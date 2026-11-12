"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { CROSSREF_USER_AGENT, crossrefWorkUrl, parseCrossrefWork } from "@/lib/doi";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { DOI_PENCERE, DOI_SAATLIK_HAK, doiRezervasyonu, doiSayacAnahtari } from "@/lib/doi-sorgu-siniri";
import {
  doiListesiniHazirla,
  kayitPlani,
  rezervasyonuBol,
  sirala,
  type CekilenKayit,
  type DoiOzeti,
  type DoiSonucu,
} from "@/lib/doi-toplu";
import { DOI_TOPLU_EN_COK, ICE_AKTARMA_EN_COK, kaynakAnahtarlari, type KaynakTaslagi } from "@/lib/kaynak-aktarim";
import { ceviri } from "@/lib/dil-sunucu";

/*
  TOPLU KAYNAK EKLEME (27.10.2026): Zotero/Mendeley dosyası ve DOI listesi.

  İkisi de YENİ İÇERİK yazıyor (DOI ayrıca Crossref'e gidiyor): abonelik
  kapısı var (lib/access.ts listesi). Dosya tarayıcıda ayrıştırılıyor
  (lib/kaynak-aktarim.ts); buraya yalnızca taslaklar geliyor ve her alan
  yeniden sınırlanıyor — istemciden gelen nesneye güvenilmez.

  TEKRAR EKLENMEZ: aynı DOI ya da aynı başlık + yıl bu çalışmada zaten
  varsa atlanır ve sayısı söylenir. Kütüphanesini ikinci kez yükleyen
  öğrencinin listesi ikiye katlanmasın.
*/

const yenile = () => {
  revalidatePath("/dashboard/literature");
  revalidatePath("/dashboard/editor");
};

const TURLER = ["article", "book", "chapter", "thesis", "report", "website", "other"];
const metin = (deger: unknown, enCok: number) => {
  const t = typeof deger === "string" ? deger.replace(/\s+/g, " ").trim().slice(0, enCok) : "";
  return t || null;
};

type Sonuc = { error?: string; eklenen?: number; atlanan?: number };

/* Çalışma kullanıcının mı ve mevcut kaynak anahtarları. */
async function hazirlik(projectId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { hata: (await oturumYokMesaji()) } as const;
  if (await isSubscriptionBlocked()) return { hata: (await abonelikKapaliMesaji()) } as const;
  const t = await ceviri();
  const { data: proje, error: projeHatasi } = await ctx.supabase
    .from("academic_projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", ctx.user.id)
    .maybeSingle();
  if (projeHatasi) return { hata: t({ tr: "Çalışma okunamadı; yeniden deneyin.", en: "Couldn't read the work; please try again." }) } as const;
  if (!proje) return { hata: t({ tr: "Çalışma bulunamadı ya da size ait değil.", en: "Work not found or it doesn't belong to you." }) } as const;
  const { data: mevcut, error } = await ctx.supabase
    .from("literature_sources")
    .select("title, year, doi_or_url")
    .eq("owner_id", ctx.user.id)
    .eq("project_id", projectId);
  /* Mevcut liste okunamazsa ekleme yapılmaz: tekrar denetimi yapılamadan eklemek listeyi ikiye katlayabilir. */
  if (error) return { hata: t({ tr: "Mevcut kaynaklarınız okunamadı; tekrarları ayıklayamadığımız için ekleme yapılmadı.", en: "Couldn't read your existing sources; nothing was added because duplicates couldn't be filtered out." }) } as const;
  // DOI ve başlık+yıl birlikte: biriyle eşleşen kayıt tekrardır (lib/kaynak-aktarim kaynakAnahtarlari).
  const anahtarlar = new Set((mevcut ?? []).flatMap((k) => kaynakAnahtarlari(k)));
  return { ctx, anahtarlar } as const;
}

