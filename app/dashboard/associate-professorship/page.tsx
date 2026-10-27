import Link from "next/link";
import { CalendarDays, ClipboardList, Pencil, Plus, Printer, Target, Trash2 } from "lucide-react";
import { etkinHedefler, faaliyetDonemi, hedefDurumlari, kriterGruplari, puanGruplari, puanYazisi } from "@/lib/docentlik-ozeti";
import { trTarih } from "@/lib/tr-time";
import {
  getCriteria,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  getMyScoreEntries,
  addScoreEntry,
  updateScoreEntry,
  deleteScoreEntry,
  getHedefler,
  hedefKaydet,
  hedefSil,
  getDoktoraTarihi,
  doktoraTarihiKaydet,
  type ScoringCriterion,
} from "@/app/actions/scoring";
import { getCurrentProfile } from "@/app/actions/profile";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";
import PanelDrawer from "../_components/panel-drawer";
import BelgeSatiri from "./belge-satiri";

/*
  Faaliyet formunun yazar ve tarih alanları: ekleme ve düzenleme AYNI
  alanları gösterir. Ortak yazarlık puanı yalnızca kriterde katsayı
  tanımlıysa değiştirir; tanımlı değilse yazar sayısı yalnızca bilgi.
*/
function YazarVeTarihAlanlari({ yazarSayisi = 1, baslica = true, tarih = null }: { yazarSayisi?: number; baslica?: boolean; tarih?: string | null }) {
  return (
    <>
      <label>
        <span>Yazar sayısı</span>
        <input name="yazarSayisi" type="number" min={1} max={500} step={1} defaultValue={yazarSayisi} required />
      </label>
      <label>
        <span>Yazarlık</span>
        <select name="baslicaYazar" defaultValue={baslica ? "evet" : "hayir"}>
          <option value="evet">Başlıca yazar (tek yazarlıda da bu)</option>
          <option value="hayir">Diğer yazar</option>
        </select>
      </label>
      <label>
        <span>Faaliyet tarihi</span>
        <input name="faaliyetTarihi" type="date" defaultValue={tarih ?? ""} />
      </label>
      <p className="hint project-form-full">
        Çok yazarlı faaliyette puan, kriterde tanımlı paylaşım katsayısıyla hesaplanır; katsayı tanımlı değilse tam puan
        sayılır. Tarih, doktora sonrası puanınızın hesaplanması için gerekir.
      </p>
    </>
  );
}

const katsayiYazisi = (c: { baslica_yazar_katsayisi: number | null; diger_yazar_katsayisi: number | null }) =>
  c.baslica_yazar_katsayisi != null || c.diger_yazar_katsayisi != null
    ? `Ortak yazar: başlıca ×${c.baslica_yazar_katsayisi != null ? puanYazisi(c.baslica_yazar_katsayisi) : "1"} · diğer ×${c.diger_yazar_katsayisi != null ? puanYazisi(c.diger_yazar_katsayisi) : "1"}`
    : null;

