import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { YETIM_IZI, otomatikSonucuYaz, sahipsizseSil, yuklemeyiYaz, type KaynakPdfKaydi } from "@/lib/kaynak-pdf-yazimi";

/*
  P52b-1 karar testleri. İstemci SAHTE: burada sınanan, hangi yanıtta hangi
  adımın atıldığı ve hangi dosyanın silinip silinmediği. Koşulun veritabanında
  gerçekten ATOMİK çalıştığı ayrı kanıtlanıyor: tests/db/kaynak-pdf-kosullu-yazma
  (SQL anlamı, PGlite) ve denetim/p52b1/senaryolar.mjs (iki gerçek oturum,
  PostgREST, Postgres 17).
*/

type Yanit = { data?: unknown; error?: { code?: string; message?: string } | null };
type Cagri = { tablo: string; adimlar: [string, ...unknown[]][] };

function sahteIstemci(yanitlar: Yanit[], silmeHatasi = false) {
  const cagrilar: Cagri[] = [];
  const silinen: string[] = [];
  const from = (tablo: string) => {
    const c: Cagri = { tablo, adimlar: [] };
    cagrilar.push(c);
    const zincir: Record<string, unknown> = {};
    for (const ad of ["select", "eq", "neq", "not", "is", "limit", "upsert", "update", "maybeSingle"]) {
      zincir[ad] = (...a: unknown[]) => {
        c.adimlar.push([ad, ...a]);
        return zincir;
      };
    }
    zincir.then = (coz: (y: Yanit) => unknown, red: (h: unknown) => unknown) => {
      const y = yanitlar.shift();
      if (!y) return Promise.reject(new Error("beklenmeyen sorgu: " + JSON.stringify(c.adimlar))).then(coz, red);
      return Promise.resolve({ data: y.data ?? null, error: y.error ?? null }).then(coz, red);
    };
    return zincir;
  };
  const storage = {
    from: () => ({
      remove: async (yollar: string[]) => {
        if (silmeHatasi) return { data: null, error: { message: "enjekte" } };
        silinen.push(...yollar);
        return { data: [], error: null };
      },
    }),
  };
  return { sb: { from, storage } as unknown as SupabaseClient, cagrilar, silinen, kalan: yanitlar };
}

const P = "3b281459-8ae2-4a9a-b31f-4530474fea2e";
const U = "b4219800-20a2-492d-ac4c-8fbd295efd70";
const YOL = `${P}/kaynak-pdf/y-${U}-1763200000000.pdf`;
const ESKI = `${P}/kaynak-pdf/y-${U}-1763100000000.pdf`;
const kayit = (ek: Partial<KaynakPdfKaydi> = {}): KaynakPdfKaydi => ({
  project_id: P,
  olusturan: U,
  kunye_anahtari: "yilmaz 2020",
  kunye: "Yılmaz (2020).",
  doi: null,
  durum: "erisilemedi",
  depo_yolu: null,
  kaynak_adres: null,
  baslik_eslesti: null,
  bakildi: "2026-11-15T00:00:00Z",
  ...ek,
});

function gunlukYakala() {
  const satirlar: string[] = [];
  const asil = console.error;
  console.error = (...a: unknown[]) => void satirlar.push(a.map(String).join(" "));
  return { satirlar, birak: () => (console.error = asil) };
}

test("otomatik: satır yoksa eklenir; koşullu güncelleme denenmez", async () => {
  const s = sahteIstemci([{ data: [{ durum: "erisilemedi" }] }]);
  const r = await otomatikSonucuYaz(s.sb, kayit(), "durum");
  assert.equal(r.tur, "yazildi");
  assert.equal(s.cagrilar.length, 1);
  assert.deepEqual(s.cagrilar[0].adimlar[0][2], { onConflict: "project_id,kunye_anahtari", ignoreDuplicates: true });
});

test("otomatik: satır varsa güncelleme YALNIZCA hazır olmayan satıra koşullu; kimlik sütunları yazılmaz", async () => {
  const s = sahteIstemci([{ data: [] }, { data: [{ durum: "erisilemedi" }] }]);
  const r = await otomatikSonucuYaz(s.sb, kayit(), "durum");
  assert.equal(r.tur, "yazildi");
  const guncelle = s.cagrilar[1].adimlar;
  assert.deepEqual(guncelle.find(([a]) => a === "not"), ["not", "durum", "in", "(indirildi,yuklendi)"]);
  const govde = guncelle.find(([a]) => a === "update")![1] as Record<string, unknown>;
  assert.equal("project_id" in govde || "kunye_anahtari" in govde || "olusturan" in govde, false);
});

test("otomatik: hazır satır (yükleme/başka indirme) → 'korundu', güncel satır döner", async () => {
  const s = sahteIstemci([{ data: [] }, { data: [] }, { data: { durum: "yuklendi", depo_yolu: YOL } }]);
  const r = await otomatikSonucuYaz(s.sb, kayit({ durum: "indirildi", depo_yolu: ESKI }), "durum, depo_yolu");
  assert.deepEqual(r, { tur: "korundu", satir: { durum: "yuklendi", depo_yolu: YOL } });
});

