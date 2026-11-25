import { redirect } from "next/navigation";
import { aktifDil, aktifSaatDilimi, ceviri, tarihler } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronRight, FileText, PenLine, Plus } from "lucide-react";
import { DugmeBaglanti } from "@/app/_components/ui/dugme";
import { createClient } from "@/lib/supabase/server";
import { siradakiAdimlar } from "@/lib/calisma-ozeti";
import { siradakiIs } from "@/lib/siradaki-is";
import { getProjects } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel } from "@/lib/project-labels";
import { getCurrentProfile } from "@/app/actions/profile";
import { getAccessState } from "@/lib/access";
import LicenseCard from "./_components/license-card";
import PlanSecimi from "./_components/plan-secimi";
import { satisHazir } from "@/lib/plan-satis";
import GeriBildirimKarti from "./_components/geri-bildirim-karti";
import { geriBildirimSorusu } from "@/app/actions/geri-bildirim";
import { ilkKullanim } from "@/lib/ilk-kullanim";
import { manuscriptReadiness } from "@/lib/manuscript-readiness";
import { etikKaydiOku } from "@/lib/etik/oku";
import { metinListeTutarsizliklari } from "@/lib/calisma-tutarlilik";
import { statusTone } from "@/lib/status-tone";
import { dueInfo } from "@/lib/due-date";
import { editedAgo, getWritingStats } from "@/lib/writing-stats";
import { calismaKilavuzu } from "@/lib/guideline-rules";
import { hareketSerisi, ilkAd, selamlama, simdi } from "@/lib/genel-bakis";
import { kisiselCalismalar, KISISEL_CALISMALAR } from "@/lib/kisisel-calismalar";
import { calismaAdresi } from "@/lib/calisma-karti";
import { belgeOnizlemesi, onizlemeDolu } from "@/lib/calisma-onizleme";
import CalismaKartMenusu from "./editor/calisma-kart-menusu";
import { GENEL_BAKIS_SATIR, ListeIzgarasi, ListeKarti, ListeSatiri, SeriKarti } from "./_components/genel-bakis";
import { KILAVUZ_ADRESI } from "@/lib/yardim/kullanim-kilavuzu";


/*
  TEK EKRAN KURALI (kurum sahibinin altın kuralı: her modülün ana sayfası
  tek sayfa, yatay ve dikey kayma yok). Bölümlerim kartı en fazla bu kadar
  satır çizer; fazlası alt başlıkta söylenir, tam liste editörde.
*/
const isActive = (status: string) => status !== "delivered" && status !== "archived";

