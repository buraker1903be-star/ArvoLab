import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { describe } from "node:test";
import {
  anahtarAyrimiKarari,
  anahtarProjesi,
  anahtarUyusmazligi,
  betikHedefKarari,
  dagitimOrtamiCoz,
  ortamGirdisi,
  projeKimligi,
  SABIT_URETIM_SUPABASE_REF,
  supabaseOrtamKarari,
  supabaseOrtaminiDogrula,
  SupabaseOrtamHatasi,
  uretimProjesiniGosteriyor,
  veritabaniAdresiProjesi,
} from "@/lib/supabase/ortam-guvenligi";
import { hedefDenetimi } from "../../scripts/supabase-hedef.mjs";

/*
  SUPABASE ORTAM GÜVENLİĞİ (Güvenli Test Ortamı, Aşama 1). Önizleme ve
  üretim aynı Supabase projesine bağlıydı; her dal önizlemesi canlıya
  yazabiliyordu. Kimlikler uydurma (20 küçük harf/rakam).
*/
const URETIM = "aaaaaaaaaaaaaaaaaaaa";
const TEST = "bbbbbbbbbbbbbbbbbbbb";
const BASKA = "cccccccccccccccccccc";
const adres = (ref: string) => `https://${ref}.supabase.co`;
const tam = { etiket: "test", uretimRef: URETIM, testRef: TEST };

describe("üretim dışı (Preview / Development)", () => {
  for (const vercelOrtami of ["preview", "development", null]) {
    test(`${vercelOrtami ?? "Vercel dışı"}: test projesine bağlantı izinli`, () => {
      assert.deepEqual(supabaseOrtamKarari({ vercelOrtami, supabaseUrl: adres(TEST), ...tam }), { tur: "izin", ortam: "uretim-disi", hedef: "test" });
    });
    test(`${vercelOrtami ?? "Vercel dışı"}: ÜRETİM projesine bağlantı reddedilir`, () => {
      const k = supabaseOrtamKarari({ vercelOrtami, supabaseUrl: adres(URETIM), ...tam });
      assert.equal(k.tur, "red");
      assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli");
    });
  }

  test("yalnızca etiket yetmez: etiket 'test' ama adres başka bir proje → ret", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(BASKA), ...tam });
    assert.equal(k.tur === "red" && k.neden, "uretim-disi-test-projesi-degil");
  });

  test("eksik değişken → ret (fail-closed); üretim kimliği biliniyorsa üretime bağlantı yine en açık nedenle reddedilir", () => {
    for (const eksik of [{ etiket: "" }, { uretimRef: "" }, { testRef: "" }]) {
      const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(TEST), ...tam, ...eksik });
      assert.equal(k.tur === "red" && k.neden, "uretim-disi-yapilandirma-eksik", JSON.stringify(eksik));
    }
    const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(URETIM), uretimRef: URETIM });
    assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli");
  });

  test("etiket 'uretim' ise ret; test ve üretim kimliği aynıysa ret", () => {
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(TEST), ...tam, etiket: "uretim" }).tur, "red");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(TEST), etiket: "test", uretimRef: TEST, testRef: TEST }).tur, "red");
  });

  test("yerel Supabase yalnızca Vercel dışında; Vercel önizlemesinde ret", () => {
    assert.deepEqual(supabaseOrtamKarari({ vercelOrtami: null, supabaseUrl: "http://127.0.0.1:54321" }), { tur: "izin", ortam: "uretim-disi", hedef: "yerel" });
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: "http://localhost:54321", ...tam }).tur, "red");
  });

  test("sahte önizleme (ARVOLAB_ONIZLEME=1) gerçek bağlantı kurmaz → izin; üretimde bu bayrak işe yaramaz", () => {
    assert.deepEqual(supabaseOrtamKarari({ vercelOrtami: "development", onizleme: "1" }), { tur: "izin", ortam: "uretim-disi", hedef: "sahte" });
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", onizleme: "1" }).tur, "red", "üretimde adres yoksa ret");
  });
});

describe("üretim (Production)", () => {
  test("GERİYE DÖNÜK UYUMLULUK: bugünkü üretim yapılandırması (yeni değişken yok) bağlantıyı KESMEZ, uyarı verir", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: adres(URETIM) });
    assert.equal(k.tur, "izin");
    assert.ok(k.tur === "izin" && k.uyari && /doğrulanamıyor/.test(k.uyari));
  });

  test("üretim kimliği tanımlıyken doğru projeye bağlantı izinli", () => {
    assert.deepEqual(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: adres(URETIM), etiket: "uretim", uretimRef: URETIM, testRef: TEST }), { tur: "izin", ortam: "uretim", hedef: "uretim" });
  });

  test("üretim TEST projesine bağlanırsa ret (yalnızca test kimliği bilinse de)", () => {
    for (const g of [{ testRef: TEST }, { uretimRef: URETIM, testRef: TEST }]) {
      const k = supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: adres(TEST), ...g });
      assert.equal(k.tur === "red" && k.neden, "uretim-test-projesine-bagli");
    }
  });

  test("üretim bilinmeyen bir projeye bağlanırsa ret; etiket 'test' ise ret", () => {
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: adres(BASKA), uretimRef: URETIM }).tur, "red");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: adres(URETIM), etiket: "test", uretimRef: URETIM }).tur, "red");
  });

  test("geçersiz proje kimliği biçimi ve geçersiz adres → ret", () => {
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: adres(URETIM), uretimRef: "KISA" }).tur, "red");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: "https://ornek.com" }).tur, "red");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: `http://${URETIM}.supabase.co` }).tur, "red", "https olmayan adres");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: "" }).tur, "red");
  });
});

