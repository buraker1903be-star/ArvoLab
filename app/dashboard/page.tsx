import { redirect } from "next/navigation";
import { aktifDil, aktifSaatDilimi, ceviri, tarihler } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import Link from "next/link";
import { LayoutList, PenLine, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { siradakiAdimlar } from "@/lib/calisma-ozeti";
import { siradakiIs } from "@/lib/siradaki-is";
import { getProjects } from "@/app/actions/projects";
import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { projectTypeLabel, statusLabel, isOversightRole, isExpertEligible, ADMIN_ROLES, STAFF_ROLES } from "@/lib/project-labels";
import { personelSayaclari } from "@/lib/personel-sayaclari";
import { DEFAULT_PROJECT_FILTERS } from "@/lib/project-filters";
import { kuyrukAdresi } from "@/lib/destek-kuyrugu";
import { getCurrentProfile } from "@/app/actions/profile";
import { getAccessState } from "@/lib/access";
import LicenseCard from "./_components/license-card";
import AbonelikOzetKarti from "./_components/abonelik-ozet-karti";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
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
import { yazimRitmi } from "@/lib/yazim-ritmi";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import { writingPace } from "@/lib/writing-pace";
import { makaleBolumleri } from "@/lib/makale/bolumler";
import { headingMatchesSection } from "@/lib/section-match";
import { trGunAnahtari } from "@/lib/tr-time";
import { takvimiGetir } from "@/app/actions/tez-takvimi";
import { kalanMetni, siradakiTas, takvimOzeti } from "@/lib/tez-takvimi";
import { calismaAdresi } from "@/lib/calisma-karti";
import TeslimTarihiFormu from "./_components/teslim-tarihi-formu";
import DanismanaGonder from "./_components/danismana-gonder";
import { GENEL_BAKIS_SATIR, ListeIzgarasi, ListeKarti, ListeSatiri, RitimKarti, SeriKarti } from "./_components/genel-bakis";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Ana Sayfa", en: "Home" }) };
}

/*
  TEK EKRAN KURALI (kurum sahibinin altın kuralı: her modülün ana sayfası
  tek sayfa, yatay ve dikey kayma yok). Bölümlerim kartı en fazla bu kadar
  satır çizer; fazlası alt başlıkta söylenir, tam liste editörde.
*/
const BOLUM_SATIRI = 5;
const isActive = (status: string) => status !== "delivered" && status !== "archived";

