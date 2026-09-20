/*
  Kullanıcının kendi asistan geçmişi ve aynı sorunun tekrar sorulmasını
  önleme.

  Neden: aynı analizi ya da aynı kaynakçayı ikinci kez denetletmek kimseye
  bir şey kazandırmıyor — kullanıcı saniyelerce bekliyor, hesaptan para
  çıkıyor ve cevap zaten kayıtlı. Bağlam birebir aynıysa kayıtlı cevap
  gösterilir; kullanıcı isterse "yeniden sorgula" ile modele gidebilir.

  Eşleştirme ham bağlam metni üzerinden: bağlam kullanıcının girdisinden
  kuruluyor (lib/ai/baglam.ts), tek bir karakter değişse yeni bir sorudur.
  Kaynak listesi değiştiğinde literatür bağlamı da değişir, yani kendiliğinden
  tazelenir.

  Bilerek "use server" DEĞİL (AGENTS.md): yardımcılar böyle dosyalarda durmaz.
*/

import { createClient } from "@/lib/supabase/server";
import type { Bulgu } from "./bulgu";
import type { YetenekAdi } from "./kayit-gorunum";

/** Kayıtlı cevabın geçerli sayıldığı süre. */
const GECERLILIK_GUN = 30;

export type GecmisKaydi = {
  id: string;
  created_at: string;
  ozet: string;
  bulgular: Bulgu[];
  aramalar?: string[];
};

/**
 * Bağlamdan kullanıcıya gösterilecek kısa bir özet çıkarır. Bağlam
 * "### Başlık" bölümlerinden oluşuyor; ilk bölümün ilk dolu satırı
 * kullanıcının ne sorduğunu en iyi anlatan parçadır.
 */
export function baglamOzeti(baglam: string | null, sinir = 120): string {
  if (!baglam) return "Kayıtlı sorgu";
  const satir = baglam
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s && !s.startsWith("###"));
  if (!satir) return "Kayıtlı sorgu";
  return satir.length > sinir ? `${satir.slice(0, sinir)}…` : satir;
}

/** Kayıtlı bulguları güvenle okur; eski kayıtlarda biçim farklı olabilir. */
function bulgulariAyikla(findings: unknown): { bulgular: Bulgu[]; aramalar?: string[] } {
  if (Array.isArray(findings)) return { bulgular: findings as Bulgu[] };
  const nesne = (findings ?? {}) as { bulgular?: unknown; aramalar?: unknown };
  return {
    bulgular: Array.isArray(nesne.bulgular) ? (nesne.bulgular as Bulgu[]) : [],
    aramalar: Array.isArray(nesne.aramalar) ? (nesne.aramalar as string[]) : undefined,
  };
}

/**
 * Aynı bağlamla daha önce alınmış cevap. Yoksa null.
 * Yalnızca kendi kaydına bakar (RLS zaten sınırlar, sorgu da açıkça filtreler).
 */
export async function oncekiCevap(
  kullaniciId: string,
  yetenek: YetenekAdi,
  baglam: string,
): Promise<GecmisKaydi | null> {
  const supabase = await createClient();
  const esik = new Date(Date.now() - GECERLILIK_GUN * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ai_assistant_runs")
    .select("id, created_at, context, findings")
    .eq("user_id", kullaniciId)
    .eq("capability", yetenek)
    .eq("status", "completed")
    .eq("context", baglam)
    .gte("created_at", esik)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Okunamazsa akış durmaz: kullanıcı cevabını modelden alır.
    console.error("[ai] önceki cevap aranamadı:", error.message);
    return null;
  }
  if (!data) return null;

  const { bulgular, aramalar } = bulgulariAyikla(data.findings);
  if (!bulgular.length && !aramalar?.length) return null;
  return { id: data.id, created_at: data.created_at, ozet: baglamOzeti(data.context), bulgular, aramalar };
}

/** Kullanıcının bu yetenekteki son sorguları. */
export async function gecmisSorgular(
  kullaniciId: string,
  yetenek: YetenekAdi,
  limit = 5,
): Promise<GecmisKaydi[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_assistant_runs")
    .select("id, created_at, context, findings")
    .eq("user_id", kullaniciId)
    .eq("capability", yetenek)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error) {
    console.error("[ai] geçmiş okunamadı:", error.message);
    return [];
  }

  return (data ?? [])
    .map((satir) => {
      const { bulgular, aramalar } = bulgulariAyikla(satir.findings);
      return { id: satir.id, created_at: satir.created_at, ozet: baglamOzeti(satir.context), bulgular, aramalar };
    })
    .filter((kayit) => kayit.bulgular.length || kayit.aramalar?.length);
}
