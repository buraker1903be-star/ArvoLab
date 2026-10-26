import { redirect } from "next/navigation";
import Link from "next/link";
import { PenLine, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { siradakiAdimlar } from "@/lib/calisma-ozeti";
import { siradakiIs } from "@/lib/siradaki-is";
import { getProjects } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel, isOversightRole, STAFF_ROLES } from "@/lib/project-labels";
import { getCurrentProfile } from "@/app/actions/profile";
import { getAccessState } from "@/lib/access";
import LicenseCard from "./_components/license-card";
import GeriBildirimKarti from "./_components/geri-bildirim-karti";
import { geriBildirimSorusu } from "@/app/actions/geri-bildirim";
import { computeAttention } from "@/lib/attention";
import { ilkKullanim } from "@/lib/ilk-kullanim";
import { manuscriptReadiness } from "@/lib/manuscript-readiness";
import { metinListeTutarsizliklari } from "@/lib/calisma-tutarlilik";
import { statusTone } from "@/lib/status-tone";
import { dueInfo } from "@/lib/due-date";
import { editedAgo, getWritingStats } from "@/lib/writing-stats";
import { calismaKilavuzu } from "@/lib/guideline-rules";
import { hareketSerisi, ilkAd, selamlama, simdi } from "@/lib/genel-bakis";
import { trTarih } from "@/lib/tr-time";
import { GENEL_BAKIS_SATIR, ListeIzgarasi, ListeKarti, ListeSatiri, SeriKarti } from "./_components/genel-bakis";