export default async function DashboardPage() {
  const t = await ceviri();
  const dil = await aktifDil();
  const saatDilimi = await aktifSaatDilimi();
  const { tarih } = await tarihler();
  const sayi = (n: number) => n.toLocaleString(YEREL[dil]);
  /* editedAgo: dil ve saat dilimi her çağrıda aynı; "şimdi" verilmezse o anki saat. */
  const once = (damga: string, an?: number) => editedAgo(damga, an ?? simdi(), dil, saatDilimi);
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
  /*
    Düzen rol ve kurumdan; iç ekip öğrenci düzenini önizleyebilir
    (lib/onizleme.ts). Önizlemede yalnızca DÜZEN değişir: veriler
    yöneticinin kendi çalışmaları, yetkiler aynı.

    Karar öne alındı (27.10.2026): personelin ana sayfası "kaldığınız
    yer" göstermiyor, ama aşağıdaki tez sorguları (müsvedde, kaynaklar,
    denetim, belge sayıları) personelde de çalışıyordu — kurumun en son
    düzenlenen öğrenci tezi için, ekranda hiç kullanılmadan.
  */
  const gorunum = await sayfaGorunumu({
    rol: profile?.role,
    personelRolu: profile?.role ? STAFF_ROLES.includes(profile.role) : false,
    kurumVar: Boolean(profile?.organization_id),
  });
  const isStaff = gorunum.personel;
  const [{ stats: writing, openComments }, geriBildirim] = await Promise.all([
    /* Personelde BÜTÜN çalışmalar: sayaçlar Çalışmalarım'daki filtreyle
       aynı sayıyı vermeli (teslim edilmiş bir çalışmanın açık yorumu da
       "Açık yorumlu" filtresinde çıkıyor). */
    getWritingStats(
      (isStaff ? projects : activeProjects).map((p) => p.id),
      user.id
    ),
    // Kullanım geri bildirimi: yalnızca sistemi gerçekten kullanmış kişiye,
    // yalnızca bir kez sorulur (lib/geri-bildirim.ts).
    geriBildirimSorusu(),
  ]);


  // Kaldığınız yer: en son yazılan aktif çalışma; hiç yazılmadıysa en yeni aktif çalışma. Personelde yok.
  const resume = isStaff ? undefined : [...activeProjects]
      .filter((p) => writing.has(p.id))
      .sort((a, b) => writing.get(b.id)!.updatedAt.localeCompare(writing.get(a.id)!.updatedAt))[0] ?? activeProjects[0];
  const resumeStats = resume ? writing.get(resume.id) : undefined;
  const resumeDue = resume ? dueInfo(resume.due_date, resume.status, new Date(), dil) : null;
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
        }, dil)
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
        }, dil)
      : [];

  const resumeTutarsizliklari = resume
    ? metinListeTutarsizliklari(resumeManuscript?.plain_text ?? null, resumeKaynaklar ?? [], resume.citation_style, dil)
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
          dil,
        })
      : null;

  /* "Şimdi" satırındaki madde listede TEKRAR edilmiyor; altındaki
     liste "başka ne var"ı gösteriyor. */
  const readinessGaps = readinessGapsSirali.filter((madde) => madde.id !== sirada?.kaynakMadde);


  // Personel için "dikkat isteyenler" (öğrencinin ana sayfası değişmez); sorumlu ataması yalnızca denetim rollerinde
  const attention = isStaff ? computeAttention(projects, openComments, { includeUnassigned: isOversightRole(profile?.role), dil }) : null;

  /*
    PERSONEL ANA SAYFASI: SAYAÇLAR VE KUYRUKLAR (27.10.2026). Sayaçlar
    Çalışmalarım'daki sayaçların AYNISI (lib/personel-sayaclari.ts): sayı,
    basınca açılan filtreli listenin uzunluğu. Yalnızca gözetim rolünde —
    filtreler (onay, sorumlu) orada anlamlı. Kuyruk sayıları Destek'in
    kuyruklarına gidiyor; yalnızca o kuyruğa yetkisi olana.
  */
  const gozetim = isStaff && isOversightRole(profile?.role);
  const sayaclar = gozetim
    ? personelSayaclari(projects, { ...DEFAULT_PROJECT_FILTERS }, {
        openComments: (id) => openComments.get(id) ?? 0,
        lastEdited: (id) => writing.get(id)?.updatedAt,
        userId: user.id,
        canFilterAssignee: true,
      }, dil)
    : [];
  const uzmanKuyrugu = isStaff && isExpertEligible(profile?.role);
  const destekKuyrugu = isStaff && Boolean(profile?.role && ADMIN_ROLES.includes(profile.role));
  /* Sayaçlar kuyruk listeleriyle AYNI kurum süzgecinden geçer (lib/kurum-secimi.ts); yoksa rozet başka, liste başka sayı söylerdi. */
  const kurum = await seciliKurum();
  // Kurumda hiç kullanıcı yoksa hiçbir talep eşleşmemeli: boş dizi PostgREST'te geçersiz, eşleşmeyen bir kimlik veriliyor.
  const talepSahipleri = kurum ? (kurum.kullanicilar.length ? kurum.kullanicilar : ["00000000-0000-0000-0000-000000000000"]) : null;
  const uzmanSorgusu = supabase.from("consultancy_requests").select("id", { count: "exact", head: true }).eq("status", "open");
  const destekSorgusu = supabase.from("app_support_requests").select("id", { count: "exact", head: true }).neq("status", "resolved");
  const [{ count: acikUzman, error: uzmanHatasi }, { count: acikDestek, error: destekHatasi }] = await Promise.all([
    uzmanKuyrugu
      ? talepSahipleri ? uzmanSorgusu.in("requested_by", talepSahipleri) : uzmanSorgusu
      : Promise.resolve({ count: null, error: null }),
    destekKuyrugu
      ? talepSahipleri ? destekSorgusu.in("requested_by", talepSahipleri) : destekSorgusu
      : Promise.resolve({ count: null, error: null }),
  ]);
  if (uzmanHatasi) console.error("[ana sayfa] uzman kuyruğu okunamadı:", uzmanHatasi.message);
  if (destekHatasi) console.error("[ana sayfa] destek kuyruğu okunamadı:", destekHatasi.message);
  /* Okunamayan kuyruk "0" demiyor: sayaç çizilmiyor, uyarı satırı söylüyor. */
  const kuyrukSayaclari = [
    ...(uzmanKuyrugu && !uzmanHatasi
      ? [{ anahtar: "uzman", etiket: t({ tr: "Açık uzman talebi", en: "Open expert requests" }), sayi: acikUzman ?? 0, href: kuyrukAdresi("uzman-acik") }]
      : []),
    ...(destekKuyrugu && !destekHatasi
      ? [{ anahtar: "destek", etiket: t({ tr: "Uygulama desteği", en: "App support" }), sayi: acikDestek ?? 0, href: kuyrukAdresi("destek") }]
      : []),
  ];

  /* Personel listelerinde öğrencinin adı (RLS: kendi kurumu). Okunamazsa ad boş kalır. */
  const sahipAdlari = new Map<string, string>();
  if (isStaff && projects.length) {
    const { data: sahipler, error: sahipHatasi } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(projects.map((p) => p.owner_id))]);
    if (sahipHatasi) console.error("[ana sayfa] öğrenci adları okunamadı:", sahipHatasi.message);
    for (const sahip of sahipler ?? []) if (sahip.full_name) sahipAdlari.set(sahip.id, sahip.full_name);
  }

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
    // Çok çalışmalı grafik yalnızca personelde; öğrencinin grafiği yazım ritmi.
    isStaff ? supabase.rpc("calisma_hareketlerim", { p_gun: 14 }) : Promise.resolve({ data: [], error: null }),
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
  /*
    ÖĞRENCİNİN TEZ KARTI İÇİN: yazım ritmi (gün başına son kelime sayısı,
    sayım veritabanında: public.yazim_ritmi) ve kanıt matrisinin iki
    sayısı. Personelde istenmiyor; onun ana sayfası çok çalışmalı liste.
  */
  const ogrenciGorunumu = !isStaff && Boolean(resume) && !yeniKullanici;
  /* Öğrenci yeni çalışmayı Çalışmalarım'daki pencerede başlatır (kendi
     kılavuzunu orada ekler); personelin tam formu ayrı sayfada. */
  const yeniCalismaHref = isStaff ? "/dashboard/editor/new" : "/dashboard/editor?yeni=1";
  const [ritimYaniti, { count: iddiaSayisi }, { count: dogrudanSayisi }] = ogrenciGorunumu
    ? await Promise.all([
        supabase.rpc("yazim_ritmi", { p_project: resume!.id, p_gun: 14 }),
        supabase.from("kanit_kayitlari").select("id", { count: "exact", head: true }).eq("project_id", resume!.id),
        supabase
          .from("kanit_kayitlari")
          .select("id", { count: "exact", head: true })
          .eq("project_id", resume!.id)
          .eq("destek_duzeyi", "dogrudan"),
      ])
    : [{ data: null, error: null }, { count: 0 }, { count: 0 }];
  if (ritimYaniti.error) console.error("[ana sayfa] yazım ritmi okunamadı:", ritimYaniti.error.message);
  /*
    TEZ TAKVİMİ (28.10.2026): sıradaki kilometre taşı tez kartında.
    Okunamazsa satır çizilmiyor; "plan yok" demek yanlış olurdu.
  */
  const bugunGun = trGunAnahtari();
  const takvim = ogrenciGorunumu ? await takvimiGetir(resume!.id) : null;
  const siradakiKilometre = takvim ? siradakiTas(takvim, bugunGun) : null;
  const takvimSayilari = takvim ? takvimOzeti(takvim, bugunGun) : null;

  /*
    BİREYSEL ABONENİN DANIŞMANI SİSTEMDE DEĞİL. Danışmanın ArvoLab'da yorum
    yazabilmesi kurumun abone olmasına bağlı; kurumu olmayan öğrencide
    "Danışman yorumları" kartı hep boş kalırdı. Orada "Danışmanıma gönder"
    duruyor ve son gönderilen bağlantının durumu (açıldı mı, kaç kez)
    gösteriliyor — öğrencinin "hocam baktı mı?" sorusu.
  */
  const bireysel = ogrenciGorunumu && gorunum.bireysel;

  /*
    Asistan kredisi (tez kartının yanındaki Abonelik ve kredi kartı).
    Okunamazsa kart sayı göstermiyor; ana sayfa düşmüyor.
  */
  const { data: krediSatiri, error: krediHatasi } = ogrenciGorunumu
    ? await supabase.rpc("ai_kredi_durumum").maybeSingle()
    : { data: null, error: null };
  if (krediHatasi) console.error("[ana sayfa] kredi durumu okunamadı:", krediHatasi.message);
  const kredi = krediOzeti((krediSatiri as KrediSatiri | null) ?? null);
  const { data: sonBaglanti } = bireysel
    ? await supabase
        .from("manuscript_share_links")
        .select("created_at, last_viewed_at, view_count, expires_at")
        .eq("project_id", resume!.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (hareketYaniti.error) console.error("[ana sayfa] hareketler okunamadı:", hareketYaniti.error.message);
  if (yorumYaniti.error) console.error("[ana sayfa] yorumlar okunamadı:", yorumYaniti.error.message);
  const simdiAn = simdi();
  const seri = hareketSerisi((hareketYaniti.data ?? []) as { gun: string; tur: string; adet: number }[], simdiAn, 14, dil);
  const ritim = yazimRitmi((ritimYaniti.data ?? []) as { gun: string; kelime: number }[], simdiAn, 14, resumeStats?.words ?? null, dil);
  /*
    Hedef kelime ve günlük tempo kılavuzun sayfa sınırından
    (lib/writing-pace.ts). Kılavuz yoksa hedef de yok; uydurma bir
    "%40 tamamlandı" göstermek yerine yalnızca yazılan sayı yazılıyor.
  */
  const tempo =
    resume && resumeGuideline
      ? writingPace({
          words: resumeStats?.words ?? 0,
          minPages: resumeGuideline.minPages,
          maxPages: resumeGuideline.maxPages,
          dueDate: resume.due_date,
          status: resume.status,
          settings: {
            fontSizePt: resumeGuideline.settings.fontSizePt,
            lineSpacing: resumeGuideline.settings.lineSpacing,
            margins: resumeGuideline.settings.margins,
          },
        }, dil)
      : null;
  const yazilanYuzde = tempo ? Math.min(100, Math.round(((resumeStats?.words ?? 0) / Math.max(1, tempo.targetWords)) * 100)) : null;

  /*
    BÖLÜMLERİM: müsveddenin üst düzey başlıkları ve sözcük sayıları;
    kılavuzun zorunlu tuttuğu ama metinde başlığı olmayan bölümler
    "henüz yok" diye listenin sonunda. Öğrencinin "hangi bölümüm bitti"
    sorusu.
  */
  const metinBolumleri = makaleBolumleri(resumeManuscript?.content).filter((b) => b.baslik);
  const eksikZorunlu = (resumeGuideline?.requiredSections ?? []).filter(
    (bolum) => !metinBolumleri.some((b) => headingMatchesSection(b.baslik, bolum)),
  );
  const okunamayanlar = [
    projelerOkunamadi ? t({ tr: "çalışmalar", en: "works" }) : "",
    hareketYaniti.error ? t({ tr: "çalışma hareketi", en: "work activity" }) : "",
    yorumYaniti.error ? t({ tr: "yorumlar", en: "comments" }) : "",
    uzmanHatasi ? t({ tr: "uzman kuyruğu", en: "expert queue" }) : "",
    destekHatasi ? t({ tr: "destek kuyruğu", en: "support queue" }) : "",
    ritimYaniti.error ? t({ tr: "yazım ritmi", en: "writing rhythm" }) : "",
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
    .map((project) => ({ project, due: dueInfo(project.due_date, project.status, new Date(), dil) }))
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

  const sonGonderim = sonBaglanti
    ? {
        olusturuldu: sonBaglanti.created_at as string,
        sonAcilis: (sonBaglanti.last_viewed_at as string | null) ?? null,
        acilmaSayisi: Number(sonBaglanti.view_count ?? 0),
        bitis: sonBaglanti.expires_at as string,
      }
    : null;
  const sonGonderimMetni = sonGonderim
    ? sonGonderim.acilmaSayisi
      ? t({
          tr: `Danışmanınız ${sonGonderim.acilmaSayisi} kez açtı · son ${once(sonGonderim.sonAcilis ?? sonGonderim.olusturuldu, simdiAn)}`,
          en: `Your advisor opened it ${sonGonderim.acilmaSayisi} time${sonGonderim.acilmaSayisi === 1 ? "" : "s"} · last ${once(sonGonderim.sonAcilis ?? sonGonderim.olusturuldu, simdiAn)}`,
        })
      : t({
          tr: `Bağlantı ${once(sonGonderim.olusturuldu, simdiAn)} gönderildi · henüz açılmadı`,
          en: `Link sent ${once(sonGonderim.olusturuldu, simdiAn)} · not opened yet`,
        })
    : null;

  return (
    <main className="dashboard-page gb gb-tek-ekran">
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
          <h1>{ad ? `${selamlama(simdiAn, dil, saatDilimi)}, ${ad}` : selamlama(simdiAn, dil, saatDilimi)}</h1>
          <p>
            {yeniKullanici
              ? t({
                  tr: "Çalışma alanınız hazır. İlk çalışmanızı oluşturduğunuzda kılavuzunuz, kaynaklarınız ve denetimleriniz burada toplanır.",
                  en: "Your workspace is ready. Once you create your first work, your guideline, sources and checks will gather here.",
                })
              : isStaff
                ? /* Personel: kurumun özeti — sayaçların ilk üçü, cümle olarak. */
                  sayaclar.length
                  ? sayaclar
                      .filter((s) => s.anahtar === "aktif" || (s.sayi > 0 && (s.anahtar === "onay" || s.anahtar === "gecikmis")))
                      .map((s) => `${sayi(s.sayi)} ${s.etiket.toLocaleLowerCase(YEREL[dil])}`)
                      .join(" · ")
                  : t({ tr: "Çalışmalar, teslim tarihleri ve gelen yorumlar burada.", en: "Works, due dates and incoming comments are here." })
              : ogrenciGorunumu
                ? [
                    resumeDue
                      ? t({ tr: `Teslim: ${resumeDue.label.toLocaleLowerCase("tr")}`, en: `Due: ${resumeDue.label.toLocaleLowerCase("en")}` })
                      : "",
                    ritim.buHafta > 0
                      ? t({ tr: `bu hafta ${sayi(ritim.buHafta)} kelime yazdınız`, en: `you wrote ${sayi(ritim.buHafta)} words this week` })
                      : t({ tr: "bu hafta henüz yazmadınız", en: "you haven't written this week yet" }),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : resume
                ? t({
                    tr: `Kaldığınız yer: ${resume.title}${resumeStats ? ` · ${sayi(resumeStats.words)} kelime, ${once(resumeStats.updatedAt)} düzenlendi` : ""}`,
                    en: `Where you left off: ${resume.title}${resumeStats ? ` · ${sayi(resumeStats.words)} words, edited ${once(resumeStats.updatedAt)}` : ""}`,
                  })
                : t({ tr: "Çalışmalarınız, teslim tarihleriniz ve gelen yorumlar burada.", en: "Your works, due dates and incoming comments are here." })}
          </p>
        </div>
        <div className="gb-selam-eylemler">
          {isStaff ? (
            <Link href="/dashboard/editor" className="projects-primary-button">
              <LayoutList size={16} aria-hidden="true" />
              {t({ tr: "Çalışmalar", en: "Works" })}
            </Link>
          ) : null}
          {resume && !ogrenciGorunumu ? (
            <Link href={`/dashboard/editor/${resume.id}/write`} className="projects-primary-button">
              <PenLine size={16} aria-hidden="true" />
              {resumeStats ? t({ tr: "Yazmaya devam et", en: "Continue writing" }) : t({ tr: "Yazmaya başla", en: "Start writing" })}
            </Link>
          ) : null}
          {ogrenciGorunumu ? null : (
            <Link href={yeniCalismaHref} className={resume || isStaff ? "projects-filter-button" : "projects-primary-button"}>
              <Plus size={16} aria-hidden="true" />
              {t({ tr: "Yeni çalışma", en: "New work" })}
            </Link>
          )}
        </div>
      </header>

      {/*
        Personelin sayaçları: Çalışmalarım filtreleri ve Destek kuyrukları.
        Sayı = basınca açılan listenin uzunluğu (lib/personel-sayaclari.ts).
      */}
      {sayaclar.length || kuyrukSayaclari.length ? (
        <nav className="personel-sayaclar ana-sayaclar" aria-label={t({ tr: "Dikkat isteyenler", en: "Needs attention" })}>
          {sayaclar.map((sayac) => (
            <Link key={sayac.anahtar} href={sayac.href} className="personel-sayac" data-tone={sayac.sayi ? sayac.ton : undefined}>
              <b>{sayac.sayi}</b>
              <span>{sayac.etiket}</span>
            </Link>
          ))}
          {kuyrukSayaclari.map((k) => (
            <Link key={k.anahtar} href={k.href} className="personel-sayac" data-tone={k.sayi ? "warning" : undefined}>
              <b>{k.sayi}</b>
              <span>{k.etiket}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {okunamayanlar.length ? (
        <p className="alert" role="alert">
          {t({
            tr: `${okunamayanlar.join(", ")} okunamadı; aşağıdaki listeler eksik olabilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.`,
            en: `Could not load ${okunamayanlar.join(", ")}; the lists below may be incomplete. Your records are safe — refresh the page.`,
          })}
        </p>
      ) : null}

      {/* Öğrencide abonelik tez kartının yanındaki kartta; ayrıca üstte tekrar edilmiyor. */}
      {ogrenciGorunumu && resume ? null : <LicenseCard access={access} />}

      {geriBildirim.sorulsun ? <GeriBildirimKarti baglam={geriBildirim.baglam} /> : null}

      {yeniKullanici ? (
        <article className="gb-kart gb-baslangic">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Üç adımda başlayın", en: "Get started in three steps" })}</h2>
              <p>{t({ tr: "Üniversitenizi seçin; tez yazım kılavuzunuz editöre kendiliğinden uygulanır.", en: "Choose your university; your thesis writing guideline is applied to the editor automatically." })}</p>
            </div>
          </header>
          {/*
            Adımlar BAĞLANTI DEĞİL, bilerek. Hiç çalışması olmayan birini
            literatür ya da denetim ekranına göndermek, onu bir boş ekrana
            daha götürmek olurdu; tek yol ileri gidiyor.
          */}
          <ol className="baslangic-adimlari">
            <li>
              <strong>{t({ tr: "Çalışmanızı açın.", en: "Create your work." })}</strong>{" "}
              {t({
                tr: "Üniversite ve bölümünüzü seçtiğinizde kurumunuzun onaylı tez kılavuzu çalışmaya bağlanır; biçim kuralları editörde kendiliğinden uygulanır.",
                en: "When you choose your university and department, your institution's approved thesis guideline is linked to the work; formatting rules are applied in the editor automatically.",
              })}
            </li>
            <li>
              <strong>{t({ tr: "Kaynaklarınızı toplayın.", en: "Gather your sources." })}</strong>{" "}
              {t({
                tr: "DOI yapıştırın, künye Crossref ve OpenAlex kayıtlarından dolsun. Atıf stiliniz kılavuzdan gelir; elle seçmeniz gerekmez.",
                en: "Paste a DOI and the reference fills in from Crossref and OpenAlex records. Your citation style comes from the guideline; no need to pick it by hand.",
              })}
            </li>
            <li>
              <strong>{t({ tr: "Yazın ve denetleyin.", en: "Write and check." })}</strong>{" "}
              {t({
                tr: "Metin içi atıflarınız kaynakçanızla karşılaştırılır, iddialarınız kanıt matrisinde kaynaklarına bağlanır ve teslim kontrol listesi aynı ekranda durur.",
                en: "Your in-text citations are compared with your reference list, your claims are linked to their sources in the evidence matrix, and the submission checklist sits on the same screen.",
              })}
            </li>
          </ol>
          <Link href={yeniCalismaHref} className="projects-primary-button">
            <Plus size={16} aria-hidden="true" />
            {t({ tr: "İlk çalışmayı oluştur", en: "Create your first work" })}
          </Link>
        </article>
      ) : ogrenciGorunumu && resume ? (
        <>
          {/*
            ÖĞRENCİNİN ANA SAYFASI (26.10.2026, kurum sahibinin isteği:
            "her zaman bir öğrenci gözüyle düşün; her öğrenci bir çalışma
            yapacak").

            Öğrenci bir panoya değil tezine bakıyor. Sayfanın ilk sorusu
            "tezim ne durumda": teslime kaç gün, hedefin ne kadarı yazıldı,
            teslime ne kadar hazır. İkincisi "şimdi ne yapmalıyım" — tek bir
            adım. Sonra dört kart: bölümlerim, yazım ritmim, danışmanımın
            yorumları, kaynaklarım ve kanıtlarım. Çok çalışmalı liste
            görünümü personelde kalıyor; öğrencide "Çalışmalarım" ve
            "Teslim tarihleri" tek satıra inen bilgiyi altı satırlık
            kartlara yayıyordu.
          */}
          {/*
            Tez kartı ve yanında Abonelik ve kredi kartı tek sırada (kurum
            sahibinin isteği): tez kartı daralıyor, öğrenci asistan hakkını
            ve abonelik durumunu ana sayfada görüyor.
          */}
          <div className="tez-ust-sira">
          <article className="gb-kart tez-kart">
            <div className="tez-kart-ust">
              <div>
                <small>
                  {t(projectTypeLabel(resume.project_type))}
                  {resume.university ? ` · ${resume.university}` : ""}
                </small>
                <h2>{resume.title}</h2>
                <div className="tez-kart-rozetler">
                  <span className="status-pill" data-tone={statusTone(resume.status)}>
                    {t(statusLabel(resume.status))}
                  </span>
                  {resumeStats ? (
                    <span className="chip">
                      {t({ tr: `${once(resumeStats.updatedAt, simdiAn)} düzenlendi`, en: `Edited ${once(resumeStats.updatedAt, simdiAn)}` })}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="tez-kart-eylemler">
                <Link href={`/dashboard/editor/${resume.id}/write`} className="projects-primary-button">
                  <PenLine size={16} aria-hidden="true" />
                  {resumeStats ? t({ tr: "Yazmaya devam et", en: "Continue writing" }) : t({ tr: "Yazmaya başla", en: "Start writing" })}
                </Link>
                <Link href={`/dashboard/editor/${resume.id}`} className="projects-filter-button">
                  {t({ tr: "Çalışma özeti", en: "Work overview" })}
                </Link>
              </div>
            </div>

            <dl className="tez-olcumler">
              <div className="tez-olcu" data-tone={resumeDue?.tone}>
                <dt>{t({ tr: "Teslime kalan", en: "Until due" })}</dt>
                <dd>
                  {resumeDue ? (resumeDue.days >= 0 ? resumeDue.days : -resumeDue.days) : "—"}
                  {resumeDue ? (
                    <small>
                      {resumeDue.days >= 0 ? t({ tr: "gün", en: "days" }) : t({ tr: "gün gecikti", en: "days overdue" })}
                    </small>
                  ) : null}
                </dd>
                {/* Tarih yoksa burada seçilip kaydediliyor (28.10.2026); eskiden ayarlar sayfasına gönderiyordu. */}
                {resume.due_date ? <span>{tarih(resume.due_date)}</span> : <TeslimTarihiFormu projectId={resume.id} bugun={bugunGun} />}
              </div>
              <div className="tez-olcu">
                <dt>{t({ tr: "Yazılan", en: "Written" })}</dt>
                <dd>
                  {sayi(resumeStats?.words ?? 0)}
                  <small>{t({ tr: "kelime", en: "words" })}</small>
                </dd>
                <span>
                  {tempo
                    ? t({
                        tr: `Kılavuz hedefi ~${sayi(tempo.targetWords)} kelime · %${yazilanYuzde}`,
                        en: `Guideline target ~${sayi(tempo.targetWords)} words · ${yazilanYuzde}%`,
                      })
                    : t({ tr: "Kılavuzda sayfa sınırı yok; hedef hesaplanmadı", en: "The guideline sets no page limit; no target calculated" })}
                </span>
              </div>
              <div className="tez-olcu" data-tone={resumeReadiness && readinessGaps.length === 0 ? "success" : undefined}>
                <dt>{t({ tr: "Teslim hazırlığı", en: "Submission readiness" })}</dt>
                <dd>
                  {resumeReadiness ? `${resumeReadiness.done}/${resumeReadiness.total}` : "—"}
                  {resumeReadiness ? <small>{t({ tr: "madde", en: "items" })}</small> : null}
                </dd>
                <span>
                  {resumeReadiness
                    ? readinessGaps.length === 0
                      ? t({ tr: "Teslime hazır görünüyor", en: "Looks ready to submit" })
                      : t({
                          tr: `${readinessGaps.length} madde bakılmayı bekliyor`,
                          en: `${readinessGaps.length} item${readinessGaps.length === 1 ? "" : "s"} need${readinessGaps.length === 1 ? "s" : ""} attention`,
                        })
                    : t({ tr: "Yazmaya başlayınca hesaplanır", en: "Calculated once you start writing" })}
                </span>
              </div>
            </dl>

            {yazilanYuzde !== null ? (
              <div className="tez-cubuk" role="progressbar" aria-valuenow={yazilanYuzde} aria-valuemin={0} aria-valuemax={100} aria-label={t({ tr: "Kılavuz hedefine göre yazılan", en: "Written against the guideline target" })}>
                {/* Genişlik veriye bağlı: satır içi değer yalnızca bu. */}
                <i style={{ "--w": `${yazilanYuzde}%` } as React.CSSProperties} />
              </div>
            ) : null}
            {tempo ? (
              <p className="tez-tempo tone-text" data-tone={tempo.tone}>
                {tempo.detail}
              </p>
            ) : null}
            {takvim ? (
              siradakiKilometre ? (
                <p className="takvim-sirada" data-durum={siradakiKilometre.durum}>
                  <span>{t({ tr: "Sıradaki kilometre taşı", en: "Next milestone" })}</span>
                  <b>{siradakiKilometre.tas.baslik}</b>
                  <small>
                    {tarih(siradakiKilometre.tas.hedef_tarih)} · {kalanMetni(siradakiKilometre.durum, siradakiKilometre.kalanGun, dil)}
                    {takvimSayilari
                      ? t({
                          tr: ` · takvim ${takvimSayilari.tamam}/${takvimSayilari.toplam}`,
                          en: ` · schedule ${takvimSayilari.tamam}/${takvimSayilari.toplam}`,
                        })
                      : ""}
                  </small>
                  <Link href={calismaAdresi(resume.id, { takvim: true })} className="link-accent">
                    {t({ tr: "Takvim", en: "Schedule" })}
                  </Link>
                </p>
              ) : resume.due_date && !takvim.length ? (
                <p className="takvim-sirada">
                  <span>{t({ tr: "Tez takvimi", en: "Thesis schedule" })}</span>
                  <b>{t({ tr: "Teslime kadar bölüm bölüm hedef tarih koyun", en: "Set target dates chapter by chapter until submission" })}</b>
                  <small>
                    {t({
                      tr: "Teslim tarihinize göre taslak takvim önerilir; her tarihi değiştirebilirsiniz.",
                      en: "A draft schedule is suggested from your due date; you can change every date.",
                    })}
                  </small>
                  <Link href={calismaAdresi(resume.id, { takvim: true })} className="link-accent">
                    {t({ tr: "Takvim kur", en: "Set up schedule" })}
                  </Link>
                </p>
              ) : null
            ) : null}
            {/*
              Sıradaki TEK iş, tez kartının içinde: ayrı bir şerit olarak
              tek ekran kuralında 70 piksel yiyordu ve "tezim" ile "şimdi
              ne yapmalıyım" zaten aynı sorunun iki yarısı. Kararın kendisi
              lib/siradaki-is.ts'te ve sınanıyor.
            */}
            {sirada ? (
              <div className="tez-simdi" data-aciliyet={sirada.aciliyet} data-bitti={sirada.bitti ? "true" : undefined}>
                <span className="sirada-etiket">{sirada.bitti ? t({ tr: "Durum", en: "Status" }) : t({ tr: "Şimdi", en: "Now" })}</span>
                <div className="sirada-govde">
                  <b>{sirada.baslik}</b>
                  <span>{sirada.aciklama}</span>
                </div>
                <Link href={sirada.href} className="projects-primary-button button-compact">
                  {sirada.eylem}
                </Link>
              </div>
            ) : null}
          </article>
          <AbonelikOzetKarti access={access} kredi={kredi} bireysel={Boolean((krediSatiri as KrediSatiri | null)?.bireysel)} />
          </div>

          <ListeIzgarasi etiket={t({ tr: "Tezim", en: "My thesis" })}>
            <ListeKarti
              baslik={t({ tr: "Bölümlerim", en: "My sections" })}
              alt={[
                eksikZorunlu.length
                  ? t({
                      tr: `${eksikZorunlu.length} zorunlu bölümün başlığı yok`,
                      en: `${eksikZorunlu.length} required section${eksikZorunlu.length === 1 ? " has" : "s have"} no heading`,
                    })
                  : t({ tr: "Müsveddenin bölümleri", en: "Sections of the manuscript" }),
                metinBolumleri.length + eksikZorunlu.length > BOLUM_SATIRI
                  ? t({ tr: `ilk ${BOLUM_SATIRI} gösteriliyor`, en: `showing first ${BOLUM_SATIRI}` })
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              bos={t({
                tr: "Henüz bölüm başlığı yok. Editörde başlıklarla bölüm açın; kılavuzunuzun istediği bölümler burada izlenir.",
                en: "No section headings yet. Create sections with headings in the editor; the sections your guideline requires are tracked here.",
              })}
              sayi={metinBolumleri.length + eksikZorunlu.length}
              href={`/dashboard/editor/${resume.id}/write`}
              hrefEtiket={t({ tr: "Editörde aç", en: "Open in editor" })}
            >
              {metinBolumleri.slice(0, BOLUM_SATIRI).map((bolum, sira) => (
                <ListeSatiri
                  key={`${sira}-${bolum.baslik}`}
                  href={`/dashboard/editor/${resume.id}/write`}
                  baslik={bolum.baslik}
                  sag={<span className="gb-sayi">{t({ tr: `${sayi(bolum.sozcuk)} kelime`, en: `${sayi(bolum.sozcuk)} words` })}</span>}
                />
              ))}
              {eksikZorunlu.slice(0, Math.max(0, BOLUM_SATIRI - metinBolumleri.length)).map((bolum) => (
                <ListeSatiri
                  key={`eksik-${bolum}`}
                  href={`/dashboard/editor/${resume.id}/write?teslim=sections`}
                  baslik={bolum}
                  alt={t({ tr: "Kılavuzunuz istiyor", en: "Required by your guideline" })}
                  sag={
                    <span className="status-pill" data-tone="warning">
                      {t({ tr: "Henüz yok", en: "Not yet" })}
                    </span>
                  }
                />
              ))}
            </ListeKarti>

            <RitimKarti ritim={ritim} href={`/dashboard/editor/${resume.id}/write`} />

            {bireysel ? (
              <DanismanaGonder
                projectId={resume.id}
                baslik={resume.title}
                sonGonderim={sonGonderim}
                sonGonderimMetni={sonGonderimMetni}
              />
            ) : (
            <ListeKarti
              baslik={t({ tr: "Danışman yorumları", en: "Advisor comments" })}
              alt={t({ tr: "Çözülmemiş yorumlar", en: "Unresolved comments" })}
              bos={t({
                tr: "Bekleyen yorum yok. Danışmanınız metninize yorum yazınca burada görünür.",
                en: "No pending comments. When your advisor comments on your text, it shows up here.",
              })}
              sayi={yorumlar.length}
            >
              {yorumlar.map((yorum) => (
                <ListeSatiri
                  key={yorum.id}
                  href={`/dashboard/editor/${yorum.project_id}/write`}
                  baslik={yorum.yazar?.full_name?.trim() || calismaAdi.get(yorum.project_id) || t({ tr: "Yorum", en: "Comment" })}
                  alt={yorum.body}
                  onizleme
                  zaman={once(yorum.created_at, simdiAn)}
                />
              ))}
            </ListeKarti>
            )}

            <ListeKarti
              baslik={t({ tr: "Kaynaklar ve kanıt", en: "Sources and evidence" })}
              alt={t({ tr: "Tezinizin dayanakları", en: "What your thesis rests on" })}
              bos=""
              sayi={4}
            >
              <ListeSatiri
                href={`/dashboard/literature?calisma=${resume.id}`}
                baslik={t({ tr: "Literatür", en: "Literature" })}
                alt={
                  resumeKaynakSayisi
                    ? t({
                        tr: `${resumeOkunan ?? 0} okundu · ${resumeKullanilan ?? 0} metinde kullanıldı`,
                        en: `${resumeOkunan ?? 0} read · ${resumeKullanilan ?? 0} used in text`,
                      })
                    : t({ tr: "Henüz kaynak eklenmedi", en: "No sources added yet" })
                }
                sag={
                  <span className="gb-sayi">
                    {t({
                      tr: `${sayi(resumeKaynakSayisi ?? 0)} kaynak`,
                      en: `${sayi(resumeKaynakSayisi ?? 0)} source${resumeKaynakSayisi === 1 ? "" : "s"}`,
                    })}
                  </span>
                }
              />
              <ListeSatiri
                href={`/dashboard/citations?calisma=${resume.id}`}
                baslik={t({ tr: "Kaynakça denetimi", en: "Reference list check" })}
                alt={
                  resumeDenetim
                    ? t({ tr: `Son denetim ${once(resumeDenetim.created_at, simdiAn)}`, en: `Last checked ${once(resumeDenetim.created_at, simdiAn)}` })
                    : t({ tr: "Henüz denetlenmedi", en: "Not checked yet" })
                }
                sag={
                  resumeDenetim?.compliance_score != null ? (
                    <span className="status-pill" data-tone={Number(resumeDenetim.compliance_score) >= 80 ? "success" : "warning"}>
                      {t({
                        tr: `%${Math.round(Number(resumeDenetim.compliance_score))}`,
                        en: `${Math.round(Number(resumeDenetim.compliance_score))}%`,
                      })}
                    </span>
                  ) : undefined
                }
              />
              <ListeSatiri
                href={`/dashboard/editor/${resume.id}/kanit`}
                baslik={t({ tr: "Kanıt matrisi", en: "Evidence matrix" })}
                alt={
                  iddiaSayisi
                    ? t({
                        tr: `${dogrudanSayisi ?? 0} iddia doğrudan destekleniyor`,
                        en: `${dogrudanSayisi ?? 0} claim${dogrudanSayisi === 1 ? "" : "s"} directly supported`,
                      })
                    : t({ tr: "İddialarınızı kaynaklarına bağlayın", en: "Link your claims to their sources" })
                }
                sag={
                  <span className="gb-sayi">
                    {t({ tr: `${sayi(iddiaSayisi ?? 0)} iddia`, en: `${sayi(iddiaSayisi ?? 0)} claim${iddiaSayisi === 1 ? "" : "s"}` })}
                  </span>
                }
              />
              <ListeSatiri
                href={`/dashboard/documents?calisma=${resume.id}`}
                baslik={t({ tr: "Belge kontrolü", en: "Document check" })}
                alt={
                  resumeBelgeSayisi
                    ? t({ tr: "Kılavuz uyumu ve orijinallik ön-kontrolü", en: "Guideline compliance and originality pre-check" })
                    : t({ tr: "Tam belgenizi yükleyip denetletin", en: "Upload your full document to have it checked" })
                }
                sag={
                  <span className="gb-sayi">
                    {t({
                      tr: `${sayi(resumeBelgeSayisi ?? 0)} belge`,
                      en: `${sayi(resumeBelgeSayisi ?? 0)} document${resumeBelgeSayisi === 1 ? "" : "s"}`,
                    })}
                  </span>
                }
              />
            </ListeKarti>
          </ListeIzgarasi>

          {/* Birden çok çalışması olan öğrenci için: odak tek tezde, diğerleri bir tık uzakta. */}
          {activeProjects.length > 1 ? (
            <nav className="diger-calismalar" aria-label={t({ tr: "Diğer çalışmalarınız", en: "Your other works" })}>
              <span>{t({ tr: "Diğer çalışmalarınız:", en: "Your other works:" })}</span>
              {activeProjects
                .filter((p) => p.id !== resume.id)
                .slice(0, 5)
                .map((p) => (
                  <Link key={p.id} href={`/dashboard/editor/${p.id}`} className="chip">
                    {p.title}
                  </Link>
                ))}
            </nav>
          ) : null}
        </>
      ) : (
        <>
          <SeriKarti
            baslik={t({ tr: "Çalışma hareketiniz", en: "Your activity" })}
            alt={t({ tr: "Son 14 gün", en: "Last 14 days" })}
            seri={seri}
            adet={t({ tr: "hareket", en: "actions" })}
            ozet={[
              { ad: t({ tr: "Kayıtlı sürüm", en: "Saved versions" }), deger: seri.turler.surum },
              { ad: t({ tr: "Eklenen kaynak", en: "Sources added" }), deger: seri.turler.kaynak },
              { ad: t({ tr: "Denetim", en: "Checks" }), deger: seri.turler.denetim },
              { ad: t({ tr: "Asistan", en: "Assistant" }), deger: seri.turler.asistan },
              { ad: t({ tr: "Kanıt", en: "Evidence" }), deger: seri.turler.kanit },
            ]}
            bos={t({
              tr: "Son 14 günde kayıtlı hareket yok. Yazdıkça, kaynak ekledikçe ve denetim çalıştırdıkça burada görünür.",
              en: "No recorded activity in the last 14 days. It shows up here as you write, add sources and run checks.",
            })}
          />

          <ListeIzgarasi etiket={t({ tr: "Güncel işler", en: "Current work" })}>
            <ListeKarti
              baslik={isStaff ? t({ tr: "Son düzenlenenler", en: "Recently edited" }) : t({ tr: "Çalışmalarım", en: "My works" })}
              alt={t({
                tr: `Aktif ${activeProjects.length} çalışma`,
                en: `${activeProjects.length} active work${activeProjects.length === 1 ? "" : "s"}`,
              })}
              bos={t({ tr: "Aktif çalışma yok.", en: "No active works." })}
              sayi={calismalarim.length}
              href="/dashboard/editor"
              hrefEtiket={t({ tr: "Tüm çalışmalar", en: "All works" })}
            >
              {calismalarim.map((p) => {
                const yazim = writing.get(p.id);
                return (
                  <ListeSatiri
                    key={p.id}
                    href={`/dashboard/editor/${p.id}`}
                    baslik={p.title}
                    alt={[
                      isStaff ? sahipAdlari.get(p.owner_id) : null,
                      t(projectTypeLabel(p.project_type)),
                      yazim
                        ? t({ tr: `${sayi(yazim.words)} kelime, ${once(yazim.updatedAt)}`, en: `${sayi(yazim.words)} words, ${once(yazim.updatedAt)}` })
                        : t({ tr: "yazılmadı", en: "not written" }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    sag={
                      <span className="status-pill" data-tone={statusTone(p.status)}>
                        {t(statusLabel(p.status))}
                      </span>
                    }
                  />
                );
              })}
            </ListeKarti>

            <ListeKarti
              baslik={t({ tr: "Teslim tarihleri", en: "Due dates" })}
              alt={t({ tr: "En yakın teslimler", en: "Nearest due dates" })}
              bos={t({
                tr: "Teslim tarihi girilmiş çalışma yok. Çalışma ayarlarından ekleyebilirsiniz.",
                en: "No works with a due date. You can add one in the work settings.",
              })}
              sayi={teslimler.length}
              href="/dashboard/editor"
              hrefEtiket={t({ tr: "Çalışmalara git", en: "Go to works" })}
            >
              {teslimler.map(({ project, due }) => (
                <ListeSatiri
                  key={project.id}
                  href={`/dashboard/editor/${project.id}`}
                  baslik={project.title}
                  alt={[isStaff ? sahipAdlari.get(project.owner_id) : null, project.due_date ? tarih(project.due_date) : null].filter(Boolean).join(" · ") || undefined}
                  sag={
                    <span className="status-pill" data-tone={due.tone}>
                      {due.label}
                    </span>
                  }
                />
              ))}
            </ListeKarti>

            <ListeKarti
              baslik={t({ tr: "Gelen yorumlar", en: "Incoming comments" })}
              alt={t({ tr: "Çözülmemiş, son 6", en: "Unresolved, latest 6" })}
              bos={t({ tr: "Danışmanınızdan ya da ekipten bekleyen yorum yok.", en: "No pending comments from your advisor or the team." })}
              sayi={yorumlar.length}
            >
              {yorumlar.map((yorum) => (
                <ListeSatiri
                  key={yorum.id}
                  href={`/dashboard/editor/${yorum.project_id}/write`}
                  baslik={yorum.yazar?.full_name?.trim() || calismaAdi.get(yorum.project_id) || t({ tr: "Yorum", en: "Comment" })}
                  alt={yorum.body}
                  onizleme
                  zaman={once(yorum.created_at, simdiAn)}
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
                baslik={t({ tr: "Dikkat isteyenler", en: "Needs attention" })}
                alt={t({ tr: "Gecikmiş, sorumlusuz ya da yanıt bekleyen", en: "Overdue, unassigned or awaiting a reply" })}
                bos={t({
                  tr: "Gecikmiş, sorumlusuz, onay ya da yanıt bekleyen çalışma yok.",
                  en: "No works that are overdue, unassigned, or awaiting approval or a reply.",
                })}
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
                baslik={t({ tr: "Sıradaki işler", en: "Next up" })}
                alt={resume ? resume.title : t({ tr: "Kaldığınız çalışma", en: "Where you left off" })}
                bos={
                  sirada?.bitti
                    ? t({ tr: "Teslim listesinde eksik görünmüyor.", en: "Nothing appears to be missing from the submission checklist." })
                    : t({ tr: "Şu an bekleyen bir adım yok.", en: "No pending steps right now." })
                }
                sayi={siradakiler.length}
                href={resume ? `/dashboard/editor/${resume.id}` : undefined}
                hrefEtiket={t({ tr: "Çalışma özeti", en: "Work overview" })}
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
