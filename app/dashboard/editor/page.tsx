import Link from "next/link";
import { AlertTriangle, FileText, Search, MessageSquare, Plus, ShieldCheck } from "lucide-react";
import { editedAgo, getWritingStats } from "@/lib/writing-stats";
import { createClient } from "@/lib/supabase/server";
import { calismaKilavuzlari } from "@/lib/guideline-rules";
import { writingPace } from "@/lib/writing-pace";
import { dueInfo } from "@/lib/due-date";
import { getProjects, approveProject, revokeApproval, assignProject, getAssignableStaff, type StaffMember } from "@/app/actions/projects";
import { listeBasarili } from "@/lib/liste-sonucu";
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
import CalismaDurumKarti from "./calisma-durum-karti";

export const metadata = { title: "Çalışmalarım" };


/* Kaynak PDF'lerini bulan sunucu işlemi dış arşivlerden indirme yapıyor
   (app/actions/kaynak-pdf.ts, süre bütçesi 40 sn). */
export const maxDuration = 60;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const filtreBaglami = {
    openComments: (id: string) => openComments.get(id) ?? 0,
    lastEdited: (projectId: string) => stats.get(projectId)?.updatedAt,
    userId: profile?.id,
    canFilterAssignee: canApprove,
  };
  const visible = applyProjectFilters(calismalar, filters, filtreBaglami);
  const sayaclar = canApprove ? personelSayaclari(calismalar, filters, filtreBaglami) : [];
  const { satirlar: staff, okunamadi: personelOkunamadi } = canApprove
    ? await getAssignableStaff()
    : listeBasarili<StaffMember>([]);

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
              margins: guideline.settings.margins,
            },
          })
        : null;
    const ilerleme = kartIlerlemesi({
      kelime: stats.get(project.id)?.words ?? null,
      hedefKelime: pace?.targetWords ?? null,
      elleIlerleme: project.progress,
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

  async function handleAssign(projectId: string, formData: FormData) {
    "use server";
    const assigneeId = String(formData.get("assigneeId") ?? "");
    return assignProject(projectId, assigneeId);
  }

  const bitti = (status: string) => status === "delivered" || status === "archived";
  const ogrenciAktif = visible.filter((project) => !bitti(project.status));
  const ogrenciBiten = visible.filter((project) => bitti(project.status));
  const ogrenciSatiri = (project: (typeof visible)[number]) => {
    const yazim = stats.get(project.id);
    const due = dueInfo(project.due_date, project.status);
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
                projectTypeLabel(project.project_type),
                yazim ? `${yazim.words.toLocaleString("tr-TR")} kelime · ${editedAgo(yazim.updatedAt)}` : "henüz yazılmadı",
                due?.label,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
          <span className="status-pill" data-tone={statusTone(project.status)}>
            {statusLabel(project.status)}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Çalışmalarım</h1>
          <p>
            {canApprove
              ? "Kurumunuzdaki tez, makale ve proje çalışmaları. Bir çalışma seçin; onay ve sorumlu ataması sağdaki kartta."
              : "Tezinizi ve diğer çalışmalarınızı buradan açın; yazmaya kaldığınız yerden devam edin."}
          </p>
        </div>
        {/* Öğrenci pencerede başlatır ve kendi kılavuzunu ekler; personelin tam formu ayrı sayfada. */}
        {ogrenciDuzeni ? (
          <YeniCalismaPenceresi acikBasla={params.yeni === "1"} />
        ) : (
          <Link href="/dashboard/editor/new" className="projects-primary-button">
            <Plus size={18} aria-hidden="true" />
            Yeni çalışma
          </Link>
        )}
      </section>

      {okunamadi ? (
        /*
          Liste okunamadı. Eskiden burada da "henüz çalışmanız yok" yazıyordu;
          geçici bir arıza kullanıcıya tezini kaybettiğini düşündürüyordu.
        */
        <section className="alert" data-tone="danger" role="alert">
          <strong>Çalışmalarınız yüklenemedi.</strong>
          <p>
            Bu bir bağlantı ya da yetki arızası; kayıtlarınız yerinde duruyor. Sayfayı yenileyin, sorun
            sürerse Uygulama Destek&apos;ten bildirin.
          </p>
        </section>
      ) : projects.length === 0 ? (
        /* Elle yazılmış kopya yerine ortak kalıp: aynı durum sayfadan
           sayfaya başka görünüyordu (bos-durum.tsx). */
        <BosDurum
          ikon={FileText}
          baslik="Henüz kayıtlı çalışmanız yok"
          aciklama="Üniversitenizi seçerek başlayın; tez yazım kılavuzunuz editöre otomatik uygulanır, kaynakça sistemi ve sayfa düzeni sizin için hazırlanır."
          eylem={{ etiket: "İlk çalışmayı oluştur", href: ogrenciDuzeni ? "/dashboard/editor?yeni=1" : "/dashboard/editor/new" }}
        />
      ) : (
        <>
        {/*
          Sayaçlar filtredir: sayı, basınca açılan listenin uzunluğu
          (lib/personel-sayaclari.ts). Seçili olana yeniden basmak kaldırır.
        */}
        {sayaclar.length ? (
          <nav className="personel-sayaclar" aria-label="Çalışma durumları">
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
          statuses={PROJECT_STATUSES.map((status) => ({ value: status, label: statusLabel(status) }))}
          showAssignee={canApprove}
          total={projects.length}
          shown={visible.length}
          filtered={isFiltered(filters)}
        />
        ) : null}
        {visible.length === 0 ? (
          <BosDurum
            kompakt
            ikon={Search}
            aciklama="Filtreye uyan çalışma yok. Ölçütleri gevşetin ya da filtreyi temizleyin."
            eylem={{ etiket: "Filtreyi temizle", href: "/dashboard/editor" }}
          />
        ) : ogrenciDuzeni ? (
          <section className="gb-sutunlar calismalar-ikili" aria-label="Çalışmalarım">
            <article className="gb-kart gb-sutun">
              <header className="gb-kart-bas">
                <div>
                  <h2>Tüm çalışmalar</h2>
                  <p>{visible.length === projects.length ? `${projects.length} çalışma` : `${visible.length}/${projects.length} çalışma`}</p>
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
              {ogrenciBiten.length ? (
                <details className="calisma-tamamlanan" open={ogrenciBiten.some((p) => p.id === seciliId) || !ogrenciAktif.length}>
                  <summary>Tamamlananlar ve arşiv · {ogrenciBiten.length}</summary>
                  <ul className="gb-liste calisma-secim">{ogrenciBiten.map(ogrenciSatiri)}</ul>
                </details>
              ) : null}
            </article>
            {secili ? (
              <CalismaDurumKarti
                key={secili.id}
                projectId={secili.id}
                kelime={stats.get(secili.id)?.words ?? null}
                ilerleme={yazimDurumu(secili).ilerleme}
                due={dueInfo(secili.due_date, secili.status)}
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
          <section className="gb-sutunlar calismalar-ikili" aria-label="Çalışmalar">
            <article className="gb-kart gb-sutun">
              <header className="gb-kart-bas">
                <div>
                  <h2>Çalışmalar</h2>
                  <p>{visible.length === projects.length ? `${projects.length} çalışma` : `${visible.length}/${projects.length} çalışma`}</p>
                </div>
              </header>
              <ul className="gb-liste calisma-secim">
                {visible.map((project) => {
                  const yazim = stats.get(project.id);
                  const due = dueInfo(project.due_date, project.status);
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
                              projectTypeLabel(project.project_type),
                              yazim ? `${yazim.words.toLocaleString("tr-TR")} kelime · ${editedAgo(yazim.updatedAt)}` : "henüz yazılmadı",
                              due?.label,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <span className="personel-isaretler">
                          {yorum ? (
                            <span className="personel-isaret" data-tone="warning" title={`${yorum} açık yorum`}>
                              <MessageSquare size={13} aria-hidden="true" />
                              {yorum}
                            </span>
                          ) : null}
                          {tutarsiz ? (
                            <span className="personel-isaret" data-tone="warning" title={`${tutarsiz} tutarsızlık`}>
                              <AlertTriangle size={13} aria-hidden="true" />
                              {tutarsiz}
                            </span>
                          ) : null}
                          {project.controller_approved_at ? (
                            <span className="personel-isaret" data-tone="success" title="Kontrolör onayı verildi">
                              <ShieldCheck size={13} aria-label="Onaylı" />
                            </span>
                          ) : null}
                          <span className="status-pill" data-tone={statusTone(project.status)}>
                            {statusLabel(project.status)}
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
                due={dueInfo(secili.due_date, secili.status)}
                acikYorum={openComments.get(secili.id) ?? 0}
                tutarsizliklar={tutarsizliklar.get(secili.id) ?? []}
                personel={staff}
                personelOkunamadi={personelOkunamadi}
                silebilir={profile?.id === secili.owner_id || canDeleteAnyProject}
                onayla={handleApprove.bind(null, secili.id)}
                onayiGeriAl={handleRevoke.bind(null, secili.id)}
                ata={handleAssign.bind(null, secili.id)}
              />
            ) : null}
          </section>
        )}
        </>
      )}
    </main>
  );
}
