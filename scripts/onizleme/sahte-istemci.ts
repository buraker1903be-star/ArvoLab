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
  YAZMA KİPİ (Signature OS 4.2, 05.11.2026). ONIZLEME_YAZ=1 iken update,
  insert ve delete örnek tabloyu BELLEKTE değiştirir (sunucu süreci
  yaşadıkça kalır, yeniden başlatınca veri.ts'e döner). Varsayılan kapalı:
  kabul senaryoları sabit veriye göre yazılmış. Düzenleme gibi bir akışın
  ekranda uçtan uca (form → sunucu işlemi → sayfanın yenilenmesi → yeni
  değer) görülebilmesi için. Yetki ve kısıtlar burada YOK; onları
  tests/db sınıyor.
*/
const YAZ = ortam.ONIZLEME_YAZ === "1";
/*
  OTURUMSUZ (Signature OS giriş ekranları, 05.11.2026). ONIZLEME_OTURUM=yok
  iken auth.getUser oturum yok der: giriş, kayıt ve şifremi unuttum
  ekranları önizlemede hiç görülemiyordu (proxy oturumu olanı /dashboard'a
  yönlendiriyor). Gerçek kullanıcı oluşturulmaz, e-posta gitmez; bu
  istemcide auth yazma yöntemi yok.
*/
const OTURUMSUZ = ortam.ONIZLEME_OTURUM === "yok";
const BOS_TABLOLAR = new Set(["academic_projects", "project_manuscripts", "literature_sources", "document_uploads", "manuscript_comments", "citation_checks", "kanit_kayitlari", "consultancy_requests", "app_support_requests", "destek_mesajlari"]);
function tur<T>(etiket: string, deger: T): Promise<T> {
  if (OLCUM) console.log(`[olcum] ${Date.now()} ${etiket}`);
  return GECIKME ? new Promise((coz) => setTimeout(() => coz(deger), GECIKME)) : Promise.resolve(deger);
}

type Satir = Record<string, unknown>;
type Sonuc = { data: unknown; error: null; count?: number | null };

function sorgu(tablo: string) {
  let satirlar: Satir[] = BOS && BOS_TABLOLAR.has(tablo) ? [] : [...((ORNEK as Record<string, Satir[]>)[tablo] ?? [])];
  if (ROL && tablo === "profiles") satirlar = satirlar.map((r) => ({ ...r, role: ROL }));
  let tek: "single" | "maybe" | null = null;
  let yazma:
    | { tur: "update"; deger: Satir }
    | { tur: "insert"; deger: Satir | Satir[] }
    | { tur: "upsert"; deger: Satir; anahtar: string }
    | { tur: "delete" }
    | null = null;
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
    // Yazmalar: varsayılan olarak kalıcı değil, başarılı görünür (YAZ kipi yukarıda).
    insert: (deger: Satir | Satir[]) => ((yazma = { tur: "insert", deger }), kurucu),
    update: (deger: Satir) => ((yazma = { tur: "update", deger }), kurucu),
    /*
      upsert (Makale Aşama 1, 05.11.2026): eskiden hiçbir şey yazmıyordu;
      Makale bilgileri formu YAZ kipinde "kaydedildi" deyip sayfa
      yenilenince boş geliyordu. onConflict sütunu eşleşen satırı günceller,
      yoksa ekler. Tek satırlık upsert yeter (uygulamadaki kullanım bu).
    */
    upsert: (deger: Satir, o?: { onConflict?: string }) => ((yazma = { tur: "upsert", deger, anahtar: o?.onConflict ?? "id" }), kurucu),
    delete: () => ((yazma = { tur: "delete" }), kurucu),
    then: (coz: (s: Sonuc) => unknown) => {
      if (YAZ && yazma) {
        const tablo_ = ((ORNEK as Record<string, Satir[]>)[tablo] ??= []);
        if (yazma.tur === "update") for (const r of satirlar) Object.assign(r, yazma.deger);
        else if (yazma.tur === "delete") for (const r of satirlar) tablo_.splice(tablo_.indexOf(r), 1);
        else if (yazma.tur === "upsert") {
          const { deger: yeniDeger, anahtar } = yazma;
          const var_ = tablo_.find((r) => r[anahtar] === yeniDeger[anahtar]);
          if (var_) Object.assign(var_, yeniDeger);
          else tablo_.push({ olusturuldu: new Date().toISOString(), ...yeniDeger });
          satirlar = [var_ ?? tablo_[tablo_.length - 1]];
        }
        else {
          const yeni = (Array.isArray(yazma.deger) ? yazma.deger : [yazma.deger]).map((d, i) => ({ id: `yeni-${Date.now()}-${i}`, created_at: new Date().toISOString(), ...d }));
          tablo_.push(...yeni);
          satirlar = yeni;
        }
      }
      if (OLCUM && yazma) console.log(`[olcum] yazma ${tablo} ${yazma.tur}`);
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
      getUser: () => tur("auth:getUser", { data: { user: OTURUMSUZ ? null : ORNEK_KULLANICI }, error: null }),
      getSession: () => tur("auth:getSession", { data: { session: OTURUMSUZ ? null : { user: ORNEK_KULLANICI } }, error: null }),
      signOut: async () => ({ error: null }),
      /*
        E-POSTA DOĞRULAMA TAKLİDİ (05.11.2026). /auth/confirm'ün başarılı,
        geçersiz ve süresi dolmuş hâllerini önizlemede sınamak için
        (scripts/onizleme/dogrulama-kabul.mjs). Gerçek belirteç yok,
        Supabase'e istek yok. Hata gövdeleri Supabase'in döndürdüğü kodlarla
        aynı (otp_expired); rota yalnızca `error` var mı diye bakıyor.
      */
      verifyOtp: async ({ token_hash }: { token_hash: string }) =>
        token_hash.startsWith("onizleme-gecerli")
          ? { data: { user: ORNEK_KULLANICI, session: {} }, error: null }
          : token_hash.startsWith("onizleme-suresi-dolmus")
            ? { data: { user: null, session: null }, error: { code: "otp_expired", status: 403, message: "Email link is invalid or has expired" } }
            : { data: { user: null, session: null }, error: { code: "otp_disabled", status: 403, message: "Token has expired or is invalid" } },
      exchangeCodeForSession: async (kod: string) =>
        kod === "onizleme-gecerli-kod"
          ? { data: { session: {} }, error: null }
          : { data: { session: null }, error: { code: "bad_code_verifier", status: 400, message: "invalid flow state" } },
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
