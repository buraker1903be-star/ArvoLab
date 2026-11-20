"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { yazimAsistani } from "@/app/actions/ai-yazim";
import { asistanPuanla } from "@/app/actions/ai-puan";
import { oneriTemizle } from "@/lib/ai/yazim-metni";
import { etkinOneri, kabulEdilenOneri, oneriGoster } from "@/lib/tiptap-satir-ici-oneri";
import { otomatikIzin } from "@/lib/oneri-siniri";
import { collectHeadings } from "./editor-navigation";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  SATIR İÇİ ÖNERİNİN DENETLEYİCİSİ (03.11.2026). Gösterme/kabul
  lib/tiptap-satir-ici-oneri.ts'te; burası öneriyi NE ZAMAN isteyeceğine
  karar verir ve getirir.

  İki yol:
    - Kısayol (Alt+/): her zaman, imleç nerede olursa.
    - Otomatik: yalnızca açıksa, yazma 1,8 sn durduğunda ve imleç bir
      paragrafın SONUNDAYSA. Varsayılan KAPALI: her öneri bir asistan
      hakkı (saatlik 20, lib/ai/sinirlar.ts) ve kurum kredisi harcıyor;
      kendiliğinden açık olsaydı öğrenci bir saat yazınca sohbet
      asistanını kullanamaz hâle gelirdi. Hak dolunca otomatik kapanır ve
      bir kez söylenir.

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
      cevap dönünce bir kez yeniden kurulur. Otomatik yolun kendi sıklık
      sınırı var (lib/oneri-siniri.ts): saatlik hak sohbetle ortak.
    - Editör odakta değilse (öğrenci araç çubuğuna, panele geçti)
      otomatik istek gitmez, gelen cevap da gösterilmez.
*/
const BEKLEME_MS = 1_500;
const EN_AZ_OTOMATIK = 40;
const SINIR_ANAHTARI = "arvolab:otomatik-oneri-zamanlari";

function zamanlariOku(): number[] {
  try {
    const ham = JSON.parse(window.localStorage.getItem(SINIR_ANAHTARI) ?? "[]");
    return Array.isArray(ham) ? ham.filter((z): z is number => typeof z === "number") : [];
  } catch {
    return [];
  }
}
function zamanlariYaz(zamanlar: number[]) {
  try {
    window.localStorage.setItem(SINIR_ANAHTARI, JSON.stringify(zamanlar));
  } catch {
    // Depolama kapalıysa sınır yalnızca bu sekmenin belleğinde kalır (aşağıdaki ref).
  }
}

export function useSatirIciOneri({
  editor,
  projectId,
  otomatik,
  otomatigiKapat,
}: {
  editor: Editor | null;
  projectId: string;
  otomatik: boolean;
  otomatigiKapat: () => void;
}) {
  const t = useCeviri();
  const istekte = useRef(false);
  const bekleyen = useRef(false);
  const sonKonum = useRef<string | null>(null);
  const bellekZamanlar = useRef<number[]>([]);
  const tavanSoylendi = useRef(false);
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
      if (!elle) {
        const karar = otomatikIzin([...zamanlariOku(), ...bellekZamanlar.current], Date.now());
        if (!karar.izin) {
          if (karar.neden === "saatlik" && !tavanSoylendi.current) {
            tavanSoylendi.current = true;
            showToast(
              "info",
              t({
                tr: "Otomatik öneri bu saat için duraklatıldı; asistan hakkınız sohbet için korunuyor. Alt+/ ile istemeye devam edebilirsiniz.",
                en: "Automatic suggestions are paused for this hour to save your assistant credits for chat. You can still press Alt+/.",
              }),
            );
          }
          return;
        }
        bellekZamanlar.current = karar.zamanlar;
        zamanlariYaz(karar.zamanlar);
      }
      sonKonum.current = anahtar;
      istekte.current = true;
      try {
        const bolum = collectHeadings(doc).filter((h) => h.pos < konum).at(-1)?.text ?? null;
        const cevap = await yazimAsistani({ projectId, istek: "", gorev: "tamamla", bolum, oncesi });
        if (cevap.hata) {
          if (elle) showToast("error", cevap.hata);
          else if (cevap.odemeGerekli || /hak|limit|kredi|credit/i.test(cevap.hata)) {
            otomatigiKapat();
            showToast("error", t({ tr: `Otomatik öneri kapatıldı: ${cevap.hata}`, en: `Automatic suggestions turned off: ${cevap.hata}` }));
          }
          return;
        }
        if (editor.isDestroyed || editor.state.doc !== doc) return;
        if (!elle && !editor.isFocused) return;
        const metin = oneriTemizle(cevap.metin ?? "", oncesi);
        if (!metin) {
          if (elle) showToast("error", t({ tr: "Burada önerecek bir devam bulunamadı.", en: "No continuation to suggest here." }));
          return;
        }
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
    [editor, projectId, otomatigiKapat, t],
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
      // Kabulün kendisi yeni bir öneri tetiklemesin: öğrenci okumadan zincirleme kabul eder.
      if (!transaction.docChanged || kabulEdilenOneri(transaction)) return;
      zamanlayici = setTimeout(() => void iste(false), BEKLEME_MS);
    };
    editor.on("update", guncellendi);
    return () => {
      clearTimeout(zamanlayici);
      editor.off("update", guncellendi);
    };
  }, [editor, otomatik, iste]);

  return { iste };
}
