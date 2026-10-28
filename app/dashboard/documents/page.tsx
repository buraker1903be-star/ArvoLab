import { FileText, RotateCcw, ShieldQuestion, Trash2, UploadCloud } from "lucide-react";
import { getMyProjects } from "@/app/actions/citation-check";
import {
  calismaBelgeleri,
  deleteDocumentUpload,
  getMyDocumentUploads,
  reanalyzeDocument,
  type DocumentUploadRecord,
} from "@/app/actions/document-upload";
import { runOriginalityCheck, getOriginalityChecksForDocument } from "@/app/actions/originality";
import { getLatestFeedback } from "@/app/actions/ai-feedback";
import { aiFeedbackConfigured } from "@/lib/ai-feedback";
import { similarityTone } from "@/lib/status-tone";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import { BOS_METIN_MESAJI_METIN, KISMI_METIN_UYARISI_METIN, sayfaDenetimi, surumFarki } from "@/lib/belge-kontrol";
import { calismaAdresi } from "@/lib/calisma-karti";
import Link from "next/link";
import DocumentUploadForm from "./document-upload-form";
import AiFeedbackButton from "./ai-feedback-button";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import BosDurum from "../_components/bos-durum";
import IkiKartSecim from "../_components/iki-kart-secim";
import CalismaSecici from "../_components/calisma-secici";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Belge Kontrol", en: "Document Check" }) };
}

// Belge yükleme + çözümleme (mammoth/pdf-parse), asistan geri bildirimi ve
// orijinallik taraması büyük dosyalarda varsayılan 10 saniyeyi aşabiliyor;
// aşınca kullanıcı uygulama içi hata yerine ham bir tarayıcı hatası görüyordu.
export const maxDuration = 60;

/*
  BELGE KONTROL — TEK EKRAN, İKİ KART (26.10.2026, Kaynaklar ve Analiz
  Merkezi'yle aynı düzen).

  Eskiden yükleme formu ve altında her belge için tam boy bir kart vardı;
  her kartta puan, orijinallik, asistan geri bildirimi ve silme alt alta
  duruyordu. Üç belgeli bir öğrencide sayfa metrelerce uzuyor, hangi
  sonucun hangi belgeye ait olduğu kayboluyordu.

  Şimdi solda seçili çalışmanın belgeleri (ve "Belge yükle"), sağda
  seçili belgenin sonuçları: kılavuz uygunluğu, kaynakça, orijinallik ön
  kontrolü, asistan geri bildirimi. Çalışmaya bağlanmadan yüklenmiş eski
  belgeler başlıktaki ayrı pencerede, kaybolmasınlar diye.
*/

const DURUM: Record<DocumentUploadRecord["status"], { ad: Metin; ton: string }> = {
  analyzed: { ad: { tr: "Denetlendi", en: "Checked" }, ton: "success" },
  failed: { ad: { tr: "Hata", en: "Error" }, ton: "danger" },
  processing: { ad: { tr: "İşleniyor", en: "Processing" }, ton: "neutral" },
};

/*
  Kayıttaki metinler YÜKLEYENİN dilinde (app/actions/document-upload.ts).
  Bilinen mesajlar okuyanın diline yeniden çevriliyor; tanınmayan bir
  metin (eski kayıt, beklenmeyen hata) olduğu gibi gösteriliyor.
  CIKARMA_HATASI işlemdeki sabitle aynı yazım: "use server" dosyası sabit
  dışa veremiyor.
*/
const CIKARMA_HATASI: Metin = {
  tr: "Dosyadan metin çıkarılırken bir hata oluştu.",
  en: "An error occurred while extracting text from the file.",
};
const bilinenMetin = (kayitli: string, adaylar: Metin[]) => adaylar.find((m) => m.tr === kayitli || m.en === kayitli) ?? null;