const isActive = (status: string) => status !== "delivered" && status !== "archived";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [{ satirlar: projects, okunamadi: projelerOkunamadi }, profile] = await Promise.all([
    getProjects(),
    getCurrentProfile(),
  ]);
  // Ad profilden: Ayarlar'dan değiştirilen ad yalnızca profiles'a yazılıyor,
  // karşılama satırı kayıttaki eski adı (user_metadata) gösteriyordu.
  /*
    Ad yoksa E-POSTA YAZILMIYOR. Panel "Hoş geldiniz,
    uzman@akademikmerkez.com" diyordu: bir selamlama değil, kişinin
    kendi adresini okuması. Ad ArvoOS'tan geliyor (arvoos_members);
    gelmediyse selamlama adsız kalıyor — adsız bir "Hoş geldiniz",
    e-postalı olandan iyi.
  */
  const displayName = profile?.full_name?.trim() || null;
  // Panel düzeniyle aynı istekte paylaşılır (lib/access.ts cache'li).
  const access = await getAccessState(profile);
  const activeProjects = projects.filter((p) => isActive(p.status));
  const [{ stats: writing, openComments }, geriBildirim] = await Promise.all([
    getWritingStats(
      activeProjects.map((p) => p.id),
      user.id
    ),
    // Kullanım geri bildirimi: yalnızca sistemi gerçekten kullanmış kişiye,
    // yalnızca bir kez sorulur (lib/geri-bildirim.ts).
    geriBildirimSorusu(),
  ]);

  // Kaldığınız yer: en son yazılan aktif çalışma; hiç yazılmadıysa en yeni aktif çalışma.
  const resume =
    [...activeProjects]
      .filter((p) => writing.has(p.id))
      .sort((a, b) => writing.get(b.id)!.updatedAt.localeCompare(writing.get(a.id)!.updatedAt))[0] ?? activeProjects[0];
  const resumeStats = resume ? writing.get(resume.id) : undefined;
  const resumeDue = resume ? dueInfo(resume.due_date, resume.status) : null;
  /*
    Yazım temposu ve teslim hazırlığı (editördekiyle aynı hesap).

    calismaKilavuzu kullanılıyor, loadAppliedGuidelines DEĞİL: ikincisi
    yalnızca kataloğa bakıyor ve öğrencinin kendi yüklediği kılavuzu
    görmüyordu. Sonucu, editör kurallara göre çalışırken ana sayfanın
    sayfa hedefini ve hazırlık listesini KILAVUZSUZ hesaplamasıydı —
    aynı çalışma iki ekranda iki ayrı cevap veriyordu.
  */
  const resumeGuideline = resume
    ? (await calismaKilavuzu(supabase, resume.id, resume.guideline_id)) ?? undefined
    : undefined;
  // Teslim hazırlığı: editördeki "Teslim kontrolü" ile aynı hesap, kaydedilmiş metinden (yalnızca bu çalışma)
  const { data: resumeManuscript } =
    resume && resumeStats
      ? await supabase.from("project_manuscripts").select("*").eq("project_id", resume.id).maybeSingle()
      : { data: null };
  const resumeReadiness =
    resume && resumeManuscript
      ? manuscriptReadiness({
          manuscript: resumeManuscript,
          guideline: resumeGuideline ?? null,
          projectType: resume.project_type,
          citationStyle: resume.citation_style ?? "apa7",
        })
      : null;
  /*
    Metin ile literatür listesi arasındaki tutarsızlıklar. Çalışma merkezinde
    ayrıntısıyla duruyor; burada yalnızca sayısı görünüyor ki kullanıcı
    ana sayfadan haberdar olsun. Müsvedde zaten okunmuş durumda, ek maliyet
    yalnızca kaynak listesi.
  */
  const { data: resumeKaynaklar } = resume
    ? await supabase
        .from("literature_sources")
        .select("id, title, authors, year, status")
        .eq("project_id", resume.id)
        .limit(500)
    : { data: null };
  /*
    BİRİM İLERLEMESİ. "Tezimde ne yarım kaldı" sorusunun yarısı metinde
    değil, bağlı birimlerde: literatür toplandı mı, kaynakça denetlendi
    mi, belge yüklendi mi. Bu bilgi yalnızca Çalışma Merkezi'nde
    duruyordu; öğrenci ana sayfada göremiyordu.

    Çalışma merkezinin tamamı (calismaOzeti) çağrılmıyor: o on sorgu
    yapıyor ve çoğu burada zaten okunmuş durumda. Eksik olan iki şey
    ayrıca soruluyor; literatür sayıları elde olan listeden türetiliyor.
  */
  const birimSayimi = (tablo: string, durum?: string) => {
    const sorgu = supabase.from(tablo).select("id", { count: "exact", head: true }).eq("project_id", resume!.id);
    return durum ? sorgu.eq("status", durum) : sorgu;
  };
  const [
    { data: resumeDenetim },
    { count: resumeBelgeSayisi },
    { count: resumeKaynakSayisi },
    { count: resumeOkunan },
    { count: resumeKullanilan },
  ] = resume
    ? await Promise.all([
        supabase
          .from("citation_checks")
          .select("id, compliance_score, created_at")
          .eq("project_id", resume.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        birimSayimi("document_uploads"),
        /*
          Kaynak sayıları ELDEKİ LİSTEDEN sayılmıyor. O liste
          `.limit(500)` ile çekiliyor (tutarsızlık denetimi için) ve
          ondan `filter().length` ile saymak, 500'den çok kaynağı olan
          bir tezde sessizce eksik sayı verirdi — `npm run
          check:rakamlar`ın aradığı hata sınıfı tam olarak bu.
        */
        birimSayimi("literature_sources"),
        birimSayimi("literature_sources", "read"),
        birimSayimi("literature_sources", "used"),
      ])
    : [{ data: null }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }];

  const resumeAdimlar =
    resume && !projelerOkunamadi
      ? siradakiAdimlar({
          calisma: { id: resume.id } as Parameters<typeof siradakiAdimlar>[0]["calisma"],
          musvedde: resumeStats ? { kelime: resumeStats.words, guncellendi: resumeStats.updatedAt } : null,
          literatur: {
            toplam: resumeKaynakSayisi ?? 0,
            okunan: resumeOkunan ?? 0,
            kullanilan: resumeKullanilan ?? 0,
          },
          kaynakca: resumeDenetim
            ? { id: resumeDenetim.id, skor: resumeDenetim.compliance_score, tarih: resumeDenetim.created_at }
            : null,
          belgeSayisi: resumeBelgeSayisi ?? 0,
        })
      : [];

  const resumeTutarsizliklari = resume
    ? metinListeTutarsizliklari(resumeManuscript?.plain_text ?? null, resumeKaynaklar ?? [], resume.citation_style)
    : [];

  // Eksikler önce, bakılması gerekenler sonra
  const readinessGapsSirali = (resumeReadiness?.items ?? [])
    .filter((item) => item.status !== "ok")
    .sort((a, b) => (a.status === "todo" ? 0 : 1) - (b.status === "todo" ? 0 : 1));


  /*
    SIRADAKİ TEK İŞ. Öğrenci dört birim ve üç eksik görüyor; hepsi
    doğru ama hiçbiri "önce hangisi" demiyordu. Kararın kendisi saf bir
    modülde (lib/siradaki-is.ts) ve sınanıyor.
  */
  const sirada =
    resume && !projelerOkunamadi
      ? siradakiIs({
          calismaId: resume.id,
          adimlar: resumeAdimlar,
          eksikler: readinessGapsSirali,
          kalanGun: resumeDue?.days ?? null,
        })
      : null;

  /* "Şimdi" satırındaki madde listede TEKRAR edilmiyor; altındaki
     liste "başka ne var"ı gösteriyor. */
  const readinessGaps = readinessGapsSirali.filter((madde) => madde.id !== sirada?.kaynakMadde);


  const isStaff = profile?.role ? STAFF_ROLES.includes(profile.role) : false;
  // Personel için "dikkat isteyenler" (öğrencinin ana sayfası değişmez); sorumlu ataması yalnızca denetim rollerinde
  const attention = isStaff ? computeAttention(projects, openComments, { includeUnassigned: isOversightRole(profile?.role) }) : null;

  // Karar ve gerekçesi lib/ilk-kullanim.ts'te (sınanabilsin diye orada).
  const yeniKullanici = ilkKullanim({
    calismaSayisi: projects.length,
    okunamadi: projelerOkunamadi,
    personel: isStaff,
  });

  /*
    Çalışma hareketi (grafik) ve son yorumlar. Sayım veritabanında
    (public.calisma_hareketlerim): satırları çekip burada saymak, satır
    tavanına çarpılan gün grafiği sessizce eksiltirdi. Okunamazsa sayfa
    düşmüyor; uyarı satırı neyin eksik olduğunu söylüyor.
  */
  const [hareketYaniti, yorumYaniti] = await Promise.all([
    supabase.rpc("calisma_hareketlerim", { p_gun: 14 }),
    activeProjects.length
      ? supabase
          .from("manuscript_comments")
          .select("id, project_id, body, created_at, author_id, yazar:profiles!manuscript_comments_author_id_fkey(full_name)")
          .in("project_id", activeProjects.map((p) => p.id))
          .is("resolved_at", null)
          .neq("author_id", user.id)
          .order("created_at", { ascending: false })
          .limit(GENEL_BAKIS_SATIR)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (hareketYaniti.error) console.error("[ana sayfa] hareketler okunamadı:", hareketYaniti.error.message);
  if (yorumYaniti.error) console.error("[ana sayfa] yorumlar okunamadı:", yorumYaniti.error.message);
  const simdiAn = simdi();
  const seri = hareketSerisi((hareketYaniti.data ?? []) as { gun: string; tur: string; adet: number }[], simdiAn);
  const okunamayanlar = [
    projelerOkunamadi ? "çalışmalar" : "",
    hareketYaniti.error ? "çalışma hareketi" : "",
    yorumYaniti.error ? "yorumlar" : "",
  ].filter(Boolean);

  const calismaAdi = new Map(projects.map((p) => [p.id, p.title]));
  const yorumlar = (yorumYaniti.data ?? []) as unknown as {
    id: string;
    project_id: string;
    body: string;
    created_at: string;
    yazar: { full_name: string | null } | null;
  }[];

  /* Son düzenlenen önce; hiç yazılmamış çalışmalar sonda. */
  const calismalarim = [...activeProjects]
    .sort((a, b) => (writing.get(b.id)?.updatedAt ?? "").localeCompare(writing.get(a.id)?.updatedAt ?? ""))
    .slice(0, GENEL_BAKIS_SATIR);

  const teslimler = activeProjects
    .map((project) => ({ project, due: dueInfo(project.due_date, project.status) }))
    .filter((item): item is { project: (typeof activeProjects)[number]; due: NonNullable<ReturnType<typeof dueInfo>> } => Boolean(item.due))
    .sort((a, b) => a.due.days - b.due.days)
    .slice(0, GENEL_BAKIS_SATIR);

  /* Öğrencinin dördüncü kartı: önce "şimdi" (lib/siradaki-is), sonra teslim eksikleri. */
  const siradakiler = [
    ...(sirada && !sirada.bitti ? [{ anahtar: "sirada", baslik: sirada.baslik, alt: sirada.aciklama, href: sirada.href }] : []),
    ...readinessGaps.map((madde) => ({
      anahtar: madde.id,
      baslik: madde.label,
      alt: madde.detail ?? "",
      href: `/dashboard/editor/${resume?.id}/write?teslim=${madde.id}`
    })),
    /* Metin ile literatür listesi arasındaki tutarsızlık: ayrıntısı çalışma merkezinde. */
    ...resumeTutarsizliklari.map((sorun) => ({
      anahtar: `tutarsizlik-${sorun.tur}`,
      baslik: sorun.baslik,
      alt: sorun.aciklama,
      href: `/dashboard/editor/${resume?.id}`
    })),
  ].slice(0, GENEL_BAKIS_SATIR);

  const ad = ilkAd(displayName);

  return (
    <main className="dashboard-page gb">
      {/*
        ANA SAYFA ArvoOS'UN GENEL BAKIŞ DÜZENİNDE (26.10.2026, kurum
        sahibinin isteği: "ArvoOS gibi, bir ürün gibi").

        Eskiden dört sayı kartı, "kaldığınız yer" kartı, birim şeridi,
        yan sütun ve kısayol şeridi alt alta diziliyordu; kısayollar
        dock'un kopyasıydı ve kaldırılmış modülleri bile gösteriyordu.
        Şimdi: selamlama · son 14 günün çalışma hareketi · dört liste
        (çalışmalarım, teslimler, yorumlar, sıradakiler). Her kart en
        fazla altı satır ve kendi sayfasına bağlantı; tek ekrana sığar.
      */}
      <header className="gb-selam">
        <div>
          <h1>{ad ? `${selamlama(simdiAn)}, ${ad}` : selamlama(simdiAn)}</h1>
          <p>
            {yeniKullanici
              ? "Çalışma alanınız hazır. İlk çalışmanızı oluşturduğunuzda kılavuzunuz, kaynaklarınız ve denetimleriniz burada toplanır."
              : resume
                ? `Kaldığınız yer: ${resume.title}${resumeStats ? ` · ${resumeStats.words.toLocaleString("tr-TR")} kelime, ${editedAgo(resumeStats.updatedAt)} düzenlendi` : ""}`
                : "Çalışmalarınız, teslim tarihleriniz ve gelen yorumlar burada."}
          </p>
        </div>
        <div className="gb-selam-eylemler">
          {resume ? (
            <Link href={`/dashboard/editor/${resume.id}/write`} className="projects-primary-button">
              <PenLine size={16} aria-hidden="true" />
              {resumeStats ? "Yazmaya devam et" : "Yazmaya başla"}
            </Link>
          ) : null}
          <Link href="/dashboard/editor/new" className={resume ? "projects-filter-button" : "projects-primary-button"}>
            <Plus size={16} aria-hidden="true" />
            Yeni çalışma
          </Link>
        </div>
      </header>

      {okunamayanlar.length ? (
        <p className="alert" role="alert">
          {okunamayanlar.join(", ")} okunamadı; aşağıdaki listeler eksik olabilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.
        </p>
      ) : null}

      <LicenseCard access={access} />

      {geriBildirim.sorulsun ? <GeriBildirimKarti baglam={geriBildirim.baglam} /> : null}

      {yeniKullanici ? (
        <article className="gb-kart gb-baslangic">
          <header className="gb-kart-bas">
            <div>
              <h2>Üç adımda başlayın</h2>
              <p>Üniversitenizi seçin; tez yazım kılavuzunuz editöre kendiliğinden uygulanır.</p>
            </div>
          </header>
          {/*
            Adımlar BAĞLANTI DEĞİL, bilerek. Hiç çalışması olmayan birini
            literatür ya da denetim ekranına göndermek, onu bir boş ekrana
            daha götürmek olurdu; tek yol ileri gidiyor.
          */}
          <ol className="baslangic-adimlari">
            <li>
              <strong>Çalışmanızı açın.</strong> Üniversite ve bölümünüzü seçtiğinizde kurumunuzun onaylı tez
              kılavuzu çalışmaya bağlanır; biçim kuralları editörde kendiliğinden uygulanır.
            </li>
            <li>
              <strong>Kaynaklarınızı toplayın.</strong> DOI yapıştırın, künye Crossref ve OpenAlex kayıtlarından
              dolsun. Atıf stiliniz kılavuzdan gelir; elle seçmeniz gerekmez.
            </li>
            <li>
              <strong>Yazın ve denetleyin.</strong> Metin içi atıflarınız kaynakçanızla karşılaştırılır, iddialarınız
              kanıt matrisinde kaynaklarına bağlanır ve teslim kontrol listesi aynı ekranda durur.
            </li>
          </ol>
          <Link href="/dashboard/editor/new" className="projects-primary-button">
            <Plus size={16} aria-hidden="true" />
            İlk çalışmayı oluştur
          </Link>
        </article>
      ) : (
        <>
          <SeriKarti
            baslik="Çalışma hareketiniz"
            alt="Son 14 gün"
            seri={seri}
            adet="hareket"
            ozet={[
              { ad: "Kayıtlı sürüm", deger: seri.turler.surum },
              { ad: "Eklenen kaynak", deger: seri.turler.kaynak },
              { ad: "Denetim", deger: seri.turler.denetim },
              { ad: "Asistan", deger: seri.turler.asistan },
              { ad: "Kanıt", deger: seri.turler.kanit },
            ]}
            bos="Son 14 günde kayıtlı hareket yok. Yazdıkça, kaynak ekledikçe ve denetim çalıştırdıkça burada görünür."
          />

          <ListeIzgarasi etiket="Güncel işler">
            <ListeKarti
              baslik="Çalışmalarım"
              alt={`Aktif ${activeProjects.length} çalışma`}
              bos="Aktif çalışma yok."
              sayi={calismalarim.length}
              href="/dashboard/editor"
              hrefEtiket="Tüm çalışmalar"
            >
              {calismalarim.map((p) => {
                const yazim = writing.get(p.id);
                return (
                  <ListeSatiri
                    key={p.id}
                    href={`/dashboard/editor/${p.id}`}
                    baslik={p.title}
                    alt={`${projectTypeLabel(p.project_type)} · ${yazim ? `${yazim.words.toLocaleString("tr-TR")} kelime, ${editedAgo(yazim.updatedAt)}` : "yazılmadı"}`}
                    sag={
                      <span className="status-pill" data-tone={statusTone(p.status)}>
                        {statusLabel(p.status)}
                      </span>
                    }
                  />
                );
              })}
            </ListeKarti>

            <ListeKarti
              baslik="Teslim tarihleri"
              alt="En yakın teslimler"
              bos="Teslim tarihi girilmiş çalışma yok. Çalışma ayarlarından ekleyebilirsiniz."
              sayi={teslimler.length}
              href="/dashboard/editor"
              hrefEtiket="Çalışmalara git"
            >
              {teslimler.map(({ project, due }) => (
                <ListeSatiri
                  key={project.id}
                  href={`/dashboard/editor/${project.id}`}
                  baslik={project.title}
                  alt={project.due_date ? trTarih(project.due_date) : undefined}
                  sag={
                    <span className="status-pill" data-tone={due.tone}>
                      {due.label}
                    </span>
                  }
                />
              ))}
            </ListeKarti>

            <ListeKarti
              baslik="Gelen yorumlar"
              alt="Çözülmemiş, son 6"
              bos="Danışmanınızdan ya da ekipten bekleyen yorum yok."
              sayi={yorumlar.length}
            >
              {yorumlar.map((yorum) => (
                <ListeSatiri
                  key={yorum.id}
                  href={`/dashboard/editor/${yorum.project_id}/write`}
                  baslik={yorum.yazar?.full_name?.trim() || calismaAdi.get(yorum.project_id) || "Yorum"}
                  alt={yorum.body}
                  onizleme
                  zaman={editedAgo(yorum.created_at, simdiAn)}
                />
              ))}
            </ListeKarti>

            {/*
              Dördüncü kart role göre: öğrenciye "şimdi ne yapmalıyım",
              personele "ne dikkat istiyor". Sayı kartları (aktif,
              revizyonda, incelemede, analizde) kalktı: yöneticinin bakışı
              bu listede, tek tezi olan öğrenciye bir şey söylemiyorlardı.
            */}
            {attention ? (
              <ListeKarti
                baslik="Dikkat isteyenler"
                alt="Gecikmiş, sorumlusuz ya da yanıt bekleyen"
                bos="Gecikmiş, sorumlusuz, onay ya da yanıt bekleyen çalışma yok."
                sayi={attention.length}
              >
                {attention.slice(0, GENEL_BAKIS_SATIR).map((item) => (
                  <ListeSatiri
                    key={item.id}
                    href={item.href}
                    baslik={item.label}
                    sag={
                      <span className="status-pill" data-tone={item.tone}>
                        {item.count}
                      </span>
                    }
                  />
                ))}
              </ListeKarti>
            ) : (
              <ListeKarti
                baslik="Sıradaki işler"
                alt={resume ? resume.title : "Kaldığınız çalışma"}
                bos={sirada?.bitti ? "Teslim listesinde eksik görünmüyor." : "Şu an bekleyen bir adım yok."}
                sayi={siradakiler.length}
                href={resume ? `/dashboard/editor/${resume.id}` : undefined}
                hrefEtiket="Çalışma merkezi"
              >
                {siradakiler.map((madde) => (
                  <ListeSatiri key={madde.anahtar} href={madde.href} baslik={madde.baslik} alt={madde.alt} />
                ))}
              </ListeKarti>
            )}
          </ListeIzgarasi>
        </>
      )}
    </main>
  );
}
