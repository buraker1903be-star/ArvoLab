"use server";

import { revalidatePath } from "next/cache";
import { HEDEF_MESAJI, kaynakHedefi } from "@/lib/kaynak-hedefi";
import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { doiAnahtari } from "@/lib/doi";
import { crossrefKunyesi } from "@/lib/doi-sorgu";
import { dizinHakkiDus } from "@/lib/dizin-kotasi";
import { topluDoiAyikla, topluDoiGetir, type TopluDoiNeden } from "@/lib/toplu-doi";
import { DOI_TOPLU_EN_COK, ICE_AKTARMA_EN_COK, kaynakAnahtari, kaynakAnahtarlari, type KaynakTaslagi } from "@/lib/kaynak-aktarim";
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
  /*
    Toplu yollar çalışmasız kayıt açmaz: bu ekranlar her zaman bir çalışma
    için açılır. Denetim öteki ekleme yollarıyla aynı (lib/kaynak-hedefi.ts).
  */
  const hedef = await kaynakHedefi(ctx.supabase, ctx.user.id, projectId);
  if (hedef.durum === "okunamadi") return { hata: t(HEDEF_MESAJI.okunamadi) } as const;
  if (hedef.durum !== "tamam") return { hata: t(HEDEF_MESAJI.yetkisiz) } as const;
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
  /** Tekrar diye atlanan taslaklar buraya eklenir (DOI listesi sonucu doğru raporlasın). */
  tekrarlar?: KaynakTaslagi[],
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
      tekrarlar?.push(taslak);
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

export type DoiSonucu = {
  doi: string;
  durum: "eklendi" | "vardi" | "bulunamadi" | "hata" | "islenmedi";
  baslik?: string;
  /** "hata" ve "islenmedi" için: kullanıcıya ayrı ayrı söylenir (lib/toplu-doi.ts). */
  neden?: TopluDoiNeden;
};

/*
  DOI listesinden ekleme: künye Crossref'ten (lib/doi.ts). Sunucu yalnızca
  sabit Crossref adresine, doğrulanmış DOI ile gider. Aynı anda en çok
  beş istek: Crossref'in "kibar havuz" sınırı.

  ORTAK DİZİN KOTASI (07.11.2026): dışarı giden her DOI bir hak
  (lib/toplu-doi.ts). Aynı listedeki tekrarlar ve çalışmada zaten olanlar
  sorulmaz. Hak biterse işlem durur; sorulamayanlar "islenmedi" raporlanır.
  Eskiden bu yol hiç saymıyordu.
*/
export async function doiIleEkle(
  projectId: string,
  doilar: string[],
): Promise<{ error?: string; sonuclar?: DoiSonucu[]; tekrar?: number; gecersiz?: number; durdu?: "kota" | "kota_denetlenemedi" | null }> {
  const { doilar: temiz, tekrar, gecersiz } = topluDoiAyikla(doilar);
  const t = await ceviri();
  if (!temiz.length) return { error: t({ tr: "Geçerli bir DOI bulunamadı (ör. 10.1000/xyz123 ya da https://doi.org/…).", en: "No valid DOI was found (e.g. 10.1000/xyz123 or https://doi.org/…)." }) };
  if (temiz.length > DOI_TOPLU_EN_COK) return { error: t({ tr: `Tek seferde en çok ${DOI_TOPLU_EN_COK} DOI eklenebilir.`, en: `You can add at most ${DOI_TOPLU_EN_COK} DOIs at once.` }) };
  // Oturum, abonelik, çalışma sahipliği ve kütüphane: hepsi hak düşmeden önce.
  const h = await hazirlik(projectId);
  if ("hata" in h) return { error: h.hata };

  const { satirlar, durdu } = await topluDoiGetir(temiz, {
    kutuphanede: (anahtar) => h.anahtarlar.has(kaynakAnahtari({ title: "", year: null, doiOrUrl: anahtar })),
    hakDus: () => dizinHakkiDus(h.ctx.user.id),
    crossref: (doi) => crossrefKunyesi(doi),
  });

  const sonuclar: DoiSonucu[] = [];
  const taslaklar: KaynakTaslagi[] = [];
  for (const s of satirlar) {
    if (s.durum === "getirildi") {
      const m = s.metadata;
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
        publicationPlace: m.publicationPlace,
      });
      sonuclar.push({ doi: s.doi, durum: "eklendi", baslik: m.title });
    } else if (s.durum === "hata" || s.durum === "islenmedi") {
      sonuclar.push({ doi: s.doi, durum: s.durum, neden: s.neden });
    } else {
      sonuclar.push({ doi: s.doi, durum: s.durum });
    }
  }

  if (taslaklar.length) {
    /*
      Crossref'ten gelen künye ekleme adımında BAŞLIK + YIL ile mevcut bir
      kayda eşleşip atlanabiliyor (ön denetim yalnızca DOI'ye bakıyor).
      Eskiden o DOI yine "eklendi" diye raporlanıyordu (A1 denetimi,
      07.11.2026): kullanıcı eklenmemiş kaynağı eklendi sanıyordu.
    */
    const tekrarlar: KaynakTaslagi[] = [];
    const r = await ekle(h.ctx, h.anahtarlar, taslaklar, projectId, tekrarlar);
    if (r.error) return { error: r.error };
    const tekrarDoilari = new Set(tekrarlar.map((tk) => doiAnahtari(tk.doiOrUrl)).filter(Boolean));
    for (const s of sonuclar) {
      if (s.durum === "eklendi" && tekrarDoilari.has(doiAnahtari(s.doi))) s.durum = "vardi";
    }
  }
  return { sonuclar, tekrar, gecersiz, durdu };
}
