"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { CROSSREF_USER_AGENT, crossrefWorkUrl, normalizeDoi, parseCrossrefWork } from "@/lib/doi";
import { DOI_TOPLU_EN_COK, ICE_AKTARMA_EN_COK, kaynakAnahtari, type KaynakTaslagi } from "@/lib/kaynak-aktarim";
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
  const anahtarlar = new Set((mevcut ?? []).map((k) => kaynakAnahtari(k)));
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
    const anahtar = kaynakAnahtari(taslak);
    if (anahtarlar.has(anahtar)) {
      atlanan += 1;
      continue;
    }
    anahtarlar.add(anahtar);
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

export type DoiSonucu = { doi: string; durum: "eklendi" | "vardi" | "bulunamadi" | "hata"; baslik?: string };

/*
  DOI listesinden ekleme: künye Crossref'ten (lib/doi.ts). Sunucu yalnızca
  sabit Crossref adresine, doğrulanmış DOI ile gider. Aynı anda en çok
  beş istek: Crossref'in "kibar havuz" sınırı.
*/
export async function doiIleEkle(projectId: string, doilar: string[]): Promise<{ error?: string; sonuclar?: DoiSonucu[] }> {
  const temiz = [...new Set((Array.isArray(doilar) ? doilar : []).map((d) => normalizeDoi(String(d))).filter((d): d is string => !!d))];
  const t = await ceviri();
  if (!temiz.length) return { error: t({ tr: "Geçerli bir DOI bulunamadı (ör. 10.1000/xyz123 ya da https://doi.org/…).", en: "No valid DOI was found (e.g. 10.1000/xyz123 or https://doi.org/…)." }) };
  if (temiz.length > DOI_TOPLU_EN_COK) return { error: t({ tr: `Tek seferde en çok ${DOI_TOPLU_EN_COK} DOI eklenebilir.`, en: `You can add at most ${DOI_TOPLU_EN_COK} DOIs at once.` }) };
  const h = await hazirlik(projectId);
  if ("hata" in h) return { error: h.hata };

  const sonuclar: DoiSonucu[] = [];
  const taslaklar: KaynakTaslagi[] = [];
  const getir = async (doi: string) => {
    if (h.anahtarlar.has(kaynakAnahtari({ title: "", year: null, doiOrUrl: doi }))) {
      sonuclar.push({ doi, durum: "vardi" });
      return;
    }
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
      taslaklar.push({
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
      });
      sonuclar.push({ doi, durum: "eklendi", baslik: m.title });
    } catch (error) {
      console.error("[kaynak-aktarim] Crossref", doi, error instanceof Error ? error.message : error);
      sonuclar.push({ doi, durum: "hata" });
    }
  };
  for (let i = 0; i < temiz.length; i += 5) await Promise.all(temiz.slice(i, i + 5).map(getir));

  if (taslaklar.length) {
    const r = await ekle(h.ctx, h.anahtarlar, taslaklar, projectId);
    if (r.error) return { error: r.error };
  }
  /* Kullanıcının yapıştırdığı sırayla dönsün. */
  sonuclar.sort((a, b) => temiz.indexOf(a.doi) - temiz.indexOf(b.doi));
  return { sonuclar };
}