/*
  HERKESİN ANA SAYFASI AYNI (20.11.2026, kurum sahibinin ürün kararı:
  ArvoLab tek tip, editör odaklı bir araştırma ve yazma ürünü; kurucu,
  personel ve bireysel kullanıcı aynı deneyimi kullanır). Yalnızca kişinin
  KENDİ çalışmaları, rol ne olursa olsun aynı düzen.

  Eskiden personelde ayrı bir düzen vardı: kurumun bütün çalışmaları,
  onay/sorumlu sayaçları, uzman ve destek kuyrukları, kurum seçici. PR #113
  bunu bir süre ayrı bir "Yönetim" sayfasına taşıdı; karar güncellenince o
  sayfa da kalktı. Görevlendirme ve operasyon ArvoOS'ta (Talepler, İşler).
*/
export default async function AnaSayfaIcerik() {
  const t = await ceviri();
  const dil = await aktifDil();
  const saatDilimi = await aktifSaatDilimi();
  const { tarih, uzunTarih } = await tarihler();
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

  const [{ satirlar: gorunenCalismalar, okunamadi: projelerOkunamadi }, profile] = await Promise.all([
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
  /*
    YALNIZCA kendi çalışmaları. Eskiden personelde liste RLS'in gösterdiği
    her satırdı: kurucunun ana sayfası kurumların bütün tezleriyle doluyordu
    ve kendi tezine "kaldığınız yer" çıkmıyordu. Sorgu da sahibe göre
    süzülüyor (getProjects); burası ikinci emniyet.
  */
  const projects = kisiselCalismalar(gorunenCalismalar, user.id);
  // Panel düzeniyle aynı istekte paylaşılır (lib/access.ts cache'li).
  const access = await getAccessState(profile);
  const activeProjects = projects.filter((p) => isActive(p.status));
  const [{ stats: writing }, geriBildirim] = await Promise.all([
    getWritingStats(
      activeProjects.map((p) => p.id),
      user.id
    ),
    // Kullanım geri bildirimi: yalnızca sistemi gerçekten kullanmış kişiye,
    // yalnızca bir kez sorulur (lib/geri-bildirim.ts).
    geriBildirimSorusu(),
  ]);


  // Kaldığınız yer: en son yazılan aktif çalışma; hiç yazılmadıysa en yeni aktif çalışma.
  const resume = [...activeProjects]
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
  /*
    SORGULAR TEK AŞAMADA (Phase 2, 04.11.2026). Aşağıdaki okumaların hiçbiri
    birbirinin sonucunu beklemiyor; hepsinin ihtiyacı yukarıda belli olan
    "resume", rol ve çalışma listesi. Eskiden her biri ayrı ayrı
    bekleniyordu: ana sayfa 34 sorguyu 21 SIRALI turda yapıyordu (önizleme
    ölçümü, sorgu başına 40 ms gecikmeyle 1,38 s). Koşullar ve hata
    davranışı aynı; yalnızca bekleme sırası değişti.

    Müsvedde "*" ile değil gereken sütunlarla okunuyor. İçeriğin (content)
    TAMAMI hâlâ gerekiyor: teslim hazırlığı bütün belgede yapı denetimi
    yapıyor (lib/manuscript-readiness.ts), plain_text de metin–liste
    tutarsızlığı için. Bunu kaldırmak kayıtta özet üretmeyi gerektirir.
  */
  /* Deneme üyesi mi? Plan seçimi yalnızca denemede gösteriliyor:
     abonesi olan kullanıcıya "planını seç" demek, zaten ödediği şeyi
     yeniden satmaktır. Durum köprüden (lib/access.ts). */
  const deneme = access.kind === "individual" && access.status === "trialing";
  const denemeBitisMetni = access.trialEndsAt ? uzunTarih(access.trialEndsAt) : null;
  const yeniKullanici = ilkKullanim({
    calismaSayisi: projects.length,
    okunamadi: projelerOkunamadi,
  });
  const ogrenciGorunumu = Boolean(resume) && !yeniKullanici;
  const birimSayimi = (tablo: string, durum?: string) => {
    const sorgu = supabase.from(tablo).select("id", { count: "exact", head: true }).eq("project_id", resume!.id);
    return durum ? sorgu.eq("status", durum) : sorgu;
  };
  const [
    resumeGuideline,
    { data: resumeManuscript },
    resumeEtik,
    { data: resumeKaynaklar },
    [
      { data: resumeDenetim },
      { count: resumeBelgeSayisi },
      { count: resumeKaynakSayisi },
      { count: resumeOkunan },
      { count: resumeKullanilan },
    ],
    [hareketYaniti, yorumYaniti],
  ] = await Promise.all([
    /*
      calismaKilavuzu kullanılıyor, loadAppliedGuidelines DEĞİL: ikincisi
      yalnızca kataloğa bakıyor ve öğrencinin kendi yüklediği kılavuzu
      görmüyordu (editörle ana sayfa iki ayrı cevap veriyordu).
    */
    resume ? calismaKilavuzu(supabase, resume.id, resume.guideline_id).then((k) => k ?? undefined) : Promise.resolve(undefined),
    // Teslim hazırlığı: editördeki "Teslim kontrolü" ile aynı hesap, kaydedilmiş metinden (yalnızca bu çalışma)
    resume && resumeStats
      ? supabase
          .from("project_manuscripts")
          .select("content, plain_text, word_count, cover_page, show_page_numbers, include_toc, heading_numbering, page_size, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm")
          .eq("project_id", resume.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Etik kurul satırı: editördeki teslim kontrolüyle aynı hesap (lib/etik/durum.ts).
    resume ? etikKaydiOku(supabase, resume.id) : Promise.resolve(null),
    /*
      Metin ile literatür listesi arasındaki tutarsızlıklar. Çalışma merkezinde
      ayrıntısıyla duruyor; burada yalnızca sayısı görünüyor ki kullanıcı
      ana sayfadan haberdar olsun.
    */
    resume
      ? supabase.from("literature_sources").select("id, title, authors, year, status").eq("project_id", resume.id).limit(500)
      : Promise.resolve({ data: null }),
    /*
      BİRİM İLERLEMESİ. "Tezimde ne yarım kaldı" sorusunun yarısı metinde
      değil, bağlı birimlerde. Kaynak sayıları ELDEKİ LİSTEDEN sayılmıyor:
      liste `.limit(500)` ile çekiliyor ve ondan `filter().length` ile
      saymak 500'den çok kaynakta sessizce eksik sayı verirdi.
    */
    resume
      ? Promise.all([
          supabase
            .from("citation_checks")
            .select("id, compliance_score, created_at")
            .eq("project_id", resume.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          birimSayimi("document_uploads"),
          birimSayimi("literature_sources"),
          birimSayimi("literature_sources", "read"),
          birimSayimi("literature_sources", "used"),
        ])
      : Promise.resolve([{ data: null }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }] as const),
    /*
      Çalışma hareketi (grafik) ve son yorumlar. Sayım veritabanında
      (public.calisma_hareketlerim): satırları çekip burada saymak, satır
      tavanına çarpılan gün grafiği sessizce eksiltirdi.
    */
    Promise.all([
      /*
        Hareket grafiği yalnızca aktif çalışması olmayan (hepsi teslim
        edilmiş ya da arşivlenmiş) kullanıcının düzeninde çiziliyor; ötekinin
        grafiği yazım ritmi. Fonksiyon yalnızca çağıranın KENDİ hareketini
        sayıyor (auth.uid() süzgeci). 20.11.2026'ya kadar yalnızca personelde
        çağrılıyordu ve bu düzende grafik her zaman "hareket yok" diyordu.
      */
      !ogrenciGorunumu && !yeniKullanici ? supabase.rpc("calisma_hareketlerim", { p_gun: 14 }) : Promise.resolve({ data: [], error: null }),
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
    ]),
  ]);
  const resumeReadiness =
    resume && resumeManuscript
      ? manuscriptReadiness({
          etik: resumeEtik,
          manuscript: resumeManuscript,
          guideline: resumeGuideline ?? null,
          projectType: resume.project_type,
          citationStyle: resume.citation_style ?? "apa7",
          // Editörle aynı: kurumsuz kullanıcı "Kurum seç" değil "Kılavuzumu yükle"ye yönlenir.
          hasInstitution: Boolean(resume.university),
        }, dil)
      : null;
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


  /* Yeni çalışma herkes için aynı pencerede (Çalışmalarım, ?yeni=1). */
  const yeniCalismaHref = "/dashboard/editor?yeni=1";

  if (hareketYaniti.error) console.error("[ana sayfa] hareketler okunamadı:", hareketYaniti.error.message);
  if (yorumYaniti.error) console.error("[ana sayfa] yorumlar okunamadı:", yorumYaniti.error.message);
  const simdiAn = simdi();
  const seri = hareketSerisi((hareketYaniti.data ?? []) as { gun: string; tur: string; adet: number }[], simdiAn, 14, dil);

  const okunamayanlar = [
    projelerOkunamadi ? t({ tr: "çalışmalar", en: "works" }) : "",
    hareketYaniti.error ? t({ tr: "çalışma hareketi", en: "work activity" }) : "",
    yorumYaniti.error ? t({ tr: "yorumlar", en: "comments" }) : "",
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
    /* Metin ile literatür listesi arasındaki tutarsızlık: ayrıntısı Çalışmalarım'daki kartta. */
    ...resumeTutarsizliklari.map((sorun) => ({
      anahtar: `tutarsizlik-${sorun.tur}`,
      baslik: sorun.baslik,
      alt: sorun.aciklama,
      href: calismaAdresi(resume?.id ?? "")
    })),
  ].slice(0, GENEL_BAKIS_SATIR);

  const ad = ilkAd(displayName);

  /*
    Ana sayfa (Signature OS 5 / Phase 4): "Teslim için kalanlar". Liste
    readinessGaps ve tutarsızlıklardan DOĞRUDAN kuruluyor ("Şimdi"deki
    madde readinessGaps'ten zaten çıkarılmış). İlk sürüm 6 satırla kesilmiş
    siradakiler'den türetiyordu: başlık 9 madde derken liste 5 satır
    gösteriyor, kalan maddelere ulaşmanın yolu yoktu (bağımsız inceleme).
    Fazlası "ilk N" notu ve teslim kontrolüne giden bağlantıyla söyleniyor.
  */
  // Tutarsızlıklar (en çok 2) BAŞTA: taşan kısım yalnızca teslim kontrol
  // listesindeki maddelerden oluşsun, "Bütün teslim kontrolü" bağlantısı
  // gizlenenlerin hepsini açabilsin. Eskiden tutarsızlıklar sondaydı ve
  // ilk kesilenler onlar oluyordu; o bağlantı onları göstermiyordu.


  /*
    Son kaynaklar (premium çalışma alanı): öğrencinin en son eklediği dört
    kaynak, bütün çalışmalarından. Sayı ÇIKARILMIYOR, yalnızca liste
    çiziliyor; limit bir gösterim sınırı (check:rakamlar'ın aradığı
    sınırlı-sorgudan-sayı kalıbı değil).
  */
  const { data: sonKaynakSatirlari, error: sonKaynakHatasi } =
    ogrenciGorunumu && resume
      ? await supabase
          .from("literature_sources")
          .select("id, title, authors, year")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4)
      : { data: null, error: null };
  const sonKaynaklar = (sonKaynakSatirlari ?? []) as { id: string; title: string; authors: string | null; year: string | null }[];

  /*
    BELGE ÖNİZLEMESİ (22.11.2026). Çalışmalarım'daki kartla AYNI saf
    yardımcı (lib/calisma-onizleme.ts) ve aynı kaynak: KAYDEDİLMİŞ
    içerik. Editör başlatılmıyor, otomatik kayıt tetiklenmiyor, sürüm
    yazılmıyor — content zaten teslim hazırlığı için okunan satırdan
    geliyor, ek sorgu yok. İçerik yoksa önizleme BOŞ döner ve kartın
    sağ bölümü ile ayıracı hiç çizilmez (sahte metin gösterilmez).
  */
  const onizleme = belgeOnizlemesi(resumeManuscript?.content);

  /*
    Silme yetkisi: Çalışmalarım'dakiyle BİREBİR aynı kural ve aynı yerde
    (sunucu) hesaplanıyor — sahibi ya da Yönetici/Sistem Yöneticisi/
    Kurucu; RLS'in kuralı da bu. Menünün girişi gizlemesi tek başına
    koruma sayılmıyor: deleteProject yetkisiz silmede sıfır satır
    döndürüp hata veriyor.
  */
  const silebilir =
    resume?.owner_id === user.id ||
    profile?.role === "academic_manager" ||
    profile?.role === "system_admin" ||
    profile?.role === "founder";

  return (
    <main className={ogrenciGorunumu || yeniKullanici ? "dashboard-page gb gb-ana-sayfa os5-ana" : "dashboard-page gb gb-ana-sayfa"}>
      {/*
        TEK EKRAN KURALI ANA SAYFADA KALDIRILDI (Phase 3, 04.11.2026).
        Eskiden sayfa görünüm yüksekliğine kilitleniyordu (gb-tek-ekran):
        dört kart kalan yüksekliği paylaşıyor, sığmayan satır kartın
        İÇİNDE kayıyordu. 1440×900'de "Bölümlerim"in dördüncü satırı yarıda
        kesik görünüyordu, öğrenci altında bir şey olduğunu anlamıyordu.
        Ana sayfa artık doğal akışta; kartlar en fazla altı satır olduğu
        için uzamıyor. Öteki modüllerin tek ekranı yerinde.

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
          {/* Yeni kullanıcıda açıklama tek: aşağıdaki bölümde (ikinci tur). */}
          {yeniKullanici ? null : <p>
            {ogrenciGorunumu
                ? /*
                    Sabit tek cümle (22.11.2026, onaylı mockup). Eskiden
                    burada haftalık yazım ritmi vardı ("Bu hafta N kelime
                    yazdınız"): sayfanın ilk cümlesi bir ÖLÇÜMDÜ ve hiç
                    yazmamış öğrenciye "Bu hafta henüz yazmadınız" diyordu.
                    Ritmi okuyan yazim_ritmi RPC'si de kalktı: gösterilmeyen
                    veri her açılışta boşuna maliyet.
                  */
                  t({ tr: "Araştırmanıza kaldığınız yerden devam edin.", en: "Pick up your research where you left off." })
                : resume
                ? t({
                    tr: `Kaldığınız yer: ${resume.title}${resumeStats ? ` · ${sayi(resumeStats.words)} kelime, ${once(resumeStats.updatedAt)} düzenlendi` : ""}`,
                    en: `Where you left off: ${resume.title}${resumeStats ? ` · ${sayi(resumeStats.words)} words, edited ${once(resumeStats.updatedAt)}` : ""}`,
                  })
                : t({ tr: "Çalışmalarınız, teslim tarihleriniz ve gelen yorumlar burada.", en: "Your works, due dates and incoming comments are here." })}
          </p>}
        </div>
        <div className="gb-selam-eylemler">
          {resume && !ogrenciGorunumu ? (
            <Link href={`/dashboard/editor/${resume.id}/write`} className="projects-primary-button">
              <PenLine size={16} aria-hidden="true" />
              {resumeStats ? t({ tr: "Yazmaya devam et", en: "Continue writing" }) : t({ tr: "Yazmaya başla", en: "Start writing" })}
            </Link>
          ) : null}
          {/* Yeni kullanıcıda başlangıç kartının "İlk çalışmayı oluştur"u tek ana eylem (Phase 3); üstte ikinci koyu düğme aynı yere gidiyordu. */}
          {ogrenciGorunumu && resume && !yeniKullanici ? (
            /*
              Görsel uyum (19.11.2026, onaylı prototip): öğrencinin "Yeni
              çalışma"sı başlığın sağında görünür, çerçeveli bir düğme. Eskiden
              "Çalışmanıza devam edin" başlığının yanında düz bir bağlantıydı;
              sayfadaki tek birincil eylem yine "Yazmaya devam et".
            */
            <DugmeBaglanti href={yeniCalismaHref} tur="ikincil">
              <Plus size={16} aria-hidden="true" />
              {t({ tr: "Yeni çalışma", en: "New work" })}
            </DugmeBaglanti>
          ) : ogrenciGorunumu || yeniKullanici ? null : (
            <Link href={yeniCalismaHref} className={resume ? "projects-filter-button" : "projects-primary-button"}>
              <Plus size={16} aria-hidden="true" />
              {t({ tr: "Yeni çalışma", en: "New work" })}
            </Link>
          )}
        </div>
      </header>

      {okunamayanlar.length ? (
        <p className="alert" role="alert">
          {t({
            tr: `${okunamayanlar.join(", ")} okunamadı; aşağıdaki listeler eksik olabilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.`,
            en: `Could not load ${okunamayanlar.join(", ")}; the lists below may be incomplete. Your records are safe — refresh the page.`,
          })}
        </p>
      ) : null}

      {/*
        İLK KULLANIM KARŞILAMANIN HEMEN ALTINDA (25.11.2026). Lisans
        kartı araya giriyordu: hiç çalışması olmayan kullanıcı önce
        abonelik durumunu, sonra ne yapacağını okuyordu. Yeni hesapta
        ilk iş çalışma açmak; kart ve tek birincil düğme artık
        selamlamanın hemen ardında, lisans kartı onların altında.
        Öteki kullanıcılarda yer değişmedi: öğrencide tez kartının
        yanında, ötekilerde burada.
      */}
      {!yeniKullanici && !(ogrenciGorunumu && resume) ? <LicenseCard access={access} /> : null}

      {yeniKullanici ? (
        <>
        {/*
          YENİ KULLANICI (ikinci tur, 17.11.2026): kısa başlık, tek açıklama,
          tek belirgin "İlk çalışmayı oluştur". Üç adımlı rehber "Nasıl
          başlarım?" altında isteğe bağlı açılıyor. Eskiden selamlamanın altında
          iki cümle, ardından başlıklı bir kartta üç uzun adım ve iki düğme
          vardı; ilk ekranın tamamı okunacak metindi.
        */}
        <section className="pw-bolum pw-baslangic" aria-labelledby="pw-baslangic-baslik">
          <h2 id="pw-baslangic-baslik">{t({ tr: "İlk çalışmanızı oluşturun", en: "Create your first work" })}</h2>
          <p>
            {t({
              tr: "Tezinizi, makalenizi ya da projenizi açın; kılavuzunuzu ve kaynaklarınızı sonra da ekleyebilirsiniz.",
              en: "Open your thesis, article or project; you can add your guideline and sources later.",
            })}
          </p>
          <div className="pw-baslangic-eylem">
            {/* Boş hesabın tek birincil eylemi. */}
            <DugmeBaglanti href={yeniCalismaHref} tur="birincil">
              <Plus size={16} aria-hidden="true" />
              {t({ tr: "İlk çalışmayı oluştur", en: "Create your first work" })}
            </DugmeBaglanti>
          </div>
          <details className="pw-rehber">
            <summary>{t({ tr: "Nasıl başlarım? Üç adım", en: "How do I start? Three steps" })}</summary>
            <ol className="baslangic-adimlari">
            <li>
              <strong>{t({ tr: "Çalışmanızı açın.", en: "Create your work." })}</strong>{" "}
              {/* Küresel metin (20.11.2026): "Enstitünüzden" yalnızca Türkiye'deki lisansüstü düzenine uyuyordu. */}
              {t({
                tr: "Ad, tür ve belge dili yeter. Uymanız gereken bir yazım kılavuzu varsa PDF'ini ya da web adresini çalışmanın içinden verin; kurallar dosyadan çıkarılır, siz onaylayınca editöre uygulanır.",
                en: "A name, type and document language are enough. If you follow a writing guideline, give its PDF or web address from inside the work; the rules are extracted from the file and applied to the editor once you approve them.",
              })}
            </li>
            <li>
              <strong>{t({ tr: "Kaynaklarınızı toplayın.", en: "Gather your sources." })}</strong>{" "}
              {t({
                tr: "DOI yapıştırın, künye Crossref ve OpenAlex kayıtlarından dolsun. Atıf stiliniz kılavuzunuzdan gelir.",
                en: "Paste a DOI and the reference fills in from Crossref and OpenAlex records. Your citation style comes from your guideline.",
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
            <Link href={KILAVUZ_ADRESI} className="pw-bolum-baglanti">
              <BookOpen size={15} aria-hidden="true" />
              {t({ tr: "Kullanım Kılavuzu'nu okuyun", en: "Read the User Guide" })}
            </Link>
          </details>
        </section>
        {/* Deneme üyesine plan seçimi: ilk çalışma bölümünün HEMEN
            altında. Katalog eksikse bileşen null döner ve aşağıdaki
            lisans kartı mevcut ödeme yolunu sunmaya devam eder. */}
        {deneme ? <PlanSecimi planlar={access.plans} denemeBitis={denemeBitisMetni} /> : null}
        {/* Üç kart çiziliyorsa lisans kartı ödeme düğmelerini, sözleşme
            notunu ve deneme bitiş TARİHİNİ tekrarlamıyor; durum rozeti
            kalıyor. Katalog eksikse kartlar yok, tarih ve mevcut ödeme
            yolu bu kartta erişilebilir duruyor. */}
        <LicenseCard access={access} tekrarGizle={deneme && satisHazir(access.plans)} />
        </>
      ) : ogrenciGorunumu && resume ? (
        <>
          {/*
            ÖĞRENCİNİN ANA SAYFASI — PREMIUM ÇALIŞMA ALANI (17.11.2026, kurum
            sahibinin onaylı tasarımı). Tek soru: "kaldığım yere nasıl dönerim?"
            Tek birincil eylem "Yazmaya devam et"; altında son kaynaklar sade
            bir liste.

            Eskiden (Signature OS 5 / Phase 4) burada çalışma paneli, üç ölçü
            (teslime kalan, yazılan, teslim hazırlığı), "Şimdi" ve takvim
            satırları, "Teslim için kalanlar", araç ızgarası, "Bölümlerim",
            "Kaynaklar ve kanıt", danışman yorumları, haftalık ritim, danışmana
            gönder ve abonelik kartı aynı ekrandaydı; ana eylem kalabalığın
            içinde kayboluyordu. Hiçbiri kaldırılmadı: ölçüler, teslim
            kontrolü, takvim, kılavuz, literatür, kaynakça, kanıt, etik ve
            analiz çalışma özetinde (Çalışmalarım → çalışma); yazım asistanı,
            danışmana gönderme (Dışa aktar) ve yorumlar Yazım Stüdyosu'nda;
            abonelik ve kredi hesap menüsünde. Yerlerin tablosu PR açıklamasında.
          */}
          {/*
            Görsel uyum (19.11.2026, onaylı prototipin hiyerarşisi): "Kaldığınız
            yer" kartı + son çalışmaların kompakt tablosu. Eskiden kartın altında
            en fazla üç çalışma tek tek satır olarak duruyordu, tür ve kelime
            sayısı okunmuyordu. Tablodaki her sayı gerçek veri (writing-stats);
            hedef kelime verisi olmadığı için ilerleme çubuğu YOK.
          */}
          <section className="pw-bolum" aria-labelledby="pw-devam-baslik">
            {/*
              DEVAM KARTI İKİ BÖLÜMLÜ (22.11.2026, onaylı mockup): solda
              "kaldığınız yer" kimliği ve eylemler, sağda kaydedilmiş
              belgenin önizlemesi. İçerik yoksa sağ bölüm ve ayıraç hiç
              çizilmez; kart dengeli tek bir bölüme iner.
            */}
            <article className="pw-devam" data-onizleme={onizlemeDolu(onizleme) ? "var" : "yok"}>
              <div className="pw-devam-sol">
                <span className="pw-devam-simge" aria-hidden="true">
                  <FileText size={20} />
                </span>
                <div className="pw-devam-metin">
                  <h2 id="pw-devam-baslik" className="pw-devam-ust">{t({ tr: "Kaldığınız yer", en: "Where you left off" })}</h2>
                  <span className="pw-devam-tur">{t(projectTypeLabel(resume.project_type))}</span>
                  <h3 title={resume.title}>{resume.title}</h3>
                  <p className="pw-devam-olcu">
                    {resumeStats
                      ? [
                          t({ tr: `${sayi(resumeStats.words)} kelime`, en: `${sayi(resumeStats.words)} words` }),
                          t({ tr: `${once(resumeStats.updatedAt, simdiAn)} düzenlendi`, en: `edited ${once(resumeStats.updatedAt, simdiAn)}` }),
                        ].join(" · ")
                      : t({ tr: "henüz yazılmadı", en: "not written yet" })}
                  </p>
                  <div className="pw-devam-eylem">
                    {/* Sayfanın TEK birincil eylemi. */}
                    <DugmeBaglanti href={`/dashboard/editor/${resume.id}/write`} tur="birincil">
                      <PenLine size={16} aria-hidden="true" />
                      {resumeStats ? t({ tr: "Yazmaya devam et", en: "Continue writing" }) : t({ tr: "Yazmaya başla", en: "Start writing" })}
                    </DugmeBaglanti>
                    {/*
                      Ayrıntılar paneli İKİNCİ KEZ YAZILMADI: bağlantı
                      Çalışmalarım'da o çalışmayı seçip mevcut "Çalışma
                      ayrıntıları" panelini açık getiriyor
                      (calismaAdresi(..., { ayrinti: true }) → ?sec=&ayrinti=1).
                      Teslim tarihi, hazırlık, kapak, kılavuz, yapı
                      uyarıları, literatür, kaynakça, kanıt, etik ve analiz
                      hepsi o panelde.
                    */}
                    <Link href={calismaAdresi(resume.id, { ayrinti: true })} className="pw-devam-ayrinti">
                      {t({ tr: "Çalışma ayrıntıları", en: "Work details" })}
                    </Link>
                  </div>
                </div>
              </div>

              {onizlemeDolu(onizleme) ? (
                <aside className="pw-devam-onizleme" aria-label={t({ tr: "Belge önizlemesi", en: "Document preview" })}>
                  {onizleme.baslik ? <b>{onizleme.baslik}</b> : null}
                  {onizleme.satirlar.map((satir, i) => (
                    <p key={i}>{satir}</p>
                  ))}
                </aside>
              ) : null}

              {/*
                Çalışmalarım'ın ORTAK kart menüsü: paylaş ve indir, teslim
                paketi ve Çalışmayı sil. Aynı çalışma için aynı seçenekler
                ve aynı yetki davranışı; silme yetkisi sunucuda hesaplandı.
              */}
              <CalismaKartMenusu
                projectId={resume.id}
                baslik={resume.title}
                kelime={resumeStats?.words ?? null}
                silebilir={silebilir}
              />
            </article>
          </section>

          {calismalarim.length > 1 ? (
            <section className="pw-bolum" aria-labelledby="pw-calismalar-baslik">
              <header className="pw-bolum-bas">
                <h2 id="pw-calismalar-baslik">{t({ tr: "Son çalışmalar", en: "Recent works" })}</h2>
                <Link href="/dashboard/editor" className="pw-bolum-baglanti">
                  {t({ tr: `Tümü (${sayi(activeProjects.length)})`, en: `All (${sayi(activeProjects.length)})` })}
                </Link>
              </header>
              <div className="pw-tablo-kap">
                <table className="pw-tablo">
                  <thead>
                    <tr>
                      <th scope="col">{t({ tr: "Çalışma", en: "Work" })}</th>
                      <th scope="col">{t({ tr: "Tür", en: "Type" })}</th>
                      <th scope="col">{t({ tr: "Son düzenleme", en: "Last edited" })}</th>
                      <th scope="col" className="pw-tablo-sayi">{t({ tr: "Kelime", en: "Words" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calismalarim.map((p) => {
                      const yazim = writing.get(p.id);
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link href={calismaAdresi(p.id)} title={p.title}>{p.title}</Link>
                          </td>
                          <td>{t(projectTypeLabel(p.project_type))}</td>
                          <td>{yazim ? once(yazim.updatedAt, simdiAn) : "—"}</td>
                          <td className="pw-tablo-sayi">{yazim ? sayi(yazim.words) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="pw-bolum" aria-labelledby="pw-kaynak-baslik">
            <header className="pw-bolum-bas">
              <h2 id="pw-kaynak-baslik">{t({ tr: "Son kaynaklar", en: "Recent sources" })}</h2>
              {/* Mockup: başlığın sağında "Tüm kaynaklar →"; hedef değişmedi (mevcut kütüphane). */}
              <Link href={`/dashboard/literature?calisma=${encodeURIComponent(resume.id)}`} className="pw-bolum-baglanti">
                {t({ tr: "Tüm kaynaklar", en: "All sources" })}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </header>
            {sonKaynakHatasi ? (
              /* Okunamayan liste "kaynak yok" diye çizilmez: kullanıcı kaynaklarını silinmiş sanırdı. */
              <p className="alert" data-tone="warning" role="alert">
                {t({ tr: "Son kaynaklar şu anda okunamadı. Kaynaklarınız yerinde — sayfayı yenileyin.", en: "Recent sources could not be loaded right now. Your sources are safe — refresh the page." })}
              </p>
            ) : sonKaynaklar.length ? (
              <ul className="pw-liste">
                {sonKaynaklar.map((k) => (
                  <li key={k.id}>
                    <Link href={`/dashboard/literature?calisma=${encodeURIComponent(resume.id)}`} className="pw-satir">
                      <FileText size={18} aria-hidden="true" className="pw-satir-simge" />
                      <span className="pw-satir-metin">
                        {/* Başlık en çok iki satır (pw-satir-metin b), ikincil satır yazar ve yıl. */}
                        <b>{k.title}</b>
                        <small>
                          {[k.authors, k.year ? `(${k.year})` : null].filter(Boolean).join(" ")}
                        </small>
                      </span>
                      {/* Açılış göstergesi: satırın tıklanabilir olduğunu söyler. */}
                      <ChevronRight size={16} aria-hidden="true" className="pw-satir-ok" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="pw-bos">
                <p>{t({ tr: "Henüz kaynak eklemediniz. DOI yapıştırarak, dosya yükleyerek ya da arayarak ekleyebilirsiniz.", en: "You haven't added any sources yet. Add them by pasting a DOI, uploading a file or searching." })}</p>
                <DugmeBaglanti href={`/dashboard/literature?calisma=${encodeURIComponent(resume.id)}`} tur="ikincil" boyut="sik">
                  <Plus size={15} aria-hidden="true" />
                  {t({ tr: "Kaynak ekle", en: "Add source" })}
                </DugmeBaglanti>
              </div>
            )}
          </section>

          {/*
            ALTTAKİ AÇIKLAMA KALDIRILDI (22.11.2026): "Teslim durumu,
            takvim, kılavuz ve kontroller çalışma özetinde" cümlesi
            sayfanın sonunda duruyordu ve aynı yere devam kartındaki
            "Çalışma ayrıntıları" bağlantısı zaten götürüyor. İŞLEV
            kalkmadı, yalnızca ikinci kez anlatılmıyor.
          */}
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
              baslik={t({ tr: "Çalışmalarım", en: "My works" })}
              alt={t({
                tr: `Aktif ${activeProjects.length} çalışma`,
                en: `${activeProjects.length} active work${activeProjects.length === 1 ? "" : "s"}`,
              })}
              bos={t({ tr: "Aktif çalışma yok.", en: "No active works." })}
              sayi={calismalarim.length}
              href={KISISEL_CALISMALAR}
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
              href={KISISEL_CALISMALAR}
              hrefEtiket={t({ tr: "Çalışmalara git", en: "Go to works" })}
            >
              {teslimler.map(({ project, due }) => (
                <ListeSatiri
                  key={project.id}
                  href={`/dashboard/editor/${project.id}`}
                  baslik={project.title}
                  alt={project.due_date ? tarih(project.due_date) : undefined}
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
              Dördüncü kart "şimdi ne yapmalıyım". 20.11.2026'ya kadar
              personelde bunun yerine kurumun "dikkat isteyenler" listesi
              çiziliyordu; personel ekranı kalktı (görevlendirme ArvoOS'ta).
            */}
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
          </ListeIzgarasi>
        </>
      )}
      {/*
        Geri bildirim sorusu SAYFANIN SONUNDA (Phase 3). Eskiden selamlamanın
        hemen altındaydı: telefonda ilk ekranın tamamını kaplıyor, tez kartı
        ve "Yazmaya devam et" kaydırmadan görünmüyordu. Soru kaybolmuyor,
        yalnızca öğrencinin asıl işinin önüne geçmiyor.
      */}
      {geriBildirim.sorulsun ? <GeriBildirimKarti baglam={geriBildirim.baglam} /> : null}
    </main>
  );
}
