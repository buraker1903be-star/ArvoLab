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

type Satir = Record<string, unknown>;
type Sonuc = { data: unknown; error: null; count?: number | null };

function sorgu(tablo: string) {
  let satirlar: Satir[] = [...((ORNEK as Record<string, Satir[]>)[tablo] ?? [])];
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
      return Promise.resolve(sonuc).then(coz);
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
        then: (coz: (s: typeof sonuc) => unknown) => Promise.resolve(sonuc).then(coz),
      };
      return kurucu;
    },
    auth: {
      getUser: async () => ({ data: { user: ORNEK_KULLANICI }, error: null }),
      getSession: async () => ({ data: { session: { user: ORNEK_KULLANICI } }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "#" }, error: null }),
        createSignedUrls: async () => ({ data: [], error: null }),
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
