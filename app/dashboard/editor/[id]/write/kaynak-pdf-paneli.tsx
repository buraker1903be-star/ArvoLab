"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Editor } from "@tiptap/react";
import { BookOpenCheck, FileText, Loader2, Quote, ShieldCheck, Sparkles, X } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { goruntuleyiciKaynaklari, kaynakSecimiDogrula } from "@/app/actions/kaynak-pdf";
import { kaynaklaSohbet, type KaynakSohbetYaniti } from "@/app/actions/ai-kaynak-sohbeti";
import { getLiteratureSources, type LiteratureSource } from "@/app/actions/literature";
import { kunyeBasligi, type KaynakPdfSatiri } from "@/lib/kaynak-pdf";
import { kaynakEslesmesi, SECIM_EN_KISA, type KaynakEslesmesi } from "@/lib/pdf-secim";
import type { KaynakMesaji } from "@/lib/ai/kaynak-sohbeti";
import type { PdfSecimi } from "./pdf-goruntuleyici";

/*
  KAYNAK PDF PANELİ — YAZIM STÜDYOSU (16.11.2026). Tek yolculuk:
  Kaynaklar → PDF aç → editörün yanında oku → pasaj seç → Arvo AI ile
  analiz et → doğrulanmış atfı kullanıcı onayıyla ekle.

  Yeni bir AI sistemi YOK: analiz mevcut "kaynakla sohbet" yeteneğinin
  (app/actions/ai-kaynak-sohbeti.ts) aynısı — aynı abonelik ve hak kapısı,
  aynı kayıt, aynı ret kuralları (alıntı kaynakta birebir, sayı kaynakta).
  Cevap panelde kalır, belgeye kendiliğinden girmez (AGENTS.md).

  Atıf mevcut yoldan girer (manuscript-editor.tsx handleCite → CSL/stil,
  kaynakça, dipnot): bu panel yalnızca HANGİ kaynakla ve hangi basılı
  sayfayla çağrılacağına karar verir. Kaynak eşleşmesi lib/pdf-secim.ts:
  DOI ile tek kayıt → kesin; aksi hâlde adaylar gösterilir ve kullanıcı
  açıkça seçip onaylamadan atıf eklenmez. Sayfa numarasını kullanıcı yazar:
  PDF'in sayfa sırası, makalenin basılı sayfa numarası değildir.

  Belgeye girebilecek tek kaynak metni ALINTI'dır ve o da istemcinin
  seçimi değil, sunucunun PDF metninden doğruladığı kanonik parçadır.
  Asistanın yazdığı metin belgeye bu panelden eklenmez; bu yüzden asistan
  izi gerekmiyor (eklenen alıntı kaynağın kendi sözü, asistanın değil).
*/

const PdfGoruntuleyici = dynamic(() => import("./pdf-goruntuleyici"), { ssr: false });

type Analiz = { soru: string; yanit: KaynakSohbetYaniti };
type AtifDurumu =
  | { adim: "dogrulaniyor" }
  | { adim: "hazir"; alinti: string; pdfSayfa: number; eslesme: KaynakEslesmesi; kaynaklar: LiteratureSource[] }
  | { adim: "hata"; mesaj: string };

const ozet = (metin: string, uzunluk = 180) => (metin.length > uzunluk ? `${metin.slice(0, uzunluk).trimEnd()}…` : metin);