describe("yardımcılar", () => {
  test("projeKimligi ve veritabaniAdresiProjesi", () => {
    assert.equal(projeKimligi(adres(TEST)), TEST);
    assert.equal(projeKimligi(`https://${TEST}.supabase.co.kotu.com`), null);
    assert.equal(veritabaniAdresiProjesi(`postgresql://postgres:gizli@db.${TEST}.supabase.co:5432/postgres`), TEST);
    assert.equal(veritabaniAdresiProjesi(`postgresql://postgres.${TEST}:gizli@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`), TEST);
    assert.equal(veritabaniAdresiProjesi("postgresql://postgres@localhost:5432/postgres"), null);
  });

  test("JWT biçimli anahtar başka projeye aitse yakalanır; opak anahtar doğrulanamaz (null)", () => {
    const jwt = (ref: string) => `x.${Buffer.from(JSON.stringify({ ref, role: "service_role" })).toString("base64url")}.y`;
    assert.deepEqual(anahtarProjesi(jwt(TEST)), { ref: TEST, rol: "service_role" });
    assert.equal(anahtarUyusmazligi(adres(TEST), jwt(TEST)), null);
    assert.match(anahtarUyusmazligi(adres(TEST), jwt(URETIM)) ?? "", /ait değil/);
    assert.equal(anahtarUyusmazligi(adres(TEST), "sb_secret_opak"), null);
  });

  test("supabaseOrtaminiDogrula ret durumunda fırlatır; hata metni anahtar değeri içermez", () => {
    const gizli = "sb_secret_COK_GIZLI_DEGER";
    assert.throws(
      () => supabaseOrtaminiDogrula({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: adres(URETIM), ARVOLAB_URETIM_SUPABASE_REF: URETIM, SUPABASE_SECRET_KEY: gizli }),
      (h: unknown) => h instanceof SupabaseOrtamHatasi && !String(h.message).includes(gizli),
    );
  });

  test("ortamGirdisi: Vercel değişkenleri ve etiketler", () => {
    assert.deepEqual(ortamGirdisi({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "u", ARVOLAB_SUPABASE_ORTAMI: "test" }), {
      vercelOrtami: "preview", derlemeOrtami: null, supabaseUrl: "u", etiket: "test", uretimRef: null, testRef: null, onizleme: null, tekProje: null,
    });
  });
});

describe("migration ve betik hedefi", () => {
  const ortak = { uretimRef: URETIM, testRef: TEST };
  test("varsayılan hedef test: izin", () => {
    assert.deepEqual(betikHedefKarari({ tur: "migration", hedefRef: TEST, ...ortak }), { tur: "izin", hedef: "test" });
  });
  test("üretime migration: bayrak + tam onay cümlesi şart", () => {
    assert.equal(betikHedefKarari({ tur: "migration", hedefRef: URETIM, ...ortak }).tur, "red");
    assert.equal(betikHedefKarari({ tur: "migration", hedefRef: URETIM, ...ortak, uretimIstendi: true, onayMetni: "evet" }).tur, "red");
    assert.deepEqual(betikHedefKarari({ tur: "migration", hedefRef: URETIM, ...ortak, uretimIstendi: true, onayMetni: `ÜRETİME UYGULA ${URETIM}` }), { tur: "izin", hedef: "uretim" });
  });
  test("şema kurulumu ve sentetik veri üretimde HİÇBİR koşulda çalışmaz", () => {
    for (const tur of ["sema-kurulumu", "sentetik-veri"] as const) {
      assert.equal(betikHedefKarari({ tur, hedefRef: URETIM, ...ortak, uretimIstendi: true, onayMetni: `ÜRETİME UYGULA ${URETIM}` }).tur, "red", tur);
    }
  });
  test("bilinmeyen proje, eksik ya da aynı kimlikler → ret", () => {
    assert.equal(betikHedefKarari({ tur: "migration", hedefRef: BASKA, ...ortak }).tur, "red");
    assert.equal(betikHedefKarari({ tur: "migration", hedefRef: TEST, uretimRef: null, testRef: TEST }).tur, "red");
    assert.equal(betikHedefKarari({ tur: "migration", hedefRef: TEST, uretimRef: TEST, testRef: TEST }).tur, "red");
  });
  test("komut satırı betiği aynı kararı verir (--ref, veritabanı adresi)", () => {
    const env = { ARVOLAB_URETIM_SUPABASE_REF: URETIM, ARVOLAB_TEST_SUPABASE_REF: TEST };
    assert.equal(hedefDenetimi(["--tur", "migration", "--ref", TEST], env).tur, "izin");
    assert.equal(hedefDenetimi(["--tur", "sentetik-veri", "--ref", URETIM, "--uretim"], { ...env, ARVOLAB_URETIM_ONAYI: `ÜRETİME UYGULA ${URETIM}` }).tur, "red");
    assert.equal(hedefDenetimi(["--tur", "sema-kurulumu"], { ...env, SUPABASE_DB_URL: `postgresql://postgres:x@db.${URETIM}.supabase.co:5432/postgres` }).tur, "red");
  });
});

describe("anahtar ayrımı (AI, e-posta, cron, köprü)", () => {
  test("üretim dışında üretim anahtarları beyansız → ret; beyanla izin; üretimde her zaman izin", () => {
    assert.equal(anahtarAyrimiKarari({ VERCEL_ENV: "preview", OPENAI_API_KEY: "x", CRON_SECRET: "y" }).tur, "red");
    assert.equal(anahtarAyrimiKarari({ VERCEL_ENV: "preview", OPENAI_API_KEY: "x", ARVOLAB_TEST_ANAHTARLARI: "1" }).tur, "izin");
    assert.equal(anahtarAyrimiKarari({ VERCEL_ENV: "preview" }).tur, "izin");
    assert.equal(anahtarAyrimiKarari({ VERCEL_ENV: "production", OPENAI_API_KEY: "x", CRON_SECRET: "y" }).tur, "izin");
    assert.equal(anahtarAyrimiKarari({ ARVOLAB_ONIZLEME: "1", AI_ANAHTAR: "onizleme" }).tur, "izin", "sahte önizleme");
  });
  test("ret mesajı değişken ADLARINI söyler, değerlerini değil", () => {
    const k = anahtarAyrimiKarari({ VERCEL_ENV: "preview", RESEND_API_KEY: "re_COK_GIZLI" });
    assert.ok(k.tur === "red" && k.mesaj.includes("RESEND_API_KEY") && !k.mesaj.includes("re_COK_GIZLI"));
  });
});

