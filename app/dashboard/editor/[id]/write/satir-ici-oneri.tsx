"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { yazimAsistani } from "@/app/actions/ai-yazim";
import { asistanPuanla } from "@/app/actions/ai-puan";
import { oneriTemizle } from "@/lib/ai/yazim-metni";
import { etkinOneri, kabulEdilenOneri, oneriGoster } from "@/lib/tiptap-satir-ici-oneri";
import { OneriOnbellegi, otomatikIstekKarari, type OneriBaglami } from "@/lib/ai/oneri-zamanlama";
import { collectHeadings } from "./editor-navigation";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  SATIR İÇİ ÖNERİNİN DENETLEYİCİSİ (03.11.2026). Gösterme/kabul
  lib/tiptap-satir-ici-oneri.ts'te; burası öneriyi NE ZAMAN isteyeceğine
  karar verir ve getirir.

  İki yol:
    - Kısayol (Alt+/): her zaman, imleç nerede olursa.
    - Otomatik: yalnızca açıksa, yazma 1,5 sn durduğunda ve imleç bir
      paragrafın SONUNDAYSA; ilk istekten sonra en az 40 yeni karakter ve
      8 sn (21.11.2026, lib/ai/oneri-zamanlama.ts). Aynı bağlam için
      önbellekteki öneri istek atılmadan gösterilir. Varsayılan KAPALI: her öneri bir asistan
      hakkı (saatlik 20, lib/ai/sinirlar.ts) ve kurum kredisi harcıyor;
      kendiliğinden açık olsaydı öğrenci bir saat yazınca sohbet
      asistanını kullanamaz hâle gelirdi. Hak dolunca öneri "duraklatıldı"
      durumuna geçer ve bunu düğmede söyler (aşağıda ÖNERİNİN DURUMU).

  Cevap geldiğinde belge değişmişse (öğrenci yazmaya devam etti) öneri
  gösterilmez: eski konuma ait öneri yanlış yere düşerdi.

  20.11.2026 düzeltmeleri (canlıda "Öneri çalışmıyor" şikâyeti):
    - Alt+/ konumu tuşa basıldığı ANDA okuyordu. ProseMirror imleci
      selectionchange ile SONRADAN günceller: öğrenci tıklayıp hemen
      Alt+/'a basınca istek eski konumla gidiyor, cevap gelince
      oneriGoster konum tutmadığı için öneriyi sessizce düşürüyordu
      (sunucu cevabı vermiş, ekranda hiçbir şey yok). Okuma bir sonraki
      göreve ertelendi.
    - Otomatik yol 80 karakterden önce hiç çalışmıyordu; ilk cümlesini
      yazan öğrenci hiçbir şey görmüyordu. Eşik 40.
    - Otomatik istek uçuştayken gelen yeni duraksama yutuluyordu; artık
      cevap dönünce bir kez yeniden kurulur. Sıklık sınırı sunucuda
      (app/actions/ai-yazim.ts): saatlik hak sohbetle ortak.
    - Editör odakta değilse (öğrenci araç çubuğuna, panele geçti)
      otomatik istek gitmez, gelen cevap da gösterilmez.
*/
const BEKLEME_MS = 1_500;
const EN_AZ_OTOMATIK = 40;
/*
  ÖNERİNİN DURUMU (20.11.2026). Sınır artık SUNUCUDA (app/actions/ai-yazim.ts):
  abonelik, deneme, kredi, kullanıcı başına saatlik asistan hakkı ve
  tamamlamaya özgü en az aralık. Eskiden istemcide sabit bir "saatte 12"
  vardı (localStorage) ve hak dolunca otomatik mod sessizce kapanıyordu;
  öğrenci düğmeyi açık sanıp öneri bekliyordu. Şimdi sunucunun nedeni
  görünür bir duruma çevrilir: düğme "duraklatıldı" der, nedenini ve
  (saatlik hakta) ne zaman açılacağını söyler; Alt+/ aynı mesajı gösterir.
*/
export type OneriDurumu = { tur: "hazir" } | { tur: "duraklatildi"; neden: "saatlik" | "kapi" | "deneme"; mesaj: string; bitis: number | null };