export default function KaynakPdfPaneli({
  editor,
  projectId,
  acik,
  onKapat,
  onCite,
}: {
  editor: Editor;
  projectId: string;
  acik: boolean;
  onKapat: () => void;
  onCite: (source: LiteratureSource, secenek: { sayfa?: string | null }) => Promise<void>;
}) {
  const t = useCeviri();
  const [liste, setListe] = useState<KaynakPdfSatiri[] | null>(null);
  const [listeHatasi, setListeHatasi] = useState<string | null>(null);
  const [pdfId, setPdfId] = useState<string>("");
  const [secim, setSecim] = useState<PdfSecimi | null>(null);
  const [gidilecek, setGidilecek] = useState<{ sayfa: number; anahtar: number } | null>(null);
  const [soru, setSoru] = useState("");
  const [analizler, setAnalizler] = useState<Analiz[]>([]);
  const [soruluyor, setSoruluyor] = useState(false);
  const [atif, setAtif] = useState<AtifDurumu | null>(null);
  const [secilenKaynak, setSecilenKaynak] = useState<string>("");
  const [onay, setOnay] = useState(false);
  const [basiliSayfa, setBasiliSayfa] = useState("");
  const [alintiEkle, setAlintiEkle] = useState(true);
  const [ekleniyor, setEkleniyor] = useState(false);

  useEffect(() => {
    if (!acik || liste) return;
    let iptal = false;
    void goruntuleyiciKaynaklari(projectId).then((sonuc) => {
      if (iptal) return;
      if ("hata" in sonuc) {
        setListeHatasi(sonuc.hata);
        return;
      }
      setListe(sonuc.satirlar);
      if (sonuc.satirlar.length) setPdfId((onceki) => onceki || sonuc.satirlar[0].id);
    });
    return () => {
      iptal = true;
    };
  }, [acik, liste, projectId]);

  const pdf = useMemo(() => liste?.find((r) => r.id === pdfId) ?? null, [liste, pdfId]);

  const pdfDegisti = (id: string) => {
    setPdfId(id);
    setSecim(null);
    setAnalizler([]);
    setAtif(null);
  };

  /* Görüntüleyici seçim bildirdiğinde: yeni seçim önceki atıf adımını sıfırlar. */
  const secimGeldi = useCallback((yeni: PdfSecimi | null) => {
    setSecim(yeni);
    setAtif(null);
  }, []);

  const sor = async (e?: FormEvent, hazirSoru?: string) => {
    e?.preventDefault();
    if (!pdf || soruluyor) return;
    const metin = (hazirSoru ?? soru).trim();
    if (metin.length < 3) return;
    setSoruluyor(true);
    const gecmis: KaynakMesaji[] = analizler.flatMap((a) => (a.yanit.cevap ? [{ rol: "kullanici" as const, metin: a.soru }, { rol: "asistan" as const, metin: a.yanit.cevap }] : [])).slice(-6);
    try {
      const yanit = await kaynaklaSohbet({ projectId, pdfId: pdf.id, soru: metin, gecmis, secim: secim && secim.metin.length >= SECIM_EN_KISA ? secim : null });
      setAnalizler((onceki) => [...onceki, { soru: metin, yanit }]);
      if (!yanit.hata) setSoru("");
    } catch {
      setAnalizler((onceki) => [...onceki, { soru: metin, yanit: { hata: t({ tr: "Asistana ulaşılamadı; tekrar deneyin.", en: "Couldn't reach the assistant; try again." }) } }]);
    } finally {
      setSoruluyor(false);
    }
  };

  const atifBaslat = async () => {
    if (!pdf || !secim) return;
    setAtif({ adim: "dogrulaniyor" });
    setSecilenKaynak("");
    setOnay(false);
    setBasiliSayfa("");
    const [dogrulama, kutuphane] = await Promise.all([
      kaynakSecimiDogrula({ projectId, pdfId: pdf.id, sayfa: secim.sayfa, metin: secim.metin }),
      getLiteratureSources(),
    ]);
    if ("hata" in dogrulama) {
      setAtif({ adim: "hata", mesaj: dogrulama.hata });
      return;
    }
    if (kutuphane.okunamadi) {
      setAtif({ adim: "hata", mesaj: t({ tr: "Literatür kütüphaneniz okunamadı; sayfayı yenileyip tekrar deneyin.", en: "Your Literature library couldn't be read; refresh and try again." }) });
      return;
    }
    const eslesme = kaynakEslesmesi({ doi: pdf.doi, baslik: kunyeBasligi(pdf.kunye) || pdf.kunye }, kutuphane.satirlar, projectId);
    if (eslesme.tur === "kesin") setSecilenKaynak(eslesme.kaynakId);
    setAtif({ adim: "hazir", alinti: dogrulama.metin, pdfSayfa: dogrulama.sayfa, eslesme, kaynaklar: kutuphane.satirlar });
  };

  const atifEkle = async () => {
    if (atif?.adim !== "hazir" || ekleniyor) return;
    const kaynak = atif.kaynaklar.find((k) => k.id === secilenKaynak);
    if (!kaynak) return;
    if (atif.eslesme.tur !== "kesin" && !onay) return;
    setEkleniyor(true);
    try {
      if (alintiEkle) editor.chain().focus().insertContent(`“${atif.alinti}” `).run();
      await onCite(kaynak, { sayfa: basiliSayfa.trim() || null });
      setAtif(null);
      setSecim(null);
      window.getSelection()?.removeAllRanges();
      // Dar ekranda panel tam ekran: ekleme bitince öğrenci yazdığı yere döner.
      if (window.matchMedia("(max-width: 1180px)").matches) onKapat();
    } finally {
      setEkleniyor(false);
    }
  };

  if (!acik) return null;

  const eslesmeMetni = (e: KaynakEslesmesi): string => {
    if (e.tur === "kesin") return t({ tr: "Kaynak DOI ile Literatür kütüphanenizdeki tek kayıtla eşleşti.", en: "The source matched a single record in your Literature library by DOI." });
    if (e.neden === "doi_coklu") return t({ tr: "Bu DOI kütüphanenizde birden çok kayıtta var. Hangisi olduğunu seçin.", en: "This DOI appears in several records in your library. Choose which one it is." });
    if (e.tur === "belirsiz")
      return t({
        tr: "Kaynak kesin olarak eşleşmedi (DOI yok ya da kütüphanede bulunamadı). Başlığı benzeyen kayıtlar aşağıda; doğru olanı kendiniz seçip onaylayın.",
        en: "The source didn't match with certainty (no DOI or not found in your library). Records with similar titles are below; choose and confirm the right one yourself.",
      });
    return t({
      tr: "Bu PDF'in kaynağı Literatür kütüphanenizde bulunamadı. Önce kaynağı Literatür'e ekleyin; sonra atfı buradan ekleyebilirsiniz.",
      en: "This PDF's source wasn't found in your Literature library. Add the source to Literature first; then you can insert the citation here.",
    });
  };

  return (
    <aside className="kaynak-pdf-paneli" aria-label={t({ tr: "Kaynak PDF", en: "Source PDF" })}>
      <header className="yazim-paneli-bas">
        <span>
          <FileText size={16} aria-hidden="true" />
          <b>{t({ tr: "Kaynak PDF", en: "Source PDF" })}</b>
        </span>
        <button type="button" className="yazim-ikon" onClick={onKapat} aria-label={t({ tr: "Kaynak panelini kapat", en: "Close source panel" })}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      {listeHatasi ? (
        <p className="pdf-durum" role="alert">{listeHatasi}</p>
      ) : !liste ? (
        <p className="pdf-durum" role="status">
          <Loader2 size={16} className="spin" aria-hidden="true" /> {t({ tr: "Kaynaklar yükleniyor…", en: "Loading sources…" })}
        </p>
      ) : liste.length === 0 ? (
        <p className="pdf-durum">
          {t({
            tr: "Bu çalışmada PDF'i olan kaynak yok. Kaynakça kontrolünde \"PDF'leri bul\" ile açık erişimli PDF'leri getirin ya da kendi PDF'inizi yükleyin.",
            en: "No source in this work has a PDF yet. Use \"Find PDFs\" in the reference check to fetch open-access PDFs, or upload your own.",
          })}
        </p>
      ) : (
        <>
          <label className="kaynak-pdf-secici">
            <span>{t({ tr: "Kaynak", en: "Source" })}</span>
            <select value={pdfId} onChange={(e) => pdfDegisti(e.target.value)}>
              {liste.map((r) => (
                <option key={r.id} value={r.id}>
                  {ozet(r.kunye, 110)}
                </option>
              ))}
            </select>
          </label>

          {pdf ? <PdfGoruntuleyici pdfId={pdf.id} gidilecekSayfa={gidilecek} onSecim={secimGeldi} /> : null}

          <div className="kaynak-pdf-alt">
            {secim ? (
              <section className="kaynak-secim" aria-label={t({ tr: "Seçili pasaj", en: "Selected passage" })}>
                <p className="kaynak-secim-metin">
                  <span className="kaynak-etiket">{t({ tr: `PDF s. ${secim.sayfa}`, en: `PDF p. ${secim.sayfa}` })}</span> “{ozet(secim.metin)}”
                </p>
                {secim.metin.length < SECIM_EN_KISA ? (
                  <small>{t({ tr: "Analiz ve alıntı için biraz daha uzun bir pasaj seçin.", en: "Select a slightly longer passage to analyse or quote it." })}</small>
                ) : (
                  <div className="kaynak-secim-eylem">
                    <button type="button" className="yazim-hizli-dugme" disabled={soruluyor} onClick={() => void sor(undefined, t({ tr: "Bu pasajın ana iddiasını, dayandığı kanıtı ve sınırlılığını açıkla.", en: "Explain this passage's main claim, its evidence and its limitations." }))}>
                      <Sparkles size={14} aria-hidden="true" /> {t({ tr: "Arvo AI ile analiz et", en: "Analyse with Arvo AI" })}
                    </button>
                    <button type="button" className="yazim-hizli-dugme" disabled={atif?.adim === "dogrulaniyor"} onClick={() => void atifBaslat()}>
                      <Quote size={14} aria-hidden="true" /> {t({ tr: "Alıntı ve atıf ekle", en: "Insert quote and citation" })}
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <p className="kaynak-ipucu">{t({ tr: "PDF'ten bir pasaj seçin: Arvo AI'a sorabilir ya da doğrulanmış alıntı ve atıf olarak ekleyebilirsiniz.", en: "Select a passage in the PDF: ask Arvo AI about it or insert it as a verified quote and citation." })}</p>
            )}

            {atif ? (
              <section className="kaynak-atif" aria-live="polite" aria-label={t({ tr: "Atıf ekle", en: "Insert citation" })}>
                {atif.adim === "dogrulaniyor" ? (
                  <p role="status">
                    <Loader2 size={14} className="spin" aria-hidden="true" /> {t({ tr: "Seçim PDF metninde doğrulanıyor…", en: "Verifying the selection against the PDF text…" })}
                  </p>
                ) : atif.adim === "hata" ? (
                  <p role="alert" className="kaynak-hata">{atif.mesaj}</p>
                ) : (
                  <>
                    <p className="kaynak-dogrulandi">
                      <ShieldCheck size={14} aria-hidden="true" /> {t({ tr: `Alıntı PDF'in ${atif.pdfSayfa}. sayfasında doğrulandı.`, en: `Quote verified on PDF page ${atif.pdfSayfa}.` })}
                    </p>
                    {/* Eklenecek metin, kaynaktan kesilen hâliyle: öğrenci onaylamadan önce görmeli. */}
                    <blockquote className="kaynak-alinti-onizleme">“{atif.alinti}”</blockquote>
                    <p className="kaynak-eslesme" data-tur={atif.eslesme.tur}>{eslesmeMetni(atif.eslesme)}</p>
                    {atif.eslesme.tur === "kesin" ? (
                      <p className="kaynak-secilen">{atif.kaynaklar.find((k) => k.id === secilenKaynak)?.title}</p>
                    ) : atif.eslesme.tur === "belirsiz" ? (
                      <fieldset className="kaynak-adaylar">
                        <legend className="sr-only">{t({ tr: "Aday kaynaklar", en: "Candidate sources" })}</legend>
                        {atif.eslesme.adaylar.map((id) => {
                          const k = atif.kaynaklar.find((x) => x.id === id);
                          return k ? (
                            <label key={id} className="kaynak-aday">
                              <input type="radio" name="kaynak-aday" value={id} checked={secilenKaynak === id} onChange={() => setSecilenKaynak(id)} />
                              <span>
                                {k.title}
                                {k.year ? ` (${k.year})` : ""}
                              </span>
                            </label>
                          ) : null;
                        })}
                        <label className="kaynak-onay">
                          <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} />
                          <span>{t({ tr: "Bu PDF'in seçtiğim kaynak olduğunu kontrol ettim.", en: "I've checked that this PDF is the source I selected." })}</span>
                        </label>
                      </fieldset>
                    ) : null}
                    {atif.eslesme.tur !== "yok" ? (
                      <>
                        <label className="kaynak-sayfa">
                          <span>{t({ tr: "Basılı sayfa (isteğe bağlı)", en: "Printed page (optional)" })}</span>
                          <input value={basiliSayfa} onChange={(e) => setBasiliSayfa(e.target.value.slice(0, 20))} inputMode="text" placeholder={t({ tr: "ör. 214", en: "e.g. 214" })} />
                          <small>
                            {t({
                              tr: `PDF'in ${atif.pdfSayfa}. sayfası. Makalenin basılı sayfa numarası farklı olabilir; numarayı makalenin kendi sayfasından yazın.`,
                              en: `PDF page ${atif.pdfSayfa}. The article's printed page number may differ; type the number shown on the article's page.`,
                            })}
                          </small>
                        </label>
                        <label className="kaynak-onay">
                          <input type="checkbox" checked={alintiEkle} onChange={(e) => setAlintiEkle(e.target.checked)} />
                          <span>{t({ tr: "Doğrulanmış alıntıyı da ekle", en: "Also insert the verified quote" })}</span>
                        </label>
                        <button type="button" className="projects-primary-button" disabled={ekleniyor || !secilenKaynak || (atif.eslesme.tur !== "kesin" && !onay)} onClick={() => void atifEkle()}>
                          <BookOpenCheck size={16} aria-hidden="true" /> {t({ tr: "İmlece ekle", en: "Insert at cursor" })}
                        </button>
                      </>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}

            <section className="kaynak-analiz" aria-label={t({ tr: "Arvo AI kaynak analizi", en: "Arvo AI source analysis" })}>
              <div className="kaynak-analiz-liste" aria-live="polite">
                {analizler.map((a, i) => (
                  <article key={i} className="kaynak-analiz-oge">
                    <p className="kaynak-soru">{a.soru}</p>
                    {a.yanit.hata ? (
                      <p role="alert" className="kaynak-hata">{a.yanit.hata}</p>
                    ) : (
                      <>
                        <p className="kaynak-cevap">{a.yanit.cevap}</p>
                        {a.yanit.alintilar?.length ? (
                          <ul className="kaynak-alintilar">
                            {a.yanit.alintilar.map((al, j) => (
                              <li key={j}>
                                <button type="button" className="result-link" onClick={() => setGidilecek({ sayfa: al.sayfa, anahtar: Date.now() })}>
                                  {t({ tr: `PDF s. ${al.sayfa}`, en: `PDF p. ${al.sayfa}` })}
                                </button>{" "}
                                “{ozet(al.metin, 240)}”
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {a.yanit.kunye ? <small className="kaynak-kunye">{t({ tr: "Kaynak:", en: "Source:" })} {ozet(a.yanit.kunye, 160)}</small> : null}
                        {a.yanit.krediUyarisi ? <small>{a.yanit.krediUyarisi}</small> : null}
                      </>
                    )}
                  </article>
                ))}
              </div>
              <form className="yazim-girdi" onSubmit={(e) => void sor(e)}>
                <label className="sr-only" htmlFor="kaynak-pdf-soru">
                  {t({ tr: "Kaynağa sor", en: "Ask the source" })}
                </label>
                <textarea
                  id="kaynak-pdf-soru"
                  rows={2}
                  value={soru}
                  onChange={(e) => setSoru(e.target.value.slice(0, 1000))}
                  // Yazım asistanıyla aynı: Enter gönderir, Shift+Enter yeni satır.
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={secim ? t({ tr: "Seçili pasaj hakkında sorun…", en: "Ask about the selected passage…" }) : t({ tr: "Bu kaynağa sorun…", en: "Ask this source…" })}
                />
                <button type="submit" className="projects-primary-button" disabled={soruluyor || soru.trim().length < 3}>
                  {soruluyor ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                  <span className="sr-only">{t({ tr: "Sor", en: "Ask" })}</span>
                </button>
              </form>
              <p className="yazim-bos-not">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>
                  {t({
                    tr: "Arvo AI yalnızca bu PDF'in metnine dayanır; alıntısı PDF'te birebir geçmeyen ya da PDF'te olmayan sayı içeren cevap gösterilmez. Cevaplar belgenize kendiliğinden girmez.",
                    en: "Arvo AI relies only on this PDF's text; answers whose quotes aren't in the PDF word for word, or that contain numbers not in the PDF, are not shown. Answers never enter your document by themselves.",
                  })}
                </span>
              </p>
            </section>
          </div>
        </>
      )}
    </aside>
  );
}
