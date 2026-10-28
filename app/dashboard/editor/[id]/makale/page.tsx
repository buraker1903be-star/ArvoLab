import { trGunAnahtari } from "@/lib/tr-time";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, ListChecks, Mail, Microscope, Search, Settings2, Sparkles } from "lucide-react";
import TarihSecici from "@/app/dashboard/_components/tarih-secici";
import { createClient } from "@/lib/supabase/server";
import { makaleProfiliKaydet, makaleProfiliOku } from "@/app/actions/makale";
import { makaleAsistaniAcik } from "@/app/actions/ai-makale";
import { kanitMatrisiOku } from "@/app/actions/kanit";
import { taramaGunlugu } from "@/app/actions/literatur-arama";
import { makaleBolumleri } from "@/lib/makale/bolumler";
import { gonderimKontrolu, type MakaleProfili } from "@/lib/makale/gonderim-kontrolu";
import {
  EQUATOR_ADRESI,
  MAKALE_TURU_SIRASI,
  bolumAdi,
  makaleTuruTanimi,
  standartUyarisi,
  yontemAilesi,
  yontemDenetimi,
} from "@/lib/makale/sablonlar";
import { denetimListesi } from "@/lib/ai/makale-denetimi";
import { matrisOzeti } from "@/lib/kanit/durum";
import ActionForm from "@/app/dashboard/action-form";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import MakaleAsistani from "./makale-asistani";
import CalismaSekmeleri from "../calisma-sekmeleri";

/*
  MAKALE ÇALIŞMA ALANI.

  Tez çalışma merkezinden AYRI bir sayfa ama aynı çalışma satırı: kaynak,
  kaynakça, analiz ve kanıt matrisi ortak altyapıdan geliyor. Makaleye
  özgü olanlar burada: tür ve şablon, hedef dergi ve sınırlar, gönderim
  öncesi kontrol, bölüm denetimi ve tarama günlüğü.

  Söylenmeyenler bilerek söylenmiyor: kabul olasılığı, "dergiye uygun"
  hükmü ve derginin güncel kuralları. ArvoLab dergi bilgisini bir dizinden
  doğrulamıyor; kullanıcının kendi kontrol tarihini kaydedip
  eskidiğinde hatırlatıyor.
*/

const VARSAYILAN_PROFIL: MakaleProfili = {
  makale_turu: "ozgun",
  arastirma_sorusu: null,
  arastirma_problemi: null,
  hedef_dergi: null,
  dergi_kurallari_adresi: null,
  dergi_kurallari_kontrol: null,
  dil: "tr",
  kelime_siniri: null,
  ozet_siniri: null,
  anahtar_en_az: null,
  anahtar_en_cok: null,
  ozet: null,
  anahtar_kelimeler: [],
  veri_durumu: "yok",
  raporlama_standardi: null,
};

const MADDE_TONU = { tamam: "success", eksik: "danger", dikkat: "warning", bilgi: "info" } as const;
const MADDE_ETIKETI: Record<keyof typeof MADDE_TONU, Metin> = {
  tamam: { tr: "Tamam", en: "Done" },
  eksik: { tr: "Eksik", en: "Missing" },
  dikkat: { tr: "Bakılacak", en: "Review" },
  bilgi: { tr: "Not", en: "Note" },
};

const KAPAK_MEKTUBU: Metin[] = [
  { tr: "Derginin ve editörün adı; makalenin başlığı ve türü", en: "The journal's and editor's names; the article's title and type" },
  {
    tr: "Çalışmanın neyi ele aldığı ve alana katkısı — kendi cümlelerinizle",
    en: "What the study addresses and its contribution to the field — in your own words",
  },
  {
    tr: "Makalenin özgün olduğu ve başka bir yerde değerlendirmede olmadığı beyanı",
    en: "A statement that the article is original and not under consideration elsewhere",
  },
  { tr: "Etik kurul onayı, aydınlatılmış onam (gerekiyorsa)", en: "Ethics committee approval, informed consent (if required)" },
  { tr: "Çıkar çatışması ve finansman beyanı", en: "Conflict of interest and funding statement" },
  {
    tr: "Derginin istediği ek bilgiler (ör. önerilen hakemler, veri paylaşım beyanı)",
    en: "Additional information the journal requires (e.g., suggested reviewers, data sharing statement)",
  },
];

