import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { TEMA_ANAHTARI, TEMA_BETIGI, TEMA_RENGI, temaCoz, tercihOku } from "@/lib/tema";

/*
  Tema tercihi (Phase 4.1). Ön boyama betiği bir METİN olarak sayfaya
  gömülüyor; tarayıcısız sınamak için Node'un vm'inde, en az sahte
  document/localStorage/matchMedia ile çalıştırılıyor. Sahte nesneler
  yalnızca betiğin dokunduğu yüzeyi taklit eder — DOM'un davranışını
  değil, betiğin kararını sınıyoruz.
*/

test("tercihOku: yalnızca light/dark/system; geri kalan her şey system", () => {
  assert.equal(tercihOku("light"), "light");
  assert.equal(tercihOku("dark"), "dark");
  assert.equal(tercihOku("system"), "system");
  for (const ham of [null, undefined, "", "blue", "DARK", 1, {}]) assert.equal(tercihOku(ham), "system");
});

test("temaCoz: sistem tercihinde işletim sistemine uyar, açık/koyu tercihte uymaz", () => {
  assert.equal(temaCoz("system", true), "dark");
  assert.equal(temaCoz("system", false), "light");
  assert.equal(temaCoz("light", true), "light");
  assert.equal(temaCoz("dark", false), "dark");
});

function ortam({ kayit, sistemKoyu = false, depoKapali = false, matchMediaYok = false, eskiApi = false }: {
  kayit?: string | null;
  sistemKoyu?: boolean;
  depoKapali?: boolean;
  matchMediaYok?: boolean;
  eskiApi?: boolean;
}) {
  const oznitelik: Record<string, string> = {};
  // Next'in iki theme-color etiketi (biri açık, biri koyu media sorgulu)
  const metaYap = (content: string) => ({ content, setAttribute(ad: string, deger: string) { if (ad === "content") this.content = deger; }, getAttribute(ad: string) { return ad === "content" ? this.content : null; } });
  const metalar = [metaYap("#ilk-acik"), metaYap("#ilk-koyu")];
  let headGozcusu: (() => void) | null = null;
  const depo = new Map<string, string>();
  if (kayit != null) depo.set(TEMA_ANAHTARI, kayit);
  const medyaDinleyicileri: Array<() => void> = [];
  const pencereDinleyicileri: Record<string, Array<(o: { key: string | null }) => void>> = {};
  const medya: Record<string, unknown> = { matches: sistemKoyu };
  if (eskiApi) medya.addListener = (f: () => void) => medyaDinleyicileri.push(f);
  else medya.addEventListener = (_: string, f: () => void) => medyaDinleyicileri.push(f);
  const pencere = {
    matchMedia: matchMediaYok ? undefined : () => medya,
    addEventListener: (ad: string, f: (o: { key: string | null }) => void) => (pencereDinleyicileri[ad] ??= []).push(f),
  };
  const baglam = {
    window: pencere,
    MutationObserver: class { constructor(f: () => void) { headGozcusu = f; } observe() {} },
    document: {
      head: {},
      documentElement: { setAttribute: (ad: string, deger: string) => (oznitelik[ad] = deger), getAttribute: (ad: string) => oznitelik[ad] ?? null },
      querySelectorAll: (secici: string) => (secici === 'meta[name="theme-color"]' ? metalar : []),
    },
    localStorage: {
      getItem: (a: string) => {
        if (depoKapali) throw new Error("SecurityError");
        return depo.get(a) ?? null;
      },
    },
  };
  vm.runInNewContext(TEMA_BETIGI, baglam);
  return {
    tema: () => oznitelik["data-theme"],
    metaRenkleri: () => metalar.map((m) => m.content),
    /** Next'in hidrasyonda sona eklediği etiketi taklit eder. */
    metaEklendi(content: string) {
      metalar.push(metaYap(content));
      headGozcusu?.();
    },
    tercih: () => oznitelik["data-theme-tercih"],
    sistemDegisti(koyu: boolean) {
      medya.matches = koyu;
      medyaDinleyicileri.forEach((f) => f());
    },
    baskaSekme(deger: string | null) {
      if (deger === null) depo.delete(TEMA_ANAHTARI);
      else depo.set(TEMA_ANAHTARI, deger);
      (pencereDinleyicileri.storage ?? []).forEach((f) => f({ key: TEMA_ANAHTARI }));
    },
    kaydet(deger: string) {
      depo.set(TEMA_ANAHTARI, deger);
    },
  };
}

test("betik: kaydı olmayan kullanıcı sisteme uyar (eski davranışın aynısı)", () => {
  const koyu = ortam({ kayit: null, sistemKoyu: true });
  assert.equal(koyu.tema(), "dark");
  assert.equal(koyu.tercih(), "system");
  assert.equal(ortam({ kayit: null, sistemKoyu: false }).tema(), "light");
});

test("betik: eski kayıtlar ('light' / 'dark') aynen geçerli, sistemi ezer", () => {
  const acik = ortam({ kayit: "light", sistemKoyu: true });
  assert.equal(acik.tema(), "light");
  assert.equal(acik.tercih(), "light");
  const koyu = ortam({ kayit: "dark", sistemKoyu: false });
  assert.equal(koyu.tema(), "dark");
  assert.equal(koyu.tercih(), "dark");
});