function satira(taslak: KaynakTaslagi, ownerId: string, projectId: string) {
  return {
    owner_id: ownerId,
    project_id: projectId,
    title: metin(taslak.title, 500)!,
    authors: metin(taslak.authors, 1000),
    year: metin(taslak.year, 20),
    source_type: TURLER.includes(taslak.sourceType) ? taslak.sourceType : "other",
    doi_or_url: metin(taslak.doiOrUrl, 500),
    status: "to_review",
    notes: null,
    container_title: metin(taslak.containerTitle, 500),
    volume: metin(taslak.volume, 40),
    issue: metin(taslak.issue, 40),
    pages: metin(taslak.pages, 40),
    publisher: metin(taslak.publisher, 300),
    publication_place: metin(taslak.publicationPlace, 200),
  };
}

async function ekle(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  anahtarlar: Set<string>,
  taslaklar: KaynakTaslagi[],
  projectId: string,
): Promise<Sonuc> {
  const satirlar: ReturnType<typeof satira>[] = [];
  let atlanan = 0;
  for (const taslak of taslaklar) {
    if (!metin(taslak?.title, 500)) {
      atlanan += 1;
      continue;
    }
    const anahtarlari = kaynakAnahtarlari(taslak);
    if (anahtarlari.some((a) => anahtarlar.has(a))) {
      atlanan += 1;
      continue;
    }
    for (const a of anahtarlari) anahtarlar.add(a);
    satirlar.push(satira(taslak, ctx.user.id, projectId));
  }
  for (let i = 0; i < satirlar.length; i += 200) {
    const { error } = await ctx.supabase.from("literature_sources").insert(satirlar.slice(i, i + 200));
    if (error) {
      console.error("[kaynak-aktarim] ekleme", error.message);
      if (i > 0) yenile();
      const t = await ceviri();
      return {
        error: i > 0
          ? t({ tr: `${i} kaynak eklendi, kalanlar kaydedilemedi; yeniden deneyin (eklenenler tekrar edilmez).`, en: `${i} sources were added, but the rest couldn't be saved; please try again (added ones won't be duplicated).` })
          : t({ tr: "Kaynaklar kaydedilemedi.", en: "Couldn't save the sources." }),
      };
    }
  }
  if (satirlar.length) yenile();
  return { eklenen: satirlar.length, atlanan };
}

/** Zotero/Mendeley/EndNote dosyasından ayrıştırılmış künyeleri ekler. */
export async function kaynaklariIceAktar(projectId: string, taslaklar: KaynakTaslagi[]): Promise<Sonuc> {
  const t = await ceviri();
  if (!Array.isArray(taslaklar) || !taslaklar.length) return { error: t({ tr: "Dosyada okunabilir kaynak bulunamadı.", en: "No readable sources were found in the file." }) };
  if (taslaklar.length > ICE_AKTARMA_EN_COK) return { error: t({ tr: `Tek seferde en çok ${ICE_AKTARMA_EN_COK} kaynak aktarılabilir; dosyayı bölün.`, en: `You can import at most ${ICE_AKTARMA_EN_COK} sources at once; please split the file.` }) };
  const h = await hazirlik(projectId);
  if ("hata" in h) return { error: h.hata };
  return ekle(h.ctx, h.anahtarlar, taslaklar, projectId);
}

export type { DoiSonucu, DoiOzeti } from "@/lib/doi-toplu";

/*
  Crossref aşamasının süre bütçesi. Sayfanın maxDuration'ı 120 sn
  (app/dashboard/literature/page.tsx); 50 DOI beşerli gruplarla ve istek
  başına 8 sn zaman aşımıyla en kötü durumda 80 sn sürer. Bütçe dolunca
  başlanmamış gruplar "ertelendi" (neden: süre) döner — yarıda kesilen bir
  istekte hiçbir şey yazılmadan cevapsız kalmaktansa.
*/
const CROSSREF_SURE_BUTCESI_MS = 70_000;

