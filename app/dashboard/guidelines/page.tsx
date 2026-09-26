import { BookMarked, ExternalLink, FilePenLine, Plus, RefreshCw, RotateCcw, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  getGuidelines,
  createGuideline,
  deleteGuideline,
  kilavuzAtifStiliniAyarla,
  approveGuideline,
  kilavuzOnayiniGeriAl,
  updateGuidelineRules,
  updateGuidelineDetails,
} from "@/app/actions/guidelines";
import { getUniversities } from "@/app/actions/universities";

import { getCurrentProfile } from "@/app/actions/profile";
import GuidelineScanner from "./guideline-scanner";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";
import PanelDrawer from "../_components/panel-drawer";
import { statusTone } from "@/lib/status-tone";
import CikarimOzeti from "./cikarim-ozeti";
import { kilavuzuYenidenTara, universiteKilavuzuKesfet } from "@/app/actions/guideline-scan";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import { kilavuzlariTopluEkle, kilavuzlariTopluTara } from "@/app/actions/guideline-scan";

const REVIEW_FONTS = ["Times New Roman", "Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Verdana", "Book Antiqua"];

/*
  Keşif ve yeniden tarama ağ üzerinde çalışıyor: enstitü alt alan adları
  taranıyor, HTML sayfalardan gerçek belgeye iniliyor. Varsayılan 10
  saniyelik süre, kullanıcıya uygulama içi hata bile göstermeden ham bir
  tarayıcı hatasına yol açardı.
*/
export const maxDuration = 300;