const puanTonu = (puan: number | null | undefined) =>
  puan == null ? "neutral" : puan >= 85 ? "success" : puan >= 60 ? "warning" : "danger";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ calisma?: string }>;
}) {
  const { calisma: istenen } = await searchParams;
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarih, tarihSaat } = await tarihler();
  const aiAcik = aiFeedbackConfigured();
  const [{ satirlar: calismalar, okunamadi: calismaOkunamadi }, { satirlar: sonYuklemeler }] = await Promise.all([
    getMyProjects(),
    getMyDocumentUploads(),
  ]);

  /* Adresteki çalışma listede yoksa yok sayılır; yoksa en son açılan. */
  const calisma = calismalar.find((c) => c.id === istenen) ?? calismalar[0] ?? null;
  const { satirlar: belgeler, okunamadi: belgeOkunamadi } = calisma
    ? await calismaBelgeleri(calisma.id)
    : { satirlar: [] as DocumentUploadRecord[], okunamadi: false };
  const bagsizlar = sonYuklemeler.filter((b) => !b.project_id);

  /* Orijinallik ve geri bildirim yalnızca bu çalışmanın denetlenmiş belgeleri için. */
  const denetlenen = belgeler.filter((b) => b.status === "analyzed");
  const [orijinallikler, geriBildirimler] = await Promise.all([
    Promise.all(denetlenen.map(async (b) => [b.id, await getOriginalityChecksForDocument(b.id)] as const)),
    Promise.all(denetlenen.map(async (b) => [b.id, await getLatestFeedback(b.id)] as const)),
  ]);
  /*
    "Tarama yapılmamış" ile "sonucu okuyamadım" ayrı taşınıyor: ikincisinde
    ekran taranmamış bir belge gibi görünüp kullanıcıyı temiz sanmaya
    bırakıyordu (app/actions/originality.ts).
  */
  const orijinallik = new Map(orijinallikler.map(([id, s]) => [id, { kayit: s.satirlar[0] ?? null, okunamadi: s.okunamadi }]));
  const geriBildirim = new Map(geriBildirimler);

  async function orijinallikTara(documentId: string) {
    "use server";
    const result = await runOriginalityCheck(documentId);
    return result.error ? { error: result.error } : { success: true };
  }

  async function sil(documentId: string) {
    "use server";
    return deleteDocumentUpload(documentId);
  }

  async function yenidenCozumle(documentId: string) {
    "use server";
    const sonuc = await reanalyzeDocument(documentId);
    /* Yeniden deneme de çözümleyemediyse "çözümlendi" demek yanlış olurdu. */
    const hata = sonuc.error ?? sonuc.cozumlenemedi;
    return hata ? { error: hata } : { success: true };
  }

  const ayrinti = (b: DocumentUploadRecord) => {
    const a = b.analysis;
    /* Liste yeniden eskiye sıralı: bir önceki denetlenmiş sürüm, bundan sonra gelen ilk denetlenmiş belge. */
    const onceki = belgeler.slice(belgeler.indexOf(b) + 1).find((x) => x.status === "analyzed" && x.analysis);
    const farklar = a && onceki?.analysis ? surumFarki(onceki.analysis, a, dil) : null;
    const sayfa = a?.kilavuz ? sayfaDenetimi(a.sayfaSayisi, a.kilavuz.minPages, a.kilavuz.maxPages, dil) : null;
    const hataMetni = b.error_message
      ? (() => {
          const bilinen = bilinenMetin(b.error_message, [BOS_METIN_MESAJI_METIN, CIKARMA_HATASI]);
          return bilinen ? t(bilinen) : b.error_message;
        })()
      : null;
    const metinUyarisi =
      a?.metinKismi || (a?.metinUyarisi && bilinenMetin(a.metinUyarisi, [KISMI_METIN_UYARISI_METIN]))
        ? t(KISMI_METIN_UYARISI_METIN)
        : (a?.metinUyarisi ?? null);
    const o = orijinallik.get(b.id);
    const g = geriBildirim.get(b.id);
    const sorunluKunyeler = a?.references.filter((r) => r.issues.length > 0) ?? [];
    return (
      <>
        <span className="dashboard-kicker">{tarihSaat(b.created_at)}</span>
        <h3 className="pencere-kart-baslik">{b.file_name}</h3>

        {b.status === "failed" ? (
          <>
            {hataMetni ? (
              <p className="tone-text text-base" data-tone="danger">
                {hataMetni}
              </p>
            ) : null}
            {/* Dosya depoda duruyor; çözümleme geçici bir sebepten düşmüş olabilir. */}
            <ActionForm action={yenidenCozumle.bind(null, b.id)} successMessage={t({ tr: "Belge yeniden çözümlendi.", en: "Document re-analyzed." })}>
              <button type="submit" className="projects-primary-button button-compact">
                <RotateCcw size={14} aria-hidden="true" /> {t({ tr: "Yeniden çözümle", en: "Re-analyze" })}
              </button>
            </ActionForm>
          </>
        ) : null}

        {b.status === "analyzed" && a ? (
          <>
            {metinUyarisi ? (
              <p className="alert" data-tone="warning" role="status">
                {metinUyarisi}
              </p>
            ) : null}

            {farklar && onceki ? (
              <>
                <h4 className="calisma-durum-alt">{t({ tr: "Önceki sürüme göre", en: "Compared with the previous version" })}</h4>
                <p className="muted text-sm">
                  {onceki.file_name} · {tarih(onceki.created_at)}
                </p>
                {farklar.length ? (
                  <ul className="belge-farklar">
                    {farklar.map((f) => (
                      <li key={f.metin} className="tone-text text-sm" data-tone={f.ton}>
                        {f.metin}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm">{t({ tr: "Denetlenen ölçülerde değişiklik yok.", en: "No changes in the checked measures." })}</p>
                )}
              </>
            ) : null}

            {a.referenceSectionFound ? (
              <div className="kaynakca-puan" data-tone={puanTonu(a.complianceScore)}>
                <b>{a.complianceScore ?? "—"}</b>
                <span>{t({ tr: "/100 kaynakça uyumu", en: "/100 reference list compliance" })}</span>
              </div>
            ) : (
              <p className="tone-text text-sm" data-tone="warning">
                {t({
                  tr: "Kaynakça bölümü otomatik bulunamadı; başlığın \"Kaynakça\" ya da \"Kaynaklar\" olduğundan emin olun.",
                  en: "The reference list section wasn't detected automatically; make sure its heading is \"References\" (or \"Kaynakça\").",
                })}
              </p>
            )}

            {/* Kılavuz uygunluğu: her zorunlu bölüm ayrı satır, var ya da eksik. */}
            {a.guidelineCompliance ? (
              <>
                <h4 className="calisma-durum-alt">{t({ tr: "Kılavuzdaki zorunlu bölümler", en: "Required sections in the guideline" })}</h4>
                {a.kilavuz ? (
                  <p className="muted text-sm">
                    {a.kilavuz.ad}
                    {/* Öğrencinin yüklediği kılavuz onaydan geçmedi; editördeki ayrımın aynısı. */}
                    {a.kilavuz.dogrulandi ? "" : t({ tr: " · sizin yüklediğiniz kılavuzdan çıkarıldı, onaylanmadı", en: " · extracted from the guideline you uploaded, not approved" })}
                  </p>
                ) : null}
                {a.guidelineCompliance.sections.length ? (
                  <ul className="gb-liste">
                    {a.guidelineCompliance.sections.map((s, i) => (
                      <li key={i} className="gb-satir">
                        <span className="gb-satir-govde">
                          <b>{s.section}</b>
                        </span>
                        <span className="status-pill" data-tone={s.found ? "success" : "danger"}>
                          {s.found ? t({ tr: "Var", en: "Present" }) : t({ tr: "Eksik", en: "Missing" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm">{t({ tr: "Kılavuz zorunlu bölüm tanımlamıyor.", en: "The guideline defines no required sections." })}</p>
                )}
                {a.guidelineCompliance.citationStyleMatches === false ? (
                  <p className="tone-text text-sm" data-tone="warning">
                    {t({
                      tr: `Kılavuz ${a.guidelineCompliance.citationStyleExpected.toUpperCase()} kaynakça sistemi bekliyor; çalışmanızda farklı bir sistem seçili.`,
                      en: `The guideline expects the ${a.guidelineCompliance.citationStyleExpected.toUpperCase()} citation system; a different system is selected in your work.`,
                    })}
                  </p>
                ) : null}
                {sayfa ? (
                  <p className="tone-text text-sm" data-tone={sayfa.ton}>
                    {sayfa.metin}
                  </p>
                ) : null}
              </>
            ) : a.kilavuzOkunamadi ? (
              <p className="tone-text text-sm" data-tone="warning">
                {t({
                  tr: "Yükleme sırasında kılavuzunuz okunamadı; zorunlu bölümler ve sayfa sınırı bu belgede denetlenmedi. Kılavuzunuz silinmedi — belgeyi yeniden yükleyin.",
                  en: "Your guideline couldn't be read during upload, so required sections and the page limit weren't checked for this document. Your guideline wasn't deleted — upload the document again.",
                })}
              </p>
            ) : calisma ? (
              <p className="muted text-sm">
                {t({
                  tr: "Bu belge bir kılavuza göre denetlenmedi; zorunlu bölümler ve sayfa sınırı bakılmadı. ",
                  en: "This document wasn't checked against a guideline; required sections and the page limit weren't checked. ",
                })}
                <Link href={calismaAdresi(calisma.id, { kilavuz: true })}>{t({ tr: "Çalışmanıza kılavuz ekleyin", en: "Add a guideline to your work" })}</Link>
                {t({ tr: ", sonra belgeyi yeniden yükleyin.", en: ", then upload the document again." })}
              </p>
            ) : null}

            {a.referenceSectionFound ? (
              <>
                <h4 className="calisma-durum-alt">{t({ tr: "Kaynakça", en: "Reference list" })}</h4>
                <ul className="gb-liste">
                  {[
                    { ad: t({ tr: "Biçim sorunu olan künye", en: "References with formatting issues" }), sayi: sorunluKunyeler.length },
                    { ad: t({ tr: "Metinde atfı olmayan kaynak", en: "Sources not cited in the text" }), sayi: a.crossCheck.referencesWithoutCitation.length },
                    { ad: t({ tr: "Kaynakçada karşılığı olmayan atıf", en: "Citations missing from the reference list" }), sayi: a.crossCheck.citationsWithoutReference.length },
                  ].map((satir) => (
                    <li key={satir.ad} className="gb-satir">
                      <span className="gb-satir-govde">
                        <b>{satir.ad}</b>
                      </span>
                      <span className="status-pill" data-tone={satir.sayi ? "warning" : "success"}>
                        {satir.sayi || t({ tr: "Yok", en: "None" })}
                      </span>
                    </li>
                  ))}
                </ul>
                {sorunluKunyeler.length ? (
                  <details className="analiz-betik">
                    <summary>{t({ tr: "Sorunlu künyeleri göster", en: "Show references with issues" })}</summary>
                    <ul className="belge-kunye-listesi">
                      {sorunluKunyeler.map((r, i) => (
                        <li key={i}>
                          <span className="muted">{r.raw}</span>
                          {r.issues.map((sorun, j) => (
                            <small key={j} className="tone-text" data-tone={sorun.severity === "error" ? "danger" : "warning"}>
                              {sorun.message}
                            </small>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {a.crossCheck.referencesWithoutCitation.length ? (
                  <details className="analiz-betik">
                    <summary>{t({ tr: "Metinde atfı olmayan kaynaklar", en: "Sources not cited in the text" })}</summary>
                    <ul className="belge-kunye-listesi">
                      {a.crossCheck.referencesWithoutCitation.map((r, i) => (
                        <li key={i} className="muted">
                          {r.raw}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {a.crossCheck.citationsWithoutReference.length ? (
                  <details className="analiz-betik">
                    <summary>{t({ tr: "Kaynakçada karşılığı olmayan atıflar", en: "Citations missing from the reference list" })}</summary>
                    {/* Aynı atıf metinde birkaç kez geçebilir; liste her birini bir kez gösterir. */}
                    <ul className="belge-kunye-listesi">
                      {[...new Set(a.crossCheck.citationsWithoutReference.map((c) => c.raw))].map((raw) => (
                        <li key={raw} className="muted">
                          {raw}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : null}

            <h4 className="calisma-durum-alt">{t({ tr: "ArvoLab ön kontrolü (orijinallik)", en: "ArvoLab originality pre-check" })}</h4>
            {o?.kayit ? (
              <>
                <p className="tone-text text-sm" data-tone={similarityTone(o.kayit.overall_similarity)}>
                  {t({
                    tr: `En yüksek örtüşme %${o.kayit.overall_similarity} (${o.kayit.compared_document_count} belgeyle karşılaştırıldı)`,
                    en: `Highest overlap ${o.kayit.overall_similarity}% (compared with ${o.kayit.compared_document_count} ${o.kayit.compared_document_count === 1 ? "document" : "documents"})`,
                  })}
                </p>
                {o.kayit.matches.slice(0, 3).map((m, i) => (
                  <p key={i} className="muted text-sm">
                    {t({ tr: `%${m.similarity}`, en: `${m.similarity}%` })} — {m.fileName}
                    {m.sampleOverlap ? t({ tr: ` · örnek: "${m.sampleOverlap}"`, en: ` · sample: "${m.sampleOverlap}"` }) : ""}
                  </p>
                ))}
              </>
            ) : o?.okunamadi ? (
              <p className="alert" data-tone="warning" role="alert">
                {t({
                  tr: "Orijinallik sonucu okunamadı. Taranmadığı ya da temiz çıktığı anlamına gelmez — sayfayı yenileyin.",
                  en: "The originality result couldn't be loaded. That doesn't mean it wasn't scanned or came back clean — refresh the page.",
                })}
              </p>
            ) : null}
            <ActionForm action={orijinallikTara.bind(null, b.id)} successMessage={t({ tr: "Orijinallik taraması tamamlandı.", en: "Originality pre-check completed." })}>
              <button type="submit" className="projects-filter-button button-compact">
                <ShieldQuestion size={14} aria-hidden="true" /> {o?.kayit ? t({ tr: "Yeniden tara", en: "Scan again" }) : t({ tr: "Ön kontrolü çalıştır", en: "Run pre-check" })}
              </button>
            </ActionForm>
            <p className="hint">
              {t({
                tr: "Yalnızca erişiminiz olan ArvoLab belge havuzuyla karşılaştırır; Turnitin'in yerini tutmaz.",
                en: "Compares only against the ArvoLab document pool you have access to; it isn't a substitute for Turnitin.",
              })}
            </p>

            <AiFeedbackButton
              documentId={b.id}
              initialFeedback={g?.kayit?.feedback_text ?? null}
              okunamadi={g?.okunamadi ?? false}
              configured={aiAcik}
            />
          </>
        ) : null}

        <ActionForm
          action={sil.bind(null, b.id)}
          className="mt-sm"
          confirmMessage={t({
            tr: `"${b.file_name}" belgesini silmek istediğinize emin misiniz? Dosya, denetim sonuçları, orijinallik taramaları ve asistan geri bildirimleri kalıcı olarak silinir.`,
            en: `Are you sure you want to delete "${b.file_name}"? The file, check results, originality scans and assistant feedback will be permanently deleted.`,
          })}
          successMessage={t({ tr: "Belge silindi.", en: "Document deleted." })}
        >
          <button type="submit" className="link-button">
            <Trash2 size={14} aria-hidden="true" /> {t({ tr: "Belgeyi sil", en: "Delete document" })}
          </button>
        </ActionForm>
      </>
    );
  };

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Belge Kontrol", en: "Document Check" })}</h1>
          <p>
            {calisma
              ? t({
                  tr: `“${calisma.title}” çalışmasının belgeleri. Word ya da PDF dosyanızı yükleyin; kılavuz uygunluğu, kaynakça ve örtüşme denetlenir. İçerik üretilmez.`,
                  en: `Documents for “${calisma.title}”. Upload your Word or PDF file; guideline compliance, the reference list and overlap are checked. No content is generated.`,
                })
              : t({
                  tr: "Tez ya da makale dosyanızı (.docx/.pdf) yükleyin; kılavuz uygunluğu, kaynakça ve örtüşme denetlenir.",
                  en: "Upload your thesis or article file (.docx/.pdf); guideline compliance, the reference list and overlap are checked.",
                })}
          </p>
        </div>
        <div className="pencere-dugmeler">
          {bagsizlar.length ? (
            <PanelDrawer
              triggerLabel={t({ tr: "Bağlı olmayan belgeler", en: "Unlinked documents" })}
              triggerClassName="projects-filter-button button-compact"
              kicker={t({ tr: "Belge Kontrol", en: "Document Check" })}
              title={t({ tr: "Çalışmaya bağlı olmayan belgeler", en: "Documents not linked to a work" })}
              description={t({
                tr: "Eski Belge Kontrol sayfasında çalışma seçilmeden yüklenmiş belgeler. Gerekmiyorsa silin; yeni belgeyi çalışmanıza yükleyin.",
                en: "Documents uploaded on the old Document Check page without selecting a work. Delete them if you don't need them; upload new documents to your work.",
              })}
              boy="genis"
              basaridaKapan={false}
            >
              <ul className="gb-liste">
                {bagsizlar.map((b) => (
                  <li key={b.id} className="gb-satir">
                    <span className="gb-satir-govde">
                      <b>{b.file_name}</b>
                      <small>
                        {[b.project_title, tarih(b.created_at), b.analysis?.referenceSectionFound ? `${b.analysis.complianceScore}/100` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <ActionForm
                      action={sil.bind(null, b.id)}
                      confirmMessage={t({ tr: `"${b.file_name}" belgesi kalıcı olarak silinsin mi?`, en: `Permanently delete "${b.file_name}"?` })}
                      successMessage={t({ tr: "Belge silindi.", en: "Document deleted." })}
                    >
                      <button type="submit" className="projects-filter-button button-compact" aria-label={t({ tr: `${b.file_name}: sil`, en: `${b.file_name}: delete` })}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </PanelDrawer>
          ) : null}
          {calisma ? <CalismaSecici calismalar={calismalar} secili={calisma.id} yol="/dashboard/documents" /> : null}
        </div>
      </section>

      {calismaOkunamadi || belgeOkunamadi ? (
        <p className="alert" role="alert">
          {calismaOkunamadi
            ? t({
                tr: "Çalışma listeniz okunamadı; aşağısı eksik görünebilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.",
                en: "Couldn't load your list of works; what's below may look incomplete. Your records are safe — refresh the page.",
              })
            : t({
                tr: "Belge listeniz okunamadı; aşağısı eksik görünebilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.",
                en: "Couldn't load your documents; what's below may look incomplete. Your records are safe — refresh the page.",
              })}
        </p>
      ) : null}

      {calisma ? (
        <IkiKartSecim
          /* Yeni yüklenen belge listenin başına gelir; anahtar değişince o seçili açılır. */
          key={`${calisma.id}-${belgeler[0]?.id ?? ""}`}
          sayfa
          solBaslik={belgeler.length ? `${t({ tr: "Belgeler", en: "Documents" })} · ${belgeler.length}` : t({ tr: "Belgeler", en: "Documents" })}
          solUst={
            <PanelDrawer
              triggerLabel={t({ tr: "Belge yükle", en: "Upload document" })}
              triggerIcon={<UploadCloud size={16} aria-hidden="true" />}
              triggerClassName={belgeler.length ? "projects-filter-button button-compact" : "projects-primary-button button-compact"}
              kicker={t({ tr: "Belge Kontrol", en: "Document Check" })}
              title={t({ tr: "Belge yükleyin", en: "Upload a document" })}
              description={t({
                tr: "Tezinizin ya da makalenizin Word (.docx) veya PDF dosyası, en fazla 20 MB. Dosya yalnızca sizin ve yetkili rollerin görebileceği şekilde saklanır.",
                en: "The Word (.docx) or PDF file of your thesis or article, up to 20 MB. The file is stored so that only you and authorized roles can see it.",
              })}
            >
              <DocumentUploadForm projects={[calisma]} secilenCalisma={calisma.id} gomulu />
            </PanelDrawer>
          }
          secenekler={belgeler.map((b) => ({
            id: b.id,
            satir: (
              <>
                <span className="kanit-kayit-govde">
                  <b>{b.file_name}</b>
                  <small>
                    {tarih(b.created_at)}
                    {b.status === "analyzed" && b.analysis?.referenceSectionFound ? ` · ${b.analysis.complianceScore}/100` : ""}
                  </small>
                </span>
                <span className="status-pill" data-tone={DURUM[b.status].ton}>
                  {t(DURUM[b.status].ad)}
                </span>
              </>
            ),
            ayrinti: ayrinti(b),
          }))}
          bos={
            <span>
              <FileText size={20} aria-hidden="true" />
              <br />
              {t({
                tr: "Henüz belge yüklemediniz. \"Belge yükle\" ile tezinizin Word ya da PDF dosyasını ekleyin; kılavuz uygunluğu, kaynakça ve örtüşme sonuçları burada görünür.",
                en: "You haven't uploaded any documents yet. Use \"Upload document\" to add your thesis's Word or PDF file; guideline compliance, reference list and overlap results will appear here.",
              })}
            </span>
          }
        />
      ) : (
        <BosDurum
          ikon={FileText}
          baslik={t({ tr: "Önce bir çalışma başlatın", en: "Start a work first" })}
          aciklama={t({
            tr: "Belgeler bir çalışmaya bağlı denetlenir: kılavuzun zorunlu bölümleri ve kaynakça sistemi o çalışmadan gelir.",
            en: "Documents are checked within a work: the guideline's required sections and the citation system come from that work.",
          })}
          eylem={{ etiket: t({ tr: "Yeni çalışma", en: "New work" }), href: "/dashboard/editor?yeni=1" }}
        />
      )}
    </main>
  );
}
