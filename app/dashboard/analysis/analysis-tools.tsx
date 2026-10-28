"use client";

import { asistanCagir } from "@/lib/asistan-istemci";
import { useState, useTransition } from "react";
import Link from "next/link";
import { detectStatistics, type DetectedStatistic } from "@/lib/stats-interpreter";
import { VARSAYILAN_BICIM, type BicimKarari } from "@/lib/sayi-bicimi";
import { parseCodebook, type CodebookCheckResult } from "@/lib/codebook-check";
import { analizDenetle, type AnalizDenetimYaniti } from "@/app/actions/ai-analiz";
import AsistanSonuc from "../_components/asistan-sonuc";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

type Calisma = { id: string; title: string; sayiBicimi?: BicimKarari };

export default function AnalysisTools({
  asistanAcik,
  calismalar = [],
  secilenCalisma = "",
}: {
  asistanAcik: boolean;
  calismalar?: Calisma[];
  /* Çalışma merkezinden gelindiyse o çalışma hazır seçili gelir; kullanıcı
     aynı seçimi her sayfada yeniden yapmasın (lib/calisma-ozeti.ts adım
     bağlantıları ?calisma=<id> taşıyor). */
  secilenCalisma?: string;
}) {
  const t = useCeviri();
  const dil = useDil();
  const [statsInput, setStatsInput] = useState("");
  const [statsResult, setStatsResult] = useState<DetectedStatistic[] | null>(null);

  // Asistan denetimi: tespit edilen istatistikler + çalışmanın kısa bağlamı.
  const [arastirmaSorusu, setArastirmaSorusu] = useState("");
  const [orneklem, setOrneklem] = useState("");
  const [calismaId, setCalismaId] = useState(secilenCalisma);

  /*
    Çalışma seçilmemişse varsayılan biçim uygulanır (APA geleneği) ve
    bu AÇIKÇA SÖYLENİR; kullanıcı istatistiği yapıştırmadan önce
    kendi kılavuzunun başka bir şey isteyebileceğini bilmeli.
  */
  const seciliCalisma = calismalar.find((c) => c.id === calismaId);
  const bicim: BicimKarari = seciliCalisma?.sayiBicimi ?? { ...VARSAYILAN_BICIM, kaynak: "varsayilan" };
  const ornek = `${bicim.bastakiSifir ? "0" : ""}${bicim.ayirici === "comma" ? "," : "."}021`;
  const bicimNotu =
    !seciliCalisma
      ? t({
          tr: `Çalışma seçilmedi; sayılar varsayılan biçimle yazılacak (örnek p = ${ornek}). Kendi kılavuzunuzun biçimi için aşağıdan çalışmanızı seçin.`,
          en: `No project selected; numbers will be written in the default style (e.g. p = ${ornek}). Select your project below to use your guideline's style.`,
        })
      : bicim.kaynak === "kilavuz"
        ? t({
            tr: `Sayılar “${seciliCalisma.title}” kılavuzuna göre yazılacak (örnek p = ${ornek}).`,
            en: `Numbers will be written according to the guideline of “${seciliCalisma.title}” (e.g. p = ${ornek}).`,
          })
        : bicim.kaynak === "atif-sistemi"
          ? t({
              tr: `Kılavuz sayı biçimini belirtmiyor; atıf sisteminin geleneği uygulanacak (örnek p = ${ornek}).`,
              en: `The guideline does not specify a number style; the citation style's convention will be used (e.g. p = ${ornek}).`,
            })
          : t({
              tr: `Kılavuz ve atıf sistemi bilinmiyor; varsayılan biçim uygulanacak (örnek p = ${ornek}).`,
              en: `Neither the guideline nor the citation style is known; the default style will be used (e.g. p = ${ornek}).`,
            });
  const [denetim, setDenetim] = useState<AnalizDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();

  // zorla=true: kayıtlı cevap atlanır, modele yeniden sorulur.
  function denetle(zorla: boolean) {
    if (!statsResult) return;
    basla(async () => {
      setDenetim(null);
      setDenetim(
        await asistanCagir(() => analizDenetle({
          istatistikMetni: statsInput,
          apaSatirlari: statsResult.map((s) => s.apaSentenceFragment),
          arastirmaSorusu,
          orneklem,
          projectId: calismaId || null,
          zorla,
        }), dil),
      );
    });
  }

  const [codebookInput, setCodebookInput] = useState("");
  const [codebookResult, setCodebookResult] = useState<CodebookCheckResult | null>(null);

  return (
    <div className="stack">
      {/* SPSS Çıktısı -> APA Biçimlendirici */}
      <section className="project-form-card">
        <div className="project-form-heading">
          <h2>{t({ tr: "SPSS Çıktısı → APA 7 Biçimlendirici", en: "SPSS Output → APA 7 Formatter" })}</h2>
          <p>
            {t({
              tr: "SPSS'ten kopyaladığınız istatistik değerlerini (t, F, r, χ²) yapıştırın; sistem bunları APA 7 raporlama biçimine çevirir. Yeni analiz yapmaz, yorum üretmez — yalnızca biçimlendirir ve anlamlılık eşiğini (p < .05) mekanik olarak işaretler.",
              en: "Paste the statistics you copied from SPSS (t, F, r, χ²); they are converted to APA 7 reporting style. No new analysis is run and nothing is interpreted — values are only formatted and the significance threshold (p < .05) is flagged mechanically.",
            })}
          </p>
        </div>

        <div className="project-form-grid">
          <label className="project-form-full">
            <span>{t({ tr: "SPSS çıktısı (serbest metin)", en: "SPSS output (free text)" })}</span>
            <textarea
              rows={6}
              placeholder={"t(28) = 2.45, p = .021\nF(2, 57) = 4.31, p = .018\nr(48) = .42, p = .003"}
              value={statsInput}
              onChange={(e) => setStatsInput(e.target.value)}
            />
          </label>
        </div>

        {/*
          SAYININ YAZILIŞI SEÇİLİ ÇALIŞMANIN KILAVUZUNDAN gelir ve
          hangi kaynaktan geldiği EKRANDA YAZAR. Eskiden biçim APA'ya
          sabitti; kılavuzu "0,021" diyen öğrenci ".021" alıyor ve
          bunun neden böyle olduğunu hiçbir yerde göremiyordu.
          Varsayılana sessizce düşmek, o hatanın aynısı olurdu.
        */}
        <p className="muted text-sm mt-sm">
          {bicimNotu}
        </p>

        <div className="project-form-actions mt-sm">
          <button
            type="button"
            className="projects-primary-button"
            onClick={() => setStatsResult(detectStatistics(statsInput, bicim, dil))}
            disabled={!statsInput.trim()}
          >
            {t({ tr: "İstatistikleri Tespit Et", en: "Detect statistics" })}
          </button>
        </div>

        {statsResult && (
          <div className="mt-md">
            {statsResult.length === 0 ? (
              <p className="muted text-base">
                {t({
                  tr: "Tanınabilir bir istatistik ifadesi bulunamadı. Desteklenen biçimler: t(df) = ..., p = ...; F(df1, df2) = ..., p = ...; r = ..., p = ...; χ²(df) = ..., p = ...",
                  en: "No recognisable statistic was found. Supported formats: t(df) = ..., p = ...; F(df1, df2) = ..., p = ...; r = ..., p = ...; χ²(df) = ..., p = ...",
                })}
              </p>
            ) : (
              <ul className="result-list">
                {statsResult.map((s, i) => (
                  <li key={i}>
                    <span className="muted">{s.raw}</span>
                    <br />
                    {/*
                      Üç durum var, iki değil: null = "bu ifadeden
                      belirlenemiyor" ("p < .10" gibi bir üst sınır).
                      Onu "warning" ile göstermek, anlamsız çıkmış bir
                      sonuçla karıştırmak olurdu.
                    */}
                    <strong
                      className="tone-text"
                      data-tone={s.significant === true ? "success" : s.significant === false ? "warning" : "neutral"}
                    >
                      {s.apaSentenceFragment}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {statsResult && statsResult.length > 0 && (
          <div className="asistan-kart mt-md">
            <div className="asistan-kart-ust">
              <h3>{t({ tr: "Asistan denetlesin", en: "Ask the assistant to review" })}</h3>
              <p>
                {t({
                  tr: "Asistan raporlamayı denetler: eksik etki büyüklüğü, eksik serbestlik derecesi, p değeri biçimi, varsayımlar. Metninizi yazmaz ve bulgunuzu yorumlamaz; size verilmeyen hiçbir sayıyı da üretemez — ürettiği anda cevap gösterilmez.",
                  en: "The assistant reviews your reporting: missing effect sizes, missing degrees of freedom, p-value format, assumptions. It does not write your text or interpret your finding, and it cannot produce any number you did not give it — if it does, the response is not shown.",
                })}
              </p>
            </div>

            <div className="project-form-grid">
              <label>
                <span>{t({ tr: "Araştırma sorusu (isteğe bağlı)", en: "Research question (optional)" })}</span>
                <input
                  type="text"
                  maxLength={2000}
                  placeholder={t({ tr: "İki öğretim yöntemi arasında başarı farkı var mı?", en: "Is there a difference in achievement between two teaching methods?" })}
                  value={arastirmaSorusu}
                  onChange={(e) => setArastirmaSorusu(e.target.value)}
                />
              </label>
              <label>
                <span>{t({ tr: "Örneklem (isteğe bağlı)", en: "Sample (optional)" })}</span>
                <input
                  type="text"
                  maxLength={2000}
                  placeholder={t({ tr: "N = 60, iki bağımsız grup", en: "N = 60, two independent groups" })}
                  value={orneklem}
                  onChange={(e) => setOrneklem(e.target.value)}
                />
              </label>
              {/* Alan adı panelin geri kalanıyla aynı ("Bağlı çalışma
                  (opsiyonel)"); burada "Çalışma (isteğe bağlı)" yazıyordu ve
                  aynı seçici sayfadan sayfaya başka adla çıkıyordu. */}
              {calismalar.length > 0 ? (
                <label>
                  <span>{t({ tr: "Bağlı çalışma (opsiyonel)", en: "Linked project (optional)" })}</span>
                  <select value={calismaId} onChange={(e) => setCalismaId(e.target.value)}>
                    <option value="">{t({ tr: "Bağlı değil", en: "Not linked" })}</option>
                    {calismalar.map((calisma) => (
                      <option key={calisma.id} value={calisma.id}>{calisma.title}</option>
                    ))}
                  </select>
                </label>
              ) : (
                /* Eskiden alan sessizce yok oluyordu: kullanıcı denetimin bir
                   çalışmaya bağlanabildiğini hiç öğrenmiyordu. */
                <p className="hint project-form-full">
                  {t({
                    tr: "Kayıtlı çalışmanız yok. Bir çalışma açarsanız denetim, o çalışmanın başlığını ve alanını da bağlam olarak kullanır.",
                    en: "You have no saved projects. If you create one, the review also uses that project's title and field as context.",
                  })}{" "}
                  <Link href="/dashboard/editor/new" className="result-link">
                    {t({ tr: "Çalışma oluştur →", en: "Create project →" })}
                  </Link>
                </p>
              )}
            </div>

            {/*
          SAYININ YAZILIŞI SEÇİLİ ÇALIŞMANIN KILAVUZUNDAN gelir ve
          hangi kaynaktan geldiği EKRANDA YAZAR. Eskiden biçim APA'ya
          sabitti; kılavuzu "0,021" diyen öğrenci ".021" alıyor ve
          bunun neden böyle olduğunu hiçbir yerde göremiyordu.
          Varsayılana sessizce düşmek, o hatanın aynısı olurdu.
        */}
        <p className="muted text-sm mt-sm">
          {bicimNotu}
        </p>

        <div className="project-form-actions mt-sm">
              <button
                type="button"
                className="projects-primary-button"
                disabled={!asistanAcik || bekleniyor}
                onClick={() => denetle(false)}
              >
                {bekleniyor ? t({ tr: "Denetleniyor…", en: "Reviewing…" }) : t({ tr: "Raporlamayı Denetle", en: "Review reporting" })}
              </button>
            </div>

            {!asistanAcik && (
              <p className="asistan-uyari" data-tone="neutral">
                {t({
                  tr: "Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.",
                  en: "The assistant is disabled in this installation; your administrator needs to configure the AI key.",
                })}
              </p>
            )}

            <AsistanSonuc
              sonuc={denetim}
              yetenek="analiz"
              etiketler={{ uyari: t({ tr: "Eksik", en: "Missing" }), oneri: t({ tr: "Öneri", en: "Suggestion" }), bilgi: t({ tr: "Not", en: "Note" }) }}
              bulguBasligi={t({ tr: "Denetim bulguları", en: "Review findings" })}
              bekleniyor={bekleniyor}
              onYenidenSorgula={() => denetle(true)}
            />
          </div>
        )}
      </section>

      {/* MAXQDA Kod Kitabı Kontrolü */}
      <section className="project-form-card">
        <div className="project-form-heading">
          <h2>{t({ tr: "MAXQDA Kod Kitabı Kalite Kontrolü", en: "MAXQDA Codebook Quality Check" })}</h2>
          <p>
            {t({
              tr: "Kod listenizi (her satıra bir kod, isteğe bağlı olarak frekansıyla birlikte) yapıştırın. Sistem tekrar eden kod adlarını, tek kullanımlık kodları ve frekans dağılımını gösterir. Yeni tema veya kod önermez — yalnızca liste kalitesini denetler.",
              en: "Paste your code list (one code per line, optionally with its frequency). Duplicate code names, single-use codes and the frequency distribution are shown. No new themes or codes are suggested — only the quality of the list is checked.",
            })}
          </p>
        </div>

        <div className="project-form-grid">
          <label className="project-form-full">
            <span>{t({ tr: "Kod listesi", en: "Code list" })}</span>
            <textarea
              rows={6}
              placeholder={t({ tr: "Motivasyon eksikliği: 15\nÖğretmen desteği: 8\nZaman yönetimi: 1", en: "Lack of motivation: 15\nTeacher support: 8\nTime management: 1" })}
              value={codebookInput}
              onChange={(e) => setCodebookInput(e.target.value)}
            />
          </label>
        </div>

        {/*
          SAYININ YAZILIŞI SEÇİLİ ÇALIŞMANIN KILAVUZUNDAN gelir ve
          hangi kaynaktan geldiği EKRANDA YAZAR. Eskiden biçim APA'ya
          sabitti; kılavuzu "0,021" diyen öğrenci ".021" alıyor ve
          bunun neden böyle olduğunu hiçbir yerde göremiyordu.
          Varsayılana sessizce düşmek, o hatanın aynısı olurdu.
        */}
        <p className="muted text-sm mt-sm">
          {bicimNotu}
        </p>

        <div className="project-form-actions mt-sm">
          <button
            type="button"
            className="projects-primary-button"
            onClick={() => setCodebookResult(parseCodebook(codebookInput))}
            disabled={!codebookInput.trim()}
          >
            {t({ tr: "Kod Kitabını Kontrol Et", en: "Check codebook" })}
          </button>
        </div>

        {codebookResult && (
          <div className="mt-md text-base">
            {/*
              "Toplam kodlama" yalnızca frekansı BİLİNEN kodları topluyor.
              Eskiden bu söylenmiyordu: dört kodun frekansı verilmemişken de
              sayı "toplam" diye sunuluyor, kullanıcı kısmi bir toplamı
              bütün sanıyordu.
            */}
            <p>
              <strong>{codebookResult.totalCodes}</strong> {t({ tr: "kod", en: "codes" })}
              {codebookResult.emptyFrequencyCodes.length === 0 ? (
                <>
                  {" · "}
                  <strong>{codebookResult.totalFrequency}</strong> {t({ tr: "toplam kodlama", en: "total codings" })}
                </>
              ) : codebookResult.emptyFrequencyCodes.length < codebookResult.totalCodes ? (
                <>
                  {" · "}
                  <strong>{codebookResult.totalFrequency}</strong>{" "}
                  {t({
                    tr: `kodlama (${codebookResult.emptyFrequencyCodes.length} kodun frekansı verilmemiş, toplama girmedi)`,
                    en: `codings (${codebookResult.emptyFrequencyCodes.length} code(s) have no frequency and were not counted)`,
                  })}
                </>
              ) : (
                <> · {t({ tr: "hiçbir kodun frekansı verilmemiş", en: "no code has a frequency" })}</>
              )}
            </p>
            {codebookResult.emptyFrequencyCodes.length > 0 ? (
              <p className="hint">
                {t({ tr: "Frekans, kod adından bir ayraçla ayrılmış olmalı:", en: "The frequency must be separated from the code name by a delimiter:" })}{" "}
                <code>{t({ tr: "Kod adı: 12", en: "Code name: 12" })}</code>, <code>{t({ tr: "Kod adı (12)", en: "Code name (12)" })}</code>{" "}
                {t({
                  tr: "ya da sekme. Boşlukla ayrılmış sayı kod adının parçası sayılır — yoksa “COVID-19” kodu “COVID” adlı, frekansı 19 bir koda dönüşürdü.",
                  en: "or a tab. A number separated by a space counts as part of the code name — otherwise the code “COVID-19” would turn into a code named “COVID” with a frequency of 19.",
                })}
              </p>
            ) : null}

            {codebookResult.duplicates.length > 0 && (
              <div className="mt-sm">
                <strong className="tone-text" data-tone="danger">{t({ tr: "Tekrar eden kod adları:", en: "Duplicate code names:" })}</strong>
                <ul className="result-list">
                  {codebookResult.duplicates.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {codebookResult.singleUseCodes.length > 0 && (
              <div className="mt-sm">
                <strong className="tone-text" data-tone="warning">
                  {t({ tr: "Tek kullanımlık kodlar (birleştirme/gözden geçirme adayı):", en: "Single-use codes (candidates for merging/review):" })}
                </strong>
                <ul className="result-list">
                  {codebookResult.singleUseCodes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-sm">
              <strong>{t({ tr: "Frekans Tablosu (azalan sırada)", en: "Frequency table (descending)" })}</strong>
              <div className="table-scroll mt-sm" role="region" aria-label={t({ tr: "Frekans tablosu", en: "Frequency table" })} tabIndex={0}>
                <table className="stats-result-table">
                  <tbody>
                    {codebookResult.codes.map((c, i) => (
                      <tr key={i}>
                        <td>{c.name}</td>
                        <td>
                          {c.frequency ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