describe("bugünkü Vercel yapılandırmasının şekli (değerler uydurma)", () => {
  // Production: Supabase üç değişken + AI/e-posta/cron/köprü; yeni değişken yok.
  const uretim = { VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: adres(URETIM), OPENAI_API_KEY: "x", AI_ANAHTAR: "x", RESEND_API_KEY: "x", CRON_SECRET: "x" };
  // Preview: AYNI Supabase projesi + OPENAI_API_KEY + CRON_SECRET (Production + Preview hedefli).
  const onizleme = { VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: adres(URETIM), OPENAI_API_KEY: "x", CRON_SECRET: "x" };

  test("Production bugünkü hâliyle ÇALIŞMAYA DEVAM EDER (kesinti yok)", () => {
    assert.equal(supabaseOrtamKarari(ortamGirdisi(uretim)).tur, "izin");
    assert.equal(anahtarAyrimiKarari(uretim).tur, "izin");
  });
  test("Preview bugünkü hâliyle REDDEDİLİR — bu kod, panel adımlarından önce önizlemeye gönderilmemeli", () => {
    assert.equal(supabaseOrtamKarari(ortamGirdisi(onizleme)).tur, "red");
    assert.equal(anahtarAyrimiKarari(onizleme).tur, "red");
  });
});

/*
  ÇALIŞMA ANINDA VERCEL_ENV YOKSA (Durak 0). Eskiden ortam yalnızca çalışma
  anındaki VERCEL_ENV'den okunuyordu: değer gelmezse üretim kendini önizleme
  sanıyor, test yapılandırması arıyor ve her isteğe 503 dönüyordu. Artık
  derlemede gömülen değer (ARVOLAB_DAGITIM_ORTAMI) yedek; ikisi çelişirse ret.
*/
describe("dağıtım ortamı: çalışma anı + derleme yedeği", () => {
  const uretimTam = { supabaseUrl: adres(URETIM), etiket: "uretim", uretimRef: URETIM, testRef: TEST };
  const testTam = { supabaseUrl: adres(TEST), ...tam };

  test("çözüm tablosu: ikisi aynı / yalnızca biri / hiçbiri / çelişki; boş metin yok sayılır", () => {
    assert.deepEqual(dagitimOrtamiCoz("production", "production"), { tur: "tamam", ortam: "uretim", kaynak: "calisma" });
    assert.deepEqual(dagitimOrtamiCoz(undefined, "production"), { tur: "tamam", ortam: "uretim", kaynak: "derleme" });
    assert.deepEqual(dagitimOrtamiCoz("", "production"), { tur: "tamam", ortam: "uretim", kaynak: "derleme" });
    assert.deepEqual(dagitimOrtamiCoz("preview", null), { tur: "tamam", ortam: "uretim-disi", kaynak: "calisma" });
    assert.deepEqual(dagitimOrtamiCoz(null, ""), { tur: "tamam", ortam: "uretim-disi", kaynak: "yok" });
    assert.deepEqual(dagitimOrtamiCoz("preview", "production"), { tur: "celiski", calisma: "preview", derleme: "production" });
  });

  test("REGRESYON — Production: çalışma anında VERCEL_ENV yok, derleme 'production' → üretim kuralları, izin (503 YOK)", () => {
    assert.deepEqual(supabaseOrtamKarari({ vercelOrtami: undefined, derlemeOrtami: "production", ...uretimTam }), { tur: "izin", ortam: "uretim", hedef: "uretim" });
    // Bugünkü Production (yeni değişkenler yok) da aynı yoldan uyarıyla geçer.
    const bugun = supabaseOrtamKarari({ vercelOrtami: undefined, derlemeOrtami: "production", supabaseUrl: adres(URETIM) });
    assert.equal(bugun.tur, "izin");
    assert.equal(bugun.ortam, "uretim");
  });
  test("Production: derleme yedeği üretim kurallarını gevşetmez — test projesine bağlıysa yine ret", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: undefined, derlemeOrtami: "production", ...uretimTam, supabaseUrl: adres(TEST) });
    assert.equal(k.tur === "red" && k.neden, "uretim-test-projesine-bagli");
  });
  test("Preview: çalışma anında yok, derleme 'preview' → üretim dışı kuralları; üretim projesine bağlıysa ret", () => {
    assert.deepEqual(supabaseOrtamKarari({ vercelOrtami: undefined, derlemeOrtami: "preview", ...testTam }), { tur: "izin", ortam: "uretim-disi", hedef: "test" });
    const k = supabaseOrtamKarari({ vercelOrtami: undefined, derlemeOrtami: "preview", ...tam, supabaseUrl: adres(URETIM) });
    assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli");
  });
  test("Development: derleme 'development' → üretim dışı; yerel Supabase Vercel'de sayılır ve reddedilir", () => {
    assert.equal(supabaseOrtamKarari({ derlemeOrtami: "development", ...testTam }).tur, "izin");
    const k = supabaseOrtamKarari({ derlemeOrtami: "development", supabaseUrl: "http://127.0.0.1:54321" });
    assert.equal(k.tur === "red" && k.neden, "yerel-supabase-vercelde");
    // Hiçbir kaynak yoksa (yerel `next dev`) yerel Supabase serbest.
    assert.equal(supabaseOrtamKarari({ supabaseUrl: "http://127.0.0.1:54321" }).tur, "izin");
  });
  test("çelişki → ret, her iki yönde; üretimi ilgilendiriyorsa ortam 'uretim' yazılır", () => {
    for (const [calisma, derleme, ortam] of [["production", "preview", "uretim"], ["preview", "production", "uretim"], ["preview", "development", "uretim-disi"]] as const) {
      const k = supabaseOrtamKarari({ vercelOrtami: calisma, derlemeOrtami: derleme, ...uretimTam });
      assert.equal(k.tur, "red");
      assert.equal(k.tur === "red" && k.neden, "dagitim-ortami-celiskili");
      assert.equal(k.ortam, ortam);
    }
  });
  test("ortamGirdisi ve supabaseOrtaminiDogrula derleme değerini ikinci argümandan alır", () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: adres(URETIM), ARVOLAB_SUPABASE_ORTAMI: "uretim", ARVOLAB_URETIM_SUPABASE_REF: URETIM, ARVOLAB_TEST_SUPABASE_REF: TEST };
    assert.equal(ortamGirdisi(env, "production").derlemeOrtami, "production");
    assert.equal(supabaseOrtaminiDogrula(env, "production").hedef, "uretim");
    // Yedek olmadan aynı yapılandırma üretim dışı sayılır ve reddedilir (eski davranış).
    assert.throws(() => supabaseOrtaminiDogrula(env), SupabaseOrtamHatasi);
  });
  test("sunucu, yönetim istemcisi ve ara katman gömülü değeri DÜZ yazımla verir (Next yalnızca onu derlemede değiştirir)", () => {
    for (const dosya of ["lib/supabase/server.ts", "lib/supabase/admin.ts", "proxy.ts"]) {
      assert.ok(readFileSync(dosya, "utf8").includes("process.env.ARVOLAB_DAGITIM_ORTAMI)"), `${dosya} derleme yedeğini vermiyor`);
    }
    assert.ok(/ARVOLAB_DAGITIM_ORTAMI:\s*process\.env\.VERCEL_ENV/.test(readFileSync("next.config.ts", "utf8")));
  });
  test("next.config `next start` evresinde denetlemez: çalışma anı kararının tek sahibi derleme yedeğini gören üç yol", () => {
    const evreler = /DENETLENEN_EVRELER = new Set<string>\(\[([^\]]*)\]/.exec(readFileSync("next.config.ts", "utf8"))?.[1] ?? "";
    assert.ok(evreler.includes("phase-production-build") && evreler.includes("phase-development-server"));
    assert.equal(evreler.includes("phase-production-server"), false);
  });
});

