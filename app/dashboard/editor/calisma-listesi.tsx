import Link from "next/link";
import { aktifDil, aktifSaatDilimi, ceviri } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import { FileText, Search, Plus } from "lucide-react";
import { simdi } from "@/lib/genel-bakis";
import { editedAgo, getWritingStats } from "@/lib/writing-stats";
import { createClient } from "@/lib/supabase/server";
import { calismaKilavuzlari } from "@/lib/guideline-rules";
import { writingPace } from "@/lib/writing-pace";
import { dueInfo } from "@/lib/due-date";
import { getProjects } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel, PROJECT_STATUSES } from "@/lib/project-labels";
import { kisiselCalismalar, KISISEL_CALISMALAR } from "@/lib/kisisel-calismalar";
import { applyProjectFilters, isFiltered, parseProjectFilters } from "@/lib/project-filters";
import ProjectFilters from "./project-filters";
import BosDurum from "../_components/bos-durum";
import { getCurrentProfile } from "@/app/actions/profile";
import { statusTone } from "@/lib/status-tone";
import { filtrelerGorunsun, kartIlerlemesi, secimAdresi, seciliCalismaId } from "@/lib/calisma-karti";
import YeniCalismaPenceresi from "./yeni-calisma-penceresi";
import CalismaDurumKarti from "./calisma-durum-karti";
import { ListeKonumunuSakla } from "../_components/liste-donusu";
import DanismanaGonder from "../_components/danismana-gonder";


