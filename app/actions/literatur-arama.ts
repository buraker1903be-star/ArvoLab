"use server";

import { calismaListeleriniYenile } from "@/lib/liste-yenileme";
import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { kaynakYazarDizesi, literaturAra, type AramaKaydi } from "@/lib/literatur-arama";
import { ceviri } from "@/lib/dil-sunucu";
import { lookupDoi } from "@/app/actions/literature";
import { htmlVarliklariniCoz } from "@/lib/html-varlik";

const PAGE_PATH = "/dashboard/literature";
/* Literatür, Çalışmalarım'daki durum kartından da pencere olarak açılıyor;
   kart sayıları ve pencere içeriği eskimesin. */
const yenile = () => {
  revalidatePath(PAGE_PATH);
  calismaListeleriniYenile();
};
const EN_KISA_SORGU = 3;
const EN_UZUN_SORGU = 300;
/*
  Saatlik arama hakkı. Sebebi kota değil nezaket: OpenAlex ve Crossref
  ücretsiz ve açık; sunucumuz üzerinden sınırsız sorgu, onların kapısında
  bizim adımıza gürültü demek. Bir oturumda 60 arama, en yoğun literatür
  gününde bile fazlasıyla yeter.
*/
const SAATLIK_HAK = 60;
/* Veritabanının kabul ettiği türler (literature_sources CHECK). İstemciden
   gelen değer doğrulanmazsa kayıt veritabanında reddedilir ve kullanıcı
   sebebini anlamadan "eklenemedi" görür. */
const TURLER = ["article", "book", "chapter", "thesis", "report", "website", "other"];

export interface AramaYaniti {
  hata?: string;
  kayitlar?: (AramaKaydi & { listede: boolean })[];
  /** Cevap vermeyen dizinler: liste eksik olabilir, kullanıcı bilsin. */
  ulasilamayan?: string[];
  /** Kendi listesi okunamadı: "zaten listemde" işaretleri bu aramada yok. */
  listeOkunamadi?: boolean;
}

const sadeBaslik = (baslik: string) => baslik.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sayi = (deger: unknown): number | null => {
  const yil = Number(deger);
  return Number.isFinite(yil) && yil > 0 ? Math.trunc(yil) : null;
};

