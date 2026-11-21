"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpenText, Copy, FlaskConical, ListChecks, Quote, ShieldCheck, Sparkles, Target, TriangleAlert } from "lucide-react";
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
  /* Bekleyişi durdurma; gerekçe yazim-paneli.tsx'teki istekSira yorumunda. */
  const istekSira = useRef(0);
  const listeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: "smooth" });
  }, [mesajlar, bekliyor]);

  /* Bekleyişi durdurur; geç gelen cevap sohbete girmez. */
  const durdur = () => {
    istekSira.current += 1;
    setBekliyor(false);
    setMesajlar((onceki) => [
      ...onceki,
      {
        rol: "asistan",
        metin: t({
          tr: "Bekleme durduruldu. Asistan isteği tamamlasa bile cevap gösterilmeyecek; yeniden sorabilirsiniz.",
          en: "Stopped waiting. Even if the assistant finishes, the answer won't be shown; you can ask again.",
        }),
        hata: true,
      },
    ]);
  };

  const sor = async (metin: string) => {
    const temiz = metin.trim();
    if (!temiz || bekliyor) return;
    /* Geçmişe yalnızca metin girer, alıntılar girmez; her alıntı kendi mesajında kalır (bkz. kaynak-pdf-paneli.tsx). */
    const gecmis = mesajlar.filter((m) => !(m.rol === "asistan" && m.hata)).map((m) => ({ rol: m.rol, metin: m.metin }));
    setMesajlar((onceki) => [...onceki, { rol: "kullanici", metin: temiz }]);
    setSoru("");
    setBekliyor(true);
    const sira = ++istekSira.current;
    const guncel = () => sira === istekSira.current;
    try {
      const cevap = await kaynaklaSohbet({ projectId, pdfId, soru: temiz, gecmis });
      if (!guncel()) return;
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
      if (!guncel()) return;
      console.error(hata);
      setMesajlar((onceki) => [...onceki, { rol: "asistan", metin: t({ tr: "Asistana ulaşılamadı; bağlantınızı kontrol edin.", en: "Couldn't reach the assistant; check your connection." }), hata: true }]);
    } finally {
      if (guncel()) setBekliyor(false);
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
    { ikon: Target, soru: t({ tr: "Araştırma sorusu ve amacı nedir?", en: "What is the research question and aim?" }) },
    { ikon: FlaskConical, soru: t({ tr: "Yöntem, veri ve örneklem nedir?", en: "What are the method, data and sample?" }) },
    { ikon: ListChecks, soru: t({ tr: "Temel bulgular nelerdir?", en: "What are the main findings?" }) },
    { ikon: TriangleAlert, soru: t({ tr: "Yazarlar hangi sınırlılıkları belirtiyor?", en: "What limitations do the authors mention?" }) },
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
          {/*
            Yazım asistanıyla AYNI sohbet dili (04.11.2026): boşken başlangıç
            kartları, asistan satırı simgeli, alıntılar sayfa rozetli kartlar,
            beklerken üç nokta. Eskiden öneriler sıradan çiplerdi ve
            "Kaynak okunuyor…" düz yazıydı.
          */}
          {mesajlar.length === 0 ? (
            <div className="yazim-paneli-bos">
              <div className="yazim-bos-bas">
                <span className="yazim-bos-ikon" aria-hidden="true">
                  <BookOpenText size={18} />
                </span>
                <b>{t({ tr: "Bu kaynağa ne sormak istersiniz?", en: "What would you like to ask this source?" })}</b>
                <small>{t({ tr: "Her cevap kaynaktan birebir alıntıyla gelir.", en: "Every answer comes with a word-for-word quote from the source." })}</small>
              </div>
              <div className="yazim-baslangic kaynak-sohbet-baslangic">
                {oneriler.map((o) => (
                  <button key={o.soru} type="button" className="yazim-baslangic-kart" onClick={() => void sor(o.soru)} disabled={bekliyor}>
                    <o.ikon size={16} aria-hidden="true" />
                    <span>
                      <b>{o.soru}</b>
                    </span>
                  </button>
                ))}
              </div>
              <p className="yazim-bos-not">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>
                  {t({
                    tr: "Alıntı kaynakta birebir bulunamazsa cevap hiç gösterilmez; kaynakta olmayan bir şeyi söyletmek mümkün değil.",
                    en: "If a quote can't be found word for word in the source, the answer isn't shown at all; the source can't be made to say what it doesn't.",
                  })}
                </span>
              </p>
            </div>
          ) : (
            mesajlar.map((m, i) =>
              m.rol === "kullanici" ? (
                <div key={i} className="yazim-mesaj" data-rol="kullanici">
                  <p>{m.metin}</p>
                </div>
              ) : (
                <div key={i} className="yazim-mesaj" data-rol="asistan">
                  <div className="yazim-asistan-satir">
                    <span className="yazim-asistan-ikon" data-tone={m.hata ? "danger" : m.bulundu === false ? "warning" : undefined} aria-hidden="true">
                      {m.hata || m.bulundu === false ? <TriangleAlert size={12} /> : <Sparkles size={12} />}
                    </span>
                    <p className={m.hata ? "tone-text" : undefined} data-tone={m.hata ? "danger" : undefined}>
                      {m.metin}
                    </p>
                  </div>
                  {m.alintilar?.length
                    ? m.alintilar.map((a, j) => (
                        <blockquote key={j} className="kaynak-alinti">
                          <Quote size={14} aria-hidden="true" />
                          <span>{a.metin}</span>
                          <footer>
                            <span className="kaynak-alinti-sayfa">{t({ tr: `PDF s. ${a.sayfa}`, en: `PDF p. ${a.sayfa}` })}</span>
                            <button type="button" className="yazim-ikon" onClick={() => void kopyala(a)} aria-label={t({ tr: "Alıntıyı kopyala", en: "Copy quote" })} title={t({ tr: "Alıntıyı kopyala", en: "Copy quote" })}>
                              <Copy size={14} aria-hidden="true" />
                            </button>
                          </footer>
                        </blockquote>
                      ))
                    : null}
                  {m.okunmayanSayfa ? (
                    <small className="muted kaynak-sohbet-not">
                      {t({
                        tr: `Kaynak uzun: soruyla en ilgili sayfalar okundu, ${m.okunmayanSayfa} sayfa okunmadı.`,
                        en: `The source is long: the pages most relevant to the question were read; ${m.okunmayanSayfa} pages were not.`,
                      })}
                    </small>
                  ) : null}
                </div>
              ),
            )
          )}
          {bekliyor ? (
            <div className="yazim-mesaj" data-rol="asistan" role="status">
              <div className="yazim-asistan-satir">
                <span className="yazim-asistan-ikon" aria-hidden="true">
                  <Sparkles size={12} />
                </span>
                <span className="yazim-yaziyor" aria-label={t({ tr: "Kaynak okunuyor…", en: "Reading the source…" })}>
                  <i />
                  <i />
                  <i />
                </span>
                <button
                  type="button"
                  className="projects-filter-button button-compact"
                  onClick={durdur}
                  title={t({
                    tr: "Bekleme durur. Asistanın isteği sunucuda tamamlanabilir ama cevap gösterilmez.",
                    en: "Stops waiting. The request may still finish on the server, but the answer won't be shown.",
                  })}
                >
                  {t({ tr: "Durdur", en: "Stop" })}
                </button>
              </div>
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