/*
  ÇALIŞMALARIM HERKES İÇİN AYNI (20.11.2026, kurum sahibinin ürün kararı:
  ArvoLab tek tip, editör odaklı; kurucu, personel ve bireysel kullanıcı
  aynı deneyimi kullanır). Yalnızca kişinin kendi çalışmaları, iki kart
  (liste + seçili çalışmanın durumu), Yeni çalışma.

  Eskiden gözetim rolünde ayrı bir personel düzeni vardı: kurumun bütün
  çalışmaları, öğrenci adı, onay/onayı geri alma, sayaçlar, toplu
  tutarsızlık taraması, etik işareti. PR #113 bunu bir süre "Yönetim ·
  çalışmalar" sayfasına taşıdı; karar güncellenince o da kalktı.
  Görevlendirme ve operasyon ArvoOS'ta (Talepler, İşler).
*/
export default async function CalismaListesi({
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
  const [{ satirlar: gorunenCalismalar, okunamadi }, profile, params] = await Promise.all([
    getProjects(),
    getCurrentProfile(),
    searchParams,
  ]);
  /* Yalnızca kendi çalışmaları (sorgu da sahibe göre süzülüyor; burası ikinci emniyet). */
  const projects = kisiselCalismalar(gorunenCalismalar, profile?.id);
  const taban = KISISEL_CALISMALAR;
  const [{ stats, openComments }, guidelines] = await Promise.all([
    getWritingStats(
      projects.map((project) => project.id),
      profile?.id
    ),
    // Kartlardaki yazım temposu için uygulanan kılavuzlar (yüklenenler dahil), çalışma kimliğine göre
    createClient().then((supabase) => calismaKilavuzlari(supabase, projects)),
  ]);
  // Arama, filtre ve sıralama (adres satırındaki ?q=…&durum=…&sirala=…)
  const filters = parseProjectFilters(params, PROJECT_STATUSES);
  const visible = applyProjectFilters(projects, filters, {
    openComments: (id: string) => openComments.get(id) ?? 0,
    lastEdited: (projectId: string) => stats.get(projectId)?.updatedAt,
    userId: profile?.id,
  });

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
    İKİ KART (26.10.2026, kurum sahibinin isteği). Solda çalışmalar, sağda
    seçili çalışmanın durumu ve eksikleri; sayfa tek ekran, kaymasız
    (lib/calisma-karti.ts).
  */
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
  /*
    DANIŞMANIMA GÖNDER (premium çalışma alanı, 17.11.2026): bireysel
    abonenin kartı ana sayfadan seçili çalışmanın özetine geldi; iş ve
    sorgu aynı (son geçerli paylaşım bağlantısı, açılma sayısı). Tek ana
    deneyimden beri (20.11.2026) herkesin kendi çalışmasında çiziliyor;
    eskiden kurumu olan öğrencide çizilmiyordu ("danışmanı sistemde") ve
    aynı kişi kurum üyeliğine göre farklı bir çalışma alanı görüyordu.
    Paylaşım işlemi zaten kuruma bakmıyor (app/actions/share-links.ts).
    Okunamazsa kart "henüz gönderilmedi" gibi davranır, sayfa düşmez.
  */
  const sonBaglantiYaniti =
    secili
      ? await (await createClient())
          .from("manuscript_share_links")
          .select("created_at, last_viewed_at, view_count, expires_at")
          .eq("project_id", secili.id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : null;
  if (sonBaglantiYaniti?.error) console.error("[çalışmalarım] danışman bağlantısı okunamadı:", sonBaglantiYaniti.error.message);
  const sonBaglanti = sonBaglantiYaniti?.data ?? null;
  const sonGonderim = sonBaglanti
    ? {
        olusturuldu: sonBaglanti.created_at as string,
        sonAcilis: (sonBaglanti.last_viewed_at as string | null) ?? null,
        acilmaSayisi: Number(sonBaglanti.view_count ?? 0),
        bitis: sonBaglanti.expires_at as string,
      }
    : null;
  const once = (damga: string) => editedAgo(damga, simdi(), dil, saatDilimi);
  const sonGonderimMetni = sonGonderim
    ? sonGonderim.acilmaSayisi
      ? t({
          tr: `Danışmanınız ${sonGonderim.acilmaSayisi} kez açtı · son ${once(sonGonderim.sonAcilis ?? sonGonderim.olusturuldu)}`,
          en: `Your advisor opened it ${sonGonderim.acilmaSayisi} time${sonGonderim.acilmaSayisi === 1 ? "" : "s"} · last ${once(sonGonderim.sonAcilis ?? sonGonderim.olusturuldu)}`,
        })
      : t({
          tr: `Bağlantı ${once(sonGonderim.olusturuldu)} gönderildi · henüz açılmadı`,
          en: `Link sent ${once(sonGonderim.olusturuldu)} · not opened yet`,
        })
    : null;

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
          href={secimAdresi(params, project.id, taban)}
          className="gb-satir"
          aria-current={project.id === seciliId ? "true" : undefined}
          scroll={false}
        >
          <span className="gb-satir-govde">
            <b>{project.title}</b>
            <small>
              {[
                t(projectTypeLabel(project.project_type)),
                yazimOzeti(yazim),
                due?.label,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
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
            {t({
              tr: "Tezinizi ve diğer çalışmalarınızı buradan açın; yazmaya kaldığınız yerden devam edin.",
              en: "Open your thesis and other works here; continue writing where you left off.",
            })}
          </p>
        </div>
        {/*
          Liste boşken başlıktaki düğme İKİNCİL (Phase 3 stabilizasyonu):
          boş durumun "İlk çalışmayı oluştur"u ile yan yana iki koyu düğme
          aynı pencereyi açıyordu. Pencere ve işlevi aynı; değişen yalnızca
          görünüm. Liste okunamadığında boş durum çizilmiyor, düğme ana kalır.
        */}
        {/* Tek giriş noktası, tek bileşen. Eskiden personel ayrı, üniversite seçtiren bir pencere görüyordu (createProject, kaldırıldı). */}
        <YeniCalismaPenceresi acikBasla={params.yeni === "1"} triggerClassName={bosListe ? "projects-filter-button" : undefined} />
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
          /*
            Herkese aynı metin (20.11.2026). Eskiden personele "Üniversitenizi
            seçerek başlayın" deniyordu; ürün artık dünyanın her yerinde
            kullanılıyor ve kurum seçimi başlangıçta istenmiyor.
          */
          aciklama={t({
            tr: "Bir ad, tür ve belge dili seçerek başlayın. Yazım kılavuzunuz varsa çalışmanın içinden ekleyebilirsiniz; kurallar editöre siz onaylayınca uygulanır.",
            en: "Start by choosing a name, type and document language. If you have a writing guideline, you can add it from inside the work; its rules are applied to the editor once you approve them.",
          })}
          eylem={{ etiket: t({ tr: "İlk çalışmayı oluştur", en: "Create your first work" }), href: "/dashboard/editor?yeni=1" }}
        />
      ) : (
        <>
        {filtrelerGorunsun(projects.length) ? (
        <ProjectFilters
          key={JSON.stringify(filters)}
          filters={filters}
          statuses={PROJECT_STATUSES.map((status) => ({ value: status, label: t(statusLabel(status)), tone: statusTone(status) }))}
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
            eylem={{ etiket: t({ tr: "Filtreyi temizle", en: "Clear filter" }), href: taban }}
          />
        ) : (
          <>
          {/*
            Seçili çalışmanın sekmeleri (17.11.2026): Özet, Yazım, Kanıt matrisi,
            Etik kurul ve o çalışmaya süzülü araçlar. Eskiden bu bağlantılar
            kenar çubuğunun çalışma alt menüsündeydi; gezinme artık editörde de
            sabit, bölümler her çalışma sayfasında aynı sekme sırasında.
          */}
          <ListeKonumunuSakla />
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
            {/*
              Seçili çalışmanın sütunu: durum kartı ve (bireysel abonede)
              Danışmanıma gönder alt alta, aynı ızgara hücresinde. Kart ızgarada
              ayrı bir öğe olsaydı tek ekranlık düzende yeni bir satır açıp durum
              kartının altını keserdi. Çalışma bağlamını sekmeler yayınlıyor.
            */}
            <div className="calisma-secili-sutun">
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
            {secili ? (
              <DanismanaGonder projectId={secili.id} baslik={secili.title} sonGonderim={sonGonderim} sonGonderimMetni={sonGonderimMetni} />
            ) : null}
            </div>
          </section>
          </>
        )}
        </>
      )}
    </main>
  );
}
