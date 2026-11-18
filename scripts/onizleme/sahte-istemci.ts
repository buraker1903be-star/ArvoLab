/*
  YEREL ÖNİZLEME İÇİN SAHTE SUPABASE İSTEMCİSİ (04.11.2026).

  Panel ekranları verisini doğrudan Supabase'den okuyor; geliştirme
  makinesinde veritabanı bağlantısı ve oturum olmadan ana sayfa hiç
  açılmıyordu. Tasarım değişikliği bu yüzden körlemesine yapılıyordu.
  `npm run onizleme` bu modülü `@/lib/supabase/*` yerine koyar
  (next.config.ts, yalnızca ARVOLAB_ONIZLEME=1 ve geliştirme sunucusunda):
  sorgular örnek veri tablosundan (veri.ts) cevaplanır, yazmalar sessizce
  "başarılı" döner. ÜRETİMDE ASLA YÜKLENMEZ: yapılandırma bayrağı üretim
  derlemesinde hata verir.

  Sorgu kurucusu yalnızca okuma için yeterli kadarını taklit ediyor:
  eq/neq/in/is/gt/gte/lt/lte süzer, order sıralar, limit/range keser;
  ilike, or, not, contains ve öteki süzgeçler YOK SAYILIR (tüm satırlar
  döner). Önizlemenin amacı ekranın nasıl göründüğü, sorgunun doğruluğu
  değil — onu tests/db sınıyor.
*/
import { ORNEK, ORNEK_KULLANICI, ORNEK_RPC } from "./veri";

/*
  ÖLÇÜM (Phase 2, 04.11.2026). Gerçek uygulamada her Supabase çağrısı bir
  ağ turudur; sahte istemci anında cevap verdiği için sıralı sorgu
  şelalesinin bedeli önizlemede görünmüyordu. ONIZLEME_GECIKME_MS her
  çağrıya sabit bir bekleme ekler (gerçek tur süresinin yerine, mutlak
  değeri değil önce/sonra farkını ölçmek için). ONIZLEME_OLCUM=1 her
  çağrıyı sunucu günlüğüne yazar: sorgu sayısı ve hangi tablolar.
  İkisi de yalnızca sunucuda okunur; tarayıcıda process.env boştur.
*/
const ortam: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env;
const GECIKME = Number(ortam.ONIZLEME_GECIKME_MS ?? 0) || 0;
const OLCUM = ortam.ONIZLEME_OLCUM === "1";
/*
  İLK KULLANIM (Phase 3). ONIZLEME_BOS=1 kullanıcının hiç çalışması yokmuş
  gibi davranır: yeni kullanıcının ana sayfası ve boş durum ekranları
  örnek veriyle hiç görülemiyordu. Yalnızca çalışma ve çalışmaya bağlı
  tablolar boşalır; profil ve abonelik yerinde.
*/
const BOS = ortam.ONIZLEME_BOS === "1";
/*
  ROL (Phase 3 stabilizasyonu). ONIZLEME_ROL=controller | system_admin | …
  örnek kullanıcının profil rolünü değiştirir: personel ve yönetici ana
  sayfası örnek veriyle hiç görülemiyordu. Yalnızca önizlemedeki sahte
  profil satırı değişir; uygulamanın rol kararları aynı koddan geçer.
*/
const ROL = ortam.ONIZLEME_ROL || null;
/*
  UZUN BAŞLIK (Signature OS 5 / Phase 4). ONIZLEME_UZUN_BASLIK=1 ilk
  çalışmanın başlığını kurumların gerçekte kabul ettiği uzunlukta bir
  tez başlığıyla değiştirir: ana sayfanın başlık kırpma ve satır kırma
  davranışı kısa örnekle görülemiyordu. Yalnızca önizlemedeki satır değişir.
*/
const UZUN_BASLIK = ortam.ONIZLEME_UZUN_BASLIK === "1";
const UZUN_BASLIK_METNI =
  "TÜRKİYE'DE 2000–2025 DÖNEMİNDE ENFLASYON, İŞSİZLİK VE PARA POLİTİKASI ARASINDAKİ DİNAMİK İLİŞKİLERİN YAPISAL KIRILMALI ZAMAN SERİSİ YÖNTEMLERİYLE EKONOMETRİK OLARAK İNCELENMESİ VE POLİTİKA ÖNERİLERİ";
const BOS_TABLOLAR = new Set(["academic_projects", "project_manuscripts", "literature_sources", "document_uploads", "manuscript_comments", "citation_checks", "kanit_kayitlari"]);
function tur<T>(etiket: string, deger: T): Promise<T> {
  if (OLCUM) console.log(`[olcum] ${Date.now()} ${etiket}`);
  return GECIKME ? new Promise((coz) => setTimeout(() => coz(deger), GECIKME)) : Promise.resolve(deger);
}

