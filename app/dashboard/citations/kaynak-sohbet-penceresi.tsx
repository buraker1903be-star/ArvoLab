"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Copy, Quote } from "lucide-react";
import PanelDrawer from "../_components/panel-drawer";
import { kaynaklaSohbet } from "@/app/actions/ai-kaynak-sohbeti";
import { showToast } from "../_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  KAYNAKLA SOHBET PENCERESİ (03.11.2026). Öğrenci kaynağın PDF'ine soru
  sorar; cevap altında kaynaktan BİREBİR alıntılar ve PDF sayfası
  (lib/ai/kaynak-sohbeti.ts). Sayfa numarası PDF dosyasının sayfasıdır,
  derginin baskı sayfası değil: atıfta "s." yazmadan önce PDF'te
  kontrol edilmeli; ekranda bu yüzden "PDF s." yazıyor.
*/

type Alinti = { sayfa: number; metin: string };
type Kayit =
  | { rol: "kullanici"; metin: string }
  | { rol: "asistan"; metin: string; bulundu?: boolean; alintilar?: Alinti[]; okunmayanSayfa?: number; hata?: boolean };

export default function KaynakSohbetPenceresi({
  projectId,
  pdfId,
  kunye,
  acik,
  onAcikDegis,
}: {
  projectId: string;
  pdfId: string;
  kunye: string;
  acik: boolean;
  onAcikDegis: (acik: boolean) => void;
}) {
  const t = useCeviri();
  const [mesajlar, setMesajlar] = useState<Kayit[]>([]);
  const [soru, setSoru] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const listeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: "smooth" });
  }, [mesajlar, bekliyor]);

  const sor = async (metin: string) => {
    const temiz = metin.trim();
    if (!temiz || bekliyor) return;
    const gecmis = mesajlar.filter((m) => !(m.rol === "asistan" && m.hata)).map((m) => ({ rol: m.rol, metin: m.metin }));
    setMesajlar((onceki) => [...onceki, { rol: "kullanici", metin: temiz }]);
    setSoru("");
    setBekliyor(true);
    try {
      const cevap = await kaynaklaSohbet({ projectId, pdfId, soru: temiz, gecmis });
      if (cevap.hata) {
        setMesajlar((onceki) => [...onceki, { rol: "asistan", metin: cevap.hata!, hata: true }]);
        return;
      }
      if (cevap.krediUyarisi) showToast("error", cevap.krediUyarisi);
      setMesajlar((onceki) => [
        ...onceki,
        { rol: "asistan", metin: cevap.cevap ?? "", bulundu: cevap.bulundu, alintilar: cevap.alintilar, okunmayanSayfa: cevap.okunmayanSayfa },
      ]);
    } catch (hata) {
      console.error(hata);
      setMesajlar((onceki) => [...onceki, { rol: "asistan", metin: t({ tr: "Asistana ulaşılamadı; bağlantınızı kontrol edin.", en: "Couldn't reach the assistant; check your connection." }), hata: true }]);
    } finally {
      setBekliyor(false);
    }
  };

  const kopyala = async (alinti: Alinti) => {
    try {
      await navigator.clipboard.writeText(`"${alinti.metin}"`);
      showToast("success", t({ tr: `Alıntı kopyalandı (PDF s. ${alinti.sayfa}).`, en: `Quote copied (PDF p. ${alinti.sayfa}).` }));
    } catch {
      showToast("error", t({ tr: "Kopyalanamadı.", en: "Couldn't copy." }));
    }
  };

  const oneriler = [
    t({ tr: "Araştırma sorusu ve amacı nedir?", en: "What is the research question and aim?" }),
    t({ tr: "Yöntem, veri ve örneklem nedir?", en: "What are the method, data and sample?" }),
    t({ tr: "Temel bulgular nelerdir?", en: "What are the main findings?" }),
    t({ tr: "Yazarlar hangi sınırlılıkları belirtiyor?", en: "What limitations do the authors mention?" }),
  ];

  return (
    <PanelDrawer
      tetiksiz
      acik={acik}
      onAcikDegis={onAcikDegis}
      basaridaKapan={false}
      boy="genis"
      triggerLabel=""
      kicker={t({ tr: "Kaynağa sor", en: "Ask the source" })}
      title={kunye.length > 140 ? `${kunye.slice(0, 137)}…` : kunye}
      description={t({
        tr: "Cevaplar yalnızca bu PDF'ten gelir ve kaynaktan birebir alıntıyla gösterilir. Alıntı kaynakta bulunamazsa cevap gösterilmez. Sayfa, PDF dosyasının sayfasıdır; atıfta baskı sayfasını PDF'ten kontrol edin.",
        en: "Answers come only from this PDF and are shown with word-for-word quotes. If a quote can't be found in the source, the answer is withheld. Page numbers are PDF file pages; check the printed page in the PDF before citing.",
      })}
    >
      <div className="kaynak-sohbet">
        <div className="yazim-paneli-liste kaynak-sohbet-liste" ref={listeRef} aria-live="polite">
          {mesajlar.length === 0 ? (
            <div className="yazim-hizli kaynak-sohbet-oneri">
              {oneriler.map((o) => (
                <button key={o} type="button" className="yazim-hizli-dugme" onClick={() => void sor(o)} disabled={bekliyor}>
                  {o}
                </button>
              ))}
            </div>
          ) : (
            mesajlar.map((m, i) => (
              <div key={i} className="yazim-mesaj" data-rol={m.rol}>
                <p className={m.rol === "asistan" && m.hata ? "tone-text" : undefined} data-tone={m.rol === "asistan" && m.hata ? "danger" : undefined}>
                  {m.metin}
                </p>
                {m.rol === "asistan" && m.alintilar?.length
                  ? m.alintilar.map((a, j) => (
                      <blockquote key={j} className="kaynak-alinti">
                        <Quote size={14} aria-hidden="true" />
                        <span>{a.metin}</span>
                        <footer>
                          <span className="muted text-sm">{t({ tr: `PDF s. ${a.sayfa}`, en: `PDF p. ${a.sayfa}` })}</span>
                          <button type="button" className="yazim-ikon" onClick={() => void kopyala(a)} aria-label={t({ tr: "Alıntıyı kopyala", en: "Copy quote" })} title={t({ tr: "Alıntıyı kopyala", en: "Copy quote" })}>
                            <Copy size={14} aria-hidden="true" />
                          </button>
                        </footer>
                      </blockquote>
                    ))
                  : null}
                {m.rol === "asistan" && m.okunmayanSayfa ? (
                  <small className="muted">
                    {t({
                      tr: `Kaynak uzun: soruyla en ilgili sayfalar okundu, ${m.okunmayanSayfa} sayfa okunmadı.`,
                      en: `The source is long: the pages most relevant to the question were read; ${m.okunmayanSayfa} pages were not.`,
                    })}
                  </small>
                ) : null}
              </div>
            ))
          )}
          {bekliyor ? (
            <div className="yazim-mesaj" data-rol="asistan" role="status">
              <p className="muted">{t({ tr: "Kaynak okunuyor…", en: "Reading the source…" })}</p>
            </div>
          ) : null}
        </div>
        <form
          className="yazim-girdi"
          onSubmit={(e) => {
            e.preventDefault();
            void sor(soru);
          }}
        >
          <textarea
            className="field-control"
            rows={2}
            value={soru}
            maxLength={1000}
            placeholder={t({ tr: "Kaynağa bir soru sorun", en: "Ask the source a question" })}
            onChange={(e) => setSoru(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="projects-primary-button button-compact" disabled={bekliyor || !soru.trim()} aria-label={t({ tr: "Sor", en: "Ask" })}>
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </form>
      </div>
    </PanelDrawer>
  );
}