export default async function ScoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [
    { satirlar: criteria, okunamadi: kriterOkunamadi },
    { satirlar: tumKayitlar, okunamadi: kayitOkunamadi },
    { satirlar: hedefler, okunamadi: hedefOkunamadi },
    doktora,
    profile,
    params,
  ] = await Promise.all([
    getCriteria(),
    getMyScoreEntries(),
    getHedefler(),
    getDoktoraTarihi(),
    getCurrentProfile(),
    searchParams,
  ]);

  /*
    DÖNEM SÜZGECİ: "Doktora sonrası" seçiliyken toplam, gruplar, hedefler
    ve liste yalnızca doktora tarihinden sonraki faaliyetlerle hesaplanır.
    Tarihi girilmemiş faaliyet o görünümde SAYILMAZ, ayrıca söylenir.
  */
  const sonrasi = params.donem === "sonra";
  const entries = sonrasi
    ? tumKayitlar.filter((e) => faaliyetDonemi(e.faaliyet_tarihi, doktora.tarih) === "sonra")
    : tumKayitlar;
  const tarihsiz = tumKayitlar.filter((e) => !e.faaliyet_tarihi).length;
  const belgesiz = entries.filter((e) => !e.belge_yolu).length;

  const canManageCriteria =
    profile?.role === "academic_manager" ||
    profile?.role === "system_admin" ||
    profile?.role === "founder";
  const icEkip = profile?.role === "system_admin" || profile?.role === "founder";

  /*
    Kriterler kuruma ait olabiliyor (migration 20260924100032). Genel listeyi
    yalnızca iç ekip düzenler; kurum yöneticisi kendi kurumununkini düzenler.
    Yetkisi olmayan satıra düğme ÇİZİLMİYOR: düğmeyi gösterip "yetkiniz yok"
    demek, kullanıcıyı bir hata mesajına tıklatmaktır.
  */
  const kriterKapsami = (c: ScoringCriterion) =>
    c.organization_id === null
      ? "Genel"
      : c.organization_id === profile?.organization_id
        ? "Kurumunuz"
        : "Başka kurum";
  const kriterDuzenlenebilir = (c: ScoringCriterion) =>
    icEkip ||
    (profile?.role === "academic_manager" &&
      Boolean(c.organization_id) &&
      c.organization_id === profile?.organization_id);

  // Toplam ve grup toplamları yazdırılabilir dökümle AYNI fonksiyondan (lib/docentlik-ozeti.ts).
  const { toplam: totalPoints, gruplar } = puanGruplari(entries);
  const etkin = etkinHedefler(hedefler, profile?.organization_id ?? null);
  const { toplamHedef, grupHedefleri } = hedefDurumlari(etkin, totalPoints, gruplar);
  /* Dağılımda hedefi olan ama hiç faaliyeti olmayan gruplar da görünür: eksik olan tam da onlar. */
  const dagilim = [
    ...gruplar.map((g) => ({ grup: g.grup, toplam: g.toplam, hedef: grupHedefleri.find((h) => h.grup === g.grup) ?? null })),
    ...grupHedefleri.filter((h) => !gruplar.some((g) => g.grup === h.grup)).map((h) => ({ grup: h.grup!, toplam: 0, hedef: h })),
  ];
  const hedefDuzenlenebilir = (h: { organization_id: string | null }) =>
    icEkip || (profile?.role === "academic_manager" && Boolean(h.organization_id) && h.organization_id === profile?.organization_id);

  async function handleDeleteHedef(id: string) {
    "use server";
    return hedefSil(id);
  }

  async function handleDeleteEntry(entryId: string) {
    "use server";
    return deleteScoreEntry(entryId);
  }

  async function handleUpdateEntry(entryId: string, formData: FormData) {
    "use server";
    return updateScoreEntry(entryId, formData);
  }

  async function handleDeleteCriterion(criterionId: string) {
    "use server";
    return deleteCriterion(criterionId);
  }

  async function handleUpdateCriterion(criterionId: string, formData: FormData) {
    "use server";
    return updateCriterion(criterionId, formData);
  }

  /*
    Kaydın kriteri pasife alınmış olabilir — getCriteria yalnızca aktifleri
    döndürüyor. Listede yoksa kaydın kendi kriteri başa ekleniyor; yoksa
    kullanıcı düzenleme penceresinde kendi kriterini bulamaz ve yalnızca
    başlığı düzeltmek için başka bir kritere geçmek zorunda kalırdı.
  */
  const kriterSecenekleri = (kendi: ScoringCriterion | null) =>
    kendi && !criteria.some((c) => c.id === kendi.id) ? [kendi, ...criteria] : criteria;

  /*
    TEK EKRAN, İKİ KART (26.10.2026, diğer modüllerle aynı düzen). Eskiden
    üstte grup başına puan kutuları, altında her faaliyet için tam boy bir
    kart ve en altta kriter listesi vardı; on faaliyeti olan akademisyen
    toplamını görmek için yukarı, kriteri görmek için en aşağı iniyordu.
    Solda puan ve faaliyetler, sağda puanlamanın dayandığı kriterler.

    Modül yalnızca personelin başlatıcısında (lib/os/uygulamalar.ts):
    öğrencinin işi değil.
  */
  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Doçentlik Puanı</h1>
          <p>
            Beyan ettiğiniz yayın ve faaliyetlere güncel puanlama kriterleri uygulanır.{" "}
            <strong>Resmî ÜAK duyurusunun yerini tutmaz</strong>; kriterleri ve hedefleri güncel tutmak Yönetici&apos;nin
            sorumluluğundadır.
          </p>
        </div>
        <span className="cluster">
          <nav className="segment-secici" aria-label="Dönem">
            <Link href="/dashboard/associate-professorship" aria-current={!sonrasi ? "page" : undefined}>
              Tüm faaliyetler
            </Link>
            <Link href="/dashboard/associate-professorship?donem=sonra" aria-current={sonrasi ? "page" : undefined}>
              Doktora sonrası
            </Link>
          </nav>
          <PanelDrawer
            triggerLabel={doktora.tarih ? `Doktora: ${trTarih(doktora.tarih)}` : "Doktora tarihi"}
            triggerIcon={<CalendarDays size={15} aria-hidden="true" />}
            triggerClassName="projects-filter-button button-compact"
            kicker="Doçentlik"
            title="Doktora tarihi"
            description="Doktora unvanını aldığınız gün. Bu tarihten SONRAKİ faaliyetler “Doktora sonrası” görünümünde sayılır; aynı gün sayılmaz."
          >
            <ActionForm className="project-form-grid" action={doktoraTarihiKaydet} successMessage="Doktora tarihi kaydedildi.">
              <label className="project-form-full">
                <span>Doktora tarihi</span>
                <input name="doktoraTarihi" type="date" defaultValue={doktora.tarih ?? ""} />
              </label>
              <div className="project-form-actions">
                <button type="submit" className="projects-primary-button">Kaydet</button>
              </div>
            </ActionForm>
          </PanelDrawer>
        </span>
      </section>

      {kriterOkunamadi ? (
        <p className="alert" role="alert">
          Puanlama kriterleri okunamadı; faaliyet ekleme şu an kapalı. Kriterlerin tanımsız olduğu anlamına gelmez —
          sayfayı yenileyin.
        </p>
      ) : null}
      {doktora.okunamadi ? (
        <p className="alert" role="alert">Doktora tarihiniz okunamadı; “Doktora sonrası” görünümü eksik olabilir. Sayfayı yenileyin.</p>
      ) : sonrasi && !doktora.tarih ? (
        <p className="alert" data-tone="info">“Doktora sonrası” puanı için önce sağ üstten doktora tarihinizi girin.</p>
      ) : null}

      <section className="gb-sutunlar kaynaklar-ikili" aria-label="Doçentlik puanı">
        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Faaliyetlerim</h2>
              <p>
                {entries.length
                  ? [
                      `${entries.length} kayıt`,
                      belgesiz ? `${belgesiz} belge eksik` : "belgeler tam",
                      sonrasi && tarihsiz ? `${tarihsiz} tarihsiz kayıt bu görünümde sayılmıyor` : !sonrasi && tarihsiz ? `${tarihsiz} tarihsiz` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : sonrasi && tumKayitlar.length
                    ? "Doktora sonrasına düşen faaliyet yok"
                    : "Yayın, atıf, proje ve danışmanlıklarınız"}
              </p>
            </div>
            {/*
              Kriter yokken düğmenin yeri boş bırakılmıyor: sebebi söyleniyor.
            */}
            <span className="cluster">
            {!kayitOkunamadi && entries.length ? (
              /* Başvuru dosyasını hazırlarken elde tutulacak döküm: grup grup
                 faaliyetler ve toplamlar (app/print/docentlik). */
              <Link href={sonrasi ? "/print/docentlik?donem=sonra" : "/print/docentlik"} target="_blank" className="projects-filter-button button-compact">
                <Printer size={15} aria-hidden="true" /> Döküm
              </Link>
            ) : null}
            {!kriterOkunamadi && criteria.length > 0 ? (
              <PanelDrawer
                triggerLabel="Faaliyet ekle"
                triggerIcon={<Plus size={15} aria-hidden="true" />}
                triggerClassName="projects-primary-button button-compact"
                kicker="Doçentlik"
                title="Yeni faaliyet ekle"
                description="Yayınınızı veya faaliyetinizi ilgili kritere göre kaydedin."
              >
                <ActionForm className="project-form-grid" action={addScoreEntry} successMessage="Faaliyet eklendi.">
                  <label className="project-form-full">
                    <span>Kriter</span>
                    <select name="criteriaId" defaultValue="" required>
                      <option value="" disabled>
                        Seçiniz
                      </option>
                      {criteria.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category_group ? `${c.category_group} · ` : ""}
                          {c.code} — {c.label} ({c.points_per_unit} puan/birim)
                        </option>
                      ))}
                    </select>
                  </label>
    
                  <label>
                    <span>Başlık / açıklama</span>
                    <input name="title" type="text" placeholder="Yayın veya faaliyetin adı" required />
                  </label>
    
                  <label>
                    <span>Adet / birim sayısı</span>
                    <input name="unitCount" type="text" inputMode="decimal" defaultValue="1" placeholder="Örn. 1 ya da 0,5" required />
                  </label>

                  <YazarVeTarihAlanlari />
    
                  <label className="project-form-full">
                    <span>Notlar</span>
                    <input name="notes" type="text" placeholder="Dergi adı, yayın yılı vb." />
                  </label>
    
                  <div className="project-form-actions">
                    <button type="submit" className="projects-primary-button">
                      <Plus size={16} aria-hidden="true" />
                      Kaydı ekle
                    </button>
                  </div>
                </ActionForm>
              </PanelDrawer>
            ) : null}
            </span>
          </header>

          {/* Okunamayan kayıtla hesaplanan toplam SIFIR değil, BİLİNMİYOR. */}
          <div className="kaynakca-puan" data-tone={kayitOkunamadi || !toplamHedef ? "neutral" : toplamHedef.eksik > 0 ? "warning" : "success"}>
            <b>
              {kayitOkunamadi ? "—" : puanYazisi(totalPoints)}
              {toplamHedef && !kayitOkunamadi ? <small> / {puanYazisi(toplamHedef.hedef)}</small> : null}
            </b>
            <span>
              {sonrasi ? "doktora sonrası puan" : "toplam puan"}
              {toplamHedef && !kayitOkunamadi
                ? toplamHedef.eksik > 0
                  ? ` · hedefe ${puanYazisi(toplamHedef.eksik)} puan eksik`
                  : " · hedef tamam"
                : ""}
            </span>
          </div>
          {hedefOkunamadi ? (
            <p className="alert" role="alert">Hedefler okunamadı; eksik puan gösterilemiyor. Sayfayı yenileyin.</p>
          ) : null}
          {/* Grup başına puan; hedefi olan grupta çubuk HEDEFE göre dolar ve eksik yazılır. */}
          {!kayitOkunamadi && dagilim.length ? (
            <ul className="docentlik-dagilim" aria-label="Gruplara göre puan">
              {dagilim.map((g) => (
                <li key={g.grup} data-tone={g.hedef ? (g.hedef.eksik > 0 ? "warning" : "success") : undefined}>
                  <span>{g.grup}</span>
                  <progress
                    max={Math.max(g.hedef ? g.hedef.hedef : totalPoints, 1)}
                    value={Math.min(g.toplam, Math.max(g.hedef ? g.hedef.hedef : totalPoints, 1))}
                    aria-label={`${g.grup}: ${puanYazisi(g.toplam)} puan`}
                  />
                  <b>
                    {puanYazisi(g.toplam)}
                    {g.hedef ? ` / ${puanYazisi(g.hedef.hedef)}` : ""}
                  </b>
                  {g.hedef && g.hedef.eksik > 0 ? <small>{puanYazisi(g.hedef.eksik)} eksik</small> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {!kriterOkunamadi && criteria.length === 0 ? (
            <p className="alert" data-tone="info">
              {canManageCriteria
                ? "Faaliyet eklenebilmesi için önce puanlama kriterleri tanımlanmalı. Sağdaki “Kriter ekle” ile başlayın."
                : "Faaliyet eklenebilmesi için önce kurumunuzun puanlama kriterleri tanımlanmalı. Yöneticinizden güncel ÜAK puanlarını girmesini isteyin."}
            </p>
          ) : null}

          {kayitOkunamadi ? (
            <p className="alert" data-tone="danger" role="alert">
              Faaliyet kayıtlarınız yüklenemedi. Puanınız eksik görünebilir; sayfayı yenileyin.
            </p>
          ) : entries.length === 0 ? (
            <BosDurum
              kompakt
              ikon={ClipboardList}
              aciklama={
                sonrasi && tumKayitlar.length
                  ? "Doktora tarihinizden sonraya düşen faaliyet yok. Faaliyetlerinize tarih girdiğinizden emin olun."
                  : "Henüz faaliyet eklemediniz. Yayın, atıf, proje ve tez danışmanlıklarınızı ekledikçe puanınız burada toplanır."
              }
            />
          ) : (
            gruplar.map((g) => (
            <section key={g.grup} className="docentlik-grup" aria-label={g.grup}>
            <h3 className="calisma-durum-alt docentlik-grup-baslik">
              <span>{g.grup}</span>
              <span className="muted">{g.kayitlar.length} kayıt · {puanYazisi(g.toplam)} puan</span>
            </h3>
            <ul className="kanit-kayitlari">
              {g.kayitlar.map((e) => {
                /* Kriter değişmediği sürece uygulanacak birim puan kaydın
                   kendisinden gelir (lib/docentlik-puan.ts); kullanıcı hangi
                   puanla hesaplanacağını düzenlemeden önce görsün. */
                const korunanPuan =
                  e.unit_count > 0 ? Math.round((e.computed_points / e.unit_count) * 1e6) / 1e6 : null;
                return (
                  <li key={e.id}>
                    <details className="kanit-kayit">
                      <summary>
                        <span className="kanit-kayit-govde">
                          <b>{e.title}</b>
                          <small>
                            {[
                              e.criteria?.code,
                              `${puanYazisi(e.unit_count)} birim`,
                              e.yazar_sayisi > 1
                                ? `${e.yazar_sayisi} yazarlı · ${e.baslica_yazar ? "başlıca" : "diğer"} yazar${e.paylasim_katsayisi < 1 ? ` ×${puanYazisi(e.paylasim_katsayisi)}` : ""}`
                                : null,
                              e.faaliyet_tarihi ? trTarih(e.faaliyet_tarihi) : "tarihsiz",
                              e.belge_yolu ? null : "belge eksik",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <span className="status-pill" data-tone="info">
                          {puanYazisi(e.computed_points)}
                        </span>
                      </summary>
                      <div className="kanit-kayit-ic">
                        {e.notes ? <p className="kaynak-not">{e.notes}</p> : null}
                        {profile ? <BelgeSatiri entryId={e.id} ownerId={profile.id} belgeYolu={e.belge_yolu} /> : null}
                        <div className="kanit-eylemler">
                          <PanelDrawer
                            triggerLabel="Düzenle"
                            triggerIcon={<Pencil size={14} aria-hidden="true" />}
                            triggerClassName="projects-filter-button button-compact"
                            kicker="Faaliyet kaydı"
                            title={e.title}
                            description={
                              korunanPuan === null
                                ? "Kriteri değiştirirseniz yeni kriterin güncel puanı uygulanır."
                                : `Kriteri değiştirmezseniz bu kaydın birim puanı (${korunanPuan} puan/birim) korunur — kriterin puanı sonradan değişmiş olsa bile. Kriteri değiştirirseniz yeni kriterin güncel puanı uygulanır.`
                            }
                          >
                            <ActionForm
                              className="project-form-grid"
                              action={handleUpdateEntry.bind(null, e.id)}
                              successMessage="Kayıt güncellendi."
                            >
                              {kriterOkunamadi ? (
                                <p className="alert project-form-full" data-tone="warning">
                                  Kriter listesi okunamadı; yalnızca bu kaydın kriteri gösteriliyor.
                                  Başka bir kritere geçmek için sayfayı yenileyin.
                                </p>
                              ) : null}
                              <label className="project-form-full">
                                <span>Kriter</span>
                                <select name="criteriaId" defaultValue={e.criteria_id} required>
                                  {kriterSecenekleri(e.criteria).map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.category_group ? `${c.category_group} · ` : ""}
                                      {c.code} — {c.label} ({c.points_per_unit} puan/birim)
                                      {c.is_active ? "" : " · pasife alındı"}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Başlık / açıklama</span>
                                <input name="title" type="text" defaultValue={e.title} required />
                              </label>
                              <label>
                                <span>Adet / birim sayısı</span>
                                <input
                                  name="unitCount"
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={puanYazisi(e.unit_count)}
                                  required
                                />
                              </label>
                              <YazarVeTarihAlanlari yazarSayisi={e.yazar_sayisi} baslica={e.baslica_yazar} tarih={e.faaliyet_tarihi} />
                              <label className="project-form-full">
                                <span>Notlar</span>
                                <input name="notes" type="text" defaultValue={e.notes ?? ""} />
                              </label>
                              <div className="project-form-actions">
                                <button type="submit" className="projects-primary-button">
                                  Kaydet
                                </button>
                              </div>
                            </ActionForm>
                          </PanelDrawer>
                          <ActionForm
                            action={handleDeleteEntry.bind(null, e.id)}
                            confirmMessage={`"${e.title}" kaydını silmek istediğinize emin misiniz?`}
                            successMessage="Kayıt silindi."
                          >
                            <button type="submit" className="link-button">
                              <Trash2 size={14} aria-hidden="true" /> Kaydı sil
                            </button>
                          </ActionForm>
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
            </section>
            ))
          )}
        </article>

        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Puanlama kriterleri</h2>
              <p>{canManageCriteria ? "Güncel ÜAK duyurusundaki puan değerleri" : "Puanınızın dayandığı kriterler"}</p>
            </div>
            {canManageCriteria ? (
              <PanelDrawer
                triggerLabel="Kriter ekle"
                triggerIcon={<Plus size={15} aria-hidden="true" />}
                triggerClassName="projects-filter-button button-compact"
                kicker="Puanlama kriterleri"
                title="Yeni kriter ekle"
                description="Güncel resmî ÜAK duyurusundaki puan değerlerini girin. Bu bölüm yalnızca Yönetici ve üzeri rollere açıktır."
              >
                <ActionForm className="project-form-grid" action={createCriterion} successMessage="Kriter eklendi.">
                  {icEkip ? (
                    /* Varsayılan GENEL: genel satır herkese görünür, yanlışlıkla
                       kuruma yazılmış bir kriter diğer kullanıcılardan sessizce
                       gizlenirdi. Kurum yöneticisine sorulmuyor — başka seçeneği yok. */
                    <label className="project-form-full">
                      <span>Kapsam</span>
                      <select name="kapsam" defaultValue="genel">
                        <option value="genel">Genel — tüm kurumlar ve bireysel aboneler görür</option>
                        <option value="kurum">Yalnızca kendi kurumum</option>
                      </select>
                    </label>
                  ) : (
                    <p className="hint project-form-full">
                      Bu kriter yalnızca kurumunuzun kullanıcılarına görünür ve
                      yalnızca sizin kurumunuzun puanlamasını etkiler.
                    </p>
                  )}
                  <label>
                    <span>Kriter kodu</span>
                    <input name="code" type="text" placeholder="Örn. A1" required />
                  </label>
                  <label>
                    <span>Birim başına puan</span>
                    <input name="pointsPerUnit" type="text" inputMode="decimal" placeholder="Örn. 20 ya da 2,5" required />
                  </label>
                  <label className="project-form-full">
                    <span>Etiket</span>
                    <input name="label" type="text" placeholder="Örn. SCI-E indeksli makale" required />
                  </label>
                  <label>
                    <span>Kategori grubu</span>
                    <input name="categoryGroup" type="text" placeholder="Örn. Makaleler" />
                  </label>
                  <label>
                    <span>Notlar</span>
                    <input name="notes" type="text" placeholder="Kaynak, şart, açıklama" />
                  </label>
                  <label>
                    <span>Başlıca yazar katsayısı</span>
                    <input name="baslicaKatsayi" type="text" inputMode="decimal" placeholder="Örn. 0,8 · boş = tam puan" />
                  </label>
                  <label>
                    <span>Diğer yazar katsayısı</span>
                    <input name="digerKatsayi" type="text" inputMode="decimal" placeholder="Örn. 0,5 · boş = tam puan" />
                  </label>
                  <p className="hint project-form-full">
                    Katsayılar çok yazarlı faaliyete uygulanır. Güncel ÜAK duyurusundaki paylaşım kuralını girin; sistem bir kural
                    varsaymaz, boş bırakılırsa çok yazarlı faaliyet de tam puan alır.
                  </p>
                  <div className="project-form-actions">
                    <button type="submit" className="projects-primary-button">
                      <Plus size={16} aria-hidden="true" />
                      Kriteri kaydet
                    </button>
                  </div>
                </ActionForm>
              </PanelDrawer>
            ) : null}
          </header>

          {/*
            HEDEFLER: kriterlerin yanında, çünkü ikisi aynı duyurudan ve aynı
            kişi tarafından giriliyor. Kurum hedefi genel hedefin yerine geçer
            (lib/docentlik-ozeti.ts); ekranda yalnızca geçerli olan görünür.
          */}
          <section className="docentlik-grup" aria-label="Hedef puanlar">
            <h3 className="calisma-durum-alt docentlik-grup-baslik">
              <span>Hedef puanlar</span>
              {canManageCriteria ? (
                <PanelDrawer
                  triggerLabel="Hedef ekle"
                  triggerIcon={<Target size={13} aria-hidden="true" />}
                  triggerClassName="projects-filter-button button-compact"
                  kicker="Doçentlik hedefleri"
                  title="Hedef puan"
                  description="Toplam ya da bir kriter grubu için asgari puan. Aynı grup için var olan hedef güncellenir."
                >
                  <ActionForm className="project-form-grid" action={hedefKaydet} successMessage="Hedef kaydedildi.">
                    {icEkip ? (
                      <label className="project-form-full">
                        <span>Kapsam</span>
                        <select name="kapsam" defaultValue="genel">
                          <option value="genel">Genel — tüm kurumlar ve bireysel aboneler</option>
                          <option value="kurum">Yalnızca kendi kurumum</option>
                        </select>
                      </label>
                    ) : null}
                    <label>
                      <span>Grup</span>
                      <select name="grup" defaultValue="">
                        <option value="">Toplam puan</option>
                        {kriterGruplari(criteria).map((kg) => (
                          <option key={kg.grup} value={kg.grup}>
                            {kg.grup}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Asgari puan</span>
                      <input name="asgariPuan" type="text" inputMode="decimal" placeholder="Örn. 100" required />
                    </label>
                    <label className="project-form-full">
                      <span>Not</span>
                      <input name="notlar" type="text" placeholder="Temel alan, duyuru tarihi vb." />
                    </label>
                    <div className="project-form-actions">
                      <button type="submit" className="projects-primary-button">Kaydet</button>
                    </div>
                  </ActionForm>
                </PanelDrawer>
              ) : null}
            </h3>
            {etkin.length ? (
              <ul className="gb-liste">
                {[...etkin]
                  .sort((a, b) => (a.grup ? 1 : 0) - (b.grup ? 1 : 0) || (a.grup ?? "").localeCompare(b.grup ?? "", "tr"))
                  .map((h) => {
                    const satir = hedefler.find((x) => x.organization_id === h.organization_id && (x.grup ?? null) === (h.grup ?? null));
                    return (
                      <li key={`${h.organization_id ?? "genel"}-${h.grup ?? "toplam"}`} className="gb-satir">
                        <span className="gb-satir-govde">
                          <b>{h.grup ?? "Toplam puan"}</b>
                          <small>{[h.organization_id ? "Kurumunuz" : "Genel", satir?.notlar].filter(Boolean).join(" · ")}</small>
                        </span>
                        <span className="status-pill" data-tone="neutral">
                          en az {puanYazisi(h.asgari_puan)}
                        </span>
                        {canManageCriteria && satir && hedefDuzenlenebilir(h) ? (
                          <ActionForm
                            action={handleDeleteHedef.bind(null, satir.id)}
                            confirmMessage="Bu hedef silinsin mi?"
                            successMessage="Hedef silindi."
                          >
                            <button type="submit" className="projects-filter-button button-compact" aria-label={`${h.grup ?? "Toplam"} hedefini sil`}>
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </ActionForm>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="gb-bos">
                {canManageCriteria
                  ? "Henüz hedef yok. “Hedef ekle” ile toplam ve grup başına asgari puanları girin; akademisyenler eksiklerini görür."
                  : "Henüz hedef tanımlanmadı; eksik puanınız hesaplanamıyor."}
              </p>
            )}
          </section>

          {criteria.length ? (
            kriterGruplari(criteria).map((kg) => (
            <section key={kg.grup} className="docentlik-grup" aria-label={kg.grup}>
            <h3 className="calisma-durum-alt docentlik-grup-baslik">
              <span>{kg.grup}</span>
              <span className="muted">{kg.kriterler.length} kriter</span>
            </h3>
            <ul className="gb-liste">
              {kg.kriterler.map((c) => (
                <li key={c.id} className="gb-satir">
                  <span className="gb-satir-govde">
                    <b>
                      {c.code} — {c.label}
                    </b>
                    <small>{[kriterKapsami(c), katsayiYazisi(c)].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="status-pill" data-tone="neutral">
                    {puanYazisi(c.points_per_unit)} puan
                  </span>
                  {/* Yetkisi olmayan satıra düğme ÇİZİLMİYOR. */}
                  {canManageCriteria && kriterDuzenlenebilir(c) ? (
                    <>
                      <PanelDrawer
                        triggerLabel="Düzenle"
                        triggerIcon={<Pencil size={13} aria-hidden="true" />}
                        triggerClassName="projects-filter-button button-compact"
                        kicker="Kriteri düzenle"
                        title={`${c.code} — ${c.label}`}
                        description="Puan ve katsayı değişikliği yalnızca bundan sonra eklenen faaliyetlere uygulanır; mevcut kayıtlar eklendikleri andaki değerle korunur."
                      >
                        <ActionForm
                          className="project-form-grid"
                          action={handleUpdateCriterion.bind(null, c.id)}
                          successMessage="Kriter güncellendi."
                        >
                          <label className="project-form-full">
                            <span>Etiket</span>
                            <input name="label" type="text" defaultValue={c.label} required />
                          </label>
                          <label>
                            <span>Kategori grubu</span>
                            <input name="categoryGroup" type="text" defaultValue={c.category_group ?? ""} />
                          </label>
                          <label>
                            <span>Birim başına puan</span>
                            <input name="pointsPerUnit" type="text" inputMode="decimal" defaultValue={puanYazisi(c.points_per_unit)} required />
                          </label>
                          <label className="project-form-full">
                            <span>Notlar</span>
                            <input name="notes" type="text" defaultValue={c.notes ?? ""} />
                          </label>
                          <label>
                            <span>Başlıca yazar katsayısı</span>
                            <input name="baslicaKatsayi" type="text" inputMode="decimal" defaultValue={c.baslica_yazar_katsayisi != null ? puanYazisi(c.baslica_yazar_katsayisi) : ""} placeholder="boş = tam puan" />
                          </label>
                          <label>
                            <span>Diğer yazar katsayısı</span>
                            <input name="digerKatsayi" type="text" inputMode="decimal" defaultValue={c.diger_yazar_katsayisi != null ? puanYazisi(c.diger_yazar_katsayisi) : ""} placeholder="boş = tam puan" />
                          </label>
                          <div className="project-form-actions">
                            <button type="submit" className="projects-primary-button">
                              Kaydet
                            </button>
                          </div>
                        </ActionForm>
                      </PanelDrawer>
                      <ActionForm
                        action={handleDeleteCriterion.bind(null, c.id)}
                        confirmMessage={`"${c.code}" kriterini silmek istediğinize emin misiniz? Bu kritere bağlı kullanıcı kayıtları varsa kriter silinmez, pasife alınır (geçmiş puanlar korunur).`}
                        successMessage="Kriter kaldırıldı."
                      >
                        <button type="submit" className="projects-filter-button button-compact" aria-label={`${c.code} kriterini sil`}>
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </ActionForm>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            </section>
            ))
          ) : (
            <p className="gb-bos">Henüz puanlama kriteri tanımlanmadı.</p>
          )}
          {canManageCriteria && !icEkip ? (
            <p className="hint">Genel listeyi yalnızca Sistem Yöneticisi düzenler; siz kurumunuzun kriterlerini düzenlersiniz.</p>
          ) : null}
        </article>
      </section>
    </main>
  );
}
