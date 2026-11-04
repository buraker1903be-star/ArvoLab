import Link from "next/link";
import { aktifDil, aktifSaatDilimi, ceviri } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import { AlertTriangle, FileText, Search, MessageSquare, ShieldAlert, ShieldCheck, Plus, CalendarClock } from "lucide-react";
import { simdi } from "@/lib/genel-bakis";
import { editedAgo, getWritingStats } from "@/lib/writing-stats";
import { createClient } from "@/lib/supabase/server";
import { etikKayitlariOku } from "@/lib/etik/oku";
import { etikTehlikesi } from "@/lib/etik/durum";
import { trGunAnahtari } from "@/lib/tr-time";
import { calismaKilavuzlari } from "@/lib/guideline-rules";
import { writingPace } from "@/lib/writing-pace";
import { dueInfo } from "@/lib/due-date";
import { getProjects, approveProject, revokeApproval } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel, isOversightRole, PROJECT_STATUSES, STAFF_ROLES } from "@/lib/project-labels";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import { applyProjectFilters, isFiltered, parseProjectFilters } from "@/lib/project-filters";
import ProjectFilters from "./project-filters";
import BosDurum from "../_components/bos-durum";
import { getCurrentProfile } from "@/app/actions/profile";
import PersonelCalismaKarti from "./personel-calisma-karti";
import { personelSayaclari } from "@/lib/personel-sayaclari";
import { statusTone } from "@/lib/status-tone";
import { topluTutarsizliklar } from "@/app/actions/calisma-merkezi";
import { taranacakCalismalar } from "@/lib/toplu-tutarsizlik";
import type { Tutarsizlik } from "@/lib/calisma-tutarlilik";
import { filtrelerGorunsun, kartIlerlemesi, secimAdresi, seciliCalismaId } from "@/lib/calisma-karti";
import YeniCalismaPenceresi from "./yeni-calisma-penceresi";
import { CalismaBaglamiYayinla } from "../_components/calisma-baglami";
import PersonelYeniCalismaPenceresi from "./personel-yeni-calisma-penceresi";
import { getUniversities } from "@/app/actions/universities";
import CalismaDurumKarti from "./calisma-durum-karti";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Çalışmalarım", en: "My works" }) };
}


/* Kaynak PDF'lerini bulan sunucu işlemi dış arşivlerden indirme yapıyor
   (app/actions/kaynak-pdf.ts, süre bütçesi 40 sn). Kılavuz okuma da bu
   sayfadan çalışıyor (kilavuzuTara: PDF, gerekirse OCR, ardından model;
   modelin süresi 150 sn) — 60 sn'de işlem yarıda kesilirdi (02.11.2026). */