/*
  TEK PROJE BEYANI KALDIRILDI (G1 Aşama 8.5D, 11.11.2026). 05.11.2026'dan
  beri ARVOLAB_TEK_PROJE=1, üretim dışı ortamın üretim projesine
  bağlanmasına izin veriyordu ve bu blok o izni sabitliyordu. Test projesi
  kuruldu, beyan Preview'da tanımlı değil; tek bir değişkenle önizlemeyi
  canlı veriye bağlayan yol kapatıldı. Testler artık izni değil RETTİ
  sabitliyor.
*/
describe("tek proje beyanı (ARVOLAB_TEK_PROJE=1) artık üretime bağlantı açmaz", () => {
  test("Preview/Development/yerel: beyan + adres tanımlı üretim projesi → ret", () => {
    for (const vercelOrtami of ["preview", "development", null]) {
      const k = supabaseOrtamKarari({ vercelOrtami, supabaseUrl: adres(URETIM), uretimRef: URETIM, tekProje: "1" });
      assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli", String(vercelOrtami));
      assert.ok(k.tur === "red" && !k.mesaj.includes("TEK_PROJE"), "ret mesajı kaçış yolunu önermemeli");
    }
  });
  test("beyan değeri ne olursa olsun üretime bağlantı reddedilir", () => {
    for (const tekProje of [undefined, "", "0", "evet", "1", " 1 "]) {
      const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(URETIM), uretimRef: URETIM, tekProje });
      assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli");
    }
  });
  test("beyan kimliği bilinmeyen ya da başka bir projeye izin vermez", () => {
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(URETIM), tekProje: "1" }).tur, "red");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(BASKA), uretimRef: URETIM, tekProje: "1" }).tur, "red");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(URETIM), uretimRef: "kisa", tekProje: "1" }).tur, "red");
  });
  test("beyan doğru test yapılandırmasını bozmaz", () => {
    assert.deepEqual(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(TEST), ...tam, tekProje: "1" }), { tur: "izin", ortam: "uretim-disi", hedef: "test" });
  });
  test("üretimde beyanın etkisi yok: kurallar aynı", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: adres(TEST), uretimRef: URETIM, testRef: TEST, tekProje: "1" });
    assert.equal(k.tur === "red" && k.neden, "uretim-test-projesine-bagli");
  });
  test("ortamGirdisi beyanı okumaya devam eder (anahtar ayrımı için); tarayıcı paketine gömülü kalır", () => {
    assert.equal(ortamGirdisi({ ARVOLAB_TEK_PROJE: "1" }).tekProje, "1");
    assert.ok(readFileSync("lib/supabase/client.ts", "utf8").includes("ARVOLAB_TEK_PROJE: process.env.ARVOLAB_TEK_PROJE"));
    assert.ok(/ARVOLAB_TEK_PROJE:\s*process\.env\.ARVOLAB_TEK_PROJE/.test(readFileSync("next.config.ts", "utf8")));
  });
  test("anahtar ayrımı (kapsam dışı, değişmedi): beyanla üretim anahtarları uyarıyla kabul; beyansız ret sürer", () => {
    const env = { VERCEL_ENV: "preview", OPENAI_API_KEY: "x", CRON_SECRET: "x" };
    assert.equal(anahtarAyrimiKarari(env).tur, "red");
    const k = anahtarAyrimiKarari({ ...env, ARVOLAB_TEK_PROJE: "1" });
    assert.equal(k.tur, "izin");
    assert.ok(k.tur === "izin" && k.uyari?.includes("OPENAI_API_KEY") && !k.uyari.includes('"x"'));
  });
  test("betik kuralları değişmez: şema kurulumu ve sentetik veri üretimde yine reddedilir", () => {
    for (const tur of ["sema-kurulumu", "sentetik-veri"] as const) {
      assert.equal(betikHedefKarari({ tur, hedefRef: URETIM, uretimRef: URETIM, testRef: TEST, uretimIstendi: true, onayMetni: `ÜRETİME UYGULA ${URETIM}` }).tur, "red");
    }
  });
});

