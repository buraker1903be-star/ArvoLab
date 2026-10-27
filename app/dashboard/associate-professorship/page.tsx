import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardList, FileUp, Pencil, Plus, Printer, Sparkles, Target, Trash2 } from "lucide-react";
import {
  etkinHedefler,
  faaliyetDonemi,
  kriterUygun,
  tavanUygula,
  hedefDurumlari,
  kriterGruplari,
  puanGruplari,
  puanYazisi,
  TEMEL_ALAN_ONERILERI,
} from "@/lib/docentlik-ozeti";
import { donemSecenekleri } from "@/lib/ai/uak-tablosu";
import { uakOnerisiniUygula, uakTablolari, uakTablosunuSil, uakTablosunuYorumla } from "@/app/actions/uak-tablosu";
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
import UakYukle from "./uak-yukle";
import UakPdfAc from "./uak-pdf-ac";

/*
  ÜAK tablosunu yorumlatmak dil modeli çağrısı (uzun tablolarda parçalar
  aynı anda, her biri en fazla 240 sn). 180 sn, 12 sayfalık Güzel Sanatlar
  tablosunda yetmedi (27.10.2026).
*/
export const maxDuration = 300;

const UAK_DURUMU: Record<string, { ad: string; ton: string }> = {
  yuklendi: { ad: "Yorumlatılmadı", ton: "warning" },
  oneri_hazir: { ad: "Öneri onay bekliyor", ton: "info" },
  onaylandi: { ad: "Uygulandı", ton: "success" },
};

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

const sonrasiParam = (p: Record<string, string | string[] | undefined>) => p.donem === "sonra";

/* Hedef satırının sınırları tek yazıda: "en az 5 · en fazla 10". */
const sinirYazisi = (h: { asgari_puan: number | null; azami_puan?: number | null }) =>
  [h.asgari_puan != null ? `en az ${puanYazisi(h.asgari_puan)}` : null, h.azami_puan != null ? `en fazla ${puanYazisi(h.azami_puan)}` : null]
    .filter(Boolean)
    .join(" · ");

const katsayiYazisi = (c: { esit_bolusum?: boolean | null; baslica_yazar_katsayisi: number | null; diger_yazar_katsayisi: number | null }) =>
  c.esit_bolusum
    ? "Ortak yazar: puan eşit bölünür"
    : c.baslica_yazar_katsayisi != null || c.diger_yazar_katsayisi != null
    ? `Ortak yazar: başlıca ×${c.baslica_yazar_katsayisi != null ? puanYazisi(c.baslica_yazar_katsayisi) : "1"} · diğer ×${c.diger_yazar_katsayisi != null ? puanYazisi(c.diger_yazar_katsayisi) : "1"}`
    : null;