export async function literaturAramasiYap(girdi: {
  sorgu: string;
  yilDan?: number | null;
  yilaKadar?: number | null;
  yalnizcaAcikErisim?: boolean;
  /** Tarama günlüğünün bağlanacağı çalışma (isteğe bağlı). */
  projectId?: string | null;
  /*
    Kaynakça denetimindeki "bu künyeyi dizinde ara" düğmesi de bu
    aramayı kullanıyor; o bir literatür TARAMASI değil, tek bir künyenin
    teyidi. Günlüğe girerse tarama kaydı künye aramalarıyla dolar.
  */
  gunlukDisi?: boolean;
}): Promise<AramaYaniti> {
  const ctx = await getAuthContext();
  if (!ctx) return { hata: (await oturumYokMesaji()) };
  if (await isSubscriptionBlocked()) return { hata: (await abonelikKapaliMesaji()) };
  const t = await ceviri();

  const sorgu = String(girdi.sorgu ?? "").trim().slice(0, EN_UZUN_SORGU);
  if (sorgu.length < EN_KISA_SORGU) return { hata: t({ tr: "Aramak için en az birkaç harf yazın.", en: "Type at least a few letters to search." }) };

  // Sayaç kurulamıyorsa arama engellenmiyor (bkz. adminIstemcisiVarsa).
  const admin = adminIstemcisiVarsa();
  if (admin) {
    const { data: izin, error } = await admin.rpc("rate_limit_hit", {
      p_key: `literatur-arama:${ctx.user.id}`,
      p_limit: SAATLIK_HAK,
      p_window: "1 hour",
    });
    // Sayaç okunamazsa akış durmaz; kapı sert kapanmamalı (lib/ai/erisim.ts ile aynı ilke).
    if (error) console.error("[literatur-arama] hız sınırı okunamadı:", error.message);
    else if (izin === false) return { hata: t({ tr: `Saatlik arama hakkınız doldu (${SAATLIK_HAK}). Bir süre sonra tekrar deneyin.`, en: `You've used up your hourly search limit (${SAATLIK_HAK}). Please try again later.` }) };
  }

  const filtreler = {
    yilDan: sayi(girdi.yilDan),
    yilaKadar: sayi(girdi.yilaKadar),
    yalnizcaAcikErisim: Boolean(girdi.yalnizcaAcikErisim),
  };
  const { kayitlar, ulasilamayan } = await literaturAra({ sorgu, ...filtreler });

  if (!girdi.gunlukDisi) await taramayiGunlugeYaz(ctx, {
    sorgu,
    filtreler,
    projectId: girdi.projectId,
    ulasilamayan,
    gosterilen: kayitlar.length,
  });

  if (kayitlar.length === 0 && ulasilamayan.length === 2) {
    return { hata: t({ tr: "Dizinlere şu anda ulaşılamıyor. Birazdan tekrar deneyin.", en: "The indexes can't be reached right now. Please try again shortly." }) };
  }

  /*
    AÇIK ERİŞİMİ YALNIZCA OPENALEX BİLİYOR (Crossref güvenilir biçimde
    söylemiyor, bu yüzden oradan gelen kayıtlar "açık erişim değil"
    sayılmıyor, "bilinmiyor" sayılıyor).

    OpenAlex'e ulaşılamadığında "yalnızca açık erişim" araması hiçbir
    zaman sonuç veremez. Eskiden bu durumda ekran "Bu aramada sonuç
    çıkmadı. Daha genel bir ifade deneyin ya da yıl aralığını
    genişletin." diyordu: cümle YANLIŞ ve önerdiği çare işe yaramaz —
    sorgu ne kadar genişletilse de sonuç çıkmayacaktı.

    Bilinmeyeni "yok" diye sunmak bu projede yasak; doğrusunu söylüyoruz
    ve işe yarayan çareyi veriyoruz.
  */
  if (kayitlar.length === 0 && girdi.yalnizcaAcikErisim && ulasilamayan.includes("openalex")) {
    return {
      hata: t({
        tr: "Açık erişim bilgisini yalnızca OpenAlex veriyor ve şu anda ulaşılamıyor. "
          + "Açık erişim süzgecini kaldırıp arayabilir ya da birazdan tekrar deneyebilirsiniz.",
        en: "Only OpenAlex provides open-access information, and it can't be reached right now. "
          + "You can remove the open-access filter and search again, or try again shortly.",
      }),
    };
  }

  /*
    "Zaten listemde" bilgisi olmadan öğrenci aynı kaynağı defalarca ekliyor
    ve sonra listesinde tekrarları temizlemekle uğraşıyordu. DOI kesin
    ölçüt; DOI'si olmayan kayıtlar için başlık karşılaştırılıyor.
  */
  const { data: mevcut, error: listeHatasi } = await ctx.supabase
    .from("literature_sources")
    .select("title, doi_or_url")
    .eq("owner_id", ctx.user.id);
  /* Hata yutulursa işaretler sessizce kaybolur ve öğrenci aynı kaynağı yeniden ekler. */
  if (listeHatasi) console.error("[literatur] liste okunamadı:", listeHatasi.message);
  const doiler = new Set<string>();
  const basliklar = new Set<string>();
  for (const satir of mevcut ?? []) {
    if (satir.doi_or_url) doiler.add(String(satir.doi_or_url).toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ""));
    if (satir.title) basliklar.add(sadeBaslik(satir.title));
  }

  return {
    kayitlar: kayitlar.map((kayit) => ({
      ...kayit,
      listede: (kayit.doi ? doiler.has(kayit.doi) : false) || basliklar.has(sadeBaslik(kayit.baslik)),
    })),
    ulasilamayan,
    ...(listeHatasi ? { listeOkunamadi: true } : {}),
  };
}

