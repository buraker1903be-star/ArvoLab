import assert from "node:assert/strict";
import { describe, test } from "node:test";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { GEZINME_BETIGI, GEZINME_DAR, GEZINME_DAR_ANAHTARI, GEZINME_OZNITELIGI, darDegeri, darMi } from "@/lib/os5/gezinme";
import { TEMA_ANAHTARI, TEMA_BETIGI } from "@/lib/tema";

/*
  Masaüstü kenar çubuğu dar/açık tercihi (Phase 5.1b, 13.11.2026).

  Ön boyama betiği bir METİN olarak sayfaya gömülüyor; tema betiği gibi
  (tema.test.ts) Node'un vm'inde, yalnızca betiğin dokunduğu yüzeyi taklit
  eden sahte document/localStorage/window ile çalıştırılıyor. DOM'un
  davranışını değil, betiğin KARARINI sınıyoruz; kararın kendisi `darMi`
  ve ikisi aynı değer matrisiyle birbirine karşı sınanıyor.
*/

/** Kayıtlı değer matrisi: undefined = anahtar hiç yok. */
const MATRIS: Array<string | undefined> = [undefined, "1", "0", "", " 1", "1 ", '"1"', "true", "dar", "2", "01", "null", "undefined"];

describe("saf karar", () => {
  test("yalnızca \"1\" dar; geri kalan her şey açık", () => {
    assert.equal(darMi("1"), true);
    for (const ham of [null, undefined, "", "0", " 1", "true", "dar", 1, true, {}, ["1"]]) assert.equal(darMi(ham), false, String(ham));
  });

  test("saklanan değer okununca aynı karara döner", () => {
    assert.equal(darMi(darDegeri(true)), true);
    assert.equal(darMi(darDegeri(false)), false);
  });

  test("anahtar ve öznitelik sabit; eski 'Diğer' tercihinin anahtarından ayrı", () => {
    assert.equal(GEZINME_DAR_ANAHTARI, "arvolab.gezinme.dar");
    assert.equal(GEZINME_OZNITELIGI, "data-gezinme");
    assert.equal(GEZINME_DAR, "dar");
    assert.notEqual(GEZINME_DAR_ANAHTARI, TEMA_ANAHTARI);
  });
});

type Dinleyici = (o?: { key: string | null }) => void;