export default async function GuidelinesPage() {
  const [{ satirlar: guidelines, okunamadi: kilavuzOkunamadi }, profile, { satirlar: universities }] = await Promise.all([
    getGuidelines(),
    getCurrentProfile(),
    getUniversities(),
  ]);
  // Kılavuz ekleme/silme yalnızca Akademik Yönetici ve üzeri rollere açık
  // (proje dosyası Bölüm 5.6: kural sürümleri akademik yönetici onayıyla etkinleşir).
  const canManage =
    profile?.role === "academic_manager" ||
    profile?.role === "system_admin" ||
    profile?.role === "founder";

  /*
    Onay kuyruğu. Otomatik keşif her gece çalışıyor ama ürettiği kayıtlar
    listenin içinde üniversite adına göre sıralı duruyordu; bekleyen iş hiç
    görünmüyordu. Canlıda 18 kılavuzun tamamı aylarca onaysız kaldı ve
    approved_snapshot boş olduğu için kılavuz özelliği müşteride hiç
    çalışmadı.

    Bekleyenler öne alınır, içlerinde tek adım onaylanabilecekler en üste.
    Onaylı kayıtlar eski sırasını (üniversite adı) korur.
  */
  const icEkip = profile?.role === "system_admin" || profile?.role === "founder";

  /*
    Kılavuzlar 20260924100033'ten beri kapsamlı: organization_id NULL olan
    kayıtlar ortak katalog (yalnızca iç ekip düzenler), dolu olanlar kurumun
    kendi eklediği kılavuzlar. OKUMA değişmedi — herkes hepsini görüyor.

    Yazamayacağı satıra düğme ÇİZİLMİYOR: düğmeyi gösterip "yetkiniz yok"
    demek, kullanıcıyı bir hata mesajına tıklatmaktır (doçentlik ekranında
    aynısı düzeltildi).
  */
  const yazabilir = (g: (typeof guidelines)[number]) =>
    icEkip ||
    (profile?.role === "academic_manager" &&
      Boolean(g.organization_id) &&
      g.organization_id === profile?.organization_id);

  /*
    AYNI DÜZEYDE birden çok onaylı kılavuz.

    26.09.2026 toplu onayında iki üniversitede ikişer üniversite geneli
    kayıt çıktı (Adıyaman, Burdur). Biri sessizce kazanıyor ve öğrencinin
    editörüne onun kuralları iniyor — Burdur'da bunlar iki AYRI enstitünün
    (Fen ve Eğitim Bilimleri) kılavuzuydu, yani biri bütün üniversiteye
    yanlış kural dayatıyordu.

    Seçim 20260926131150'den beri kararlı ama bu yalnızca "hep aynısı"
    demek, "doğrusu" demek değil. Karar insanın: satırda görünsün.

    Ölçüt BİRİM DÜZEYİ: bölüm ya da enstitüye bağlı kayıtlar birbiriyle
    çakışmaz, doğru olan onlardır. Kapsam da ayrı tutuluyor (ortak katalog
    ile kurumun kendi kılavuzu bilerek yan yana durabilir).
  */
  const ayniDuzeyAnahtari = (g: (typeof guidelines)[number]) =>
    `${g.university_id ?? ""}|${g.organization_id ?? ""}`;
  const cakisanDuzeyler = new Map<string, number>();
  for (const g of guidelines) {
    if (g.analysis_status !== "approved" || g.academic_unit_id || !g.university_id) continue;
    const anahtar = ayniDuzeyAnahtari(g);
    cakisanDuzeyler.set(anahtar, (cakisanDuzeyler.get(anahtar) ?? 0) + 1);
  }
  const cakisanSayisi = (g: (typeof guidelines)[number]) =>
    g.analysis_status === "approved" && !g.academic_unit_id && g.university_id
      ? cakisanDuzeyler.get(ayniDuzeyAnahtari(g)) ?? 0
      : 0;

  const bekleyenler = guidelines.filter((g) => g.analysis_status !== "approved");
  /* Kuyruk yalnızca ELİNDEN GELENİ sayıyor; gerisi gizlenmiyor, ayrıca yazılıyor. */
  const benimBekleyenlerim = bekleyenler.filter(yazabilir);
  const kapsamDisiBekleyen = bekleyenler.length - benimBekleyenlerim.length;
  const hazirSayisi = benimBekleyenlerim.filter((g) => g.ready_for_approval).length;
  /*
    Kanıtı eksik kayıtlar: en son tarandıkları sürüm citationMentions
    üretmiyordu, o yüzden "metinde hangi ad kaç kez geçiyor" bilgisi yok.
    Kararı bekleten asıl veri bu.
  */
  const kanitiEksik = guidelines.filter(
    (g) =>
      yazabilir(g) &&
      g.analysis_status !== "approved" &&
      Boolean(g.source_url) &&
      g.ai_analysis?.citationMentions === undefined,
  ).length;
  const yeniSurumlu = guidelines.filter((g) => g.ai_analysis?.pendingReview).length;
  const eskiCikarimli = guidelines.filter((g) => g.ai_analysis?.scannerOutdated).length;
  const siraliKilavuzlar = canManage
    ? [...guidelines].sort((a, b) => {
        const oncelik = (g: (typeof guidelines)[number]) =>
          g.analysis_status === "approved" ? 2 : g.ready_for_approval ? 0 : 1;
        return oncelik(a) - oncelik(b) || a.university_name.localeCompare(b.university_name, "tr");
      })
    : guidelines;

  async function handleAtifStili(guidelineId: string, formData: FormData) {
    "use server";
    return kilavuzAtifStiliniAyarla(guidelineId, formData);
  }

  async function handleTopluTara() {
    "use server";
    return kilavuzlariTopluTara();
  }

  async function handleTopluEkle(formData: FormData) {
    "use server";
    return kilavuzlariTopluEkle(formData);
  }

  async function handleDelete(guidelineId: string) {
    "use server";
    return deleteGuideline(guidelineId);
  }

  async function handleDiscover(formData: FormData) {
    "use server";
    return universiteKilavuzuKesfet(String(formData.get("universityId") ?? ""));
  }

  async function handleRescan(guidelineId: string) {
    "use server";
    return kilavuzuYenidenTara(guidelineId);
  }

  async function handleRevoke(guidelineId: string) {
    "use server";
    return kilavuzOnayiniGeriAl(guidelineId);
  }

  async function handleApprove(guidelineId: string) {
    "use server";
    return approveGuideline(guidelineId);
  }

  async function handleRuleUpdate(guidelineId: string, formData: FormData) {
    "use server";
    return updateGuidelineRules(guidelineId, formData);
  }

  async function handleDetailsUpdate(guidelineId: string, formData: FormData) {
    "use server";
    return updateGuidelineDetails(guidelineId, formData);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Referans veri</span>
          <h1>Üniversite Tez Yazım Kılavuzları</h1>
          <p>
            Üniversitelerin zorunlu tuttuğu bölümler, kaynakça sistemi ve
            sayfa aralığı burada tutulur. Belge yükleme sırasında bu
            kurallara göre otomatik ön kontrol yapılabilir.
          </p>
        </div>
        {canManage ? (
          <PanelDrawer
            triggerLabel="Yeni kılavuz"
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            kicker="Referans veri"
            title="Yeni kılavuz ekle"
            description="Kayıt, projelerde kullanılmadan önce akademik onaya düşer."
          >
            <ActionForm className="project-form-grid" action={createGuideline} successMessage="Kılavuz eklendi; onay bekliyor.">
              <label>
                <span>Üniversite adı</span>
                <input
                  name="universityName"
                  type="text"
                  list="university-options-guideline"
                  placeholder="Örn. Marmara Üniversitesi"
                  autoComplete="off"
                  required
                />
              </label>

              <label>
                <span>Enstitü (opsiyonel)</span>
                <input name="instituteName" type="text" placeholder="Sosyal Bilimler Enstitüsü" />
              </label>

              <label>
                <span>Sürüm etiketi</span>
                <input name="versionLabel" type="text" placeholder="2025 Güz" />
              </label>

              <label>
                <span>Kaynak URL (resmî kılavuz)</span>
                <input name="sourceUrl" type="url" placeholder="https://..." />
              </label>

              <label>
                <span>Kaynakça sistemi</span>
                <select name="citationStyle" defaultValue="apa7">
                  {Object.entries(STIL_ETIKETLERI).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Min. sayfa</span>
                <input name="minPages" type="number" min={0} placeholder="60" />
              </label>

              <label>
                <span>Maks. sayfa</span>
                <input name="maxPages" type="number" min={0} placeholder="150" />
              </label>

              <label className="project-form-full">
                <span>Zorunlu bölümler (virgülle ayırın)</span>
                <input
                  name="requiredSections"
                  type="text"
                  placeholder="Giriş, Yöntem, Bulgular, Tartışma, Sonuç, Kaynakça"
                />
              </label>

              <label className="project-form-full">
                <span>Notlar</span>
                <textarea name="notes" rows={3} placeholder="Ek biçimsel notlar" />
              </label>

              <div className="project-form-actions">
                <button type="submit" className="projects-primary-button">
                  <Plus size={16} aria-hidden="true" />
                  Kılavuzu kaydet
                </button>
              </div>
            </ActionForm>
          </PanelDrawer>
        ) : null}
      </section>

      {/*
        Bekleyen iş sayfanın başında duyurulur. Kılavuz onaylanmadıkça
        approved_snapshot boş kalır ve kural hiçbir çalışmada uygulanmaz —
        bekleyen kayıt, sessizce çalışmayan bir özellik demektir.
      */}
      {canManage && eskiCikarimli > 0 ? (
        <section className="alert" data-tone="danger" role="alert">
          <strong>{eskiCikarimli} onaylı kılavuz eski bir çıkarım sürümüyle onaylandı.</strong>
          <p>
            Kuralları korunuyor ama yanlış olabilir. Onayı geri alıp &ldquo;Şimdi yeniden tara&rdquo; ile
            güncelleyin, sonra yeniden onaylayın.
          </p>
        </section>
      ) : null}

      {canManage && bekleyenler.length > 0 ? (
        <section className="onay-kuyrugu" role="status">
          <div>
            <strong>
              {benimBekleyenlerim.length > 0
                ? `${benimBekleyenlerim.length} kılavuz onayınızı bekliyor`
                : "Onayınızı bekleyen kılavuz yok"}
              {hazirSayisi > 0 ? ` · ${hazirSayisi} tanesi tek adım` : ""}
            </strong>
            <p>
              Onaylanmayan kılavuz hiçbir çalışmada uygulanmaz: zorunlu bölümler, sayfa sınırı, atıf
              sistemi ve editör sayfa ayarları öğrencinin ekranına ancak onaydan sonra iner.
              {yeniSurumlu > 0
                ? ` ${yeniSurumlu} onaylı kılavuzun resmî kaynağında yeni sürüm algılandı; eski kurallar korunuyor.`
                : ""}
              {kapsamDisiBekleyen > 0
                ? ` Ayrıca ortak katalogda ${kapsamDisiBekleyen} kılavuz onay bekliyor; onları Sistem Yöneticisi onaylar.`
                : ""}
            </p>
            {/*
              Kanıt alanı sonradan eklendi; eski kayıtlar onu taşımıyor.
              Tek tek "Şimdi yeniden tara" ile ilerlemek onlarca tıklamaydı.
              Parti parti çalışıyor: her tarama bir ağ isteği ve çoğu zaman
              bir PDF ayrıştırması, hepsi tek istekte zaman aşımına girer.
            */}
            {kanitiEksik > 0 ? (
              <ActionForm action={handleTopluTara} className="mt-sm">
                <button type="submit" className="projects-filter-button">
                  <RefreshCw size={14} aria-hidden="true" />
                  {kanitiEksik} kılavuzda atıf kanıtı eksik — sıradakileri tara
                </button>
              </ActionForm>
            ) : null}
          </div>
        </section>
      ) : null}

      {/*
        Elle keşif. Eskiden keşif yalnızca gece çalışan cron'daydı (günde 2
        üniversite; 204 üniversite ≈ 100 gün) ve çalışıp çalışmadığını
        görmenin tek yolu ertesi sabah veritabanına bakmaktı.
      */}
      {/*
        Otomatik keşfin yapısal tavanı var: kılavuz enstitü sitesinde iki üç
        seviye derinde, üniversitelerin çoğunda site haritası yok ya da HTML
        dönüyor ve ana sayfa kılavuza bağlanmıyor. Denenen üniversitelerin
        büyük kısmı bu yüzden hiç aday üretmiyor; kalanı elle eklenecek ve
        tek tek form 160+ üniversite için ağır.
      */}
      {icEkip ? (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">
              <Plus size={16} aria-hidden="true" />
              Toplu kılavuz ekle
            </h2>
          </div>
          <PanelDrawer
            triggerLabel="Listeden ekle"
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            triggerClassName="projects-filter-button"
            kicker="Ortak katalog"
            title="Listeden toplu kılavuz ekle"
            description="Her satıra bir üniversite adı ve kılavuzun resmî adresi. Adres indirilip taranır, kurallar çıkarılır; kayıt onaylanana kadar hiçbir çalışmaya uygulanmaz."
          >
            <ActionForm className="project-form-grid" action={handleTopluEkle} successMessage="Liste işlendi.">
              <label className="project-form-full">
                <span>Üniversite adı ve kılavuz adresi (satır başına bir tane)</span>
                <textarea
                  name="liste"
                  rows={8}
                  placeholder={"Akdeniz Üniversitesi https://sbe.akdeniz.edu.tr/.../tez-yazim-kilavuzu.pdf\nAnadolu Üniversitesi https://sbe.anadolu.edu.tr/.../kilavuz.pdf"}
                  required
                />
              </label>
              <p className="hint project-form-full">
                Üniversite adı listedekiyle <strong>aynı</strong> olmalı; eşleşmeyen satır atlanır ve sebebi
                bildirilir — en yakın ad tahmin edilmez, yanlış kuruma kılavuz bağlamak öğrencinin editörüne
                başka kurumun kurallarını indirir. Adres yalnızca <code>edu.tr</code> alan adlarından kabul
                edilir. Her satır bir belge indirip çözümlediği için tek seferde en fazla 10 satır işlenir.
              </p>
              <div className="project-form-actions">
                <button type="submit" className="projects-primary-button">
                  <Plus size={16} aria-hidden="true" />
                  Listeyi ekle ve tara
                </button>
              </div>
            </ActionForm>
          </PanelDrawer>
        </section>
      ) : null}

      {canManage ? (
        <section className="section">
          <h2 className="section-title">
            <Search size={16} aria-hidden="true" />
            Üniversite kılavuzu keşfet
          </h2>
          <p className="muted text-base">
            Kurumun resmî .edu.tr sitesi ve enstitü alt alan adları taranır; bulunan kılavuzlar
            onay kuyruğuna düşer. İşlem birkaç dakika sürebilir.
          </p>
          <ActionForm action={handleDiscover} className="cluster mt-sm">
            <select name="universityId" aria-label="Üniversite" className="compact-select grow-select" defaultValue="">
              <option value="">Üniversite seçin</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button type="submit" className="projects-primary-button">
              <Search size={15} aria-hidden="true" />
              Şimdi keşfet
            </button>
          </ActionForm>
        </section>
      ) : null}

      {canManage ? (
        <>
          {/* Yeni ve düzenleme pencerelerindeki üniversite alanlarının önerileri */}
          <datalist id="university-options-guideline">
            {universities.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>
          <GuidelineScanner />
        </>
      ) : null}

      {/* Okunamadı ile "kayıt yok" ayrı: ikincisi akademik yöneticiye
          "kılavuzlar gitti" gibi okunuyordu. */}
      {kilavuzOkunamadi ? (
        <p className="alert" data-tone="danger" role="alert">
          Kılavuz listesi yüklenemedi. Kayıtlar yerinde duruyor; sayfayı yenileyin.
        </p>
      ) : guidelines.length === 0 ? (
        <BosDurum
          ikon={BookMarked}
          baslik="Kılavuz kaydı yok"
          aciklama={
            canManage
              ? "Henüz kayıtlı bir üniversite kılavuzu yok. Yukarıdaki “Yeni kılavuz” ile ekleyin; kurallar editöre, belge kontrolüne ve Word çıktısına otomatik uygulanır."
              : "Henüz kayıtlı bir üniversite kılavuzu yok. Kurumunuzun kılavuzunun eklenmesi için Akademik Yönetici'nize başvurun."
          }
        />
      ) : (
        <section className="projects-list" aria-label="Kılavuz listesi">
          {siraliKilavuzlar.map((g) => {
            const margins = (g.extracted_rules?.margins_cm ?? {}) as Record<string, unknown>;
            const guidelineName = `${g.university_name}${g.institute_name ? ` — ${g.institute_name}` : ""}`;
            return (
              <article className="project-card" key={g.id}>
                <div className="project-card-main">
                  <div>
                    <div className="pill-row">
                      <span className="status-pill">{STIL_ETIKETLERI[g.citation_style] ?? g.citation_style}</span>
                      {/* Kaydın kimin sorumluluğunda olduğu görünsün: ortak
                          katalog mu, kurumun kendi eklediği kılavuz mu. */}
                      {canManage ? (
                        <span className="status-pill">
                          {g.organization_id === null
                            ? "Ortak katalog"
                            : g.organization_id === profile?.organization_id
                              ? "Kurumunuz"
                              : "Başka kurum"}
                        </span>
                      ) : null}
                      <span className="status-pill" data-tone={statusTone(g.analysis_status)}>
                        {g.analysis_status === "approved"
                          ? "Onaylı"
                          : g.analysis_status === "needs_review"
                            ? "İnceleme gerekli"
                            : g.analysis_status}
                      </span>
                      {/* Kuyruktaki sıra: tek adım onaylanabilecekler ayrılır. */}
                      {g.ready_for_approval ? (
                        <span className="status-pill" data-tone="success">Tek adım onaya hazır</span>
                      ) : null}
                      {g.ai_analysis?.pendingReview ? (
                        <span className="status-pill" data-tone="warning">Kaynakta yeni sürüm</span>
                      ) : null}
                      {/* Gürültülü metin: kurallar belgeyle karşılaştırılmalı. */}
                      {cakisanSayisi(g) > 1 ? (
                        <span className="status-pill" data-tone="warning">
                          Aynı üniversitede {cakisanSayisi(g)} onaylı genel kılavuz
                        </span>
                      ) : null}
                      {g.ai_analysis?.ocrUsed ? (
                        <span className="status-pill" data-tone="warning">OCR ile okundu</span>
                      ) : null}
                      {/* Bilinen bir çıkarım hatasıyla onaylanmış olabilir. */}
                      {g.ai_analysis?.scannerOutdated ? (
                        <span className="status-pill" data-tone="danger">Eski çıkarımla onaylandı</span>
                      ) : null}
                    </div>
                    <h2>{guidelineName}</h2>
                    <p>
                      {g.version_label ? `${g.version_label} · ` : ""}
                      {g.required_sections.length > 0
                        ? `Zorunlu bölümler: ${g.required_sections.join(", ")}`
                        : "Zorunlu bölüm tanımlanmadı"}
                    </p>
                  </div>
                </div>

                <div className="project-card-meta">
                  {g.min_pages || g.max_pages ? (
                    <span>
                      Sayfa aralığı: {g.min_pages ?? "—"}–{g.max_pages ?? "—"}
                    </span>
                  ) : null}
                  {g.source_url ? (
                    <a href={g.source_url} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} aria-hidden="true" />
                      Resmî kaynak
                    </a>
                  ) : null}
                </div>

                {/* Yönetici neye dayanarak onayladığını görsün. */}
                {canManage ? <CikarimOzeti cikarim={g.ai_analysis} kayitliStil={STIL_ETIKETLERI[g.citation_style] ?? g.citation_style} /> : null}

                {canManage && !yazabilir(g) ? (
                  <p className="muted text-sm">
                    Ortak katalog kaydı — kuralları ve onayı Sistem Yöneticisi yönetir.
                  </p>
                ) : null}

                {yazabilir(g) ? (
                  <div className="cluster cluster-spaced">
                    {g.analysis_status !== "approved" ? (
                      <ActionForm action={handleApprove.bind(null, g.id)} successMessage="Kılavuz onaylandı ve uygulandı.">
                        <button type="submit" className="projects-primary-button">Onayla ve uygula</button>
                      </ActionForm>
                    ) : null}

                    {/* Çıkarımın yanlış olduğu sonradan anlaşılabiliyor; onaylı
                        kayda dokunulmadığı için geri dönüş yolu gerekiyor. */}
                    {g.analysis_status === "approved" ? (
                      <ActionForm
                        action={handleRevoke.bind(null, g.id)}
                        confirmMessage={`"${guidelineName}" kılavuzunun onayını geri almak istediğinize emin misiniz?\n\nKurallar bu kurumdaki çalışmalarda UYGULANMAYI DURDURUR: zorunlu bölümler, sayfa sınırı, atıf sistemi ve editör sayfa ayarları öğrencilerin ekranından kalkar. Yeniden onaylayana kadar böyle kalır.`}
                        successMessage="Onay geri alındı; kılavuz yeniden incelemeye düştü."
                      >
                        <button type="submit" className="projects-filter-button">
                          <RotateCcw size={14} aria-hidden="true" />
                          Onayı geri al
                        </button>
                      </ActionForm>
                    ) : null}

                    {/* Gece çalışan cron'u beklemeden: çıkarım düzeldiğinde ya da
                        kurumda yeni sürüm yayımlandığında hemen uygulansın. */}
                    {g.analysis_status !== "approved" && g.source_url ? (
                      <ActionForm
                        action={handleRescan.bind(null, g.id)}
                        successMessage="Kılavuz yeniden tarandı; kurallar güncellendi."
                      >
                        <button type="submit" className="projects-filter-button">
                          <RefreshCw size={14} aria-hidden="true" />
                          Şimdi yeniden tara
                        </button>
                      </ActionForm>
                    ) : null}

                    {/*
                      Tek alanlık karar, on alanlık forma bağlıydı: atıf
                      sistemi belgeden seçilemediğinde (32 bekleyenin
                      30'unda böyle) yöneticinin "Kuralları düzenle"
                      penceresini açıp kenar boşluğundan satır aralığına
                      kadar her alanı geçerli hâle getirmesi gerekiyordu.
                      Burada yalnızca sistem yazılıyor.
                    */}
                    {!g.ai_analysis?.detectedCitationHint ? (
                      <ActionForm
                        action={handleAtifStili.bind(null, g.id)}
                        className="cluster"
                        successMessage="Atıf sistemi kaydedildi."
                      >
                        <select
                          name="citationStyle"
                          className="compact-select"
                          defaultValue={g.citation_style}
                          aria-label={`${guidelineName} için atıf sistemi`}
                        >
                          {Object.entries(STIL_ETIKETLERI).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        <button type="submit" className="projects-filter-button button-compact">
                          Atıf sistemini kaydet
                        </button>
                      </ActionForm>
                    ) : null}

                    <PanelDrawer
                      triggerLabel="Kuralları düzenle"
                      triggerIcon={<SlidersHorizontal size={14} aria-hidden="true" />}
                      triggerClassName="projects-filter-button"
                      kicker="Biçim kuralları"
                      title={guidelineName}
                      description="Kaydedince kılavuz yeniden onaya düşer; projelerde kullanılabilmesi için yeniden onaylayın."
                    >
                      <ActionForm
                        className="guideline-review-form"
                        action={handleRuleUpdate.bind(null, g.id)}
                        successMessage="Kurallar kaydedildi; yeniden onay gerekiyor."
                      >
                        <label>
                          <span>Kaynakça sistemi</span>
                          <select name="citationStyle" defaultValue={g.citation_style}>
                            {Object.entries(STIL_ETIKETLERI).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Yazı tipi</span>
                          <select name="fontFamily" defaultValue={String(g.extracted_rules?.font_family ?? "Times New Roman")}>
                            {REVIEW_FONTS.map((font) => (
                              <option key={font}>{font}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Punto</span>
                          <input name="fontSizePt" type="number" min="8" max="24" step="0.5" defaultValue={Number(g.extracted_rules?.font_size_pt ?? 12)} required />
                        </label>
                        <label>
                          <span>Satır aralığı</span>
                          <input name="lineSpacing" type="number" min="1" max="3" step="0.15" defaultValue={Number(g.extracted_rules?.line_spacing ?? 1.5)} required />
                        </label>
                        {(["Top", "Bottom", "Left", "Right"] as const).map((side) => {
                          const key = side.toLowerCase() as "top" | "bottom" | "left" | "right";
                          const labels = { top: "Üst boşluk (cm)", bottom: "Alt boşluk (cm)", left: "Sol boşluk (cm)", right: "Sağ boşluk (cm)" };
                          return (
                            <label key={side}>
                              <span>{labels[key]}</span>
                              <input name={`margin${side}`} type="number" min="0" max="10" step="0.1" defaultValue={Number(margins[key] ?? 2.5)} required />
                            </label>
                          );
                        })}
                        <label className="guideline-review-full">
                          <span>Zorunlu bölümler</span>
                          <input name="requiredSections" defaultValue={g.required_sections.join(", ")} placeholder="Giriş, Yöntem, Bulgular, Sonuç, Kaynakça" required />
                        </label>
                        <label className="guideline-review-check checkbox-label">
                          <input name="showPageNumbers" type="checkbox" defaultChecked={g.extracted_rules?.show_page_numbers !== false} />
                          <span>Sayfa numarası kullan</span>
                        </label>
                        <label className="guideline-review-check checkbox-label">
                          <input name="headingNumbering" type="checkbox" defaultChecked={g.extracted_rules?.heading_numbering === true} />
                          <span>Başlıklar ondalık numaralı (1., 1.1., 1.1.1.)</span>
                        </label>
                        <label className="guideline-review-check checkbox-label">
                          <input name="chapterUppercase" type="checkbox" defaultChecked={g.extracted_rules?.chapter_uppercase === true} />
                          <span>Ana bölüm başlıkları büyük harfle</span>
                        </label>
                        <label className="guideline-review-check checkbox-label">
                          <input name="chapterNewPage" type="checkbox" defaultChecked={g.extracted_rules?.chapter_new_page === true} />
                          <span>Her ana bölüm yeni sayfadan başlar</span>
                        </label>
                        <label className="guideline-review-check checkbox-label">
                          <input name="justify" type="checkbox" defaultChecked={g.extracted_rules?.justify === true} />
                          <span>Gövde metni iki yana yaslı</span>
                        </label>
                        <label>
                          <span>Paragraf girintisi (cm)</span>
                          <input
                            name="paragraphIndentCm"
                            type="number"
                            min="0.3"
                            max="3"
                            step="0.05"
                            defaultValue={String(g.extracted_rules?.paragraph_indent_cm ?? "")}
                            placeholder="Yok"
                          />
                        </label>
                        <label>
                          <span>Özet en az kelime</span>
                          <input name="abstractMinWords" type="number" min="20" max="2000" step="1" defaultValue={String(g.extracted_rules?.abstract_min_words ?? "")} placeholder="Yok" />
                        </label>
                        <label>
                          <span>Özet en fazla kelime</span>
                          <input name="abstractMaxWords" type="number" min="20" max="2000" step="1" defaultValue={String(g.extracted_rules?.abstract_max_words ?? "")} placeholder="Yok" />
                        </label>
                        <label>
                          <span>Anahtar kelime en az</span>
                          <input name="keywordsMin" type="number" min="1" max="20" step="1" defaultValue={String(g.extracted_rules?.keywords_min ?? "")} placeholder="Yok" />
                        </label>
                        <label>
                          <span>Anahtar kelime en fazla</span>
                          <input name="keywordsMax" type="number" min="1" max="20" step="1" defaultValue={String(g.extracted_rules?.keywords_max ?? "")} placeholder="Yok" />
                        </label>
                        <label className="guideline-review-full">
                          <span>İnceleme notu</span>
                          <textarea name="reviewNotes" rows={2} defaultValue={g.review_notes ?? ""} />
                        </label>
                        <div className="project-form-actions guideline-review-full">
                          <button type="submit" className="projects-primary-button">Kuralları kaydet</button>
                        </div>
                      </ActionForm>
                    </PanelDrawer>

                    <PanelDrawer
                      triggerLabel="Bilgileri düzenle"
                      triggerIcon={<FilePenLine size={14} aria-hidden="true" />}
                      triggerClassName="projects-filter-button"
                      kicker="Kılavuz bilgileri"
                      title={guidelineName}
                      description="Üniversite ya da enstitü değişirse kılavuz yeniden onaya düşer."
                    >
                      <ActionForm
                        className="guideline-review-form"
                        action={handleDetailsUpdate.bind(null, g.id)}
                        successMessage="Kılavuz bilgileri kaydedildi."
                      >
                        <label className="guideline-review-full">
                          <span>Üniversite adı</span>
                          <input
                            name="universityName"
                            type="text"
                            list="university-options-guideline"
                            defaultValue={g.university_name}
                            autoComplete="off"
                            required
                          />
                        </label>
                        <label>
                          <span>Enstitü</span>
                          <input name="instituteName" type="text" defaultValue={g.institute_name ?? ""} />
                        </label>
                        <label>
                          <span>Sürüm etiketi</span>
                          <input name="versionLabel" type="text" defaultValue={g.version_label ?? ""} />
                        </label>
                        <label>
                          <span>Min. sayfa</span>
                          <input name="minPages" type="number" min={0} defaultValue={g.min_pages ?? ""} />
                        </label>
                        <label>
                          <span>Maks. sayfa</span>
                          <input name="maxPages" type="number" min={0} defaultValue={g.max_pages ?? ""} />
                        </label>
                        <label className="guideline-review-full">
                          <span>Kaynak URL (resmî kılavuz)</span>
                          <input name="sourceUrl" type="url" defaultValue={g.source_url ?? ""} />
                        </label>
                        <label className="guideline-review-full">
                          <span>Notlar</span>
                          <textarea name="notes" rows={2} defaultValue={g.notes ?? ""} />
                        </label>
                        <div className="project-form-actions guideline-review-full">
                          <button type="submit" className="projects-primary-button">Bilgileri kaydet</button>
                        </div>
                      </ActionForm>
                    </PanelDrawer>

                    <ActionForm
                      action={handleDelete.bind(null, g.id)}
                      confirmMessage={`${g.university_name} kılavuzunu silmek istediğinize emin misiniz?`}
                      successMessage="Kılavuz silindi."
                    >
                      <button type="submit" className="projects-filter-button">
                        <Trash2 size={14} aria-hidden="true" />
                        Sil
                      </button>
                    </ActionForm>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