/*
  TARAMA GÜNLÜĞÜ (migration 20261026065320). Hangi dizinde, hangi
  sorguyla, ne zaman, hangi filtrelerle arandığı ve kaç sonuç gösterildiği
  kaydediliyor: literatür bölümü "kapsamlı tarama yapıldı" demek yerine
  gerçekten yapılanı gösterebilsin. Cevap vermeyen dizin "tarandı"
  sayılmıyor (yanit_veren ayrı sütun).

  Günlük akışı DÜŞÜRMEZ: yazılamazsa kullanıcı sonuçlarını yine alır,
  hata yalnızca log'a gider (asistan kaydıyla aynı ilke).
*/
const SORGULANAN_DIZINLER = ["openalex", "crossref"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function taramayiGunlugeYaz(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  kayit: { sorgu: string; filtreler: Record<string, unknown>; projectId?: string | null; ulasilamayan: string[]; gosterilen: number },
) {
  const projectId = kayit.projectId && UUID.test(kayit.projectId) ? kayit.projectId : null;
  const { error } = await ctx.supabase.from("literatur_tarama_gunlugu").insert({
    kullanici: ctx.user.id,
    project_id: projectId,
    sorgu: kayit.sorgu,
    filtreler: kayit.filtreler,
    sorgulanan: SORGULANAN_DIZINLER,
    yanit_veren: SORGULANAN_DIZINLER.filter((d) => !kayit.ulasilamayan.includes(d)),
    ulasilamayan: kayit.ulasilamayan,
    gosterilen_sonuc: kayit.gosterilen,
  });
  if (error) console.error("[literatur-arama] tarama günlüğü yazılamadı:", error.message);
}

export type TaramaGunluguSatiri = {
  id: string;
  sorgu: string;
  filtreler: { yilDan?: number | null; yilaKadar?: number | null; yalnizcaAcikErisim?: boolean };
  yanit_veren: string[];
  ulasilamayan: string[];
  gosterilen_sonuc: number;
  olusturuldu: string;
};

/**
 * Çalışmanın (verilmezse kullanıcının) son taramaları. Okuma: RLS sahibini
 * ve çalışmayı görebilenleri sınırlıyor.
 */
export async function taramaGunlugu(projectId?: string | null, sinir = 50): Promise<{ satirlar: TaramaGunluguSatiri[]; okunamadi: boolean }> {
  const ctx = await getAuthContext();
  if (!ctx) return { satirlar: [], okunamadi: false };
  let sorgu = ctx.supabase
    .from("literatur_tarama_gunlugu")
    .select("id, sorgu, filtreler, yanit_veren, ulasilamayan, gosterilen_sonuc, olusturuldu")
    .order("olusturuldu", { ascending: false })
    .limit(Math.min(Math.max(sinir, 1), 200));
  sorgu = projectId && UUID.test(projectId) ? sorgu.eq("project_id", projectId) : sorgu.eq("kullanici", ctx.user.id);
  const { data, error } = await sorgu;
  if (error) {
    console.error("[literatur-arama] tarama günlüğü okunamadı:", error.message);
    return { satirlar: [], okunamadi: true };
  }
  return { satirlar: (data ?? []) as TaramaGunluguSatiri[], okunamadi: false };
}

/**
 * Bulunan kaydı kullanıcının listesine ekler.
 *
 * Alanlar istemciden geliyor ama uydurulamaz: hepsi metin olarak
 * saklanıyor, satır kullanıcının kendi kaydı ve RLS owner_id'yi zaten
 * sınırlıyor. Riskli olan tek şey uzunluk, o da kırpılıyor.
 */
export async function aramaKaydiniEkle(kayit: {
  baslik: string;
  yazarlar?: string[];
  /** Sağlayıcının given/family verisinden kurulmuş künye dizesi (lib/literatur-arama.ts). */
  kunyeYazarlari?: string | null;
  yil?: number | null;
  tur?: string;
  dergi?: string | null;
  doi?: string | null;
  url?: string;
  projectId?: string | null;
}): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();

  const baslik = String(kayit.baslik ?? "").trim().slice(0, 500);
  if (!baslik) return { error: t({ tr: "Kaynak başlığı okunamadı.", en: "Couldn't read the source title." }) };

  /*
    YAZAR VE KÜNYE (20.11.2026). Eskiden ekrandaki "Ad Soyad" dizisi ", "
    ile birleştirilip yazılıyordu ("Edward W. Fisher, Jane Other"); atıf bunu
    tek yazar sanıyordu. Sıra: (1) DOI varsa Crossref künyesi (DOI ile kaynak
    eklemenin aynısı; cilt, sayı, sayfa da gelir), (2) sağlayıcının
    yapılandırılmış adı, (3) ikisi de yoksa adlar "; " ile, TERS ÇEVRİLMEDEN:
    soyadını tahmin etmek "van der Berg" ya da kurum adını bozar. Üçüncü
    durumdaki kayıt Kaynaklar'da "yazar biçimi doğrulanmadı" diye işaretlenir.
  */
  const doiBilgisi = kayit.doi ? (await lookupDoi(kayit.doi).catch(() => ({ metadata: undefined }))).metadata : undefined;
  const yazarlar = kaynakYazarDizesi({ doiYazarlari: doiBilgisi?.authors, kunyeYazarlari: kayit.kunyeYazarlari, yazarlar: kayit.yazarlar }) ?? "";
  const satir = {
    owner_id: ctx.user.id,
    project_id: String(kayit.projectId ?? "").trim() || null,
    title: htmlVarliklariniCoz(baslik).slice(0, 500) || baslik,
    authors: yazarlar.slice(0, 500) || null,
    // Künye yılı sayının yılı (OpenAlex'le uzlaştırılmış arama yılı); yoksa Crossref'inki.
    year: kayit.yil ? String(kayit.yil) : doiBilgisi?.year ?? null,
    source_type: TURLER.includes(String(kayit.tur)) ? String(kayit.tur) : "other",
    doi_or_url: (kayit.doi ? `https://doi.org/${kayit.doi}` : String(kayit.url ?? "")).slice(0, 500) || null,
    status: "to_review" as const,
    notes: null,
  };
  const yayin = {
    container_title: (doiBilgisi?.containerTitle || htmlVarliklariniCoz(kayit.dergi)).slice(0, 500) || null,
    volume: doiBilgisi?.volume ?? null,
    issue: doiBilgisi?.issue ?? null,
    pages: doiBilgisi?.pages ?? null,
    publisher: doiBilgisi?.publisher ?? null,
  };
  // Dergi adı sonradan eklenen bir kolon; yoksa kaynak yine kaydedilir.
  let { error } = await ctx.supabase
    .from("literature_sources")
    .insert({ ...satir, ...yayin });
  if (error?.code === "PGRST204" || error?.code === "42703") {
    ({ error } = await ctx.supabase.from("literature_sources").insert(satir));
  }
  if (error) {
    console.error(error);
    return { error: t({ tr: "Kaynak listenize eklenemedi.", en: "Couldn't add it to your sources." }) };
  }

  yenile();
  return { success: true };
}