describe("gizli değerler istemciye gitmez (durağan denetim)", () => {
  test("next.config env bloğu yalnızca gizli olmayan adlar içerir", () => {
    const kaynak = readFileSync("next.config.ts", "utf8");
    const blok = /env:\s*\{([\s\S]*?)\n\s*\},/.exec(kaynak)?.[1] ?? "";
    assert.ok(blok.includes("ARVOLAB_URETIM_SUPABASE_REF"));
    assert.equal(/SECRET|SERVICE_ROLE|KEY|ANAHTAR|PASSWORD|PAROLA|TOKEN/.test(blok.replace(/\/\*[\s\S]*?\*\//g, "")), false);
  });
  test("tarayıcı istemcisi sunucu anahtarına başvurmaz; dört bağlantı yolu denetimi çağırır", () => {
    const istemci = readFileSync("lib/supabase/client.ts", "utf8");
    assert.equal(/SUPABASE_SECRET_KEY|SERVICE_ROLE/.test(istemci), false);
    for (const [dosya, cagri] of [
      ["lib/supabase/client.ts", "supabaseOrtaminiDogrula("],
      ["lib/supabase/server.ts", "supabaseOrtaminiDogrula("],
      ["lib/supabase/admin.ts", "supabaseOrtaminiDogrula("],
      ["proxy.ts", "supabaseOrtamKarari("],
      ["next.config.ts", "supabaseOrtamKarari("],
    ] as const) {
      assert.ok(readFileSync(dosya, "utf8").includes(cagri), `${dosya} ortam denetimini çağırmıyor`);
    }
  });
  test("Supabase istemcisi bu dört yol dışında kurulmuyor (yeni bir yol eklenirse test hatırlatır)", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    // İstemci KURAN kod: createServerClient(, createBrowserClient( ya da supabase-js'ten createClient içe aktarması. Tip içe aktarmaları sayılmaz.
    const kurar = (metin: string) => /createServerClient\(|createBrowserClient\(/.test(metin) || /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*"@supabase\/supabase-js"/.test(metin);
    const bulunan: string[] = [];
    const tara = (k: string) => {
      for (const ad of readdirSync(k)) {
        const y = join(k, ad);
        if (statSync(y).isDirectory()) tara(y);
        else if (/\.tsx?$/.test(ad) && kurar(readFileSync(y, "utf8"))) bulunan.push(y);
      }
    };
    tara("app");
    tara("lib");
    if (kurar(readFileSync("proxy.ts", "utf8"))) bulunan.push("proxy.ts");
    assert.deepEqual(bulunan.sort(), ["lib/supabase/admin.ts", "lib/supabase/client.ts", "lib/supabase/server.ts", "proxy.ts"]);
  });
});

/*
  KODDA SABİT ÜRETİM KİMLİĞİ (05.11.2026). Betiklerin kararı eskiden yalnızca
  ortam değişkenlerine dayanıyordu: ARVOLAB_TEST_SUPABASE_REF ile
  ARVOLAB_URETIM_SUPABASE_REF yer değiştirince üretim projesi "test" sayılıyor
  ve şema kurulumu izin alıyordu. Burada GERÇEK kimlikler kullanılıyor;
  yukarıdaki uydurma kimliklerle bu kuralın hiçbir şeyi sınanamaz.
*/
describe("kodda sabit üretim kimliği: kimlikler yer değiştirse de üretime yazılmaz", () => {
  const PROD = "zpfpocyajnxcketdjbxm";
  const TEST_GERCEK = "kyvjftrsweqjlgjeobnq";
  const TURLER = ["migration", "sema-kurulumu", "sentetik-veri"] as const;
  const onayli = (ref: string) => ({ uretimIstendi: true, onayMetni: `ÜRETİME UYGULA ${ref}` });
  const havuz = (ref: string) => `postgresql://postgres.${ref}:x@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
  const dogruEnv = { ARVOLAB_URETIM_SUPABASE_REF: PROD, ARVOLAB_TEST_SUPABASE_REF: TEST_GERCEK };
  const tersEnv = { ARVOLAB_URETIM_SUPABASE_REF: TEST_GERCEK, ARVOLAB_TEST_SUPABASE_REF: PROD };

  test("sabit, ortam değişkeninden okunmuyor ve gerçek üretim kimliği", () => {
    assert.equal(SABIT_URETIM_SUPABASE_REF, PROD);
    const kaynak = readFileSync("lib/supabase/ortam-guvenligi.ts", "utf8");
    assert.match(kaynak, /export const SABIT_URETIM_SUPABASE_REF = "zpfpocyajnxcketdjbxm";/);
  });

  test("kimlikler yer değiştirmiş: üretim hedefi hiçbir betikte, onaylı bile olsa, izin almaz", () => {
    for (const tur of TURLER) {
      assert.equal(betikHedefKarari({ tur, hedefRef: PROD, uretimRef: TEST_GERCEK, testRef: PROD }).tur, "red", tur);
      for (const ref of [PROD, TEST_GERCEK]) {
        assert.equal(betikHedefKarari({ tur, hedefRef: PROD, uretimRef: TEST_GERCEK, testRef: PROD, ...onayli(ref) }).tur, "red", `${tur} onay ${ref}`);
      }
    }
  });

  test("kimlikler yer değiştirmiş: gerçek test projesine de izin verilmez (yapılandırma yanlış)", () => {
    for (const tur of TURLER) {
      const k = betikHedefKarari({ tur, hedefRef: TEST_GERCEK, uretimRef: TEST_GERCEK, testRef: PROD });
      assert.ok(k.tur === "red" && /yer değiştirmiş/.test(k.mesaj), tur);
    }
  });

  test("test kimliği değişkeni üretimi gösteriyorsa (büyük harf, boşluk) ret; öteki değişken ne derse desin", () => {
    for (const testRef of [PROD, ` ${PROD} `, PROD.toUpperCase()]) {
      for (const uretimRef of [null, "", "aaaaaaaaaaaaaaaaaaaa", PROD]) {
        assert.equal(betikHedefKarari({ tur: "sema-kurulumu", hedefRef: TEST_GERCEK, uretimRef, testRef }).tur, "red", `${testRef}/${uretimRef}`);
      }
    }
  });

  test("şema kurulumu ve sentetik veri: hedef üretimse değişkenler eksik, uydurma ya da DOĞRU olsa da ret", () => {
    const ortamlar = [
      { uretimRef: null, testRef: null },
      { uretimRef: "aaaaaaaaaaaaaaaaaaaa", testRef: "bbbbbbbbbbbbbbbbbbbb" },
      { uretimRef: PROD, testRef: TEST_GERCEK },
      { uretimRef: PROD, testRef: PROD },
    ];
    for (const tur of ["sema-kurulumu", "sentetik-veri"] as const) {
      for (const o of ortamlar) {
        assert.equal(betikHedefKarari({ tur, hedefRef: PROD, ...o, ...onayli(PROD) }).tur, "red", `${tur} ${JSON.stringify(o)}`);
      }
    }
  });

  test("migration: üretime YALNIZCA doğru değişkenler + --uretim + tam onayla; değişkenler uydurmaysa bilinmeyen proje", () => {
    assert.equal(betikHedefKarari({ tur: "migration", hedefRef: PROD, uretimRef: PROD, testRef: TEST_GERCEK }).tur, "red");
    assert.equal(betikHedefKarari({ tur: "migration", hedefRef: PROD, uretimRef: PROD, testRef: TEST_GERCEK, ...onayli(TEST_GERCEK) }).tur, "red");
    assert.equal(betikHedefKarari({ tur: "migration", hedefRef: PROD, uretimRef: "aaaaaaaaaaaaaaaaaaaa", testRef: "bbbbbbbbbbbbbbbbbbbb", ...onayli(PROD) }).tur, "red");
    /* Bilinçli yol değişmedi (ayrı onay gerektiren üretim migration'ı). */
    assert.deepEqual(betikHedefKarari({ tur: "migration", hedefRef: PROD, uretimRef: PROD, testRef: TEST_GERCEK, ...onayli(PROD) }), { tur: "izin", hedef: "uretim" });
  });

  test("beklenmeyen proje kimliği ve doğru yapılandırmada test projesi", () => {
    for (const tur of TURLER) {
      assert.equal(betikHedefKarari({ tur, hedefRef: "cccccccccccccccccccc", uretimRef: PROD, testRef: TEST_GERCEK }).tur, "red", tur);
      assert.deepEqual(betikHedefKarari({ tur, hedefRef: TEST_GERCEK, uretimRef: PROD, testRef: TEST_GERCEK }), { tur: "izin", hedef: "test" }, tur);
    }
  });

  test("uretimProjesiniGosteriyor: adres biçimleri, kodlama, harf; başka proje yakalanmaz", () => {
    for (const m of [
      PROD,
      `https://${PROD}.supabase.co`,
      havuz(PROD),
      `postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres`,
      `postgresql://postgres%2E${PROD}:x@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres.${PROD.toUpperCase()}:x@AWS-0-EU-WEST-1.POOLER.SUPABASE.COM/postgres`,
      `postgresql://postgres.${PROD}:x@beklenmedik-vekil.example.com/postgres`,
    ]) {
      assert.equal(uretimProjesiniGosteriyor(m), true, m);
    }
    for (const m of [null, undefined, "", TEST_GERCEK, havuz(TEST_GERCEK), "%E0%A4%A"]) assert.equal(uretimProjesiniGosteriyor(m), false, String(m));
    assert.equal(uretimProjesiniGosteriyor(null, havuz(TEST_GERCEK), PROD), true);
  });

  test("hedefDenetimi: kimlikler yer değiştirmiş ve adres üretim → ret (üç betik türü)", () => {
    for (const tur of TURLER) {
      assert.equal(hedefDenetimi(["--tur", tur], { ...tersEnv, SUPABASE_DB_URL: havuz(PROD) }).tur, "red", tur);
      assert.equal(hedefDenetimi(["--tur", tur, "--uretim"], { ...tersEnv, SUPABASE_DB_URL: havuz(PROD), ARVOLAB_URETIM_ONAYI: `ÜRETİME UYGULA ${PROD}` }).tur, "red", tur);
    }
  });

  test("hedefDenetimi: --ref test derken adres üretim → ret (karar ile bağlantı ayrışamaz)", () => {
    for (const tur of TURLER) {
      const k = hedefDenetimi(["--tur", tur, "--ref", TEST_GERCEK], { ...dogruEnv, SUPABASE_DB_URL: havuz(PROD) });
      assert.equal(k.tur, "red", tur);
    }
  });

  test("hedefDenetimi: ayrıştırılamayan ama üretimi içeren adres, ve NEXT_PUBLIC adresi üretim → kurulum/veri reddedilir", () => {
    const garip = `postgresql://postgres.${PROD}:x@beklenmedik-vekil.example.com:5432/postgres`;
    assert.equal(hedefDenetimi(["--tur", "sema-kurulumu"], { ...dogruEnv, SUPABASE_DB_URL: garip }).tur, "red");
    assert.equal(hedefDenetimi(["--tur", "sentetik-veri", "--ref", TEST_GERCEK], { ...dogruEnv, NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }).tur, "red");
  });

  test("hedefDenetimi: doğru yapılandırma ve test adresi → izin (kurulumun beklenen yolu)", () => {
    for (const adresi of [havuz(TEST_GERCEK), `postgresql://postgres.${TEST_GERCEK}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require`]) {
      const k = hedefDenetimi(["--tur", "sema-kurulumu"], { ...dogruEnv, SUPABASE_DB_URL: adresi });
      assert.equal(k.tur, "izin");
    }
  });

  /*
    Eskiden burada "önizleme tek proje beyanıyla üretime bağlanmaya devam
    eder" sabitleniyordu (05.11.2026 kararı). 11.11.2026'da (G1 Aşama 8.5D)
    beyan kaldırıldı ve uygulama kararı da sabit kimliği kullanıyor;
    üretimin kendi kararı aynı kaldı.
  */
  test("önizleme beyanla bile üretime bağlanamaz; üretimin kararı değişmedi", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: `https://${PROD}.supabase.co`, uretimRef: PROD, tekProje: "1" });
    assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli");
    const u = supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: `https://${PROD}.supabase.co`, uretimRef: PROD, testRef: TEST_GERCEK });
    assert.equal(u.tur === "izin" && u.hedef, "uretim");
  });
});

