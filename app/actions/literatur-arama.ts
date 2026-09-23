"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { literaturAra, type AramaKaydi } from "@/lib/literatur-arama";

const PAGE_PATH = "/dashboard/literature";
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
}): Promise<AramaYaniti> {
  const ctx = await getAuthContext();
  if (!ctx) return { hata: SESSION_MISSING.error };
  if (await isSubscriptionBlocked()) return { hata: SUBSCRIPTION_BLOCKED_MESSAGE };

  const sorgu = String(girdi.sorgu ?? "").trim().slice(0, EN_UZUN_SORGU);
  if (sorgu.length < EN_KISA_SORGU) return { hata: "Aramak için en az birkaç harf yazın." };

  const admin = createAdminClient();
  if (admin) {
    const { data: izin, error } = await admin.rpc("rate_limit_hit", {
      p_key: `literatur-arama:${ctx.user.id}`,
      p_limit: SAATLIK_HAK,
      p_window: "1 hour",
    });
    // Sayaç okunamazsa akış durmaz; kapı sert kapanmamalı (lib/ai/erisim.ts ile aynı ilke).
    if (error) console.error("[literatur-arama] hız sınırı okunamadı:", error.message);
    else if (izin === false) return { hata: `Saatlik arama hakkınız doldu (${SAATLIK_HAK}). Bir süre sonra tekrar deneyin.` };
  }

  const { kayitlar, ulasilamayan } = await literaturAra({
    sorgu,
    yilDan: sayi(girdi.yilDan),
    yilaKadar: sayi(girdi.yilaKadar),
    yalnizcaAcikErisim: Boolean(girdi.yalnizcaAcikErisim),
  });

  if (kayitlar.length === 0 && ulasilamayan.length === 2) {
    return { hata: "Dizinlere şu anda ulaşılamıyor. Birazdan tekrar deneyin." };
  }

  /*
    "Zaten listemde" bilgisi olmadan öğrenci aynı kaynağı defalarca ekliyor
    ve sonra listesinde tekrarları temizlemekle uğraşıyordu. DOI kesin
    ölçüt; DOI'si olmayan kayıtlar için başlık karşılaştırılıyor.
  */
  const { data: mevcut } = await ctx.supabase
    .from("literature_sources")
    .select("title, doi_or_url")
    .eq("owner_id", ctx.user.id);
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
  };
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
  yil?: number | null;
  tur?: string;
  dergi?: string | null;
  doi?: string | null;
  url?: string;
  projectId?: string | null;
}): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };

  const baslik = String(kayit.baslik ?? "").trim().slice(0, 500);
  if (!baslik) return { error: "Kaynak başlığı okunamadı." };

  const satir = {
    owner_id: ctx.user.id,
    project_id: String(kayit.projectId ?? "").trim() || null,
    title: baslik,
    authors: (kayit.yazarlar ?? []).join(", ").slice(0, 500) || null,
    year: kayit.yil ? String(kayit.yil) : null,
    source_type: TURLER.includes(String(kayit.tur)) ? String(kayit.tur) : "other",
    doi_or_url: (kayit.doi ? `https://doi.org/${kayit.doi}` : String(kayit.url ?? "")).slice(0, 500) || null,
    status: "to_review" as const,
    notes: null,
  };
  // Dergi adı sonradan eklenen bir kolon; yoksa kaynak yine kaydedilir.
  let { error } = await ctx.supabase
    .from("literature_sources")
    .insert({ ...satir, container_title: (kayit.dergi ?? "").slice(0, 500) || null });
  if (error?.code === "PGRST204" || error?.code === "42703") {
    ({ error } = await ctx.supabase.from("literature_sources").insert(satir));
  }
  if (error) {
    console.error(error);
    return { error: "Kaynak listenize eklenemedi." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}