export function useSatirIciOneri({
  editor,
  projectId,
  otomatik,
  belgeDili,
  atifStili,
}: {
  editor: Editor | null;
  projectId: string;
  otomatik: boolean;
  /** Önbellek anahtarına girer: başka dildeki ya da stildeki öneri gösterilmez. */
  belgeDili: string;
  atifStili: string;
}) {
  const t = useCeviri();
  const istekte = useRef(false);
  /* Sıklık kuralı ve önbellek: lib/ai/oneri-zamanlama.ts (gerekçe orada). */
  const sonIstek = useRef<number | null>(null);
  const yeniKarakter = useRef(0);
  const bekleZamanlayici = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onbellek = useRef<OneriOnbellegi | null>(null);
  const bekleyen = useRef(false);
  const sonKonum = useRef<string | null>(null);
  const [durum, setDurum] = useState<OneriDurumu>({ tur: "hazir" });
  const durumRef = useRef<OneriDurumu>({ tur: "hazir" });
  // Kalan süre yazısı için "şimdi": render saf kalsın diye olayda ve zamanlayıcıda güncellenir.
  const [simdi, setSimdi] = useState(0);
  const durumuKur = useCallback((d: OneriDurumu) => {
    durumRef.current = d;
    setDurum(d);
    setSimdi(Date.now());
  }, []);
  // Bekleyen turu kuran zamanlayıcı en güncel iste'yi çağırsın (kendi içinden çağrı yerine).
  const isteRef = useRef<(elle: boolean) => Promise<void>>(async () => undefined);

  const iste = useCallback(
    async (elle: boolean): Promise<void> => {
      if (!editor || editor.isDestroyed) return;
      if (istekte.current) {
        // Uçuştaki istek bitince yeniden denenir (otomatik yol); elle istek ikinciyi göndermez.
        if (!elle) bekleyen.current = true;
        return;
      }
      const d = durumRef.current;
      if (d.tur === "duraklatildi") {
        if (d.bitis !== null && Date.now() >= d.bitis) durumuKur({ tur: "hazir" });
        else {
          // Duraklatılmışken otomatik istek gitmez; elle istek nedenini SÖYLER (sessizce bozuk görünmesin).
          if (elle) showToast("error", d.mesaj);
          return;
        }
      }
      if (!elle && (!editor.isFocused || etkinOneri(editor.state))) return;
      const { selection, doc } = editor.state;
      if (!selection.empty) return;
      const $bas = selection.$head;
      if ($bas.parent.type.name !== "paragraph") return;
      if (!elle && $bas.parentOffset !== $bas.parent.content.size) return;
      const konum = selection.head;
      const oncesi = doc.textBetween(Math.max(0, konum - 4_000), konum, "\n\n");
      if (oncesi.trim().length < (elle ? 10 : EN_AZ_OTOMATIK)) {
        if (elle) showToast("error", t({ tr: "Öneri için biraz daha yazın.", en: "Write a little more for a suggestion." }));
        return;
      }
      // Otomatik yol aynı yer için ikinci kez istemez (öğrenci öneriyi Esc ile reddetmiş olabilir).
      const anahtar = `${konum}:${oncesi.slice(-60)}`;
      if (!elle && sonKonum.current === anahtar) return;
      const bolum = collectHeadings(doc).filter((h) => h.pos < konum).at(-1)?.text ?? null;
      const baglam: OneriBaglami = { calisma: projectId, belgeDili, atifStili, bolum, konum, oncesi };
      const ob = (onbellek.current ??= new OneriOnbellegi());
      /*
        Önbellek: bağlamın TAMAMI aynıysa (çalışma, dil, stil, bölüm, imleç,
        imleçten önceki metin) istek atılmaz; öneri yine yalnızca süsleme
        olarak gösterilir, belgeye girmesi kullanıcının kabulüdür.
      */
      const kayitli = ob.al(baglam);
      if (kayitli) {
        sonKonum.current = anahtar;
        const tr = oneriGoster(editor.state, { konum, metin: kayitli.metin, kayit: kayitli.kayit });
        if (tr) editor.view.dispatch(tr);
        return;
      }
      if (!elle) {
        const karar = otomatikIstekKarari({ simdi: Date.now(), sonIstek: sonIstek.current, yeniKarakter: yeniKarakter.current });
        if (karar.tur === "yok") return;
        if (karar.tur === "bekle") {
          clearTimeout(bekleZamanlayici.current);
          bekleZamanlayici.current = setTimeout(() => void isteRef.current(false), karar.ms);
          return;
        }
      }
      sonKonum.current = anahtar;
      sonIstek.current = Date.now();
      yeniKarakter.current = 0;
      istekte.current = true;
      try {
        const cevap = await yazimAsistani({ projectId, istek: "", gorev: "tamamla", bolum, oncesi });
        if (cevap.hata) {
          const sinir = cevap.sinir;
          if (sinir?.tur === "aralik") {
            // En az aralık: kısa süre sonra kendiliğinden yeniden denenir; elle istekte söylenir.
            sonKonum.current = null;
            if (elle) showToast("info", cevap.hata);
            else window.setTimeout(() => void isteRef.current(false), (sinir.tekrarSaniye ?? 3) * 1000 + 200);
            return;
          }
          if (sinir) {
            const bitis = sinir.tur === "saatlik" && typeof sinir.tekrarSaniye === "number" ? Date.now() + sinir.tekrarSaniye * 1000 : null;
            durumuKur({ tur: "duraklatildi", neden: sinir.tur, mesaj: cevap.hata, bitis });
            showToast(elle ? "error" : "info", t({ tr: `Öneriler duraklatıldı: ${cevap.hata}`, en: `Suggestions paused: ${cevap.hata}` }));
            return;
          }
          if (elle) showToast("error", cevap.hata);
          return;
        }
        if (editor.isDestroyed || editor.state.doc !== doc) return;
        if (!elle && !editor.isFocused) return;
        const metin = oneriTemizle(cevap.metin ?? "", oncesi);
        if (!metin) {
          if (elle) showToast("error", t({ tr: "Burada önerecek bir devam bulunamadı.", en: "No continuation to suggest here." }));
          return;
        }
        ob.koy(baglam, { metin, kayit: cevap.kayitId ?? null });
        const tr = oneriGoster(editor.state, { konum, metin, kayit: cevap.kayitId ?? null });
        if (tr) editor.view.dispatch(tr);
      } catch {
        if (elle) showToast("error", t({ tr: "Asistana ulaşılamadı.", en: "Couldn't reach the assistant." }));
      } finally {
        istekte.current = false;
        if (bekleyen.current) {
          bekleyen.current = false;
          // Bu arada yazıldıysa yeni konum için bir tur daha; değişmediyse aynı anahtar istek göndermez.
          window.setTimeout(() => void isteRef.current(false), BEKLEME_MS);
        }
      }
    },
    [editor, projectId, belgeDili, atifStili, durumuKur, t],
  );

  useEffect(() => {
    isteRef.current = iste;
  }, [iste]);

  // Kısayol ve kabul kaydı: her zaman.
  useEffect(() => {
    if (!editor) return;
    const tus = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        // Bir sonraki görevde oku: imleç değişikliği (selectionchange) önce işlensin.
        window.setTimeout(() => void iste(true), 0);
      }
    };
    const islem = ({ transaction }: { transaction: Parameters<typeof kabulEdilenOneri>[0] }) => {
      const kabul = kabulEdilenOneri(transaction);
      if (kabul?.kayit) void asistanPuanla(kabul.kayit, "faydali", "satır içi öneri kabul edildi").catch(() => undefined);
      // Sıklık kuralının "yeni karakter" sayacı: kullanıcının yazdığı metin (kabul edilen öneri sayılmaz).
      if (transaction.docChanged && !kabul) {
        for (const adim of transaction.steps) yeniKarakter.current += (adim as { slice?: { size: number } }).slice?.size ?? 0;
      }
    };
    const kok = editor.view.dom;
    kok.addEventListener("keydown", tus);
    editor.on("transaction", islem);
    return () => {
      kok.removeEventListener("keydown", tus);
      editor.off("transaction", islem);
    };
  }, [editor, iste]);

  // Otomatik: yazma durduğunda.
  useEffect(() => {
    if (!editor || !otomatik) return;
    let zamanlayici: ReturnType<typeof setTimeout> | undefined;
    const guncellendi = ({ transaction }: { transaction: Parameters<typeof kabulEdilenOneri>[0] }) => {
      clearTimeout(zamanlayici);
      clearTimeout(bekleZamanlayici.current);
      // Kabulün kendisi yeni bir öneri tetiklemesin: öğrenci okumadan zincirleme kabul eder.
      if (!transaction.docChanged || kabulEdilenOneri(transaction)) return;
      zamanlayici = setTimeout(() => void iste(false), BEKLEME_MS);
    };
    editor.on("update", guncellendi);
    return () => {
      clearTimeout(zamanlayici);
      clearTimeout(bekleZamanlayici.current);
      editor.off("update", guncellendi);
    };
  }, [editor, otomatik, iste]);

  // Saatlik hak açılınca durum kendiliğinden "hazır"a döner (düğme yazısı da).
  useEffect(() => {
    if (durum.tur !== "duraklatildi" || durum.bitis === null) return;
    const z = window.setTimeout(() => durumuKur({ tur: "hazir" }), Math.max(0, durum.bitis - Date.now()) + 500);
    const saat = window.setInterval(() => setSimdi(Date.now()), 30_000);
    return () => {
      window.clearTimeout(z);
      window.clearInterval(saat);
    };
  }, [durum, durumuKur]);
  const kalanDk = durum.tur === "duraklatildi" && durum.bitis !== null ? Math.max(1, Math.ceil((durum.bitis - simdi) / 60_000)) : null;

  /** Kullanıcı düğmeyi yeniden açınca duraklatma sıfırlanır (abonelik/kredi değişmiş olabilir). */
  const durumuSifirla = useCallback(() => durumuKur({ tur: "hazir" }), [durumuKur]);

  return { iste, durum, kalanDk, durumuSifirla };
}