export default async function MakaleCalismaAlani({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sorgu] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarihSaat } = await tarihler();
  const { data: calisma, error } = await supabase
    .from("academic_projects")
    .select("id, title, project_type, research_method")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <main className="dashboard-page">
        <p className="alert" role="alert">
          {t({ tr: "Çalışma okunamadı. Kaydınız yerinde duruyor; sayfayı yenileyin.", en: "The work could not be read. Your data is safe; refresh the page." })}
        </p>
      </main>
    );
  }
  if (!calisma) notFound();

  if (calisma.project_type !== "article") {
    return (
      <main className="dashboard-page">
        <article className="resume-card">
          <span className="dashboard-kicker">{t({ tr: "Makale çalışma alanı", en: "Article workspace" })}</span>
          <div className="resume-heading">
            <h2>{t({ tr: "Bu çalışma makale türünde değil", en: "This work is not an article" })}</h2>
            <p>
              {t({
                tr: "Makale çalışma alanı makale türündeki çalışmalar içindir. Türü çalışma ayarlarından değiştirebilirsiniz.",
                en: "The article workspace is for article-type works. You can change the type in the work settings.",
              })}
            </p>
          </div>
          <div className="cluster">
            <Link href={`/dashboard/editor/${id}`} className="projects-filter-button">
              {t({ tr: "Çalışma özeti", en: "Work overview" })}
            </Link>
            <Link href={`/dashboard/editor/${id}/edit`} className="projects-filter-button">
              {t({ tr: "Çalışma ayarları", en: "Work settings" })}
            </Link>
          </div>
        </article>
      </main>
    );
  }

  const [{ profil: kayitliProfil, okunamadi: profilOkunamadi }, matris, gunluk, musvedde, asistanAcik] = await Promise.all([
    makaleProfiliOku(id),
    kanitMatrisiOku(id),
    taramaGunlugu(id, 20),
    supabase.from("project_manuscripts").select("content, updated_at").eq("project_id", id).maybeSingle(),
    makaleAsistaniAcik(),
  ]);

  const profil: MakaleProfili = kayitliProfil ?? VARSAYILAN_PROFIL;
  const tur = makaleTuruTanimi(profil.makale_turu, dil);
  const bolumler = makaleBolumleri(musvedde.data?.content, dil);
  const kanitOzeti = matrisOzeti(matris.kayitlar);
  /* Türkiye günü: UTC günü gece 00:00–03:00 arasında dünü verir ve "kontrol
     edileli N gün" bir gün eksik görünürdü. */
  const bugun = trGunAnahtari();
  const maddeler = gonderimKontrolu({ profil, bolumler, kanit: kanitOzeti, bugun }, dil);
  const aile = yontemAilesi(calisma.research_method, profil.makale_turu);
  const yontem = aile ? yontemDenetimi(aile, dil) : null;

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">
            {t({ tr: "Makale çalışma alanı", en: "Article workspace" })} · {tur.etiket}
          </span>
          <h1>{calisma.title}</h1>
          <p>
            {profil.hedef_dergi
              ? t({ tr: `Hedef: ${profil.hedef_dergi}`, en: `Target: ${profil.hedef_dergi}` })
              : t({ tr: "Hedef dergi seçilmedi", en: "No target journal selected" })}
            {profil.arastirma_sorusu ? ` · ${profil.arastirma_sorusu}` : ""}
          </p>
        </div>
        <div className="merkez-ust-eylemler">
          <PanelDrawer
            triggerLabel={
              kayitliProfil ? t({ tr: "Makale bilgileri", en: "Article details" }) : t({ tr: "Makale bilgilerini girin", en: "Enter article details" })
            }
            triggerIcon={<Settings2 size={16} aria-hidden="true" />}
            triggerClassName={kayitliProfil ? "projects-filter-button" : "projects-primary-button"}
            kicker={t({ tr: "Makale", en: "Article" })}
            title={t({ tr: "Makale bilgileri", en: "Article details" })}
            description={t({
              tr: "Tür, araştırma sorusu ve hedef derginin sınırları. Dergi bilgilerini derginin kendi sayfasından kontrol edin; ArvoLab bunları doğrulamıyor.",
              en: "Type, research question and the target journal's limits. Check the journal details on the journal's own website; ArvoLab does not verify them.",
            })}
            /* Yeni makale buraya ?dergi=1 ile geliyor (createProject): kılavuzun
               makaledeki karşılığı derginin kuralları, ilk iş onları girmek. */
            acikBasla={sorgu.dergi === "1" && !kayitliProfil}
          >
            <ActionForm className="project-form-grid" action={makaleProfiliKaydet} successMessage={t({ tr: "Makale bilgileri kaydedildi.", en: "Article details saved." })}>
              <input type="hidden" name="project_id" value={id} />
              <label>
                <span>{t({ tr: "Makale türü", en: "Article type" })}</span>
                <select name="makale_turu" defaultValue={profil.makale_turu}>
                  {MAKALE_TURU_SIRASI.map((k) => (
                    <option key={k} value={k}>{makaleTuruTanimi(k, dil).etiket}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t({ tr: "Makale dili", en: "Article language" })}</span>
                <select name="dil" defaultValue={profil.dil}>
                  <option value="tr">{t({ tr: "Türkçe", en: "Turkish" })}</option>
                  <option value="en">{t({ tr: "İngilizce", en: "English" })}</option>
                  <option value="diger">{t({ tr: "Diğer", en: "Other" })}</option>
                </select>
              </label>
              <label className="project-form-full">
                <span>{t({ tr: "Araştırma problemi", en: "Research problem" })}</span>
                <textarea name="arastirma_problemi" rows={2} maxLength={2000} defaultValue={profil.arastirma_problemi ?? ""} />
              </label>
              <label className="project-form-full">
                <span>{t({ tr: "Araştırma sorusu", en: "Research question" })}</span>
                <textarea name="arastirma_sorusu" rows={2} maxLength={1000} defaultValue={profil.arastirma_sorusu ?? ""} />
              </label>
              <label>
                <span>{t({ tr: "Araştırma tasarımı", en: "Research design" })}</span>
                <input
                  name="arastirma_tasarimi"
                  type="text"
                  maxLength={500}
                  defaultValue={kayitliProfil?.arastirma_tasarimi ?? ""}
                  placeholder={t({ tr: "Kesitsel, yarı deneysel, fenomenoloji…", en: "Cross-sectional, quasi-experimental, phenomenology…" })}
                />
              </label>
              <label>
                <span>{t({ tr: "Hedef disiplin", en: "Target discipline" })}</span>
                <input name="disiplin" type="text" maxLength={200} defaultValue={kayitliProfil?.disiplin ?? ""} />
              </label>
              <label>
                <span>{t({ tr: "Hedef dergi / yayın", en: "Target journal / venue" })}</span>
                <input name="hedef_dergi" type="text" maxLength={300} defaultValue={profil.hedef_dergi ?? ""} />
              </label>
              <label>
                <span>{t({ tr: "Yazım kuralları adresi", en: "Author guidelines URL" })}</span>
                <input name="dergi_kurallari_adresi" type="url" maxLength={1000} defaultValue={profil.dergi_kurallari_adresi ?? ""} placeholder="https://" />
              </label>
              <label>
                <span>{t({ tr: "Kuralları kontrol ettiğim tarih", en: "Date I checked the guidelines" })}</span>
                <TarihSecici name="dergi_kurallari_kontrol" deger={profil.dergi_kurallari_kontrol} etiket={t({ tr: "Kuralları kontrol ettiğim tarih", en: "Date I checked the guidelines" })} />
              </label>
              <label>
                <span>{t({ tr: "Raporlama standardı", en: "Reporting standard" })}</span>
                <input name="raporlama_standardi" type="text" maxLength={100} defaultValue={profil.raporlama_standardi ?? ""} placeholder={tur.standartlar[0]?.ad ?? ""} />
              </label>
              <label>
                <span>{t({ tr: "Kelime sınırı", en: "Word limit" })}</span>
                <input name="kelime_siniri" type="number" min={100} max={100000} defaultValue={profil.kelime_siniri ?? ""} />
              </label>
              <label>
                <span>{t({ tr: "Özet sınırı (sözcük)", en: "Abstract limit (words)" })}</span>
                <input name="ozet_siniri" type="number" min={30} max={2000} defaultValue={profil.ozet_siniri ?? ""} />
              </label>
              <label>
                <span>{t({ tr: "Anahtar kelime (en az)", en: "Keywords (minimum)" })}</span>
                <input name="anahtar_en_az" type="number" min={1} max={20} defaultValue={profil.anahtar_en_az ?? ""} />
              </label>
              <label>
                <span>{t({ tr: "Anahtar kelime (en çok)", en: "Keywords (maximum)" })}</span>
                <input name="anahtar_en_cok" type="number" min={1} max={20} defaultValue={profil.anahtar_en_cok ?? ""} />
              </label>
              <label>
                <span>{t({ tr: "Veri ve analiz durumu", en: "Data and analysis status" })}</span>
                <select name="veri_durumu" defaultValue={profil.veri_durumu}>
                  <option value="yok">{t({ tr: "Veri yok", en: "No data" })}</option>
                  <option value="toplaniyor">{t({ tr: "Veri toplanıyor", en: "Collecting data" })}</option>
                  <option value="toplandi">{t({ tr: "Veri toplandı", en: "Data collected" })}</option>
                  <option value="analiz_edildi">{t({ tr: "Analiz tamamlandı", en: "Analysis completed" })}</option>
                  <option value="gerekmiyor">{t({ tr: "Veri gerekmiyor (derleme vb.)", en: "No data needed (review, etc.)" })}</option>
                </select>
              </label>
              <label className="project-form-full">
                <span>{t({ tr: "Özet", en: "Abstract" })}</span>
                <textarea name="ozet" rows={5} maxLength={8000} defaultValue={profil.ozet ?? ""} />
              </label>
              <label className="project-form-full">
                <span>{t({ tr: "Anahtar kelimeler (virgülle ayırın)", en: "Keywords (separate with commas)" })}</span>
                <input name="anahtar_kelimeler" type="text" defaultValue={profil.anahtar_kelimeler.join(", ")} />
              </label>
              <label className="project-form-full">
                <span>{t({ tr: "Dergi kuralları notları", en: "Journal guideline notes" })}</span>
                <textarea name="dergi_kurallari_notu" rows={3} maxLength={4000} defaultValue={kayitliProfil?.dergi_kurallari_notu ?? ""} />
              </label>
              <div className="project-form-actions project-form-full">
                <button type="submit" className="projects-primary-button">{t({ tr: "Kaydet", en: "Save" })}</button>
              </div>
            </ActionForm>
          </PanelDrawer>
        </div>
      </section>

      <CalismaSekmeleri calisma={calisma} aktif="makale" />

      {profilOkunamadi && (
        <p className="alert mb-md" role="alert">
          {t({
            tr: "Makale bilgileri okunamadı; aşağıdaki kontroller varsayılanlarla hesaplandı. Sayfayı yenileyin.",
            en: "Article details could not be read; the checks below were calculated with defaults. Refresh the page.",
          })}
        </p>
      )}
      {!kayitliProfil && !profilOkunamadi && (
        <p className="callout mb-md" data-tone="accent">
          <strong>{t({ tr: "Makale bilgileri girilmedi.", en: "Article details have not been entered." })}</strong>{" "}
          {t({
            tr: "Tür, araştırma sorusu ve hedef derginin sınırlarını girdiğinizde şablon, gönderim kontrolü ve bölüm denetimi bunlara göre kurulur.",
            en: "Once you enter the type, research question and the target journal's limits, the template, submission checklist and section review are built on them.",
          })}
        </p>
      )}

      <section className="section">
        <h2 className="section-title">
          <ListChecks size={18} aria-hidden="true" /> {t({ tr: "Gönderim öncesi kontrol", en: "Pre-submission checklist" })}
        </h2>
        <p className="muted text-base">
          {t({
            tr: "Kaydedilmiş müsveddeden ve kanıt matrisinden hesaplanır. Kabul olasılığı ya da dergiye uygunluk hükmü verilmez; bunları hiçbir veri doğrulayamaz.",
            en: "Calculated from the saved manuscript and the evidence matrix. No acceptance probability or journal-fit verdict is given; no data can verify these.",
          })}
        </p>
        <ul className="asistan-bulgular mt-sm">
          {maddeler.map((m) => (
            <li className="asistan-bulgu" data-tone={MADDE_TONU[m.durum]} key={m.anahtar}>
              <span className="asistan-bulgu-etiket">{t(MADDE_ETIKETI[m.durum])}</span>
              <span className="asistan-bulgu-metin">
                <b>{m.baslik}</b>
                {m.aciklama}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/*
        ARAÇLAR KAROLARDA (26.10.2026, kurum sahibinin isteği: ArvoOS
        gibi açılır pencereler). Sayfa eskiden yedi bölümü alt alta
        diziyordu; gönderim kontrolü — makalenin asıl sorusu, "gönderebilir
        miyim" — o uzunluğun içinde kayboluyordu. Şimdi sayfada yalnızca o
        duruyor, şablon, yöntem listesi, bölüm denetimi, tarama günlüğü ve
        kapak mektubu ikinci satırında ne içerdiğini söyleyen karolar.
        Dışa aktarma karosu kalktı: "Yazım" sekmesinin kendisi.
      */}
      <section className="section">
        <h2 className="section-title">{t({ tr: "Araçlar", en: "Tools" })}</h2>
        <div className="calisma-karolari">
          <PanelDrawer
            triggerLabel={t({ tr: "Bölüm denetimi", en: "Section review" })}
            triggerNote={
              bolumler.length
                ? t({ tr: `${bolumler.length} bölüm · asistan`, en: `${bolumler.length} sections · assistant` })
                : t({ tr: "Müsveddede başlıklı bölüm yok", en: "No headed sections in the manuscript" })
            }
            triggerIcon={<Sparkles size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker={t({ tr: "Asistan", en: "Assistant" })}
            title={t({ tr: "Bölüm denetimi", en: "Section review" })}
            boy="genis"
            basaridaKapan={false}
          >
            <MakaleAsistani
              projectId={id}
              asistanAcik={asistanAcik}
              bolumler={bolumler.map((b, sira) => ({ sira, baslik: b.baslik, sozcuk: b.sozcuk, denetim: denetimListesi(b.tur, aile, dil) }))}
            />
          </PanelDrawer>

          <PanelDrawer
            triggerLabel={t({ tr: "Şablon ve bölüm planı", en: "Template and section plan" })}
            triggerNote={`${tur.etiket}${tur.standartlar.length ? ` · ${tur.standartlar.map((st) => st.ad).join(", ")}` : ""}`}
            triggerIcon={<FileText size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker={t({ tr: "Makale", en: "Article" })}
            title={t({ tr: "Şablon ve bölüm planı", en: "Template and section plan" })}
            boy="genis"
            basaridaKapan={false}
          >
            <p className="muted text-base">
              {tur.aciklama}{" "}
              {t({
                tr: "Bu bir başlangıç planıdır; hedef derginin talimatı farklı bir düzen istiyorsa dergi geçerlidir.",
                en: "This is a starting plan; if the target journal's instructions require a different structure, the journal's take precedence.",
              })}
            </p>
            <ul className="makale-plan mt-sm">
              {tur.bolumler.map((b) => {
                const metinde = bolumler.find((x) => x.tur === b);
                return (
                  <li key={b}>
                    <span>{bolumAdi(b, profil.dil)}</span>
                    <span className="status-pill" data-tone={b === "ozet" ? (profil.ozet ? "success" : "neutral") : metinde ? "success" : "neutral"}>
                      {b === "ozet"
                        ? profil.ozet
                          ? t({ tr: "Makale bilgilerinde", en: "In article details" })
                          : t({ tr: "Girilmedi", en: "Not entered" })
                        : metinde
                          ? t({ tr: `Metinde · yaklaşık ${metinde.sozcuk} sözcük`, en: `In text · about ${metinde.sozcuk} words` })
                          : t({ tr: "Metinde başlık yok", en: "No heading in text" })}
                    </span>
                  </li>
                );
              })}
            </ul>
            {tur.notlar.length > 0 && (
              <ul className="kanit-alanlar mt-sm">
                {tur.notlar.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {tur.standartlar.length > 0 && (
              <div className="callout mt-md" data-tone="accent">
                <strong>{t({ tr: "İlgili olabilecek raporlama standartları", en: "Reporting standards that may apply" })}</strong>
                <ul className="kanit-alanlar">
                  {tur.standartlar.map((s) => (
                    <li key={s.ad}>
                      <b>{s.ad}</b> — {s.kapsam}
                    </li>
                  ))}
                </ul>
                <p className="callout-body text-sm">
                  {standartUyarisi(dil)}{" "}
                  <a className="link-accent" href={EQUATOR_ADRESI} target="_blank" rel="noopener noreferrer">
                    EQUATOR Network <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </p>
              </div>
            )}
          </PanelDrawer>

          {yontem && (
            <PanelDrawer
              triggerLabel={t({ tr: "Yönteme göre kontrol listesi", en: "Method checklist" })}
              triggerNote={t({ tr: `${yontem.etiket} · ${yontem.maddeler.length} madde`, en: `${yontem.etiket} · ${yontem.maddeler.length} items` })}
              triggerIcon={<ListChecks size={18} aria-hidden="true" />}
              triggerClassName="merkez-baglanti"
              kicker={t({ tr: "Yöntem", en: "Method" })}
              title={t({ tr: `${yontem.etiket}: kontrol listesi`, en: `${yontem.etiket}: checklist` })}
              basaridaKapan={false}
            >
              <p className="muted text-base">
                {t({
                  tr: "Asistan yöntem ve bulgular bölümlerini denetlerken bu maddelere bakar. Gerçek analiz sonuçlarının yerine tahmin koymaz; analiz çıktısını Analiz modülünde denetletebilirsiniz.",
                  en: "The assistant checks these items when reviewing the methods and results sections. It never substitutes guesses for actual analysis results; you can have your analysis output reviewed in the Analysis module.",
                })}
              </p>
              <ul className="kanit-alanlar mt-sm">
                {yontem.maddeler.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </PanelDrawer>
          )}

          <PanelDrawer
            triggerLabel={t({ tr: "Literatür tarama günlüğü", en: "Literature search log" })}
            triggerNote={
              gunluk.okunamadi
                ? t({ tr: "Okunamadı", en: "Could not be read" })
                : gunluk.satirlar.length
                  ? t({ tr: `Son ${gunluk.satirlar.length} arama`, en: `Last ${gunluk.satirlar.length} searches` })
                  : t({ tr: "Bu çalışmaya bağlı arama yok", en: "No searches linked to this work" })
            }
            triggerIcon={<Search size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker={t({ tr: "Literatür", en: "Literature" })}
            title={t({ tr: "Literatür tarama günlüğü", en: "Literature search log" })}
            boy="genis"
            basaridaKapan={false}
          >
            <p className="muted text-base">
              {t({
                tr: "Bu çalışma için yapılan aramalar: sorgu, tarih, filtreler ve cevap veren dizinler. Yalnızca OpenAlex ve Crossref taranır; bu günlük taramanın kapsamını gösterir, literatürün tamamının tarandığını değil.",
                en: "Searches run for this work: query, date, filters and the indexes that responded. Only OpenAlex and Crossref are searched; this log shows the scope of the search, not that the entire literature was searched.",
              })}
            </p>
            {gunluk.okunamadi ? (
              <p className="alert mt-sm" role="alert">{t({ tr: "Tarama günlüğü okunamadı.", en: "The search log could not be read." })}</p>
            ) : gunluk.satirlar.length === 0 ? (
              <p className="muted mt-sm">{t({ tr: "Bu çalışmaya bağlı arama yok.", en: "No searches linked to this work." })}</p>
            ) : (
              <div className="kanit-matris-sarici mt-sm">
                <table className="kanit-matris">
                  <thead>
                    <tr>
                      <th>{t({ tr: "Tarih", en: "Date" })}</th>
                      <th>{t({ tr: "Sorgu", en: "Query" })}</th>
                      <th>{t({ tr: "Filtreler", en: "Filters" })}</th>
                      <th>{t({ tr: "Cevap veren dizin", en: "Responding index" })}</th>
                      <th>{t({ tr: "Gösterilen sonuç", en: "Results shown" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gunluk.satirlar.map((s) => (
                      <tr key={s.id}>
                        <td>{tarihSaat(s.olusturuldu)}</td>
                        <td className="mono">{s.sorgu}</td>
                        <td>
                          {[
                            s.filtreler.yilDan ? t({ tr: `${s.filtreler.yilDan}’den`, en: `from ${s.filtreler.yilDan}` }) : "",
                            s.filtreler.yilaKadar ? t({ tr: `${s.filtreler.yilaKadar}’e kadar`, en: `until ${s.filtreler.yilaKadar}` }) : "",
                            s.filtreler.yalnizcaAcikErisim ? t({ tr: "yalnızca açık erişim", en: "open access only" }) : "",
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </td>
                        <td>
                          {s.yanit_veren.join(", ") || t({ tr: "Hiçbiri", en: "None" })}
                          {s.ulasilamayan.length ? (
                            <small>
                              {t({ tr: "ulaşılamadı", en: "unreachable" })}: {s.ulasilamayan.join(", ")}
                            </small>
                          ) : null}
                        </td>
                        <td>{s.gosterilen_sonuc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Link href={`/dashboard/literature?calisma=${id}`} className="projects-filter-button mt-sm">
              {t({ tr: "Literatürde ara", en: "Search literature" })}
            </Link>
          </PanelDrawer>

          <Link href={`/dashboard/editor/${id}/kanit`} className="merkez-baglanti">
            <Microscope size={18} aria-hidden="true" />
            <span>
              <b>{t({ tr: "Kanıt matrisi", en: "Evidence matrix" })}</b>
              {kanitOzeti.toplam
                ? t({
                    tr: `${kanitOzeti.toplam} iddia · ${kanitOzeti.dogrudan} doğrudan · ${kanitOzeti.celisen} çelişen`,
                    en: `${kanitOzeti.toplam} claims · ${kanitOzeti.dogrudan} direct · ${kanitOzeti.celisen} contradicting`,
                  })
                : t({ tr: "Henüz iddia yok", en: "No claims yet" })}
            </span>
          </Link>

          <PanelDrawer
            triggerLabel={t({ tr: "Kapak mektubu", en: "Cover letter" })}
            triggerNote={t({ tr: "Kontrol listesi", en: "Checklist" })}
            triggerIcon={<Mail size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker={t({ tr: "Gönderim", en: "Submission" })}
            title={t({ tr: "Kapak mektubu kontrol listesi", en: "Cover letter checklist" })}
            basaridaKapan={false}
          >
            <p className="muted text-base">
              {t({
                tr: "Asistan kapak mektubu yazmaz. Derginin talimatına göre mektubunuzda bulunması gerekebilecekler:",
                en: "The assistant does not write cover letters. Depending on the journal's instructions, your letter may need to include:",
              })}
            </p>
            <ul className="kanit-alanlar mt-sm">
              {KAPAK_MEKTUBU.map((m) => (
                <li key={m.tr}>{t(m)}</li>
              ))}
            </ul>
          </PanelDrawer>
        </div>
      </section>
    </main>
  );
}