test("otomatik: her adımın hatası 'hata' olarak döner (sessiz başarı yok)", async () => {
  for (const sira of [[{ error: { message: "x" } }], [{ data: [] }, { error: { code: "42501" } }], [{ data: [] }, { data: [] }, { error: { message: "y" } }]]) {
    const s = sahteIstemci(sira as Yanit[]);
    assert.equal((await otomatikSonucuYaz(s.sb, kayit(), "durum")).tur, "hata");
  }
});

test("yükleme: güncelleme OKUNAN eski yola koşullu; eski yol sonuçla döner", async () => {
  const s = sahteIstemci([{ data: { depo_yolu: ESKI } }, { data: [{ id: 1 }] }]);
  const r = await yuklemeyiYaz(s.sb, kayit({ durum: "yuklendi", depo_yolu: YOL }), "id");
  assert.deepEqual(r, { tur: "yazildi", satir: { id: 1 }, eskiYol: ESKI });
  assert.deepEqual(s.cagrilar[1].adimlar.at(-2), ["eq", "depo_yolu", ESKI]);
});

test("yükleme: dosyasız satırda koşul 'depo_yolu is null'", async () => {
  const s = sahteIstemci([{ data: { depo_yolu: null } }, { data: [{ id: 1 }] }]);
  const r = await yuklemeyiYaz(s.sb, kayit({ durum: "yuklendi", depo_yolu: YOL }), "id");
  assert.equal(r.tur, "yazildi");
  assert.deepEqual(s.cagrilar[1].adimlar.at(-2), ["is", "depo_yolu", null]);
});

test("yükleme: arada satır değişirse yeniden okur; üç denemede de değişirse 'yarisma' (eski dosya silinmesin diye yazmaz)", async () => {
  const bir = sahteIstemci([{ data: { depo_yolu: ESKI } }, { data: [] }, { data: { depo_yolu: YOL + "x" } }, { data: [{ id: 2 }] }]);
  const r1 = await yuklemeyiYaz(bir.sb, kayit({ durum: "yuklendi", depo_yolu: YOL }), "id");
  assert.deepEqual(r1, { tur: "yazildi", satir: { id: 2 }, eskiYol: YOL + "x" });

  const uc = sahteIstemci([{ data: { depo_yolu: ESKI } }, { data: [] }, { data: { depo_yolu: ESKI } }, { data: [] }, { data: { depo_yolu: ESKI } }, { data: [] }]);
  assert.deepEqual(await yuklemeyiYaz(uc.sb, kayit({ durum: "yuklendi", depo_yolu: YOL }), "id"), { tur: "yarisma" });
});

test("yükleme: satır yokken eşzamanlı eklenirse (ignoreDuplicates 0 satır) yeniden okunup koşullu güncellenir", async () => {
  const s = sahteIstemci([{ data: null }, { data: [] }, { data: { depo_yolu: ESKI } }, { data: [{ id: 3 }] }]);
  const r = await yuklemeyiYaz(s.sb, kayit({ durum: "yuklendi", depo_yolu: YOL }), "id");
  assert.deepEqual(r, { tur: "yazildi", satir: { id: 3 }, eskiYol: ESKI });
});

test("sahipsizseSil: başka kayıt gösteriyorsa SİLMEZ", async () => {
  const s = sahteIstemci([{ data: [{ id: "b" }] }]);
  assert.equal(await sahipsizseSil(s.sb, P, YOL, "deneme"), "kullaniliyor");
  assert.deepEqual(s.silinen, []);
});

test("sahipsizseSil: kalıba uymayan ya da başka çalışmanın yolu sorgu bile atılmadan reddedilir", async () => {
  const g = gunlukYakala();
  try {
    for (const yol of [`${P}/kaynak-pdf/../x.pdf`, `${P}/kilavuz/a.pdf`, `9c1e0d4a-1111-4222-8333-444455556666/kaynak-pdf/y-${U}-1763200000000.pdf`]) {
      const s = sahteIstemci([]);
      assert.equal(await sahipsizseSil(s.sb, P, yol, "deneme"), "gecersiz");
      assert.equal(s.cagrilar.length, 0);
      assert.deepEqual(s.silinen, []);
    }
  } finally {
    g.birak();
  }
});

test("sahipsizseSil: kullanım okunamazsa silmez ve yolu YETIM izine yazar", async () => {
  const g = gunlukYakala();
  try {
    const s = sahteIstemci([{ error: { message: "ağ" } }]);
    assert.equal(await sahipsizseSil(s.sb, P, YOL, "deneme"), "okunamadi");
    assert.deepEqual(s.silinen, []);
    assert.ok(g.satirlar.some((x) => x.includes(YETIM_IZI) && x.includes(YOL)));
  } finally {
    g.birak();
  }
});

test("sahipsizseSil: silme düşerse 'silinemedi' döner (başarı değil), yol YETIM izinde", async () => {
  const g = gunlukYakala();
  try {
    const s = sahteIstemci([{ data: [] }], true);
    assert.equal(await sahipsizseSil(s.sb, P, YOL, "deneme"), "silinemedi");
    assert.ok(g.satirlar.some((x) => x.includes(YETIM_IZI) && x.includes(YOL)));
  } finally {
    g.birak();
  }
});

test("sahipsizseSil: kimse göstermiyorsa siler", async () => {
  const s = sahteIstemci([{ data: [] }]);
  assert.equal(await sahipsizseSil(s.sb, P, YOL, "deneme"), "silindi");
  assert.deepEqual(s.silinen, [YOL]);
});
