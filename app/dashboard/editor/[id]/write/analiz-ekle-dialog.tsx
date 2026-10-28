"use client";

import { useEffect, useState } from "react";
import Dialog from "@/app/dashboard/_components/dialog";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { analizTezeEklendi, calismaAnalizleri, type CalismaAnalizi } from "@/app/actions/analiz-sonuclari";
import { analizEtiketi } from "@/lib/analiz-turleri";
import { useCeviri, useDil, useTarihler } from "@/app/_components/dil-saglayici";

/*
  "Analiz ekle" (26.10.2026): Çalışmalarım'daki Analiz penceresinde
  "Teze ekleme sırasına koy" denen sonuçlar burada listelenir; seçilen
  imlecin olduğu yere eklenir ve kayda "teze eklendi" yazılır.

  Eklenen metin hesabın KENDİSİ: ArvoLab'ın istatistik motorunun ürettiği
  sonuç satırları, olduğu gibi. Yorum cümlesi eklenmez — bulgunun ne
  anlama geldiğini öğrenci yazar (AGENTS.md: asistan denetler, yazmaz).
*/
export default function AnalizEkleDialog({
  open,
  onClose,
  projectId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Metni imlecin olduğu yere ekler; eklenemediyse false. */
  onPick: (metin: string) => boolean;
}) {
  const t = useCeviri();
  const dil = useDil();
  const { tarih } = useTarihler();
  const [analizler, setAnalizler] = useState<CalismaAnalizi[] | null>(null);
  /* Okunamadı ile "analiz yok" ayrı: eskiden arıza "kaydedilmiş analiz yok" görünüyordu. */
  const [okunamadi, setOkunamadi] = useState(false);

  useEffect(() => {
    if (!open) return;
    let iptal = false;
    void (async () => {
      const liste = await calismaAnalizleri(projectId);
      if (iptal) return;
      setOkunamadi(liste.okunamadi);
      setAnalizler(liste.satirlar);
    })();
    return () => {
      iptal = true;
    };
  }, [open, projectId]);

  const kapat = () => {
    setAnalizler(null);
    onClose();
  };

  const ekle = async (analiz: CalismaAnalizi) => {
    if (!onPick(analiz.apa_metni)) return;
    kapat();
    /* İşaretleme düşerse metin yine eklendi; yalnızca sıra listesinde kalır. Söyleniyor. */
    const sonuc = await analizTezeEklendi(analiz.id);
    showToast(
      sonuc.error ? "error" : "success",
      sonuc.error
        ? t({
            tr: `Sonuç eklendi ama sırada işaretlenemedi: ${sonuc.error}`,
            en: `The result was inserted but could not be marked in the queue: ${sonuc.error}`,
          })
        : t({
            tr: "Analiz sonucu eklendi. Yorumunu kendi cümlenizle yazın.",
            en: "Analysis result inserted. Write its interpretation in your own words.",
          }),
    );
  };

  const sirada = (analizler ?? []).filter((a) => a.teze_eklenecek && !a.teze_eklendi);
  const digerleri = (analizler ?? []).filter((a) => !(a.teze_eklenecek && !a.teze_eklendi));

  const liste = (satirlar: CalismaAnalizi[]) => (
    <ul className="picker-list">
      {satirlar.map((a) => (
        <li key={a.id}>
          <div className="picker-item">
            <button type="button" className="picker-main" onClick={() => void ekle(a)}>
              <strong>{a.baslik}</strong>
              <small>
                {analizEtiketi(a.analiz_turu, dil)} · {tarih(a.created_at)}
                {a.teze_eklendi
                  ? t({ tr: ` · teze eklendi ${tarih(a.teze_eklendi)}`, en: ` · added to thesis ${tarih(a.teze_eklendi)}` })
                  : ""}
              </small>
              <small className="analiz-apa-kisa">{a.apa_metni}</small>
            </button>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog
      open={open}
      onClose={kapat}
      kicker={t({ tr: "Analiz", en: "Analysis" })}
      title={t({ tr: "Analiz sonucu ekle", en: "Insert analysis result" })}
      description={t({
        tr: "Seçtiğiniz sonuç imlecin olduğu yere eklenir. Bulgunun yorumunu kendi cümlenizle yazın.",
        en: "The result you choose is inserted at the cursor. Write the interpretation of the finding in your own words.",
      })}
    >
      <div className="stack">
        {analizler === null ? (
          <p className="muted text-sm" aria-busy="true">{t({ tr: "Analizler yükleniyor…", en: "Loading analyses…" })}</p>
        ) : okunamadi ? (
          <p className="alert" role="alert">
            {t({
              tr: "Analizleriniz okunamadı. Kayıtlarınız yerinde duruyor — pencereyi kapatıp yeniden açın.",
              en: "Your analyses could not be read. Your data is safe — close and reopen this dialog.",
            })}
          </p>
        ) : analizler.length === 0 ? (
          <p className="muted text-sm">
            {t({
              tr: "Bu çalışmaya kaydedilmiş analiz yok. Çalışmalarım'da çalışma kartındaki \"Analiz\" düğmesinden verinizi analiz edip sonucu teze ekleme sırasına koyun.",
              en: "No analyses are saved for this work. In My Works, use the \"Analysis\" button on the work card to analyze your data and queue the result for your thesis.",
            })}
          </p>
        ) : (
          <>
            <h3 className="result-heading">
              {sirada.length
                ? t({ tr: `Teze eklenecekler · ${sirada.length}`, en: `Queued for thesis · ${sirada.length}` })
                : t({ tr: "Sırada sonuç yok", en: "No results in the queue" })}
            </h3>
            {sirada.length ? liste(sirada) : null}
            {digerleri.length ? (
              <>
                <h3 className="result-heading">{t({ tr: "Diğer analizler", en: "Other analyses" })}</h3>
                {liste(digerleri)}
              </>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}
