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
  supabaseOrtamKarari,
  supabaseOrtaminiDogrula,
  SupabaseOrtamHatasi,
  TEK_PROJE_UYARISI,
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
  TEK PROJE BEYANI (05.11.2026). Kurum sahibi ayrı test projesi açmamaya
  karar verdi; önizleme bilerek üretim projesine bağlanıyor. Beyan yalnızca
  adres TANIMLI üretim kimliğini gösteriyorsa geçerli; betik kuralları
  (şema kurulumu, sentetik veri) bundan etkilenmez.
*/
describe("tek proje beyanı (ARVOLAB_TEK_PROJE=1)", () => {
  test("Preview/Development/yerel: beyan + adres tanımlı üretim projesi → izin, uyarıyla", () => {
    for (const vercelOrtami of ["preview", "development", null]) {
      assert.deepEqual(supabaseOrtamKarari({ vercelOrtami, supabaseUrl: adres(URETIM), uretimRef: URETIM, tekProje: "1" }), {
        tur: "izin", ortam: "uretim-disi", hedef: "uretim", uyari: TEK_PROJE_UYARISI,
      });
    }
  });
  test("beyan yoksa ya da '1' değilse eski kural: üretime bağlantı reddedilir", () => {
    for (const tekProje of [undefined, "", "0", "evet"]) {
      const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(URETIM), uretimRef: URETIM, tekProje });
      assert.equal(k.tur === "red" && k.neden, "uretim-disi-uretime-bagli");
    }
  });
  test("beyan kimliği bilinmeyen ya da başka bir projeye izin VERMEZ", () => {
    // Üretim kimliği tanımlı değil: hangi projeye bağlanıldığı doğrulanamıyor.
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(URETIM), tekProje: "1" }).tur, "red");
    // Adres başka bir projeyi gösteriyor.
    const k = supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(BASKA), uretimRef: URETIM, tekProje: "1" });
    assert.equal(k.tur, "red");
    // Kimlik biçimi bozuk.
    assert.equal(supabaseOrtamKarari({ vercelOrtami: "preview", supabaseUrl: adres(URETIM), uretimRef: "kisa", tekProje: "1" }).tur, "red");
  });
  test("üretimde beyanın etkisi yok: kurallar aynı", () => {
    const k = supabaseOrtamKarari({ vercelOrtami: "production", supabaseUrl: adres(TEST), uretimRef: URETIM, testRef: TEST, tekProje: "1" });
    assert.equal(k.tur === "red" && k.neden, "uretim-test-projesine-bagli");
  });
  test("ortamGirdisi beyanı okur; tarayıcı paketine gömülür", () => {
    assert.equal(ortamGirdisi({ ARVOLAB_TEK_PROJE: "1" }).tekProje, "1");
    assert.ok(readFileSync("lib/supabase/client.ts", "utf8").includes("ARVOLAB_TEK_PROJE: process.env.ARVOLAB_TEK_PROJE"));
    assert.ok(/ARVOLAB_TEK_PROJE:\s*process\.env\.ARVOLAB_TEK_PROJE/.test(readFileSync("next.config.ts", "utf8")));
  });
  test("anahtar ayrımı: beyanla üretim anahtarları kabul edilir ama uyarı yazılır; beyansız ret sürer", () => {
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