type Satir = Record<string, unknown>;
type Sonuc = { data: unknown; error: null; count?: number | null };

function sorgu(tablo: string) {
  let satirlar: Satir[] = BOS && BOS_TABLOLAR.has(tablo) ? [] : [...((ORNEK as Record<string, Satir[]>)[tablo] ?? [])];
  if (ROL && tablo === "profiles") satirlar = satirlar.map((r) => ({ ...r, role: ROL }));
  if (UZUN_BASLIK && tablo === "academic_projects") satirlar = satirlar.map((r, i) => (i === 0 ? { ...r, title: UZUN_BASLIK_METNI } : r));
  let tek: "single" | "maybe" | null = null;
  let sayim = false;
  let yalnizSayim = false;
  const ham: Record<string, unknown> = {};
  // Bilinmeyen süzgeçler (ilike, or, not, contains, filter, textSearch…) zinciri bozmasın: her yöntem bu vekili döndürür.
  const kurucu: Record<string, unknown> = new Proxy(ham, { get: (h, ad) => (ad in h ? h[ad as string] : () => kurucu) });
  const zincir = (f: (s: Satir[]) => Satir[]) => {
    satirlar = f(satirlar);
    return kurucu;
  };
  const deger = (s: Satir, sutun: string) => s[sutun.split("->")[0]];
  Object.assign(ham, {
    select: (_s?: string, o?: { count?: string; head?: boolean }) => {
      if (o?.count) sayim = true;
      if (o?.head) yalnizSayim = true;
      return kurucu;
    },
    eq: (c: string, v: unknown) => zincir((s) => s.filter((r) => deger(r, c) === undefined || deger(r, c) === v)),
    neq: (c: string, v: unknown) => zincir((s) => s.filter((r) => deger(r, c) !== v)),
    in: (c: string, v: unknown[]) => zincir((s) => s.filter((r) => deger(r, c) === undefined || v.includes(deger(r, c)))),
    is: (c: string, v: unknown) => zincir((s) => s.filter((r) => (v === null ? deger(r, c) == null : deger(r, c) === v))),
    gt: () => kurucu,
    gte: () => kurucu,
    lt: () => kurucu,
    lte: () => kurucu,
    order: (c: string, o?: { ascending?: boolean }) =>
      zincir((s) => [...s].sort((a, b) => (String(deger(a, c) ?? "") < String(deger(b, c) ?? "") ? -1 : 1) * (o?.ascending === false ? -1 : 1))),
    limit: (n: number) => zincir((s) => s.slice(0, n)),
    range: (a: number, b: number) => zincir((s) => s.slice(a, b + 1)),
    single: () => ((tek = "single"), kurucu),
    maybeSingle: () => ((tek = "maybe"), kurucu),
    // Yazmalar: önizlemede kalıcı değil, başarılı görünür.
    insert: () => kurucu,
    update: () => kurucu,
    upsert: () => kurucu,
    delete: () => kurucu,
    then: (coz: (s: Sonuc) => unknown) => {
      const sonuc: Sonuc = yalnizSayim
        ? { data: null, error: null, count: satirlar.length }
        : { data: tek ? (satirlar[0] ?? null) : satirlar, error: null, count: sayim ? satirlar.length : null };
      return tur(`from:${tablo}`, sonuc).then(coz);
    },
  });
  return kurucu;
}

export function sahteIstemci() {
  return {
    from: (tablo: string) => sorgu(tablo),
    // RPC tek satır ya da liste döndürebilir; .single()/.maybeSingle() zinciri de desteklenir.
    rpc: (ad: string) => {
      const veri = (ORNEK_RPC as Record<string, unknown>)[ad] ?? null;
      const sonuc = { data: veri, error: null };
      const kurucu = {
        single: () => kurucu,
        maybeSingle: () => kurucu,
        then: (coz: (s: typeof sonuc) => unknown) => tur(`rpc:${ad}`, sonuc).then(coz),
      };
      return kurucu;
    },
    auth: {
      getUser: () => tur("auth:getUser", { data: { user: ORNEK_KULLANICI }, error: null }),
      getSession: () => tur("auth:getSession", { data: { session: { user: ORNEK_KULLANICI } }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: {
      from: () => ({
        createSignedUrl: () => tur("storage:createSignedUrl", { data: { signedUrl: "#" }, error: null }),
        createSignedUrls: () => tur("storage:createSignedUrls", { data: [], error: null }),
        download: async () => ({ data: null, error: { message: "önizleme" } }),
        upload: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
        list: async () => ({ data: [], error: null }),
      }),
    },
    channel: () => {
      const kanal = { on: () => kanal, subscribe: () => kanal, unsubscribe: () => undefined };
      return kanal;
    },
    removeChannel: () => undefined,
  };
}