/*
  DOI listesinden ekleme: künye Crossref'ten (lib/doi.ts). Sunucu yalnızca
  sabit Crossref adresine, doğrulanmış DOI ile gider. Aynı anda en çok
  beş istek: Crossref'in "kibar havuz" sınırı.

  ORTAK SAATLİK BÜTÇE (T3, 12.11.2026): tekli DOI sorgusuyla aynı
  kullanıcı başına 120 DOI (lib/doi-sorgu-siniri.ts). Eskiden bu yol
  abonelik kapılıydı ama sınırsızdı: çağrı başına 50 DOI, istenen kadar
  tekrar. Hak yalnızca Crossref'e gidecek DOI'ler için ve TEK atomik
  çağrıyla (rate_limit_take) ayrılır; yetmezse ilk N DOI sorgulanır,
  kalanı "ertelendi" döner (sıra kullanıcınınki). Tekrar denemek
  güvenli: eklenenler "vardi" olur ve hak harcamaz.

  Sonuçların kuralları lib/doi-toplu.ts'te (D1, D2 düzeltmeleri dahil).
*/
export async function doiIleEkle(
  projectId: string,
  doilar: string[],
): Promise<{ error?: string; sonuclar?: DoiSonucu[]; ozet?: DoiOzeti }> {
  const t = await ceviri();
  // Biçim ve adet denetimi oturumdan önce: veritabanına hiç gitmeden.
  const onHazirlik = doiListesiniHazirla(doilar, new Set());
  if (!onHazirlik.sira.length) return { error: t({ tr: "Geçerli bir DOI bulunamadı (ör. 10.1000/xyz123 ya da https://doi.org/…).", en: "No valid DOI was found (e.g. 10.1000/xyz123 or https://doi.org/…)." }) };
  if (onHazirlik.sira.length > DOI_TOPLU_EN_COK) return { error: t({ tr: `Tek seferde en çok ${DOI_TOPLU_EN_COK} DOI eklenebilir.`, en: `You can add at most ${DOI_TOPLU_EN_COK} DOIs at once.` }) };
  const h = await hazirlik(projectId);
  if ("hata" in h) return { error: h.hata };

  const plan = doiListesiniHazirla(doilar, h.anahtarlar);
  const sonuclar: DoiSonucu[] = plan.vardi.map((doi) => ({ doi, durum: "vardi" as const }));

  // Hak: yalnızca Crossref'e gidecekler için, tek atomik çağrıyla.
  let hak: ReturnType<typeof doiRezervasyonu> = { tur: "sayacli", verilen: 0, kalan: DOI_SAATLIK_HAK, yenilenme: null };
  if (plan.aranacak.length) {
    const sayac = adminIstemcisiVarsa();
    let cevap: { data: unknown; error: { message: string } | null } | null = null;
    if (sayac) {
      try {
        cevap = await sayac.rpc("rate_limit_take", {
          p_key: doiSayacAnahtari(h.ctx.user.id),
          p_limit: DOI_SAATLIK_HAK,
          p_window: DOI_PENCERE,
          p_requested: plan.aranacak.length,
        });
      } catch (hata) {
        cevap = { data: null, error: { message: hata instanceof Error ? hata.message : String(hata) } };
      }
    }
    hak = doiRezervasyonu({ sayacVar: Boolean(sayac), hata: cevap?.error, veri: cevap?.data, istenen: plan.aranacak.length });
    if (hak.tur === "sayacsiz") {
      // Açık kalır (lib/doi-sorgu-siniri.ts); arıza günlükte ve özette görünür.
      console.error("[kaynak-aktarim] hız sınırı uygulanamadı:", sayac ? cevap?.error?.message ?? "beklenmeyen cevap" : "sunucu anahtarı yok");
    }
  }
  const { islenecek, ertelenen } = rezervasyonuBol(plan.aranacak, hak.verilen);
  for (const doi of ertelenen) sonuclar.push({ doi, durum: "ertelendi", neden: "hak" });

  const cekilenler: CekilenKayit[] = [];
  let sorgulanan = 0;
  const getir = async (doi: string) => {
    sorgulanan += 1;
    try {
      const yanit = await fetch(crossrefWorkUrl(doi), {
        headers: { "User-Agent": CROSSREF_USER_AGENT },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (yanit.status === 404) return void sonuclar.push({ doi, durum: "bulunamadi" });
      if (!yanit.ok) return void sonuclar.push({ doi, durum: "hata" });
      const govde = (await yanit.json()) as { message?: unknown };
      const m = parseCrossrefWork(govde.message as Parameters<typeof parseCrossrefWork>[0], doi);
      if (!m) return void sonuclar.push({ doi, durum: "bulunamadi" });
      cekilenler.push({
        doi,
        taslak: {
          title: m.title,
          authors: m.authors,
          year: m.year,
          sourceType: m.sourceType,
          doiOrUrl: m.doi,
          containerTitle: m.containerTitle,
          volume: m.volume,
          issue: m.issue,
          pages: m.pages,
          publisher: m.publisher,
          publicationPlace: m.publicationPlace,
        },
      });
    } catch (error) {
      console.error("[kaynak-aktarim] Crossref", doi, error instanceof Error ? error.message : error);
      sonuclar.push({ doi, durum: "hata" });
    }
  };
  const bitis = Date.now() + CROSSREF_SURE_BUTCESI_MS;
  for (let i = 0; i < islenecek.length; i += 5) {
    if (Date.now() > bitis) {
      for (const doi of islenecek.slice(i)) sonuclar.push({ doi, durum: "ertelendi", neden: "sure" });
      break;
    }
    await Promise.all(islenecek.slice(i, i + 5).map(getir));
  }
  // Çekilenleri listedeki sıraya koy: başlık+yıl çakışmasında "ilk gelen" kullanıcının sırasındaki ilk olsun.
  cekilenler.sort((a, b) => plan.sira.indexOf(a.doi) - plan.sira.indexOf(b.doi));

  const { yazilacak, baslikCakisan, doiCakisan } = kayitPlani(cekilenler, h.anahtarlar);
  for (const k of doiCakisan) sonuclar.push({ doi: k.doi, durum: "vardi", baslik: k.taslak.title });
  for (const k of baslikCakisan) sonuclar.push({ doi: k.doi, durum: "vardi_baslik", baslik: k.taslak.title });

  let kayitHatasi: string | undefined;
  if (yazilacak.length) {
    // En çok 50 satır, tek ifade: ya hepsi yazılır ya hiçbiri.
    const { error } = await h.ctx.supabase
      .from("literature_sources")
      .insert(yazilacak.map((k) => satira(k.taslak, h.ctx.user.id, projectId)));
    if (error) {
      console.error("[kaynak-aktarim] DOI ekleme", error.message);
      kayitHatasi = t({
        tr: "Crossref'ten gelen kaynaklar kaydedilemedi; aynı listeyle yeniden deneyin.",
        en: "The sources fetched from Crossref couldn't be saved; please try again with the same list.",
      });
      for (const k of yazilacak) sonuclar.push({ doi: k.doi, durum: "kaydedilemedi", baslik: k.taslak.title });
    } else {
      for (const k of yazilacak) sonuclar.push({ doi: k.doi, durum: "eklendi", baslik: k.taslak.title });
      yenile();
    }
  }

  const ertelenenSayi = sonuclar.filter((s) => s.durum === "ertelendi").length;
  const ozet: DoiOzeti = {
    istenen: plan.aranacak.length,
    rezerve: hak.verilen,
    sorgulanan,
    kullanilmayan: Math.max(0, hak.verilen - sorgulanan),
    ertelenen: ertelenenSayi,
    // Sayaca hiç sorulmadıysa (aranacak yok) kalan hak BİLİNMİYOR; uydurma bir 120 yazılmaz.
    kalanHak: plan.aranacak.length && hak.tur === "sayacli" ? hak.kalan : null,
    yenilenme: plan.aranacak.length && hak.tur === "sayacli" ? hak.yenilenme : null,
    sayacsiz: hak.tur === "sayacsiz",
    gecersiz: plan.gecersiz,
    listedeTekrar: plan.listedeTekrar,
  };
  return { ...(kayitHatasi ? { error: kayitHatasi } : {}), sonuclar: sirala(sonuclar, plan.sira), ozet };
}
