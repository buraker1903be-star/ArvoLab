import { getAuthContext } from "@/lib/auth-guards";
import { isSubscriptionBlocked } from "@/lib/access";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { ayniKokenMi } from "@/lib/istek-koken";
import { aramaKunyesiniKontrolEt, bagimsizDizin, kontrolAnahtari, KunyeOnbellegi, type KontrolGirdisi, type KunyeKontrolSonucu } from "@/lib/arama-kunye-kontrolu";
import { varsayilanGetir } from "@/lib/kanit/dizin";
import type { HamKunye } from "@/lib/literatur-arama";

/*
  MAKALE BUL OTOMATİK KÜNYE KONTROLÜ (20.11.2026, lib/arama-kunye-kontrolu.ts).

  Neden sunucu işlemi (server action) DEĞİL de uç nokta: Next sunucu
  işlemlerini istemcide SIRAYLA gönderiyor (belge: "Server Actions are
  queued"). Önce öyle yazıldı ve ölçüldü: "en çok üç eşzamanlı" kuyruğu
  gerçekte tek tek gidiyordu, üstelik yirmi kontrol "Listeme ekle"yi ve
  yeni aramayı kendi arkasında bekletiyordu. Uç nokta paralel gider ve
  istemci yeni aramada eski istekleri iptal edebilir (AbortController).

  İstemci sonuçlar gelir gelmez, görünürlerden başlayarak, en çok üç
  eşzamanlı istekle kayıt başına bir kez çağırır.

  Kapılar sunucu işlemleriyle aynı: oturum (getAuthContext), abonelik
  (dizinlere dış istek), aynı köken (çerezli POST; başka site kullanıcının
  hakkını tüketemesin), saatlik hak. Hak, arama hakkından AYRI: arama başına
  yirmiye kadar kontrol düşüyor, arama hakkını yemesin. Önbellekten dönen
  sonuç hakkı tüketmez. Hiçbir kapı "yanlış kaynak" dönmez: hepsi geçici
  "kontrol edilemedi"dir; arama ve ekleme çalışmaya devam eder.

  Önbellek bu sunucu örneğinin belleğinde, 24 saat: aynı yayın başka bir
  aramada çıkınca dizine yeniden gidilmez. Servis arızası önbelleğe girmez.
*/
const onbellek = new KunyeOnbellegi();
const SAATLIK_KUNYE_HAKKI = 400;
const BASLIK = { "Cache-Control": "private, no-store", "Content-Type": "application/json; charset=utf-8" };

const metin = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
const sayi = (v: unknown): number | null => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};
const hamOku = (v: unknown): HamKunye | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const h = v as Record<string, unknown>;
  const baslik = metin(h.baslik, 500);
  if (!baslik) return undefined;
  return { baslik, yazarlar: metin(h.yazarlar, 1000) ?? "", yil: sayi(h.yil), dergi: metin(h.dergi, 500), doi: metin(h.doi, 300) };
};

export async function POST(istek: Request) {
  const cevap = (sonuc: KunyeKontrolSonucu, durum = 200) => new Response(JSON.stringify(sonuc), { status: durum, headers: BASLIK });
  if (!ayniKokenMi({ secFetchSite: istek.headers.get("sec-fetch-site"), origin: istek.headers.get("origin"), host: istek.headers.get("host") })) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  let govde: Partial<KontrolGirdisi> & { ham?: Record<string, unknown> };
  try {
    govde = (await istek.json()) as typeof govde;
  } catch {
    return new Response("Bad request", { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  const saglayici = govde?.saglayici === "crossref" ? "crossref" : "openalex";
  const dizin = bagimsizDizin(saglayici);
  const reddet = (tr: string, en: string): KunyeKontrolSonucu => ({ durum: "kontrol_edilemedi", dizin, alanlar: [], tamamlama: null, gecici: true, neden: { tr, en } });

  const ctx = await getAuthContext();
  if (!ctx) return cevap(reddet("Oturum bulunamadı; künye kontrol edilemedi.", "No session; the reference wasn't checked."), 401);
  if (await isSubscriptionBlocked()) return cevap(reddet("Abonelik kapalı; künye kontrol edilemedi.", "Subscription inactive; the reference wasn't checked."), 403);

  /* İstemciden gelen alanlar sınırlanır; içerik yalnızca dizine sorulacak metin, hiçbir yere yazılmaz. */
  const ham: KontrolGirdisi["ham"] = {};
  const oa = hamOku(govde?.ham?.openalex);
  const cr = hamOku(govde?.ham?.crossref);
  if (oa) ham.openalex = oa;
  if (cr) ham.crossref = cr;
  const girdi: KontrolGirdisi = {
    baslik: metin(govde?.baslik, 500) ?? "",
    yazarlar: Array.isArray(govde?.yazarlar) ? govde.yazarlar.slice(0, 50).map((y) => String(y).slice(0, 200)) : [],
    kunyeYazarlari: metin(govde?.kunyeYazarlari, 1000),
    yil: sayi(govde?.yil),
    dergi: metin(govde?.dergi, 500),
    doi: metin(govde?.doi, 300),
    saglayici,
    ham,
  };
  const anahtar = kontrolAnahtari(girdi);
  const onbellekte = onbellek.al(anahtar);
  if (onbellekte) return cevap(onbellekte);

  const admin = adminIstemcisiVarsa();
  if (admin) {
    const { data: izin, error } = await admin.rpc("rate_limit_hit", { p_key: `kunye-kontrol:${ctx.user.id}`, p_limit: SAATLIK_KUNYE_HAKKI, p_window: "1 hour" });
    // Sayaç okunamazsa akış durmaz; kapı sert kapanmamalı (lib/ai/erisim.ts ile aynı ilke).
    if (error) console.error("[kunye-kontrol] hız sınırı okunamadı:", error.message);
    else if (izin === false)
      return cevap(
        reddet(
          `Saatlik otomatik künye kontrolü hakkı doldu (${SAATLIK_KUNYE_HAKKI}); bu sonuç kontrol edilmedi. Bu, kaynağın yanlış olduğu anlamına gelmez.`,
          `The hourly automatic reference-check limit (${SAATLIK_KUNYE_HAKKI}) was reached; this result wasn't checked. This doesn't mean the source is wrong.`,
        ),
      );
  }

  const sonuc = await aramaKunyesiniKontrolEt(girdi, varsayilanGetir).catch((hata) => {
    console.error("[kunye-kontrol]", hata);
    return reddet("Künye kontrolü beklenmedik bir hatayla durdu.", "The reference check stopped with an unexpected error.");
  });
  onbellek.koy(anahtar, sonuc);
  return cevap(sonuc);
}