test("betik: tanınmayan kayıt sistem sayılır", () => {
  const o = ortam({ kayit: "mavi", sistemKoyu: true });
  assert.equal(o.tercih(), "system");
  assert.equal(o.tema(), "dark");
});

test("betik: sistem tercihinde işletim sistemi değişince sayfa izler", () => {
  const o = ortam({ kayit: "system", sistemKoyu: false });
  assert.equal(o.tema(), "light");
  o.sistemDegisti(true);
  assert.equal(o.tema(), "dark");
  o.sistemDegisti(false);
  assert.equal(o.tema(), "light");
});

test("betik: açık/koyu tercihte sistem değişikliği temayı DEĞİŞTİRMEZ", () => {
  const o = ortam({ kayit: "dark", sistemKoyu: false });
  o.sistemDegisti(false);
  assert.equal(o.tema(), "dark");
  const a = ortam({ kayit: "light", sistemKoyu: false });
  a.sistemDegisti(true);
  assert.equal(a.tema(), "light");
});

test("betik: yüklendikten SONRA 'Sistem'e geçilirse dinleyici yine çalışır", () => {
  // Açılışta "dark"; kullanıcı menüden Sistem'i seçer (kayıt değişir), sonra OS açığa döner.
  const o = ortam({ kayit: "dark", sistemKoyu: true });
  o.kaydet("system");
  o.sistemDegisti(false);
  assert.equal(o.tema(), "light");
  assert.equal(o.tercih(), "system");
});

test("betik: başka sekmedeki seçim bu sekmeye geçer", () => {
  const o = ortam({ kayit: "light", sistemKoyu: false });
  o.baskaSekme("dark");
  assert.equal(o.tema(), "dark");
  o.baskaSekme(null);
  assert.equal(o.tercih(), "system");
  assert.equal(o.tema(), "light");
});

test("betik: depolama kapalıysa (gizli sekme) düşmez, sisteme uyar", () => {
  const o = ortam({ depoKapali: true, sistemKoyu: true });
  assert.equal(o.tema(), "dark");
  assert.equal(o.tercih(), "system");
});

test("betik: matchMedia yoksa açık tema, hata yok", () => {
  const o = ortam({ kayit: null, matchMediaYok: true });
  assert.equal(o.tema(), "light");
});

test("betik: eski Safari'nin addListener yolu da dinlenir", () => {
  const o = ortam({ kayit: "system", sistemKoyu: false, eskiApi: true });
  o.sistemDegisti(true);
  assert.equal(o.tema(), "dark");
});

test("betik: tarayıcı çubuğu (theme-color) UYGULANAN temanın renginde, sistemin değil", () => {
  // Cihaz açık, kullanıcı Koyu seçmiş: iki etiket de koyu renk olmalı (hangisi eşleşirse eşleşsin).
  const o = ortam({ kayit: "dark", sistemKoyu: false });
  assert.deepEqual(o.metaRenkleri(), [TEMA_RENGI.dark, TEMA_RENGI.dark]);
  o.baskaSekme("light");
  assert.deepEqual(o.metaRenkleri(), [TEMA_RENGI.light, TEMA_RENGI.light]);
  const s = ortam({ kayit: "system", sistemKoyu: false });
  s.sistemDegisti(true);
  assert.deepEqual(s.metaRenkleri(), [TEMA_RENGI.dark, TEMA_RENGI.dark]);
});

/*
  TEMA_RENGI, tokens.css'teki --bg'nin kopyası (ilk boyamadan önce CSS
  okunamıyor). Zemin değişip bu sabit unutulursa tarayıcı çubuğu
  uygulamadan farklı renkte kalır; bu test o kaymayı yakalar.
*/
test("TEMA_RENGI tokens.css'teki --bg ile aynı (açık ve koyu)", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "app/styles/tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const palet = new Map([...css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{3,8})\s*;/gi)].map((m) => [m[1], m[2].toLowerCase()]));
  const coz = (deger: string): string => {
    const v = deger.trim().match(/^var\((--[a-z0-9-]+)\)$/i);
    return v ? (palet.get(v[1]) ?? `çözülemedi:${v[1]}`) : deger.trim().toLowerCase();
  };
  const kok = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const koyu = css.match(/html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const bg = (blok: string) => coz(blok.match(/--bg:\s*([^;]+);/)?.[1] ?? "yok");
  assert.equal(bg(kok), TEMA_RENGI.light.toLowerCase());
  assert.equal(bg(koyu), TEMA_RENGI.dark.toLowerCase());
});

test("betik: Next'in sonradan eklediği theme-color etiketi de uygulanan temaya boyanır", () => {
  // Ölçüldü: hidrasyon <head>'in sonuna cihaz temasının renginde bir etiket daha ekliyor.
  const o = ortam({ kayit: "dark", sistemKoyu: false });
  o.metaEklendi(TEMA_RENGI.light);
  assert.deepEqual(o.metaRenkleri(), [TEMA_RENGI.dark, TEMA_RENGI.dark, TEMA_RENGI.dark]);
});
