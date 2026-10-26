"use client";

import { useEffect, useState } from "react";
import Dialog from "@/app/dashboard/_components/dialog";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { analizTezeEklendi, calismaAnalizleri, type CalismaAnalizi } from "@/app/actions/analiz-sonuclari";
import { analizEtiketi } from "@/lib/analiz-turleri";
import { trTarih } from "@/lib/tr-time";

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
  const [analizler, setAnalizler] = useState<CalismaAnalizi[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let iptal = false;
    void (async () => {
      const liste = await calismaAnalizleri(projectId);
      if (!iptal) setAnalizler(liste);
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
      sonuc.error ? `Sonuç eklendi ama sırada işaretlenemedi: ${sonuc.error}` : "Analiz sonucu eklendi. Yorumunu kendi cümlenizle yazın.",
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
                {analizEtiketi(a.analiz_turu)} · {trTarih(a.created_at)}
                {a.teze_eklendi ? ` · teze eklendi ${trTarih(a.teze_eklendi)}` : ""}
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
      kicker="Analiz"
      title="Analiz sonucu ekle"
      description="Seçtiğiniz sonuç imlecin olduğu yere eklenir. Bulgunun yorumunu kendi cümlenizle yazın."
    >
      <div className="stack">
        {analizler === null ? (
          <p className="muted text-sm" aria-busy="true">Analizler yükleniyor…</p>
        ) : analizler.length === 0 ? (
          <p className="muted text-sm">
            Bu çalışmaya kaydedilmiş analiz yok. Çalışmalarım&apos;da çalışma kartındaki &quot;Analiz&quot; düğmesinden
            verinizi analiz edip sonucu teze ekleme sırasına koyun.
          </p>
        ) : (
          <>
            <h3 className="result-heading">{sirada.length ? `Teze eklenecekler · ${sirada.length}` : "Sırada sonuç yok"}</h3>
            {sirada.length ? liste(sirada) : null}
            {digerleri.length ? (
              <>
                <h3 className="result-heading">Diğer analizler</h3>
                {liste(digerleri)}
              </>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}