/*
  Kurulum ve sentetik veri betiklerinin (scripts/test-ortami) üretim adresiyle
  başlamadığını sınayan senaryolar o betiklerle birlikte G1 test ortamı dalında
  (entegrasyon/g1-tasarim) duruyor; bu dal o betikleri taşımıyor.
*/

/*
  BAĞIMSIZ ÜRETİM ENGELİ (G1 Aşama 8.5D, 11.11.2026). Eskiden üretim dışı
  karar yalnızca ortam değişkenlerine dayanıyordu: ARVOLAB_TEST_SUPABASE_REF
  üretim kimliğine yazılır ve adres de üretimi gösterirse "test projesi"
  sayılıp İZİN veriliyordu (ilk test bunu sabitliyor). Burada gerçek
  kimlikler kullanılıyor; uydurma kimliklerle sabit kimlik sınanamaz.
*/
describe("bağımsız üretim engeli: sabit üretim kimliği değişkenlerden bağımsız reddedilir", () => {
  const PROD = "zpfpocyajnxcketdjbxm";
  const TEST_GERCEK = "kyvjftrsweqjlgjeobnq";
  const BASKA_GERCEK = "dddddddddddddddddddd";
  const url = (ref: string) => `https://${ref}.supabase.co`;
  const ONIZLEME_DISI = ["preview", "development", null] as const;
  const dogru = { etiket: "test", uretimRef: PROD, testRef: TEST_GERCEK };

  test("doğru Test yapılandırması kabul edilir", () => {
    for (const vercelOrtami of ONIZLEME_DISI) {
      assert.deepEqual(supabaseOrtamKarari({ vercelOrtami, supabaseUrl: url(TEST_GERCEK), ...dogru }), { tur: "izin", ortam: "uretim-disi", hedef: "test" });
    }
  });

  test("test değişkenine üretim kimliği yazılır ve adres üretimi gösterirse ret (eskiden İZİN veriyordu)", () => {
    for (const vercelOrtami of ONIZLEME_DISI) {
      // Değişkenler tutarlı ama yanlış: üretim kimliği "test", başka bir kimlik "üretim" sanılıyor.
      const k = supabaseOrtamKarari({ vercelOrtami, supabaseUrl: url(PROD), etiket: "test", uretimRef: BASKA_GERCEK, testRef: PROD });
      assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli", String(vercelOrtami));
    }
  });

  test("test değişkenine üretim kimliği yazılırsa adres başka olsa da ret", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(TEST_GERCEK), etiket: "test", uretimRef: TEST_GERCEK, testRef: PROD });
    assert.equal(k.tur === "red" && k.neden, "test-kimligi-uretimi-gosteriyor");
    const kodlu = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(TEST_GERCEK), etiket: "test", uretimRef: BASKA_GERCEK, testRef: PROD.toUpperCase() });
    assert.equal(kodlu.tur, "red");
  });

  test("test etiketiyle üretim adresi verilirse ret", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(PROD), ...dogru });
    assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli");
  });

  test("üretim adresi: değişkenler eksik, boş ya da bozuk olsa da ret (fail-closed, en açık nedenle)", () => {
    for (const degiskenler of [{}, { etiket: "test" }, { uretimRef: "", testRef: "" }, { uretimRef: "bozuk", testRef: "x" }, { etiket: "uretim" }]) {
      const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(PROD), ...degiskenler });
      assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli", JSON.stringify(degiskenler));
    }
  });

  test("kaçış bayrağı açıkken üretim adresi verilirse ret", () => {
    for (const degiskenler of [{}, dogru, { uretimRef: PROD }, { etiket: "test", uretimRef: BASKA_GERCEK, testRef: PROD }]) {
      const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(PROD), ...degiskenler, tekProje: "1" });
      assert.equal(k.tur, "red", JSON.stringify(degiskenler));
    }
  });

  test("test ve üretim kimlikleri aynıysa ret", () => {
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(TEST_GERCEK), etiket: "test", uretimRef: TEST_GERCEK, testRef: TEST_GERCEK }).tur, "red");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(PROD), etiket: "test", uretimRef: PROD, testRef: PROD }).tur, "red");
  });

  test("eksik ya da geçersiz değişkenler test adresinde de fail-closed", () => {
    for (const eksik of [{ etiket: "" }, { uretimRef: "" }, { testRef: "" }, { etiket: "uretim" }, { testRef: "kisa" }]) {
      assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(TEST_GERCEK), ...dogru, ...eksik }).tur, "red", JSON.stringify(eksik));
    }
    for (const adres of [undefined, "", "http://zpfpocyajnxcketdjbxm.supabase.co", "https://example.com"]) {
      assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres, ...dogru }).tur, "red", String(adres));
    }
  });

  test("ret başka projeye geçmez; mesaj anahtar ya da adres içermez", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: url(PROD), ...dogru, tekProje: "1" });
    assert.equal(k.tur, "red");
    assert.ok(k.tur === "red" && !("hedef" in k));
    assert.ok(k.tur === "red" && !/https?:|supabase\.co|key|anahtar=/i.test(k.mesaj));
    // Doğrulayıcı fırlatır: çağıran istemci kurmadan durur.
    assert.throws(() => supabaseOrtaminiDogrula({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: url(PROD), ARVOLAB_SUPABASE_ORTAMI: "test", ARVOLAB_URETIM_SUPABASE_REF: BASKA_GERCEK, ARVOLAB_TEST_SUPABASE_REF: PROD }), SupabaseOrtamHatasi);
  });

  test("derleme anı ortamı preview, çalışma anı boşsa da engel uygulanır (sunucu, ara katman, yönetici)", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: null, derlemeOrtami: "preview", supabaseUrl: url(PROD), ...dogru, tekProje: "1" });
    assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli");
  });

  test("sahte önizleme (ARVOLAB_ONIZLEME=1) gerçek bağlantı kurmadığı için değişmedi", () => {
    assert.deepEqual(supabaseOrtamKarari({ vercelOrtami: "preview", onizleme: "1", supabaseUrl: url(PROD) }), { tur: "izin", ortam: "uretim-disi", hedef: "sahte" });
  });

  test("üretimin mevcut davranışı değişmedi", () => {
    // Doğru üretim yapılandırması: izin.
    assert.deepEqual(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: url(PROD), etiket: "uretim", uretimRef: PROD, testRef: TEST_GERCEK }), { tur: "izin", ortam: "uretim", hedef: "uretim" });
    // Bugünkü Production: ARVOLAB_* değişkenleri yok → bağlantı KESİLMEZ, yalnızca uyarı (geriye dönük uyumluluk, P1).
    const bugun = supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: url(PROD) });
    assert.equal(bugun.tur === "izin" && bugun.hedef, "uretim");
    assert.ok(bugun.tur === "izin" && bugun.uyari?.includes("ARVOLAB_URETIM_SUPABASE_REF"));
    // Derleme yedeğiyle de aynı.
    assert.equal(supabaseOrtamKarari({ vercelOrtami: null, derlemeOrtami: "production", supabaseUrl: url(PROD) }).tur, "izin");
    // Üretimin mevcut retleri aynı.
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: url(TEST_GERCEK), testRef: TEST_GERCEK }).tur, "red");
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: url(PROD), etiket: "test" }).tur, "red");
    // Üretim dalı sabit kimlik engeline girmez: test değişkeni yanlışlıkla üretim olsa bile üretimin kararı eskisi gibi.
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: url(PROD), testRef: PROD }).tur, "red");
    // Anahtar ayrımı üretimde her zaman izin.
    assert.deepEqual(anahtarAyrimiKarari({ VERCEL_ENV: "production", OPENAI_API_KEY: "x" }), { tur: "izin" });
  });

  test("dört istemci de aynı merkezi kararı kullanır (kaynak sözleşmesi)", () => {
    const dosyalar = {
      "lib/supabase/client.ts": /supabaseOrtaminiDogrula\(tarayiciOrtami\(\)\);\s*return createBrowserClient\(/,
      "lib/supabase/server.ts": /supabaseOrtaminiDogrula\(process\.env, process\.env\.ARVOLAB_DAGITIM_ORTAMI\);[\s\S]*return createServerClient\(/,
      "lib/supabase/admin.ts": /supabaseOrtaminiDogrula\(process\.env, process\.env\.ARVOLAB_DAGITIM_ORTAMI\);[\s\S]*return createClient\(url, secret/,
      "proxy.ts": /supabaseOrtamKarari\(ortamGirdisi\(process\.env, process\.env\.ARVOLAB_DAGITIM_ORTAMI\)\);\s*if \(ortamKarari\.tur === "red"\)[\s\S]*createServerClient\(/,
    };
    for (const [dosya, desen] of Object.entries(dosyalar)) assert.match(readFileSync(dosya, "utf8"), desen, dosya);
    // supabaseOrtaminiDogrula aynı kararı çağırır; ayrı bir kopya yok.
    const modul = readFileSync("lib/supabase/ortam-guvenligi.ts", "utf8");
    assert.match(modul, /export function supabaseOrtaminiDogrula[\s\S]*?supabaseOrtamKarari\(ortamGirdisi\(env, derlemeOrtami\)\)/);
    // Derleme anı da aynı kararı çağırır.
    assert.match(readFileSync("next.config.ts", "utf8"), /supabaseOrtamKarari\(ortamGirdisi\(process\.env\)\)/);
  });
});
