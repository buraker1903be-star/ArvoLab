"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { yazimAsistani } from "@/app/actions/ai-yazim";
import { kararKaydet } from "@/lib/ai-kararlari";
import { oneriTemizle } from "@/lib/ai/yazim-metni";
import { kabulEdilenOneri, oneriGoster } from "@/lib/tiptap-satir-ici-oneri";
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
*/
const BEKLEME_MS = 1_800;
const EN_AZ_OTOMATIK = 80;

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
  const sonKonum = useRef<string | null>(null);

  const iste = useCallback(
    async (elle: boolean) => {
      if (!editor || istekte.current) return;
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
      sonKonum.current = anahtar;
      istekte.current = true;
      try {
        const bolum = collectHeadings(doc).filter((h) => h.pos < konum).at(-1)?.text ?? null;
        const cevap = await yazimAsistani({ projectId, istek: "", gorev: "tamamla", bolum, oncesi });
        /* C2-5: istek yoldayken editör yok edildiyse (çalışma ya da bölüm değişti) sonuç yok sayılır; editöre işlem gönderilmez. */
        if (editor.isDestroyed) return;
        if (cevap.hata) {
          if (elle) showToast("error", cevap.hata);
          else if (cevap.odemeGerekli || /hak|limit|kredi|credit/i.test(cevap.hata)) {
            otomatigiKapat();
            showToast("error", t({ tr: `Otomatik öneri kapatıldı: ${cevap.hata}`, en: `Automatic suggestions turned off: ${cevap.hata}` }));
          }
          return;
        }
        if (editor.state.doc !== doc) return;
        const metin = oneriTemizle(cevap.metin ?? "", oncesi);
        if (!metin) {
          if (elle) showToast("error", t({ tr: "Burada önerecek bir devam bulunamadı.", en: "No continuation to suggest here." }));
          return;
        }
        const tr = oneriGoster(editor.state, { konum, metin, kayit: cevap.kayitId ?? null });
        if (tr) editor.view.dispatch(tr);
      } catch {
        if (editor.isDestroyed) return;
        if (elle) showToast("error", t({ tr: "Asistana ulaşılamadı.", en: "Couldn't reach the assistant." }));
      } finally {
        istekte.current = false;
      }
    },
    [editor, projectId, otomatigiKapat, t],
  );

  // Kısayol ve kabul kararı (oturumda): her zaman.
  useEffect(() => {
    if (!editor) return;
    const tus = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        void iste(true);
      }
    };
    const islem = ({ transaction }: { transaction: Parameters<typeof kabulEdilenOneri>[0] }) => {
      const kabul = kabulEdilenOneri(transaction);
      /* Kabul bir İŞLEM KARARI, memnuniyet puanı değil (4.3): kayda "faydalı" yazılmaz, yalnızca oturumda tutulur (lib/ai-kararlari.ts). */
      if (kabul) kararKaydet(kabul.kayit, "satir_ici_kabul");
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