export const maxDuration = 300;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const saatDilimi = await aktifSaatDilimi();
  const vade = (dueDate: string | null, status: string) => dueInfo(dueDate, status, new Date(), dil);
  const yazimOzeti = (yazim: { words: number; updatedAt: string } | undefined) =>
    yazim
      ? t({
          tr: `${yazim.words.toLocaleString(YEREL[dil])} kelime · ${editedAgo(yazim.updatedAt, simdi(), dil, saatDilimi)}`,
          en: `${yazim.words.toLocaleString(YEREL[dil])} words · ${editedAgo(yazim.updatedAt, simdi(), dil, saatDilimi)}`,
        })
      : t({ tr: "henüz yazılmadı", en: "not written yet" });
  const [{ satirlar: projects, okunamadi }, profile, params] = await Promise.all([
    getProjects(),
    getCurrentProfile(),
    searchParams,
  ]);
  const [{ stats, openComments }, guidelines] = await Promise.all([
    getWritingStats(
      projects.map((project) => project.id),
      profile?.id
    ),
    // Kartlardaki yazım temposu için uygulanan kılavuzlar (yüklenenler dahil), çalışma kimliğine göre
    createClient().then((supabase) => calismaKilavuzlari(supabase, projects)),
  ]);
  /*
    Denetim şeridi, filtreler ve personel metni gözetim rolünde; iç ekip
    öğrenci düzenini önizlerken bunlar gizlenir (lib/onizleme.ts).
    Yetkiler değişmiyor: düğmeler gizlense de RLS gerçek rolle çalışıyor.
  */
  const gorunum = await sayfaGorunumu({
    rol: profile?.role,
    personelRolu: profile?.role ? STAFF_ROLES.includes(profile.role) : false,
    kurumVar: Boolean(profile?.organization_id),
  });
  const canApprove = isOversightRole(profile?.role) && gorunum.personel;
  /*
    Personel listesinde ÖĞRENCİNİN ADI. Eskiden kartlarda yalnızca başlık
    vardı; "Ekonometri" başlıklı üç tezden hangisinin kimin olduğu
    çalışmayı açmadan anlaşılmıyordu. Profil okuması RLS'e tabi (aynı
    kurum); okunamazsa ad boş kalır, liste düşmez.
  */
  const sahipAdlari = new Map<string, string>();
  if (canApprove && projects.length) {
    const supabase = await createClient();
    const { data: sahipler, error: sahipHatasi } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(projects.map((project) => project.owner_id))]);
    if (sahipHatasi) console.error("[calismalar] öğrenci adları okunamadı:", sahipHatasi.message);
    for (const sahip of sahipler ?? []) if (sahip.full_name) sahipAdlari.set(sahip.id, sahip.full_name);
  }
  const calismalar = projects.map((project) => ({ ...project, sahip_adi: sahipAdlari.get(project.owner_id) ?? null }));
  // Arama, filtre ve sıralama (adres satırındaki ?q=…&durum=…&sirala=…&atanan=…)
  const filters = parseProjectFilters(params, PROJECT_STATUSES);
  /*
    Etik kurul tehlikesi (lib/etik/durum.ts): onaydan önce veri toplama ya da
    reddedilmiş başvuru. Yalnızca personelde; tek sorgu. Süzmeden ÖNCE
    okunuyor: "etik=risk" süzgeci (ana sayfanın sayacından gelinir) ve
    listedeki işaret aynı kümeyi kullanır.
  */
  const etikKayitlari = canApprove ? await etikKayitlariOku(await createClient(), calismalar.map((p) => p.id)) : new Map();
  const etikBugun = trGunAnahtari();
  const filtreBaglami = {
    etikRiski: (id: string) => etikTehlikesi(etikKayitlari.get(id), etikBugun),
    openComments: (id: string) => openComments.get(id) ?? 0,
    lastEdited: (projectId: string) => stats.get(projectId)?.updatedAt,
    userId: profile?.id,
  };
  const visible = applyProjectFilters(calismalar, filters, filtreBaglami);
  const sayaclar = canApprove ? personelSayaclari(calismalar, filters, filtreBaglami, dil) : [];

  /*
    Kontrolör onayı verirken metinle literatürün çelişip çelişmediğini
    ONAYDAN SONRA öğreniyordu (lib/onay-uyarisi.ts). Burada onaylamadan önce
    görsün. Tarama tam metin istediği için yalnızca onaysız ve yazılmış
    çalışmalarda, sınırlı sayıda yapılır (lib/toplu-tutarsizlik.ts); rozet
    çıkmaması "temiz" demek değil, kesin yargı çalışma merkezinde.
  */
  const tutarsizliklar: Map<string, Tutarsizlik[]> = canApprove
    ? await topluTutarsizliklar(
        taranacakCalismalar(
          visible.map((project) => ({
            id: project.id,
            onayli: !!project.controller_approved_at,
            kelime: stats.get(project.id)?.words ?? 0,
            guncellendi: stats.get(project.id)?.updatedAt ?? null,
          })),
        ),
      )
    : new Map();
  // Silme yetkisi RLS ile aynı: sahibi ya da Yönetici/Sistem
  // Yöneticisi/Kurucu (Kontrolör silme yetkisine sahip DEĞİL).
  const canDeleteAnyProject =
    profile?.role === "academic_manager" || profile?.role === "system_admin" || profile?.role === "founder";

  type Calisma = (typeof projects)[number];
  // Kartlardaki yazım temposu ve ilerleme: iki düzen de aynı hesabı kullanıyor.
  function yazimDurumu(project: Calisma) {
    const guideline = guidelines.get(project.id);
    const pace =
      guideline && stats.has(project.id)
        ? writingPace({
            words: stats.get(project.id)!.words,
            minPages: guideline.minPages,
            maxPages: guideline.maxPages,
            dueDate: project.due_date,
            status: project.status,
            settings: {
              fontSizePt: guideline.settings.fontSizePt,
              lineSpacing: guideline.settings.lineSpacing,
              margins: stats.get(project.id)!.margins ?? guideline.settings.margins,
              pageSize: stats.get(project.id)!.pageSize,
            },
          }, dil)
        : null;
    const ilerleme = kartIlerlemesi({
      kelime: stats.get(project.id)?.words ?? null,
      hedefKelime: pace?.targetWords ?? null,
      elleIlerleme: project.progress,
      dil,
    });
    return { pace, ilerleme };
  }

  /*
    ÖĞRENCİ DÜZENİ: İKİ KART (26.10.2026, kurum sahibinin isteği). Solda
    çalışmalar, sağda seçili çalışmanın durumu ve eksikleri; sayfa tek
    ekran, kaymasız (lib/calisma-karti.ts). Personel düzeni değişmedi:
    onlarca çalışmayı onay ve atama şeridiyle tarıyorlar, orada liste
    kartları gerekiyor.
  */
  const ogrenciDuzeni = !canApprove;
  /* Personelin penceresi kurum seçicileri için üniversite listesini ister; öğrencide okunmuyor. */
  const universiteListesi = ogrenciDuzeni ? null : await getUniversities();
  /* Personel düzeni de iki kart (26.10.2026): seçim ikisinde de aynı kuralla. */
  const seciliId = seciliCalismaId(
    visible.map((project) => project.id),
    typeof params.sec === "string" ? params.sec : null,
    (id) => stats.get(id)?.updatedAt,
    (id) => {
      const durum = visible.find((project) => project.id === id)?.status;
      return durum !== "delivered" && durum !== "archived";
    },
  );
  const secili = seciliId ? visible.find((project) => project.id === seciliId) ?? null : null;

  async function handleApprove(projectId: string) {
    "use server";
    return approveProject(projectId);
  }

  async function handleRevoke(projectId: string) {
    "use server";
    return revokeApproval(projectId);
  }

  const calismaSayisi =
    visible.length === projects.length
      ? t({ tr: `${projects.length} çalışma`, en: `${projects.length} work${projects.length === 1 ? "" : "s"}` })
      : t({ tr: `${visible.length}/${projects.length} çalışma`, en: `${visible.length}/${projects.length} works` });
  const bitti = (status: string) => status === "delivered" || status === "archived";
  const ogrenciAktif = visible.filter((project) => !bitti(project.status));
  const ogrenciBiten = visible.filter((project) => bitti(project.status));
  const ogrenciSatiri = (project: (typeof visible)[number]) => {
    const yazim = stats.get(project.id);
    const due = vade(project.due_date, project.status);
    return (
      <li key={project.id}>
        <Link
          href={secimAdresi(params, project.id)}
          className="gb-satir"
          aria-current={project.id === seciliId ? "true" : undefined}
          scroll={false}
        >
          {/*
            Satır taranabilir (Signature OS Phase 3): tür ve son düzenleme bir
            satırda, teslim ayrı satırda kendi tonuyla. Eskiden dördü tek
            satırda "Tez · 6.172 kelime · 34 dk önce · …" diye kesiliyordu;
            teslim tarihi hiç okunmuyordu.
          */}
          <span className="gb-satir-govde">
            <b>{project.title}</b>
            <small>{[t(projectTypeLabel(project.project_type)), yazimOzeti(yazim)].filter(Boolean).join(" · ")}</small>
            {due ? (
              <small className="calisma-teslim" data-tone={due.tone}>
                {/* Etiket kendi içinde "kaldı / gecikti / bugün teslim" diyor (lib/due-date.ts); simge teslim olduğunu söyler. */}
                <CalendarClock size={12} aria-hidden="true" />
                {due.label}
              </small>
            ) : null}
          </span>
          <span className="status-pill" data-tone={statusTone(project.status)}>
            {t(statusLabel(project.status))}
          </span>
          {/*
            İlerleme çizgisi (04.11.2026): listede çalışmanın ne kadar
            ilerlediği yalnızca "%55" yazısıyla sağdaki kartta görünüyordu;
            birden çok çalışması olan öğrenci hangisinin geride kaldığını
            listeye bakarak göremiyordu.
          */}
          {typeof project.progress === "number" && project.progress > 0 ? (
            <progress className="calisma-ilerleme" max={100} value={Math.min(100, project.progress)} aria-label={t({ tr: `İlerleme %${project.progress}`, en: `Progress ${project.progress}%` })} />
          ) : null}
        </Link>
      </li>
    );
  };

  // Boş durum yalnızca liste OKUNDUĞUNDA çiziliyor (aşağıda); okunamadıysa başlıktaki düğme ana eylem kalır.
  const bosListe = !okunamadi && projects.length === 0;

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Çalışmalarım", en: "My works" })}</h1>
          <p>
            {canApprove
              ? t({
                  tr: "Kurumunuzdaki tez, makale ve proje çalışmaları. Bir çalışma seçin; onay ve sorumlu ataması sağdaki kartta.",
                  en: "Thesis, article and project works in your institution. Select a work; approval and assignment are on the card on the right.",
                })
              : t({
                  tr: "Tezinizi ve diğer çalışmalarınızı buradan açın; yazmaya kaldığınız yerden devam edin.",
                  en: "Open your thesis and other works here; continue writing where you left off.",
                })}
          </p>
        </div>
        {/* İkisi de pencere (02.11.2026): öğrenci kendi kılavuzunu ekler, personel kurumu katalogdan seçer. */}
        {/*
          Liste boşken başlıktaki düğme İKİNCİL (Phase 3 stabilizasyonu):
          boş durumun "İlk çalışmayı oluştur"u ile yan yana iki koyu düğme
          aynı pencereyi açıyordu. Pencere ve işlevi aynı; değişen yalnızca
          görünüm. Liste okunamadığında boş durum çizilmiyor, düğme ana kalır.
        */}
        {ogrenciDuzeni ? (
          /* İkincil (Signature OS Phase 3): sayfanın ana eylemi seçili çalışmanın "Yazmaya devam et"i; kenar çubuğunda ve listenin altında da "Yeni çalışma" var. */
          <YeniCalismaPenceresi acikBasla={params.yeni === "1"} triggerClassName="projects-filter-button" />
        ) : universiteListesi ? (
          <PersonelYeniCalismaPenceresi
            universities={universiteListesi.satirlar}
            universiteOkunamadi={universiteListesi.okunamadi}
            acikBasla={params.yeni === "1"}
            triggerClassName={bosListe ? "projects-filter-button" : undefined}
          />
        ) : null}
      </section>

      {okunamadi ? (
        /*
          Liste okunamadı. Eskiden burada da "henüz çalışmanız yok" yazıyordu;
          geçici bir arıza kullanıcıya tezini kaybettiğini düşündürüyordu.
        */
        <section className="alert" data-tone="danger" role="alert">
          <strong>{t({ tr: "Çalışmalarınız yüklenemedi.", en: "Your works could not be loaded." })}</strong>
          <p>
            {t({
              tr: "Bu bir bağlantı ya da yetki arızası; kayıtlarınız yerinde duruyor. Sayfayı yenileyin, sorun sürerse Uygulama Destek'ten bildirin.",
              en: "This is a connection or permission failure; your records are safe. Refresh the page, and if the problem persists, report it via App Support.",
            })}
          </p>
        </section>
      ) : projects.length === 0 ? (
        /* Elle yazılmış kopya yerine ortak kalıp: aynı durum sayfadan
           sayfaya başka görünüyordu (bos-durum.tsx). */
        <BosDurum
          ikon={FileText}
          baslik={t({ tr: "Henüz kayıtlı çalışmanız yok", en: "You have no works yet" })}
          /* Öğrencinin penceresi kılavuzu YÜKLETİYOR; katalogdan kurum
             seçtiren pencere personelde (personel-yeni-calisma-penceresi.tsx). Eskiden ikisine
             de "üniversitenizi seçin, kılavuz otomatik uygulanır" deniyordu. */
          aciklama={
            ogrenciDuzeni
              ? t({
                  tr: "Çalışmanızı açın ve tez yazım kılavuzunuzu ekleyin; onayladığınız kurallarla sayfa düzeni, zorunlu bölümler ve kaynakça sistemi editöre uygulanır.",
                  en: "Create your work and add your thesis writing guideline; once you approve its rules, page layout, required sections and the citation system are applied to the editor.",
                })
              : t({
                  tr: "Üniversitenizi seçerek başlayın; tez yazım kılavuzunuz editöre otomatik uygulanır, kaynakça sistemi ve sayfa düzeni sizin için hazırlanır.",
                  en: "Start by choosing your university; your thesis writing guideline is applied to the editor automatically, and the citation system and page layout are set up for you.",
                })
          }
          eylem={{ etiket: t({ tr: "İlk çalışmayı oluştur", en: "Create your first work" }), href: "/dashboard/editor?yeni=1" }}
        />
      ) : (
        <>
        {/*
          Sayaçlar filtredir: sayı, basınca açılan listenin uzunluğu
          (lib/personel-sayaclari.ts). Seçili olana yeniden basmak kaldırır.
        */}
        {sayaclar.length ? (
          <nav className="personel-sayaclar" aria-label={t({ tr: "Çalışma durumları", en: "Work statuses" })}>
            {sayaclar.map((sayac) => (
              <Link
                key={sayac.anahtar}
                href={sayac.href}
                className="personel-sayac"
                data-tone={sayac.sayi ? sayac.ton : undefined}
                aria-current={sayac.secili ? "true" : undefined}
              >
                <b>{sayac.sayi}</b>
                <span>{sayac.etiket}</span>
              </Link>
            ))}
          </nav>
        ) : null}
        {filtrelerGorunsun(projects.length, canApprove) ? (
        <ProjectFilters
          key={JSON.stringify(filters)}
          filters={filters}
          statuses={PROJECT_STATUSES.map((status) => ({ value: status, label: t(statusLabel(status)), tone: statusTone(status) }))}
          personel={canApprove}
          total={projects.length}
          shown={visible.length}
          filtered={isFiltered(filters)}
        />
        ) : null}
        {visible.length === 0 ? (
          <BosDurum
            kompakt
            ikon={Search}
            aciklama={t({
              tr: "Filtreye uyan çalışma yok. Ölçütleri gevşetin ya da filtreyi temizleyin.",
              en: "No works match the filter. Loosen the criteria or clear the filter.",
            })}
            eylem={{ etiket: t({ tr: "Filtreyi temizle", en: "Clear filter" }), href: "/dashboard/editor" }}
          />
        ) : ogrenciDuzeni ? (
          <section className="gb-sutunlar calismalar-ikili" aria-label={t({ tr: "Çalışmalarım", en: "My works" })}>
            <article className="gb-kart gb-sutun">
              <header className="gb-kart-bas">
                <div>
                  <h2>{t({ tr: "Tüm çalışmalar", en: "All works" })}</h2>
                  <p>{calismaSayisi}</p>
                </div>
              </header>
              {/*
                TAMAMLANANLAR AYRI (28.10.2026). Teslim edilmiş ve arşivlenmiş
                çalışmalar aktiflerin arasında, son düzenlenme sırasıyla
                karışıyordu; üç dönemlik öğrencinin listesinde güncel tez
                eski ödevlerin arasında kayboluyordu. Aktifler üstte;
                tamamlananlar kapalı bir grupta, seçiliyse açık.
              */}
              <ul className="gb-liste calisma-secim">{ogrenciAktif.map(ogrenciSatiri)}</ul>
              {/* Listenin hemen altında yeni çalışma: sağ üstteki düğmeyle aynı pencere (?yeni=1). */}
              <Link href="/dashboard/editor?yeni=1" className="calisma-yeni-kutu" scroll={false}>
                <Plus size={16} aria-hidden="true" />
                <span>
                  <b>{t({ tr: "Yeni çalışma", en: "New work" })}</b>
                  <small>{t({ tr: "Tez, makale ya da proje; kılavuzunuz ve kaynaklarınızla", en: "Thesis, article or project, with your guideline and sources" })}</small>
                </span>
              </Link>
              {ogrenciBiten.length ? (
                <details className="calisma-tamamlanan" open={ogrenciBiten.some((p) => p.id === seciliId) || !ogrenciAktif.length}>
                  <summary>
                    {t({ tr: "Tamamlananlar ve arşiv", en: "Completed and archived" })} · {ogrenciBiten.length}
                  </summary>
                  <ul className="gb-liste calisma-secim">{ogrenciBiten.map(ogrenciSatiri)}</ul>
                </details>
              ) : null}
              {/*
                ÖZET (04.11.2026). Bir iki çalışması olan öğrencide kartın
                altı yarım ekran boş kalıyordu. Kartın dibine üç sayı
                iniyor: toplam yazılan, en yakın teslim, son yazım. Hepsi
                listenin zaten okuduğu veriden; ayrı sorgu yok.
              */}
              {(() => {
                const toplam = ogrenciAktif.reduce((n, p) => n + (stats.get(p.id)?.words ?? 0), 0);
                const yakin = ogrenciAktif
                  .map((p) => ({ p, d: vade(p.due_date, p.status) }))
                  .filter((x): x is { p: (typeof ogrenciAktif)[number]; d: NonNullable<ReturnType<typeof vade>> } => x.d !== null)
                  .sort((a, b) => a.d.days - b.d.days)[0];
                const son = ogrenciAktif
                  .map((p) => stats.get(p.id)?.updatedAt)
                  .filter((d): d is string => Boolean(d))
                  .sort()
                  .at(-1);
                return (
                  <dl className="calismalar-ozet">
                    <div>
                      <dt>{t({ tr: "Toplam yazılan", en: "Total written" })}</dt>
                      <dd>
                        {toplam.toLocaleString(YEREL[dil])} <small>{t({ tr: "kelime", en: "words" })}</small>
                      </dd>
                    </div>
                    <div data-tone={yakin?.d.tone}>
                      <dt>{t({ tr: "En yakın teslim", en: "Next due" })}</dt>
                      <dd title={yakin?.p.title}>{yakin ? yakin.d.label : "—"}</dd>
                    </div>
                    <div>
                      <dt>{t({ tr: "Son yazım", en: "Last written" })}</dt>
                      <dd>{son ? editedAgo(son, simdi(), dil, saatDilimi) : "—"}</dd>
                    </div>
                  </dl>
                );
              })()}
            </article>
            {/* Seçili çalışma kenar çubuğuna bildirilir (Phase 3): o çalışmanın bölümleri orada açılır. */}
            {secili ? <CalismaBaglamiYayinla id={secili.id} baslik={secili.title} tur={secili.project_type} /> : null}
            {secili ? (
              <CalismaDurumKarti
                key={secili.id}
                projectId={secili.id}
                kelime={stats.get(secili.id)?.words ?? null}
                ilerleme={yazimDurumu(secili).ilerleme}
                due={vade(secili.due_date, secili.status)}
                duzenleyebilir={profile?.id === secili.owner_id || profile?.id === secili.assignee_id}
                silebilir={profile?.id === secili.owner_id || canDeleteAnyProject}
                kilavuzAc={params.kilavuz === "1" && params.sec === secili.id}
                takvimAc={params.takvim === "1" && params.sec === secili.id}
              />
            ) : null}
          </section>
        ) : (
          /*
            PERSONEL DÜZENİ: İKİ KART (26.10.2026, kurum sahibinin isteği).
            Eskiden her çalışma uzun bir karttı (onay, atama, beş düğme,
            menü) ve onlarca çalışmada sayfa kilometrelerce kayıyordu.
            Solda öğrenci adıyla liste ve küçük işaretler (yorum, tutarsızlık,
            onay), sağda seçili çalışmanın ayrıntısı ve denetim eylemleri.
          */
          <section className="gb-sutunlar calismalar-ikili" aria-label={t({ tr: "Çalışmalar", en: "Works" })}>
            <article className="gb-kart gb-sutun">
              <header className="gb-kart-bas">
                <div>
                  <h2>{t({ tr: "Çalışmalar", en: "Works" })}</h2>
                  <p>{calismaSayisi}</p>
                </div>
              </header>
              <ul className="gb-liste calisma-secim">
                {visible.map((project) => {
                  const yazim = stats.get(project.id);
                  const due = vade(project.due_date, project.status);
                  const yorum = openComments.get(project.id) ?? 0;
                  const tutarsiz = tutarsizliklar.get(project.id)?.length ?? 0;
                  return (
                    <li key={project.id}>
                      <Link
                        href={secimAdresi(params, project.id)}
                        className="gb-satir"
                        aria-current={project.id === seciliId ? "true" : undefined}
                        scroll={false}
                      >
                        <span className="gb-satir-govde">
                          <b>{project.title}</b>
                          <small>
                            {[
                              project.sahip_adi,
                              t(projectTypeLabel(project.project_type)),
                              yazimOzeti(yazim),
                              due?.label,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <span className="personel-isaretler">
                          {yorum ? (
                            <span className="personel-isaret" data-tone="warning" title={t({ tr: `${yorum} açık yorum`, en: `${yorum} open comment${yorum === 1 ? "" : "s"}` })}>
                              <MessageSquare size={13} aria-hidden="true" />
                              {yorum}
                            </span>
                          ) : null}
                          {tutarsiz ? (
                            <span className="personel-isaret" data-tone="warning" title={t({ tr: `${tutarsiz} tutarsızlık`, en: `${tutarsiz} inconsistenc${tutarsiz === 1 ? "y" : "ies"}` })}>
                              <AlertTriangle size={13} aria-hidden="true" />
                              {tutarsiz}
                            </span>
                          ) : null}
                          {etikTehlikesi(etikKayitlari.get(project.id), etikBugun) ? (
                            <span className="personel-isaret" data-tone="danger" title={t({ tr: "Etik kurul: tarih ya da onay sorunu", en: "Ethics: date or approval problem" })}>
                              <ShieldAlert size={13} aria-label={t({ tr: "Etik kurul riski", en: "Ethics risk" })} />
                            </span>
                          ) : null}
                          {project.controller_approved_at ? (
                            <span className="personel-isaret" data-tone="success" title={t({ tr: "Kontrolör onayı verildi", en: "Controller approval given" })}>
                              <ShieldCheck size={13} aria-label={t({ tr: "Onaylı", en: "Approved" })} />
                            </span>
                          ) : null}
                          <span className="status-pill" data-tone={statusTone(project.status)}>
                            {t(statusLabel(project.status))}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </article>
            {secili ? (
              <PersonelCalismaKarti
                key={secili.id}
                calisma={secili}
                sahipAdi={secili.sahip_adi}
                yazim={stats.get(secili.id)}
                ilerleme={yazimDurumu(secili).ilerleme}
                tempo={yazimDurumu(secili).pace}
                due={vade(secili.due_date, secili.status)}
                acikYorum={openComments.get(secili.id) ?? 0}
                tutarsizliklar={tutarsizliklar.get(secili.id) ?? []}
                silebilir={profile?.id === secili.owner_id || canDeleteAnyProject}
                onayla={handleApprove.bind(null, secili.id)}
                onayiGeriAl={handleRevoke.bind(null, secili.id)}
              />
            ) : null}
          </section>
        )}
        </>
      )}
    </main>
  );
}