export default async function ScoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [
    { satirlar: tumKriterler, okunamadi: kriterOkunamadi },
    { satirlar: tumKayitlar, okunamadi: kayitOkunamadi },
    { satirlar: hedefler, okunamadi: hedefOkunamadi },
    doktora,
    profile,
    params,
    { satirlar: uakListesi, okunamadi: uakOkunamadi },
  ] = await Promise.all([
    getCriteria(),
    getMyScoreEntries(),
    getHedefler(),
    getDoktoraTarihi(),
    getCurrentProfile(),
    searchParams,
    uakTablolari(),
  ]);

  /*
    TEMEL ALAN (20261027083309). ÜAK şartları alana göre değişiyor;
    akademisyen kendi alanını bir kez seçer, kriterler ve hedefler ona göre
    süzülür. ?alan= ile başka bir alana bakılabilir (yönetici her alanın
    tablosunu yönetiyor). "Bütün alanlar"a ait (alansız) kriterler her
    görünümde durur. Alan seçilmemişse bütün kriterler görünür ama yalnızca
    alansız hedefler sayılır — hangi alanın eşiğinin geçerli olduğu
    bilinmeden eksik puan söylenmez.
  */
  const alan = (typeof params.alan === "string" && params.alan.trim()) || doktora.temelAlan || null;
  /*
    ALT ALAN (20261027142035): Güzel Sanatlar gibi tablolarda aday genel
    şartlarla birlikte YALNIZCA kendi alt alanının özel şartlarını sağlar.
    ?altalan= ile bakılan alt alan değiştirilebilir; yoksa kişinin kayıtlı
    alt alanı — o da temel alan seçimiyle eşleşiyorsa.
  */
  const altAlan =
    (typeof params.altalan === "string" && params.altalan.trim()) ||
    (alan && alan === doktora.temelAlan ? doktora.altAlan : null) ||
    null;
  const criteria = tumKriterler.filter((c) => kriterUygun(c, alan, altAlan));
  const altAlanlar = alan
    ? [...new Set(tumKriterler.filter((c) => c.temel_alan === alan && c.alt_alan).map((c) => c.alt_alan!))].sort((a, b) => a.localeCompare(b, "tr"))
    : [];
  const altAlanAdresi = (a: string | null) =>
    `/dashboard/associate-professorship?${new URLSearchParams({ ...(sonrasiParam(params) ? { donem: "sonra" } : {}), ...(alan ? { alan } : {}), ...(a ? { altalan: a } : {}) })}`;
  const bilinenAlanlar = [
    ...new Set([
      ...tumKriterler.map((c) => c.temel_alan),
      ...hedefler.map((h) => h.temel_alan ?? null),
      ...uakListesi.map((u) => u.temel_alan),
    ].filter((a): a is string => Boolean(a))),
  ].sort((a, b) => a.localeCompare(b, "tr"));
  const alanOnerileri = [...new Set([...bilinenAlanlar, ...TEMEL_ALAN_ONERILERI])];
  const alanaOzelVar = bilinenAlanlar.length > 0;
  const alanAdresi = (a: string) => `/dashboard/associate-professorship?${new URLSearchParams({ ...(sonrasiParam(params) ? { donem: "sonra" } : {}), alan: a })}`;

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

  /*
    Toplamlar yazdırılabilir dökümle AYNI fonksiyonlardan (lib/docentlik-ozeti.ts).
    Tavan ("bu maddeden en fazla 10 puan") uygulanmış SAYILAN puan gösterilir;
    doktora sonrası şartlar ("100'ün en az 90'ı") görünümden bağımsız olarak
    doktora sonrası faaliyetlerle ölçülür. Doktora tarihi yoksa ölçülmez.
  */
  const etkin = etkinHedefler(hedefler, profile?.organization_id ?? null, alan, altAlan);
  const tumOzet = tavanUygula(puanGruplari(tumKayitlar), etkin);
  const sonraOzet = doktora.tarih
    ? tavanUygula(puanGruplari(tumKayitlar.filter((e) => faaliyetDonemi(e.faaliyet_tarihi, doktora.tarih) === "sonra")), etkin)
    : null;
  const gorunen = sonrasi ? (sonraOzet ?? tavanUygula(puanGruplari(entries), etkin)) : tumOzet;
  const totalPoints = gorunen.toplam;
  const gruplar = gorunen.gruplar;
  const sayilmayan = Math.round((gorunen.ham - gorunen.toplam) * 1e6) / 1e6;
  const { toplamHedefleri, grupHedefleri } = hedefDurumlari(etkin, tumOzet, sonraOzet);
  const anaHedef = toplamHedefleri.find((h) => h.doktoraSonrasi === sonrasi) ?? toplamHedefleri[0] ?? null;
  const sonraSartiOlculemedi = !doktora.tarih && etkin.some((h) => h.doktora_sonrasi && h.asgari_puan);
  /* Dağılımda asgari şartı olan ama hiç faaliyeti olmayan gruplar da görünür: eksik olan tam da onlar. */
  const dagilim = [...new Set([...gruplar.map((g) => g.grup), ...grupHedefleri.map((h) => h.grup!)])].map((grup) => {
    const g = gruplar.find((x) => x.grup === grup);
    const sartlar = grupHedefleri.filter((h) => h.grup === grup);
    const azami = g?.azami ?? etkin.find((h) => !h.doktora_sonrasi && h.grup === grup && h.azami_puan != null)?.azami_puan ?? null;
    const olcu = sartlar.find((h) => !h.doktoraSonrasi)?.hedef ?? sartlar[0]?.hedef ?? azami ?? null;
    return { grup, toplam: g?.toplam ?? 0, ham: g?.ham ?? 0, azami, sartlar, olcu };
  });
  const hedefDuzenlenebilir = (h: { organization_id: string | null }) =>
    icEkip || (profile?.role === "academic_manager" && Boolean(h.organization_id) && h.organization_id === profile?.organization_id);

  async function handleDeleteHedef(id: string) {
    "use server";
    return hedefSil(id);
  }
  async function uakYorumla(id: string) {
    "use server";
    return uakTablosunuYorumla(id);
  }
  async function uakUygula(id: string) {
    "use server";
    return uakOnerisiniUygula(id);
  }
  async function uakSil(id: string) {
    "use server";
    return uakTablosunuSil(id);
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
            <Link href={`/dashboard/associate-professorship${typeof params.alan === "string" ? `?alan=${encodeURIComponent(params.alan)}` : ""}`} aria-current={!sonrasi ? "page" : undefined}>
              Tüm faaliyetler
            </Link>
            <Link href={`/dashboard/associate-professorship?donem=sonra${typeof params.alan === "string" ? `&alan=${encodeURIComponent(params.alan)}` : ""}`} aria-current={sonrasi ? "page" : undefined}>
              Doktora sonrası
            </Link>
          </nav>
          <PanelDrawer
            triggerLabel={[
              doktora.temelAlan ?? "Temel alan seçin",
              doktora.altAlan,
              doktora.tarih ? `Doktora: ${trTarih(doktora.tarih)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            triggerIcon={<CalendarDays size={15} aria-hidden="true" />}
            triggerClassName="projects-filter-button button-compact"
            kicker="Doçentlik"
            title="Doçentlik bilgilerim"
            description="Temel alanınız hangi ÜAK kriterlerinin ve hedeflerinin size uygulanacağını belirler. Doktora tarihinden SONRAKİ faaliyetler “Doktora sonrası” görünümünde sayılır; aynı gün sayılmaz."
          >
            <ActionForm className="project-form-grid" action={doktoraTarihiKaydet} successMessage="Bilgileriniz kaydedildi.">
              <label className="project-form-full">
                <span>Temel alan</span>
                <input name="temelAlan" type="text" list="docentlik-alanlar" defaultValue={doktora.temelAlan ?? ""} placeholder="Örn. Sağlık Bilimleri" />
                <datalist id="docentlik-alanlar">
                  {alanOnerileri.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </label>
              <label className="project-form-full">
                <span>Alt alan (varsa)</span>
                <input name="altAlan" type="text" list="docentlik-alt-alanlar" defaultValue={doktora.altAlan ?? ""} placeholder="Örn. Müzik · Yorumculuk" />
                <datalist id="docentlik-alt-alanlar">
                  {[...new Set(tumKriterler.map((c) => c.alt_alan).filter((a): a is string => Boolean(a)))].map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </label>
              <p className="hint project-form-full">
                Güzel Sanatlar gibi bazı temel alanlarda genel şartlara ek olarak alt alanın özel şartları da sağlanır. Alt alanınızı
                seçince yalnızca kendi alt alanınızın kriterlerini ve hedeflerini görürsünüz.
              </p>
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
      ) : !alan && alanaOzelVar ? (
        <p className="alert" data-tone="info">
          Kurumunuzda temel alana göre kriterler ve hedefler var. Doğru eşiklerin uygulanması için sağ üstten temel alanınızı seçin.
        </p>
      ) : alan && !altAlan && altAlanlar.length ? (
        <p className="alert" data-tone="info">
          {alan} temel alanında alt alanlara göre özel şartlar var ({altAlanlar.join(", ")}). Bütün alt alanların kriterleri
          listeleniyor; yalnızca kendi alt alanınızınkileri görmek ve özel şart hedeflerini ölçmek için sağ üstten alt alanınızı seçin.
        </p>
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
              <Link
                href={`/print/docentlik?${new URLSearchParams({ ...(sonrasi ? { donem: "sonra" } : {}), ...(alan ? { alan } : {}), ...(altAlan ? { altalan: altAlan } : {}) })}`}
                target="_blank"
                className="projects-filter-button button-compact"
              >
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
          <div className="kaynakca-puan" data-tone={kayitOkunamadi || !anaHedef ? "neutral" : toplamHedefleri.some((h) => h.eksik > 0) ? "warning" : "success"}>
            <b>
              {kayitOkunamadi ? "—" : puanYazisi(totalPoints)}
              {anaHedef && !kayitOkunamadi ? <small> / {puanYazisi(anaHedef.hedef)}</small> : null}
            </b>
            <span>
              {sonrasi ? "doktora sonrası sayılan puan" : "sayılan puan"}
              {anaHedef && !kayitOkunamadi
                ? anaHedef.eksik > 0
                  ? ` · hedefe ${puanYazisi(anaHedef.eksik)} puan eksik`
                  : " · hedef tamam"
                : ""}
            </span>
          </div>
          {!kayitOkunamadi && (toplamHedefleri.length > 1 || sayilmayan > 0 || sonraSartiOlculemedi) ? (
            <ul className="docentlik-sartlar">
              {toplamHedefleri.length > 1
                ? toplamHedefleri.map((h) => (
                    <li key={String(h.doktoraSonrasi)} data-tone={h.eksik > 0 ? "warning" : "success"}>
                      {h.doktoraSonrasi ? "Doktora sonrası" : "Toplam"} en az {puanYazisi(h.hedef)}: {puanYazisi(h.mevcut)} ·{" "}
                      {h.eksik > 0 ? `${puanYazisi(h.eksik)} eksik` : "tamam"}
                    </li>
                  ))
                : null}
              {sayilmayan > 0 ? (
                <li>Madde tavanları nedeniyle {puanYazisi(sayilmayan)} puan sayılmadı (toplam beyan {puanYazisi(gorunen.ham)}).</li>
              ) : null}
              {sonraSartiOlculemedi ? <li>Doktora sonrası şartları ölçmek için sağ üstten doktora tarihinizi girin.</li> : null}
            </ul>
          ) : null}
          {hedefOkunamadi ? (
            <p className="alert" role="alert">Hedefler okunamadı; eksik puan gösterilemiyor. Sayfayı yenileyin.</p>
          ) : null}
          {/* Grup başına puan; hedefi olan grupta çubuk HEDEFE göre dolar ve eksik yazılır. */}
          {!kayitOkunamadi && dagilim.length ? (
            <ul className="docentlik-dagilim" aria-label="Gruplara göre puan">
              {dagilim.map((g) => {
                const olcu = Math.max(g.olcu ?? totalPoints, 1);
                const ton = g.sartlar.length ? (g.sartlar.some((h) => h.eksik > 0) ? "warning" : "success") : undefined;
                const notlar = [
                  ...g.sartlar.map(
                    (h) => `en az ${puanYazisi(h.hedef)}${h.doktoraSonrasi ? " (doktora sonrası)" : ""}: ${h.eksik > 0 ? `${puanYazisi(h.eksik)} eksik` : "tamam"}`,
                  ),
                  g.azami !== null ? `en fazla ${puanYazisi(g.azami)}${g.ham > g.toplam ? ` · ${puanYazisi(g.ham - g.toplam)} puan sayılmadı` : ""}` : null,
                ].filter(Boolean);
                return (
                  <li key={g.grup} data-tone={ton}>
                    <span>{g.grup}</span>
                    <progress max={olcu} value={Math.min(g.toplam, olcu)} aria-label={`${g.grup}: ${puanYazisi(g.toplam)} puan`} />
                    <b>
                      {puanYazisi(g.toplam)}
                      {g.olcu !== null ? ` / ${puanYazisi(g.olcu)}` : ""}
                    </b>
                    {notlar.length ? <small>{notlar.join(" · ")}</small> : null}
                  </li>
                );
              })}
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
                    <span>Temel alan</span>
                    <input name="temelAlan" type="text" list="docentlik-alanlar" defaultValue={alan ?? ""} placeholder="Boş = bütün alanlar" />
                  </label>
                  <label>
                    <span>Alt alan</span>
                    <input name="altAlan" type="text" list="docentlik-alt-alanlar" defaultValue={altAlan ?? ""} placeholder="Boş = temel alanın tamamı" />
                  </label>
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
                  <label className="project-form-full checkbox-label">
                    <input name="esitBolusum" type="checkbox" value="1" />
                    <span>Çok yazarlıda puan yazar sayısına eşit bölünür (katsayılardan önce gelir)</span>
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
            ÜAK TABLOLARI (yalnızca Yönetici ve iç ekip). Akış: PDF yükle →
            yorumlat (asistan öneri çıkarır, her sayısı PDF'te geçmek zorunda)
            → PDF'le karşılaştır → onayla. Onaylanınca kriterler ve hedefler
            KURUMA ve o temel alana yazılır (app/actions/uak-tablosu.ts).
          */}
          {canManageCriteria ? (
            <section className="docentlik-grup" aria-label="ÜAK tabloları">
              <h3 className="calisma-durum-alt docentlik-grup-baslik">
                <span>ÜAK tabloları</span>
                {profile ? (
                  <PanelDrawer
                    triggerLabel="PDF yükle"
                    triggerIcon={<FileUp size={13} aria-hidden="true" />}
                    triggerClassName="projects-filter-button button-compact"
                    kicker="ÜAK tablosu"
                    title="ÜAK PDF'ini yükleyin"
                    description="ÜAK'ın yayımladığı doçentlik başvuru şartları tablosu (temel alan başına bir PDF). Yükledikten sonra yorumlatın; öneri onaylanmadan hiçbir kriter değişmez."
                  >
                    <UakYukle
                      kullaniciId={profile.id}
                      alanlar={alanOnerileri}
                      donemler={donemSecenekleri(trTarih(new Date()).split(".").reverse().join("-"))}
                      varsayilanAlan={alan}
                    />
                  </PanelDrawer>
                ) : null}
              </h3>
              {uakOkunamadi ? (
                <p className="alert" role="alert">ÜAK tabloları okunamadı; sayfayı yenileyin.</p>
              ) : uakListesi.length ? (
                <ul className="gb-liste">
                  {uakListesi.map((u) => (
                    <li key={u.id} className="gb-satir uak-satir">
                      <span className="gb-satir-govde">
                        <b>{u.temel_alan}</b>
                        <small>
                          {[u.donem, u.dosya_adi, u.onaylandi_at ? `onay ${trTarih(u.onaylandi_at)}` : null].filter(Boolean).join(" · ")}
                        </small>
                      </span>
                      <span className="status-pill" data-tone={UAK_DURUMU[u.durum]?.ton ?? "neutral"}>
                        {UAK_DURUMU[u.durum]?.ad ?? u.durum}
                      </span>
                      <span className="cluster">
                        <UakPdfAc yol={u.depo_yolu} />
                        <ActionForm action={uakYorumla.bind(null, u.id)}>
                          <button type="submit" className="projects-filter-button button-compact">
                            <Sparkles size={13} aria-hidden="true" /> {u.durum === "yuklendi" ? "Yorumlat" : "Yeniden yorumlat"}
                          </button>
                        </ActionForm>
                        {u.oneri && u.durum !== "yuklendi" ? (
                          <PanelDrawer
                            triggerLabel={u.durum === "oneri_hazir" ? "İncele ve onayla" : "Öneriyi gör"}
                            triggerIcon={<CheckCircle2 size={13} aria-hidden="true" />}
                            triggerClassName={u.durum === "oneri_hazir" ? "projects-primary-button button-compact" : "projects-filter-button button-compact"}
                            kicker={`ÜAK · ${u.donem}`}
                            title={u.temel_alan}
                            description="Öneriyi PDF'le satır satır karşılaştırın. Onaylayınca bu temel alandaki kurum kriterleri ve hedefleri bu listeyle değiştirilir; mevcut faaliyet kayıtlarının puanı korunur."
                          >
                            {u.oneri.kirpildi ? (
                              <p className="alert" data-tone="warning">
                                PDF çok uzun olduğu için yalnızca baş kısmı okundu; son sayfalardaki satırlar eksik olabilir.
                              </p>
                            ) : null}
                            <h3 className="calisma-durum-alt">Hedefler</h3>
                            {u.oneri.hedefler.length ? (
                              <ul className="gb-liste">
                                {u.oneri.hedefler.map((h, i) => (
                                  <li key={i} className="gb-satir">
                                    <span className="gb-satir-govde">
                                      <b>{h.grup ?? "Toplam puan"}</b>
                                      {h.doktora_sonrasi ? <small>doktora sonrası</small> : null}
                                    </span>
                                    <span className="status-pill" data-tone="neutral">{sinirYazisi(h)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="gb-bos">Tabloda asgari puan bulunamadı; hedefleri elle girebilirsiniz.</p>
                            )}
                            <h3 className="calisma-durum-alt">Kriterler ({u.oneri.kriterler.length})</h3>
                            <ul className="gb-liste">
                              {u.oneri.kriterler.map((k) => (
                                <li key={k.kod} className="gb-satir">
                                  <span className="gb-satir-govde">
                                    <b>
                                      {k.kod} — {k.etiket}
                                    </b>
                                    <small>
                                      {[k.grup, k.alt_alan, katsayiYazisi({ esit_bolusum: k.esit_bolusum, baslica_yazar_katsayisi: k.baslica_katsayi, diger_yazar_katsayisi: k.diger_katsayi })]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </small>
                                  </span>
                                  <span className="status-pill" data-tone="neutral">{puanYazisi(k.puan)} puan</span>
                                </li>
                              ))}
                            </ul>
                            {u.oneri.notlar.length ? (
                              <>
                                <h3 className="calisma-durum-alt">Puana çevrilemeyen şartlar</h3>
                                <ul className="uak-notlar">
                                  {u.oneri.notlar.map((n, i) => (
                                    <li key={i}>{n}</li>
                                  ))}
                                </ul>
                              </>
                            ) : null}
                            {u.durum === "oneri_hazir" ? (
                              <ActionForm
                                action={uakUygula.bind(null, u.id)}
                                confirmMessage={`${u.temel_alan} için kurum kriterleri ve hedefleri bu öneriyle değiştirilsin mi?`}
                              >
                                <div className="project-form-actions">
                                  <button type="submit" className="projects-primary-button">
                                    <CheckCircle2 size={16} aria-hidden="true" /> Onayla ve uygula
                                  </button>
                                </div>
                              </ActionForm>
                            ) : null}
                          </PanelDrawer>
                        ) : null}
                        <ActionForm
                          action={uakSil.bind(null, u.id)}
                          confirmMessage="Tablo ve PDF silinsin mi? Onaylanmış kriterler kurumda kalır."
                          successMessage="Tablo silindi."
                        >
                          <button type="submit" className="projects-filter-button button-compact" aria-label={`${u.temel_alan} tablosunu sil`}>
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </ActionForm>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gb-bos">
                  Henüz ÜAK tablosu yüklenmedi. Başvuru döneminin (mart, ekim) PDF&apos;ini temel alan başına yükleyin; kriterler
                  ve hedefler onayınızla kurumunuza yazılır.
                </p>
              )}
            </section>
          ) : null}

          {/* Temel alanlar arasında geçiş: yönetici her alanın tablosuna bakar, akademisyen kendininkine. */}
          {alanaOzelVar ? (
            <nav className="uak-alanlar" aria-label="Temel alan">
              {bilinenAlanlar.map((a) => (
                <Link key={a} href={alanAdresi(a)} className="chip" aria-current={a === alan ? "true" : undefined}>
                  {a}
                </Link>
              ))}
            </nav>
          ) : null}
          {altAlanlar.length ? (
            <nav className="uak-alanlar" aria-label="Alt alan">
              <Link href={altAlanAdresi(null)} className="chip" aria-current={!altAlan ? "true" : undefined}>
                Bütün alt alanlar
              </Link>
              {altAlanlar.map((a) => (
                <Link key={a} href={altAlanAdresi(a)} className="chip" aria-current={a === altAlan ? "true" : undefined}>
                  {a}
                </Link>
              ))}
            </nav>
          ) : null}

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
                  description="Toplam ya da bir kriter grubu için asgari puan (en az) ve tavan (en fazla). Aynı grup ve aynı dönem şartı için var olan satır güncellenir."
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
                      <span>Temel alan</span>
                      <input name="temelAlan" type="text" list="docentlik-alanlar" defaultValue={alan ?? ""} placeholder="Boş = bütün alanlar" />
                    </label>
                    <label>
                      <span>Alt alan</span>
                      <input name="altAlan" type="text" list="docentlik-alt-alanlar" defaultValue={altAlan ?? ""} placeholder="Boş = temel alanın tamamı" />
                    </label>
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
                      <span>Asgari puan (en az)</span>
                      <input name="asgariPuan" type="text" inputMode="decimal" placeholder="Örn. 100" />
                    </label>
                    <label>
                      <span>Azami puan (en fazla)</span>
                      <input name="azamiPuan" type="text" inputMode="decimal" placeholder="Örn. 10 · maddenin tavanı" />
                    </label>
                    <label className="project-form-full checkbox-label">
                      <input name="doktoraSonrasi" type="checkbox" value="1" />
                      <span>Asgari puan yalnızca doktora sonrası faaliyetlerle sağlanır (bu satıra tavan yazılmaz)</span>
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
                  .sort(
                    (a, b) =>
                      (a.grup ? 1 : 0) - (b.grup ? 1 : 0) ||
                      (a.grup ?? "").localeCompare(b.grup ?? "", "tr") ||
                      Number(Boolean(a.doktora_sonrasi)) - Number(Boolean(b.doktora_sonrasi)),
                  )
                  .map((h) => {
                    const satir = hedefler.find(
                      (x) =>
                        x.organization_id === h.organization_id &&
                        (x.grup ?? null) === (h.grup ?? null) &&
                        (x.temel_alan ?? null) === (h.temel_alan ?? null) &&
                        (x.alt_alan ?? null) === (h.alt_alan ?? null) &&
                        Boolean(x.doktora_sonrasi) === Boolean(h.doktora_sonrasi),
                    );
                    return (
                      <li key={`${h.organization_id ?? "genel"}-${h.alt_alan ?? ""}-${h.grup ?? "toplam"}-${h.doktora_sonrasi ? 1 : 0}`} className="gb-satir">
                        <span className="gb-satir-govde">
                          <b>{h.grup ?? "Toplam puan"}</b>
                          <small>
                            {[h.doktora_sonrasi ? "Doktora sonrası" : null, h.organization_id ? "Kurumunuz" : "Genel", h.temel_alan ?? null, h.alt_alan ?? null, satir?.notlar]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <span className="status-pill" data-tone="neutral">
                          {sinirYazisi(h)}
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
                    <small>
                      {[kriterKapsami(c), c.temel_alan ?? (alanaOzelVar ? "Bütün alanlar" : null), c.alt_alan, katsayiYazisi(c)].filter(Boolean).join(" · ")}
                    </small>
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
                          <label className="project-form-full checkbox-label">
                            <input name="esitBolusum" type="checkbox" value="1" defaultChecked={c.esit_bolusum} />
                            <span>Çok yazarlıda puan yazar sayısına eşit bölünür</span>
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