function ortam({
  kayit,
  depoKapali = false,
  depoNesnesiYok = false,
  oznitelikHatasi = false,
  dinleyiciYok = false,
  temaDa = false,
}: {
  kayit?: string;
  depoKapali?: boolean;
  depoNesnesiYok?: boolean;
  oznitelikHatasi?: boolean;
  dinleyiciYok?: boolean;
  temaDa?: boolean;
}) {
  const oznitelik: Record<string, string> = {};
  const depo = new Map<string, string>();
  if (kayit !== undefined) depo.set(GEZINME_DAR_ANAHTARI, kayit);
  const dinleyiciler: Record<string, Dinleyici[]> = {};
  const localStorage = depoNesnesiYok
    ? undefined
    : {
        getItem: (a: string) => {
          if (depoKapali) throw new Error("SecurityError");
          return depo.get(a) ?? null;
        },
      };
  const pencere: Record<string, unknown> = {
    localStorage,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  if (!dinleyiciYok) pencere.addEventListener = (ad: string, f: Dinleyici) => (dinleyiciler[ad] ??= []).push(f);
  const baglam = {
    window: pencere,
    localStorage,
    MutationObserver: class { observe() {} },
    document: {
      head: {},
      documentElement: {
        setAttribute: (ad: string, deger: string) => {
          if (oznitelikHatasi && ad === GEZINME_OZNITELIGI) throw new Error("NoModificationAllowedError");
          oznitelik[ad] = deger;
        },
        removeAttribute: (ad: string) => {
          if (oznitelikHatasi && ad === GEZINME_OZNITELIGI) throw new Error("NoModificationAllowedError");
          delete oznitelik[ad];
        },
        getAttribute: (ad: string) => oznitelik[ad] ?? null,
      },
      querySelectorAll: () => [],
    },
  };
  // Sayfadaki sıra: önce tema, sonra gezinme (app/layout.tsx).
  if (temaDa) vm.runInNewContext(TEMA_BETIGI, baglam);
  vm.runInNewContext(GEZINME_BETIGI, baglam);
  const olay = (o?: { key: string | null }) => (dinleyiciler.storage ?? []).forEach((f) => f(o));
  return {
    dar: () => oznitelik[GEZINME_OZNITELIGI] === GEZINME_DAR,
    oznitelik: () => oznitelik[GEZINME_OZNITELIGI],
    tema: () => oznitelik["data-theme"],
    baskaSekme(anahtar: string, deger: string | null) {
      if (deger === null) depo.delete(anahtar);
      else depo.set(anahtar, deger);
      olay({ key: anahtar });
    },
    depoTemizlendi() {
      depo.clear();
      olay({ key: null });
    },
    bosOlay: () => olay(undefined),
    dinleyiciSayisi: () => (dinleyiciler.storage ?? []).length,
  };
}

describe("ön boyama betiği", () => {
  test("betik ile saf karar bütün matriste aynı sonucu verir", () => {
    for (const kayit of MATRIS) {
      const o = ortam({ kayit });
      assert.equal(o.dar(), darMi(kayit ?? null), `kayıt: ${JSON.stringify(kayit)}`);
      // Açıkken öznitelik hiç yazılmaz: CSS yalnızca "dar" değerine bakar, başka bir değer ara durum yaratmaz.
      if (!o.dar()) assert.equal(o.oznitelik(), undefined);
    }
  });

  test("depolama okunamazsa (gizli sekme, engelli site verisi) açık, betik düşmez", () => {
    assert.doesNotThrow(() => ortam({ kayit: "1", depoKapali: true }));
    const kapali = ortam({ kayit: "1", depoKapali: true });
    assert.equal(kapali.dar(), false);
    /* Okuma hatası yalnızca o okumayı etkilemeli: betiğin geri kalanı
       (sekmeler arası dinleyici) yine kurulur ve sonraki olay betiği düşürmez.
       Dış try/catch hatayı tek başına yutsaydı sayfa açık açılırdı ama
       dinleyici hiç kurulmazdı; bu test o farkı görür. */
    assert.equal(kapali.dinleyiciSayisi(), 1);
    assert.doesNotThrow(() => kapali.baskaSekme(GEZINME_DAR_ANAHTARI, "1"));
    assert.equal(kapali.dar(), false);
    assert.equal(ortam({ depoNesnesiYok: true }).dar(), false);
  });

  test("öznitelik yazılamazsa da betik düşmez", () => {
    assert.doesNotThrow(() => ortam({ kayit: "1", oznitelikHatasi: true }));
  });

  test("addEventListener yoksa ilk karar yine uygulanır", () => {
    const o = ortam({ kayit: "1", dinleyiciYok: true });
    assert.equal(o.dar(), true);
  });

  test("başka sekmede değişen tercih bu sekmede izlenir", () => {
    const o = ortam({});
    assert.equal(o.dar(), false);
    o.baskaSekme(GEZINME_DAR_ANAHTARI, "1");
    assert.equal(o.dar(), true);
    o.baskaSekme(GEZINME_DAR_ANAHTARI, "0");
    assert.equal(o.dar(), false);
    o.baskaSekme(GEZINME_DAR_ANAHTARI, "1");
    o.baskaSekme(GEZINME_DAR_ANAHTARI, null);
    assert.equal(o.dar(), false, "anahtar silinince açık");
  });

  test("depo tamamen temizlenince (key === null) açığa döner", () => {
    const o = ortam({ kayit: "1" });
    assert.equal(o.dar(), true);
    o.depoTemizlendi();
    assert.equal(o.dar(), false);
  });

  test("başka anahtarın olayı tercihi değiştirmez; boş olay betiği düşürmez", () => {
    const o = ortam({ kayit: "1" });
    o.baskaSekme("arvolab.baska", "x");
    assert.equal(o.dar(), true);
    assert.doesNotThrow(() => o.bosOlay());
  });

  test("ES5: ok işlevi, let/const ve şablon metni yok (eski tarayıcıda da çalışsın)", () => {
    assert.doesNotMatch(GEZINME_BETIGI, /=>|\blet\b|\bconst\b|`/);
    assert.doesNotThrow(() => new vm.Script(GEZINME_BETIGI));
  });
});

describe("tema betiğiyle birlikte", () => {
  test("ikisi aynı sayfada birbirini bozmadan uygulanır", () => {
    const o = ortam({ kayit: "1", temaDa: true });
    assert.equal(o.dar(), true);
    assert.equal(o.tema(), "light");
  });

  test("tema değişikliği gezinme tercihine, gezinme değişikliği temaya dokunmaz", () => {
    const o = ortam({ kayit: "1", temaDa: true });
    o.baskaSekme(TEMA_ANAHTARI, "dark");
    assert.equal(o.tema(), "dark");
    assert.equal(o.dar(), true);
    o.baskaSekme(GEZINME_DAR_ANAHTARI, "0");
    assert.equal(o.dar(), false);
    assert.equal(o.tema(), "dark");
  });

  test("depo temizlenince ikisi de varsayılana döner", () => {
    const o = ortam({ kayit: "1", temaDa: true });
    o.baskaSekme(TEMA_ANAHTARI, "dark");
    o.depoTemizlendi();
    assert.equal(o.dar(), false);
    assert.equal(o.tema(), "light");
  });
});

describe("sayfaya yerleşim", () => {
  const layout = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");

  test("betik <head>'de, gerçek satır içi <script> olarak ve tema betiğinden SONRA", () => {
    const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
    const tema = head.indexOf('<script id="theme-init" dangerouslySetInnerHTML={{ __html: TEMA_BETIGI }} />');
    const gezinme = head.indexOf('<script id="gezinme-init" dangerouslySetInnerHTML={{ __html: GEZINME_BETIGI }} />');
    assert.ok(tema > 0 && gezinme > tema, `sıra: tema ${tema}, gezinme ${gezinme}`);
    // next/script'in beforeInteractive'i betiği ilk boyamadan önce çalıştırmıyor (layout.tsx, tema notu).
    assert.doesNotMatch(layout, /GEZINME_BETIGI[\s\S]{0,80}strategy=/);
  });

  test("<html> suppressHydrationWarning taşıyor: betiğin yazdığı öznitelik hydration uyuşmazlığı doğurmaz", () => {
    assert.match(layout, /<html lang=\{dil\} suppressHydrationWarning>/);
  });

  test("CSP satır içi betiğe izin veriyor (tema betiğiyle aynı koşul)", () => {
    const csp = fs.readFileSync(path.join(process.cwd(), "lib/guvenlik-basliklari.ts"), "utf8");
    assert.match(csp, /\["script-src", \["'self'", "'unsafe-inline'"/);
  });
});

/*
  KIRILIM GÜVENCESİ. Tercih yalnızca masaüstünü değiştirmeli: tablet her
  zaman ray, telefon alt çubuk (kurum sahibinin kararı). Sonraki CSS
  aşamasında `[data-gezinme…]` seçicisi taşıyan HER kural
  `@media (min-width: 1200px)` bloğunun içinde olmalı. Bugün hiçbir kural
  yok; denetim, ilk kural yazıldığı anda devreye girer. Denetimin kendisi
  yapay CSS ile sınanıyor (kör kalan bir denetim, denetlediği hatadan
  farksızdır).
*/
function masaustuDisiGezinmeKurallari(css: string): string[] {
  const temiz = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const ihlaller: string[] = [];
  const yigin: string[] = [];
  let bas = 0;
  for (let i = 0; i < temiz.length; i++) {
    const c = temiz[i];
    if (c === "{") {
      const onSoz = temiz.slice(bas, i).trim();
      yigin.push(onSoz);
      const masaustu = yigin.some((s) => /^@media\b[^{]*\(\s*min-width\s*:\s*1200px\s*\)/.test(s) && !/max-width/.test(s));
      if (/\[data-gezinme/.test(onSoz) && !onSoz.startsWith("@") && !masaustu) ihlaller.push(onSoz);
      bas = i + 1;
    } else if (c === "}") {
      yigin.pop();
      bas = i + 1;
    } else if (c === ";" ) {
      bas = i + 1;
    }
  }
  return ihlaller;
}

describe("kırılım güvencesi", () => {
  test("denetim: masaüstü bloğundaki kural geçer, dışındakiler yakalanır", () => {
    assert.deepEqual(masaustuDisiGezinmeKurallari(`@media (min-width: 1200px) { html[data-gezinme="dar"] .os-gezinme { width: 64px; } }`), []);
    assert.equal(masaustuDisiGezinmeKurallari(`html[data-gezinme="dar"] .os-gezinme { width: 64px; }`).length, 1);
    assert.equal(masaustuDisiGezinmeKurallari(`@media (min-width: 761px) and (max-width: 1199px) { html[data-gezinme="dar"] .x { a: b; } }`).length, 1);
    assert.equal(masaustuDisiGezinmeKurallari(`@media (max-width: 760px) { html[data-gezinme] .x { a: b; } }`).length, 1);
    assert.deepEqual(masaustuDisiGezinmeKurallari(`/* html[data-gezinme="dar"] { } */ .a { b: c; }`), []);
  });

  test("uygulamanın CSS'inde dar tercihi masaüstü dışında hiçbir kuralı değiştirmiyor", () => {
    const klasor = path.join(process.cwd(), "app/styles");
    for (const ad of fs.readdirSync(klasor).filter((d) => d.endsWith(".css"))) {
      assert.deepEqual(masaustuDisiGezinmeKurallari(fs.readFileSync(path.join(klasor, ad), "utf8")), [], ad);
    }
  });
});
