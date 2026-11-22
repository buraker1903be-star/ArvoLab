import Link from "next/link";
import { aktifDil, aktifSaatDilimi, ceviri } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import { FileText, Search, ArrowRight } from "lucide-react";
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
import { belgeOnizlemesi, onizlemeDolu } from "@/lib/calisma-onizleme";
import ProjectFilters from "./project-filters";
import BosDurum from "../_components/bos-durum";
import { getCurrentProfile } from "@/app/actions/profile";
import { statusTone } from "@/lib/status-tone";
import { filtrelerGorunsun, kartIlerlemesi, secimAdresi, seciliCalismaId } from "@/lib/calisma-karti";
import YeniCalismaPenceresi from "./yeni-calisma-penceresi";
import CalismaDurumKarti from "./calisma-durum-karti";
import CalismaKartMenusu from "./calisma-kart-menusu";
import PanelDrawer from "../_components/panel-drawer";
import { ListeKonumunuSakla } from "../_components/liste-donusu";

/*
  ÇALIŞMALARIM (22.11.2026 sadeleştirmesi, kurum sahibinin taslağı).

  Sayfa tek bir soruya cevap veriyor: "nerede kalmıştım?". En son
  düzenlenen çalışma ÖNE ÇIKAN kartta; varsa ötekiler altında kompakt bir
  listede. Aynı çalışma iki kez görünmez.

  Eskiden (26.10.2026) iki sütun vardı: solda bütün çalışmaların listesi ve
  bir özet (toplam yazılan / en yakın teslim / son yazım), sağda seçili
  çalışmanın durum kartı. İki sütun aynı anda doluyken sayfa, daha yazmaya
  başlamamış bir öğrenciye bile yönetim paneli gibi görünüyordu. Düzen
  kalktı; İŞLEV kalkmadı, yalnızca yer değiştirdi:

    - teslim tarihi, hazırlık, kapak, kılavuz, yapı uyarıları, literatür,
      kaynakça, kanıt matrisi, etik kurul ve analiz → "Çalışma ayrıntıları"
      panelinde (aynı CalismaDurumKarti, panel kipinde);
    - paylaşım (danışmana gönder) ve Word/PDF/ZIP dışa aktarma → kartın
      "⋯" menüsünde (calisma-kart-menusu.tsx);
    - arama/filtre/sıralama çok çalışması olanda yerinde duruyor.

  Çalışma seçimi değişmedi: kompakt satır `?sec=<id>` ile o çalışmayı öne
  çıkarır (lib/calisma-karti.ts). Böylece öne çıkmayan bir çalışmanın
  ayrıntılarına ve menüsüne de ulaşılıyor.

  Önizleme KAYDEDİLMİŞ içerikten okunur (lib/calisma-onizleme.ts) ve
  yalnızca öne çıkan çalışma için: editör başlatılmaz, kayıt tetiklenmez.
  Sayfayı açıp kapatmak belgeyi ya da son düzenleme zamanını değiştirmez.
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
    createClient().then((supabase) => calismaKilavuzlari(supabase, projects)),
  ]);
  // Arama, filtre ve sıralama (adres satırındaki ?q=…&durum=…&sirala=…)
  const filters = parseProjectFilters(params, PROJECT_STATUSES);
  const visible = applyProjectFilters(projects, filters, {
    openComments: (id: string) => openComments.get(id) ?? 0,
    lastEdited: (projectId: string) => stats.get(projectId)?.updatedAt,
    userId: profile?.id,
  });

  // Silme yetkisi RLS ile aynı: sahibi ya da Yönetici/Sistem Yöneticisi/Kurucu.
  const canDeleteAnyProject =
    profile?.role === "academic_manager" || profile?.role === "system_admin" || profile?.role === "founder";

  type Calisma = (typeof projects)[number];
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

  /* Öne çıkan çalışma: en son düzenlenen (bitmişler geride), `?sec=` ile değiştirilebilir. */
  const oneCikanId = seciliCalismaId(
    visible.map((project) => project.id),
    typeof params.sec === "string" ? params.sec : null,
    (id) => stats.get(id)?.updatedAt,
    (id) => {
      const durum = visible.find((project) => project.id === id)?.status;
      return durum !== "delivered" && durum !== "archived";
    },
  );
  const oneCikan = oneCikanId ? visible.find((project) => project.id === oneCikanId) ?? null : null;
  /* Aynı çalışma iki kez görünmesin: öne çıkan kompakt listeye girmez. */
  const digerleri = visible.filter((project) => project.id !== oneCikan?.id);
  /*
    TAMAMLANANLAR AYRI (28.10.2026'dan beri; sadeleştirmede korundu).
    Teslim edilmiş ve arşivlenmiş çalışmalar aktiflerin arasına karışırsa
    üç dönemlik öğrencinin listesinde güncel tez eski ödevlerin arasında
    kayboluyordu. Aktifler üstte, bitenler kapalı bir grupta.
  */
  const bitti = (status: string) => status === "delivered" || status === "archived";
  const digerAktif = digerleri.filter((project) => !bitti(project.status));
  const digerBiten = digerleri.filter((project) => bitti(project.status));

  /*
    Önizleme yalnızca öne çıkan çalışma için ve yalnızca OKUNARAK: tek
    satır, tek sorgu; liste büyüdükçe artmaz. Okunamazsa önizleme boş
    kalır, sayfa düşmez.
  */
  let onizleme = belgeOnizlemesi(null);
  if (oneCikan) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_manuscripts")
      .select("content")
      .eq("project_id", oneCikan.id)
      .maybeSingle();
    if (error) console.error("[çalışmalarım] önizleme okunamadı:", error.message);
    onizleme = belgeOnizlemesi(data?.content);
  }

  /*
    TOPLAM SAYI TEK YERDE (22.11.2026). Filtre çubuğu zaten "N çalışma"
    yazıyor (project-filter-count); "Son çalışmanız" yanında aynı sayıyı
    tekrarlamak iki ayrı toplam varmış gibi okunuyordu. Çubuk yoksa (az
    çalışma) sayı başlığın yanında duruyor, böylece hiç kaybolmuyor.
  */
  const filtreCubuguVar = filtrelerGorunsun(projects.length);
  const calismaSayisi = filtreCubuguVar
    ? null
    : t({ tr: `${projects.length} çalışma`, en: `${projects.length} work${projects.length === 1 ? "" : "s"}` });

  const yazimOzeti = (project: Calisma) => {
    const yazim = stats.get(project.id);
    return yazim
      ? t({
          tr: `${yazim.words.toLocaleString(YEREL[dil])} kelime · ${editedAgo(yazim.updatedAt, simdi(), dil, saatDilimi)}`,
          en: `${yazim.words.toLocaleString(YEREL[dil])} words · ${editedAgo(yazim.updatedAt, simdi(), dil, saatDilimi)}`,
        })
      : t({ tr: "henüz yazılmadı", en: "not written yet" });
  };

  const kompaktSatir = (project: Calisma) => {
    const due = vade(project.due_date, project.status);
    return (
      <li key={project.id}>
        <Link href={secimAdresi(params, project.id, taban)} className="calismalarim-satir" scroll={false}>
          <span className="calismalarim-satir-govde">
            <b>{project.title}</b>
            <small>{[t(projectTypeLabel(project.project_type)), yazimOzeti(project), due?.label].filter(Boolean).join(" · ")}</small>
          </span>
          <span className="status-pill" data-tone={statusTone(project.status)}>
            {t(statusLabel(project.status))}
          </span>
        </Link>
      </li>
    );
  };

  const bosListe = !okunamadi && projects.length === 0;
  const oneCikanYazim = oneCikan ? stats.get(oneCikan.id) : undefined;

  return (
    <main className="dashboard-page calismalarim">
      <section className="calismalarim-bas">
        <div className="calismalarim-bas-metin">
          <p className="calismalarim-ustbaslik">{t({ tr: "Yazı alanınız", en: "Your writing space" })}</p>
          <h1>{t({ tr: "Çalışmalarım", en: "My works" })}</h1>
          <p className="calismalarim-aciklama">{t({ tr: "Kaldığınız yerden devam edin.", en: "Pick up where you left off." })}</p>
        </div>
        {/*
          Yeni çalışma İKİNCİL görünümde (taslak): sayfanın ana eylemi
          "Yazmaya devam et". Boş listede de aynı düğme, aynı pencere.
        */}
        <YeniCalismaPenceresi acikBasla={params.yeni === "1"} triggerClassName="projects-filter-button calismalarim-yeni" />
      </section>

      {okunamadi ? (
        /* Liste okunamadı: kayıtlar yerinde, yalnızca okuma düştü. */
        <section className="alert" data-tone="danger" role="alert">
          <strong>{t({ tr: "Çalışmalarınız yüklenemedi.", en: "Your works could not be loaded." })}</strong>
          <p>
            {t({
              tr: "Bu bir bağlantı ya da yetki arızası; kayıtlarınız yerinde duruyor. Sayfayı yenileyin, sorun sürerse Uygulama Destek'ten bildirin.",
              en: "This is a connection or permission failure; your records are safe. Refresh the page, and if the problem persists, report it via App Support.",
            })}
          </p>
        </section>
      ) : bosListe ? (
        <BosDurum
          ikon={FileText}
          baslik={t({ tr: "Henüz kayıtlı çalışmanız yok", en: "You have no works yet" })}
          aciklama={t({
            tr: "Bir ad, tür ve belge dili seçerek başlayın. Yazım kılavuzunuz varsa çalışmanın içinden ekleyebilirsiniz; kurallar editöre siz onaylayınca uygulanır.",
            en: "Start by choosing a name, type and document language. If you have a writing guideline, you can add it from inside the work; its rules are applied to the editor once you approve them.",
          })}
          eylem={{ etiket: t({ tr: "İlk çalışmayı oluştur", en: "Create your first work" }), href: "/dashboard/editor?yeni=1" }}
        />
      ) : (
        <>
          <ListeKonumunuSakla />
          {filtreCubuguVar ? (
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
          ) : oneCikan ? (
            <>
              <div className="calismalarim-bolum-bas">
                <h2>{t({ tr: "Son çalışmanız", en: "Your latest work" })}</h2>
                {calismaSayisi ? <span>{calismaSayisi}</span> : null}
              </div>

              <article className="calismalarim-one-cikan">
                <div className="one-cikan-govde">
                  <span className="one-cikan-tur">{t(projectTypeLabel(oneCikan.project_type))}</span>
                  <h3>{oneCikan.title}</h3>
                  <p className="one-cikan-olcu">
                    {oneCikanYazim ? (
                      <>
                        <b>{oneCikanYazim.words.toLocaleString(YEREL[dil])}</b> {t({ tr: "kelime", en: "words" })}
                        <span className="one-cikan-ayrac" aria-hidden="true" />
                        {t({
                          tr: `${editedAgo(oneCikanYazim.updatedAt, simdi(), dil, saatDilimi)} düzenlendi`,
                          en: `edited ${editedAgo(oneCikanYazim.updatedAt, simdi(), dil, saatDilimi)}`,
                        })}
                      </>
                    ) : (
                      t({ tr: "henüz yazılmadı", en: "not written yet" })
                    )}
                  </p>
                  <div className="one-cikan-eylem">
                    <Link href={`/dashboard/editor/${oneCikan.id}/write`} className="projects-primary-button">
                      {oneCikanYazim ? t({ tr: "Yazmaya devam et", en: "Continue writing" }) : t({ tr: "Yazmaya başla", en: "Start writing" })}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    {/*
                      Çalışma ayrıntıları: teslim tarihi, hazırlık, kapak,
                      kılavuz, yapı uyarıları ve çalışmanın birimleri
                      (literatür, kaynakça, kanıt, etik, analiz). Kartın
                      kendisi değişmedi; yalnızca panelde çiziliyor.
                    */}
                    <PanelDrawer
                      triggerLabel={t({ tr: "Çalışma ayrıntıları", en: "Work details" })}
                      triggerClassName="calismalarim-ayrinti"
                      title={oneCikan.title}
                      kicker={t({ tr: "Çalışma ayrıntıları", en: "Work details" })}
                      boy="genis"
                      acikBasla={params.ayrinti === "1"}
                    >
                      <CalismaDurumKarti
                        key={oneCikan.id}
                        projectId={oneCikan.id}
                        kelime={oneCikanYazim?.words ?? null}
                        ilerleme={yazimDurumu(oneCikan).ilerleme}
                        due={vade(oneCikan.due_date, oneCikan.status)}
                        duzenleyebilir={profile?.id === oneCikan.owner_id || profile?.id === oneCikan.assignee_id}
                        silebilir={profile?.id === oneCikan.owner_id || canDeleteAnyProject}
                        kilavuzAc={params.kilavuz === "1" && params.sec === oneCikan.id}
                        takvimAc={params.takvim === "1" && params.sec === oneCikan.id}
                        panelIcinde
                      />
                    </PanelDrawer>
                  </div>
                </div>

                {/*
                  Belge önizlemesi: kaydedilmiş içerikten. İçerik yoksa kutu
                  HİÇ çizilmez — sahte metin ya da "yükleniyor" çizgisi yok.
                */}
                {onizlemeDolu(onizleme) ? (
                  <aside className="one-cikan-onizleme" aria-label={t({ tr: "Belge önizlemesi", en: "Document preview" })}>
                    <div className="onizleme-kagit">
                      {onizleme.baslik ? <b>{onizleme.baslik}</b> : null}
                      {onizleme.satirlar.map((satir, i) => (
                        <p key={i}>{satir}</p>
                      ))}
                    </div>
                  </aside>
                ) : null}

                {/*
                  "⋯": paylaş ve indir, teslim paketi ve Çalışmayı sil.
                  silebilir SUNUCUDA, RLS'in kuralıyla aynı hesaplanıyor
                  (sahibi ya da Yönetici/Sistem Yöneticisi/Kurucu) ve
                  ayrıntılar panelindekiyle aynı değer; `?sec=` ile başka
                  bir çalışma öne çıktığında menü de onun id'si ve adıyla
                  çiziliyor.
                */}
                <CalismaKartMenusu
                  projectId={oneCikan.id}
                  baslik={oneCikan.title}
                  kelime={oneCikanYazim?.words ?? null}
                  silebilir={profile?.id === oneCikan.owner_id || canDeleteAnyProject}
                />
              </article>

              {digerleri.length ? (
                <section className="calismalarim-diger" aria-label={t({ tr: "Diğer çalışmalar", en: "Other works" })}>
                  <div className="calismalarim-bolum-bas">
                    <h2>{t({ tr: "Diğer çalışmalar", en: "Other works" })}</h2>
                    <span>
                      {t({
                        tr: `${digerleri.length} çalışma`,
                        en: `${digerleri.length} work${digerleri.length === 1 ? "" : "s"}`,
                      })}
                    </span>
                  </div>
                  {digerAktif.length ? <ul className="calismalarim-liste">{digerAktif.map(kompaktSatir)}</ul> : null}
                  {digerBiten.length ? (
                    <details className="calismalarim-tamamlanan" open={!digerAktif.length}>
                      <summary>
                        {t({ tr: "Tamamlananlar ve arşiv", en: "Completed and archived" })} · {digerBiten.length}
                      </summary>
                      <ul className="calismalarim-liste">{digerBiten.map(kompaktSatir)}</ul>
                    </details>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            /* Seçilebilir çalışma bulunamadı (hepsi süzüldü): liste yine gösterilir. */
            <ul className="calismalarim-liste">{visible.map(kompaktSatir)}</ul>
          )}
        </>
      )}
    </main>
  );
}