/**
 * "PDF'yi oku" (M7, 20.11.2026): arama sonucunu çalışmaya OKUNACAK olarak
 * alır ve okumaya hazırlar. Kaynak çalışmada zaten varsa (DOI ya da başlık)
 * yeniden eklenmez ve `yeni: false` döner: Geri al yalnızca bu çağrının
 * eklediği kaydı silebilsin, öğrencinin önceden eklediği kayda asla
 * dokunulmasın. Çalışma seçilmeden çağrılırsa çalışma OLUŞTURULMAZ.
 * PDF bu çalışmada zaten hazırsa kimliği döner; çağıran ikinci kez indirmez.
 */
export async function okumayaAl(kayit: {
  baslik: string;
  yazarlar?: string[];
  /** Sağlayıcının yapılandırılmış yazar dizesi (aramaKaydiniEkle ile aynı). */
  kunyeYazarlari?: string | null;
  yil?: number | null;
  tur?: string;
  dergi?: string | null;
  doi?: string | null;
  url?: string;
  projectId: string;
}): Promise<{ kaynakId: string; yeni: boolean; hazirPdfId: string | null } | { error: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: await abonelikKapaliMesaji() };
  const t = await ceviri();
  const projectId = String(kayit.projectId ?? "").trim();
  if (!UUID.test(projectId)) return { error: t({ tr: "Önce bir çalışma seçin; PDF çalışmanın kaynaklarına eklenir.", en: "Pick a work first; the PDF is added to that work's sources." }) };
  const baslik = String(kayit.baslik ?? "").trim().slice(0, 500);
  if (!baslik) return { error: t({ tr: "Kaynak başlığı okunamadı.", en: "Couldn't read the source title." }) };
  const doi = String(kayit.doi ?? "").trim().toLowerCase() || null;

  /* Var mı: aynı çalışmada aynı DOI ya da aynı başlık. Okuma hatası "yok"
     sayılmaz — sayılsaydı ikinci bir kopya eklenir, Geri al onu da silerdi. */
  const { data: adaylar, error: okumaHatasi } = await ctx.supabase
    .from("literature_sources")
    .select("id, title, doi_or_url")
    .eq("owner_id", ctx.user.id)
    .eq("project_id", projectId)
    .limit(500);
  if (okumaHatasi) {
    console.error("[okumaya-al] kaynaklar okunamadı:", okumaHatasi.message);
    return { error: t({ tr: "Kaynaklarınız okunamadı; tekrar deneyin.", en: "Your sources couldn't be read; please try again." }) };
  }
  const baslikAnahtari = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const mevcut = (adaylar ?? []).find(
    (a) => (doi && String(a.doi_or_url ?? "").toLowerCase().includes(doi)) || baslikAnahtari(String(a.title ?? "")) === baslikAnahtari(baslik),
  );

  let kaynakId: string;
  let yeni = false;
  if (mevcut) {
    kaynakId = String(mevcut.id);
  } else {
    /*
      Yazar ve yayın bilgisi "Listeme ekle" ile AYNI yoldan (kaynakYazarDizesi):
      DOI'nin Crossref künyesi, sonra yapılandırılmış ad, sonra "; " ile adlar.
      Eskiden burada adlar ", " ile birleşiyordu ve atıf iki yazarı tek yazar
      sayıyordu ("(Markus Knauff, 2014)", 21.11.2026). Yalnızca YENİ kayıtlar:
      eski kayıtlar toplu dönüştürülmez.
    */
    const doiBilgisi = doi ? (await lookupDoi(doi).catch(() => ({ metadata: undefined }))).metadata : undefined;
    const satir = {
      owner_id: ctx.user.id,
      project_id: projectId,
      title: htmlVarliklariniCoz(baslik).slice(0, 500) || baslik,
      authors: kaynakYazarDizesi({ doiYazarlari: doiBilgisi?.authors, kunyeYazarlari: kayit.kunyeYazarlari, yazarlar: kayit.yazarlar }),
      year: kayit.yil ? String(kayit.yil) : doiBilgisi?.year ?? null,
      source_type: TURLER.includes(String(kayit.tur)) ? String(kayit.tur) : "other",
      doi_or_url: (doi ? `https://doi.org/${doi}` : String(kayit.url ?? "")).slice(0, 500) || null,
      status: "to_review" as const,
      notes: null,
      container_title: (doiBilgisi?.containerTitle || htmlVarliklariniCoz(kayit.dergi)).slice(0, 500) || null,
      volume: doiBilgisi?.volume ?? null,
      issue: doiBilgisi?.issue ?? null,
      pages: doiBilgisi?.pages ?? null,
      publisher: doiBilgisi?.publisher ?? null,
    };
    const { data: eklenen, error } = await ctx.supabase.from("literature_sources").insert(satir).select("id").single();
    if (error || !eklenen) {
      console.error("[okumaya-al] eklenemedi:", error?.message);
      return { error: t({ tr: "Kaynak çalışmaya eklenemedi.", en: "Couldn't add the source to the work." }) };
    }
    kaynakId = String(eklenen.id);
    yeni = true;
  }

  let hazirPdfId: string | null = null;
  const { data: pdfler, error: pdfHatasi } = await ctx.supabase
    .from("kaynak_pdfleri")
    .select("id, durum, doi, kaynak_id")
    .eq("project_id", projectId)
    .in("durum", ["indirildi", "yuklendi"])
    .limit(500);
  if (pdfHatasi) console.error("[okumaya-al] PDF kayıtları okunamadı:", pdfHatasi.message);
  // hata-tamam: okunamazsa hazır PDF yok sayılır; çağıran PDF'i arar, ikinci kopya yazılmaz (otomatikSonucuYaz koşulu).
  else hazirPdfId = (pdfler ?? []).find((p) => p.kaynak_id === kaynakId || (doi && String(p.doi ?? "").toLowerCase() === doi))?.id ?? null;

  yenile();
  return { kaynakId, yeni, hazirPdfId };
}
