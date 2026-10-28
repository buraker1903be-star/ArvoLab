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
import { trTarih, trTarihSaat } from "@/lib/tr-time";
import { sayfaDenetimi, surumFarki } from "@/lib/belge-kontrol";
import { calismaAdresi } from "@/lib/calisma-karti";
import Link from "next/link";
import DocumentUploadForm from "./document-upload-form";
import AiFeedbackButton from "./ai-feedback-button";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import BosDurum from "../_components/bos-durum";
import IkiKartSecim from "../_components/iki-kart-secim";
import CalismaSecici from "../_components/calisma-secici";

export const metadata = { title: "Belge Kontrol" };

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

const DURUM: Record<DocumentUploadRecord["status"], { ad: string; ton: string }> = {
  analyzed: { ad: "Denetlendi", ton: "success" },
  failed: { ad: "Hata", ton: "danger" },
  processing: { ad: "İşleniyor", ton: "neutral" },
};

const puanTonu = (puan: number | null | undefined) =>
  puan == null ? "neutral" : puan >= 85 ? "success" : puan >= 60 ? "warning" : "danger";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ calisma?: string }>;
}) {
  const { calisma: istenen } = await searchParams;
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
    const farklar = a && onceki?.analysis ? surumFarki(onceki.analysis, a) : null;
    const sayfa = a?.kilavuz ? sayfaDenetimi(a.sayfaSayisi, a.kilavuz.minPages, a.kilavuz.maxPages) : null;
    const o = orijinallik.get(b.id);
    const g = geriBildirim.get(b.id);
    const sorunluKunyeler = a?.references.filter((r) => r.issues.length > 0) ?? [];
    return (
      <>
        <span className="dashboard-kicker">{trTarihSaat(b.created_at)}</span>
        <h3 className="pencere-kart-baslik">{b.file_name}</h3>

        {b.status === "failed" ? (
          <>
            {b.error_message ? (
              <p className="tone-text text-base" data-tone="danger">
                {b.error_message}
              </p>
            ) : null}
            {/* Dosya depoda duruyor; çözümleme geçici bir sebepten düşmüş olabilir. */}
            <ActionForm action={yenidenCozumle.bind(null, b.id)} successMessage="Belge yeniden çözümlendi.">
              <button type="submit" className="projects-primary-button button-compact">
                <RotateCcw size={14} aria-hidden="true" /> Yeniden çözümle
              </button>
            </ActionForm>
          </>
        ) : null}

        {b.status === "analyzed" && a ? (
          <>
            {a.metinUyarisi ? (
              <p className="alert" data-tone="warning" role="status">
                {a.metinUyarisi}
              </p>
            ) : null}

            {farklar && onceki ? (
              <>
                <h4 className="calisma-durum-alt">Önceki sürüme göre</h4>
                <p className="muted text-sm">
                  {onceki.file_name} · {trTarih(onceki.created_at)}
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
                  <p className="muted text-sm">Denetlenen ölçülerde değişiklik yok.</p>
                )}
              </>
            ) : null}

            {a.referenceSectionFound ? (
              <div className="kaynakca-puan" data-tone={puanTonu(a.complianceScore)}>
                <b>{a.complianceScore ?? "—"}</b>
                <span>/100 kaynakça uyumu</span>
              </div>
            ) : (
              <p className="tone-text text-sm" data-tone="warning">
                Kaynakça bölümü otomatik bulunamadı; başlığın &quot;Kaynakça&quot; ya da &quot;Kaynaklar&quot; olduğundan
                emin olun.
              </p>
            )}

            {/* Kılavuz uygunluğu: her zorunlu bölüm ayrı satır, var ya da eksik. */}
            {a.guidelineCompliance ? (
              <>
                <h4 className="calisma-durum-alt">Kılavuzdaki zorunlu bölümler</h4>
                {a.kilavuz ? (
                  <p className="muted text-sm">
                    {a.kilavuz.ad}
                    {/* Öğrencinin yüklediği kılavuz onaydan geçmedi; editördeki ayrımın aynısı. */}
                    {a.kilavuz.dogrulandi ? "" : " · sizin yüklediğiniz kılavuzdan çıkarıldı, onaylanmadı"}
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
                          {s.found ? "Var" : "Eksik"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm">Kılavuz zorunlu bölüm tanımlamıyor.</p>
                )}
                {a.guidelineCompliance.citationStyleMatches === false ? (
                  <p className="tone-text text-sm" data-tone="warning">
                    Kılavuz {a.guidelineCompliance.citationStyleExpected.toUpperCase()} kaynakça sistemi bekliyor; çalışmanızda
                    farklı bir sistem seçili.
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
                Yükleme sırasında kılavuzunuz okunamadı; zorunlu bölümler ve sayfa sınırı bu belgede denetlenmedi.
                Kılavuzunuz silinmedi — belgeyi yeniden yükleyin.
              </p>
            ) : calisma ? (
              <p className="muted text-sm">
                Bu belge bir kılavuza göre denetlenmedi; zorunlu bölümler ve sayfa sınırı bakılmadı.{" "}
                <Link href={calismaAdresi(calisma.id, { kilavuz: true })}>Çalışmanıza kılavuz ekleyin</Link>, sonra belgeyi
                yeniden yükleyin.
              </p>
            ) : null}

            {a.referenceSectionFound ? (
              <>
                <h4 className="calisma-durum-alt">Kaynakça</h4>
                <ul className="gb-liste">
                  {[
                    { ad: "Biçim sorunu olan künye", sayi: sorunluKunyeler.length },
                    { ad: "Metinde atfı olmayan kaynak", sayi: a.crossCheck.referencesWithoutCitation.length },
                    { ad: "Kaynakçada karşılığı olmayan atıf", sayi: a.crossCheck.citationsWithoutReference.length },
                  ].map((satir) => (
                    <li key={satir.ad} className="gb-satir">
                      <span className="gb-satir-govde">
                        <b>{satir.ad}</b>
                      </span>
                      <span className="status-pill" data-tone={satir.sayi ? "warning" : "success"}>
                        {satir.sayi || "Yok"}
                      </span>
                    </li>
                  ))}
                </ul>
                {sorunluKunyeler.length ? (
                  <details className="analiz-betik">
                    <summary>Sorunlu künyeleri göster</summary>
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
                    <summary>Metinde atfı olmayan kaynaklar</summary>
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
                    <summary>Kaynakçada karşılığı olmayan atıflar</summary>
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

            <h4 className="calisma-durum-alt">ArvoLab ön kontrolü (orijinallik)</h4>
            {o?.kayit ? (
              <>
                <p className="tone-text text-sm" data-tone={similarityTone(o.kayit.overall_similarity)}>
                  En yüksek örtüşme %{o.kayit.overall_similarity} ({o.kayit.compared_document_count} belgeyle karşılaştırıldı)
                </p>
                {o.kayit.matches.slice(0, 3).map((m, i) => (
                  <p key={i} className="muted text-sm">
                    %{m.similarity} — {m.fileName}
                    {m.sampleOverlap ? ` · örnek: "${m.sampleOverlap}"` : ""}
                  </p>
                ))}
              </>
            ) : o?.okunamadi ? (
              <p className="alert" data-tone="warning" role="alert">
                Orijinallik sonucu okunamadı. Taranmadığı ya da temiz çıktığı anlamına gelmez — sayfayı yenileyin.
              </p>
            ) : null}
            <ActionForm action={orijinallikTara.bind(null, b.id)} successMessage="Orijinallik taraması tamamlandı.">
              <button type="submit" className="projects-filter-button button-compact">
                <ShieldQuestion size={14} aria-hidden="true" /> {o?.kayit ? "Yeniden tara" : "Ön kontrolü çalıştır"}
              </button>
            </ActionForm>
            <p className="hint">
              Yalnızca erişiminiz olan ArvoLab belge havuzuyla karşılaştırır; Turnitin&apos;in yerini tutmaz.
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
          confirmMessage={`"${b.file_name}" belgesini silmek istediğinize emin misiniz? Dosya, denetim sonuçları, orijinallik taramaları ve asistan geri bildirimleri kalıcı olarak silinir.`}
          successMessage="Belge silindi."
        >
          <button type="submit" className="link-button">
            <Trash2 size={14} aria-hidden="true" /> Belgeyi sil
          </button>
        </ActionForm>
      </>
    );
  };

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Belge Kontrol</h1>
          <p>
            {calisma
              ? `“${calisma.title}” çalışmasının belgeleri. Word ya da PDF dosyanızı yükleyin; kılavuz uygunluğu, kaynakça ve örtüşme denetlenir. İçerik üretilmez.`
              : "Tez ya da makale dosyanızı (.docx/.pdf) yükleyin; kılavuz uygunluğu, kaynakça ve örtüşme denetlenir."}
          </p>
        </div>
        <div className="pencere-dugmeler">
          {bagsizlar.length ? (
            <PanelDrawer
              triggerLabel="Bağlı olmayan belgeler"
              triggerClassName="projects-filter-button button-compact"
              kicker="Belge Kontrol"
              title="Çalışmaya bağlı olmayan belgeler"
              description="Eski Belge Kontrol sayfasında çalışma seçilmeden yüklenmiş belgeler. Gerekmiyorsa silin; yeni belgeyi çalışmanıza yükleyin."
              boy="genis"
              basaridaKapan={false}
            >
              <ul className="gb-liste">
                {bagsizlar.map((b) => (
                  <li key={b.id} className="gb-satir">
                    <span className="gb-satir-govde">
                      <b>{b.file_name}</b>
                      <small>
                        {[b.project_title, trTarih(b.created_at), b.analysis?.referenceSectionFound ? `${b.analysis.complianceScore}/100` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <ActionForm
                      action={sil.bind(null, b.id)}
                      confirmMessage={`"${b.file_name}" belgesi kalıcı olarak silinsin mi?`}
                      successMessage="Belge silindi."
                    >
                      <button type="submit" className="projects-filter-button button-compact" aria-label={`${b.file_name}: sil`}>
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
          {calismaOkunamadi ? "Çalışma listeniz" : "Belge listeniz"} okunamadı; aşağısı eksik görünebilir. Kayıtlarınız
          yerinde duruyor — sayfayı yenileyin.
        </p>
      ) : null}

      {calisma ? (
        <IkiKartSecim
          /* Yeni yüklenen belge listenin başına gelir; anahtar değişince o seçili açılır. */
          key={`${calisma.id}-${belgeler[0]?.id ?? ""}`}
          sayfa
          solBaslik={belgeler.length ? `Belgeler · ${belgeler.length}` : "Belgeler"}
          solUst={
            <PanelDrawer
              triggerLabel="Belge yükle"
              triggerIcon={<UploadCloud size={16} aria-hidden="true" />}
              triggerClassName={belgeler.length ? "projects-filter-button button-compact" : "projects-primary-button button-compact"}
              kicker="Belge Kontrol"
              title="Belge yükleyin"
              description="Tezinizin ya da makalenizin Word (.docx) veya PDF dosyası, en fazla 20 MB. Dosya yalnızca sizin ve yetkili rollerin görebileceği şekilde saklanır."
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
                    {trTarih(b.created_at)}
                    {b.status === "analyzed" && b.analysis?.referenceSectionFound ? ` · ${b.analysis.complianceScore}/100` : ""}
                  </small>
                </span>
                <span className="status-pill" data-tone={DURUM[b.status].ton}>
                  {DURUM[b.status].ad}
                </span>
              </>
            ),
            ayrinti: ayrinti(b),
          }))}
          bos={
            <span>
              <FileText size={20} aria-hidden="true" />
              <br />
              Henüz belge yüklemediniz. &quot;Belge yükle&quot; ile tezinizin Word ya da PDF dosyasını ekleyin; kılavuz
              uygunluğu, kaynakça ve örtüşme sonuçları burada görünür.
            </span>
          }
        />
      ) : (
        <BosDurum
          ikon={FileText}
          baslik="Önce bir çalışma başlatın"
          aciklama="Belgeler bir çalışmaya bağlı denetlenir: kılavuzun zorunlu bölümleri ve kaynakça sistemi o çalışmadan gelir."
          eylem={{ etiket: "Yeni çalışma", href: "/dashboard/editor?yeni=1" }}
        />
      )}
    </main>
  );
}
