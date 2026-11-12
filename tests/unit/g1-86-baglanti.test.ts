import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import {
  devamBekleKur,
  epostaRolu,
  sentetikEposta,
  u2SifresiOku,
  U2_BEKLEME_SINIRI_MS,
  ACICI_DEGISKENLERI,
  aciciOrtami,
  dogrudanCalistirildiMi,
  sistemAcicisiKur,
  argumanlariCoz,
  baglantiKur,
  baglantiyiAc,
  IZINLI_KOKLER,
  VARSAYILAN_KOK,
  calistir,
  Dur,
  epostaGecerli,
  guvenliHata,
  hedefDenetle,
  hedefKullaniciDenetle,
  kimlikOzeti,
  TEST_REF,
  u1Epostasi,
  URETIM_REF,
} from "../../scripts/test-ortami/g1-86-baglanti.mjs";

/*
  G1 AŞAMA 8.6 TEST AUTH YARDIMCISI (scripts/test-ortami/g1-86-baglanti.mjs).
  Gerçek Supabase'e HİÇ bağlanılmaz: yönetim istemcisi sahtedir, anahtar
  ve belirteçler uydurmadır. Betik varsayılan olarak kuru kipte; burada
  hem kuru kipin hiçbir yan etki üretmediği hem de gerçek kipin kapıları
  ve kimlik denetimleri sabitleniyor.
*/

const URL_TEST = `https://${TEST_REF}.supabase.co`;
const URL_URETIM = `https://${URETIM_REF}.supabase.co`;
const SAHTE_ANAHTAR = "sb_secret_SAHTE-ANAHTAR-0123456789abcdef";
const SAHTE_TOKEN = "SAHTE-HASHED-TOKEN-zzzzzzzzzzzzzzzzzzzzzzzz";
const SAHTE_ACTION = `https://${TEST_REF}.supabase.co/auth/v1/verify?token=SAHTE-ACTION-TOKEN&type=signup`;
const SIMDI = new Date("2026-11-11T08:30:00.000Z");
const U1_EPOSTA = u1Epostasi(SIMDI);
const MEVCUT = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"];
const U1_ID = "99999999-9999-9999-9999-999999999999";

let dizin: string;
let kayitYolu: string;
beforeEach(() => {
  dizin = fs.mkdtempSync(path.join(os.tmpdir(), "g1-86-test-"));
  kayitYolu = path.join(dizin, "kayit.json");
});
afterEach(() => fs.rmSync(dizin, { recursive: true, force: true }));

type Kullanici = { id: string; email: string; created_at: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> };

/** Çağrıları kaydeden sahte yönetim istemcisi. Varsayılan: projede yalnızca MEVCUT kullanıcılar var. */
function sahteAdmin(
  ayar: {
    kullanicilar?: Kullanici[];
    olusturulan?: Partial<Kullanici>;
    hata?: Record<string, unknown>;
    silmeSonrasiVar?: boolean;
    silmeSonrasiHata?: Record<string, unknown>;
    /** Oluşturma isteği sunucuda işlenir (kullanıcı oluşur) ama yanıt istemciye ulaşmaz. */
    yanitKaybolur?: boolean;
    /** Oluşturma yanıtı kullanıcıyı eksik alanla döndürür (sunucuda kullanıcı yine eksiksiz). */
    yanitEksik?: (k: Kullanici) => Partial<Kullanici>;
    /** Silme çağrısı hata döndürür ama kullanıcı gerçekte silinir. */
    silmeYanitiHata?: Record<string, unknown>;
    /** Silme öncesi okuma belirsiz hata döndürür. */
    okumaHatasi?: Record<string, unknown>;
    /** listUsers hata döndürür. */
    listeHatasi?: Record<string, unknown>;
  } = {},
) {
  const cagrilar: { ad: string; arg: unknown }[] = [];
  const kullanicilar = new Map<string, Kullanici>((ayar.kullanicilar ?? MEVCUT.map((id) => ({ id, email: `gercek-${id.slice(0, 4)}@kurum.edu`, created_at: "2026-11-01T00:00:00Z" }))).map((k) => [k.id, k]));
  let silindi = false;
  const admin = {
    async listUsers(p: unknown) {
      cagrilar.push({ ad: "listUsers", arg: p });
      if (ayar.listeHatasi) return { data: null, error: ayar.listeHatasi };
      return { data: { users: [...kullanicilar.values()] }, error: null };
    },
    async generateLink(p: { type: string; email: string }) {
      cagrilar.push({ ad: "generateLink", arg: { type: p.type, email: p.email } });
      if (ayar.hata) return { data: null, error: ayar.hata };
      let user = [...kullanicilar.values()].find((k) => k.email === p.email);
      if (!user) {
        user = { id: U1_ID, email: p.email, created_at: SIMDI.toISOString(), email_confirmed_at: null, user_metadata: { g1_86: true }, ...ayar.olusturulan } as Kullanici;
        kullanicilar.set(user.id, user);
      }
      if (ayar.yanitKaybolur) throw Object.assign(new Error(`zaman aşımı ${SAHTE_TOKEN}`), { status: 504 });
      const donen = ayar.yanitEksik ? { ...user, ...ayar.yanitEksik(user) } : user;
      return { data: { user: donen, properties: { hashed_token: SAHTE_TOKEN, action_link: SAHTE_ACTION } }, error: null };
    },
    async getUserById(id: string) {
      cagrilar.push({ ad: "getUserById", arg: id });
      if (ayar.okumaHatasi && !silindi) return { data: { user: null }, error: ayar.okumaHatasi };
      if (silindi) return ayar.silmeSonrasiVar ? { data: { user: kullanicilar.get(id) }, error: null } : { data: { user: null }, error: ayar.silmeSonrasiHata ?? { code: "user_not_found", status: 404 } };
      const k = kullanicilar.get(id);
      return k ? { data: { user: k }, error: null } : { data: { user: null }, error: { code: "user_not_found", status: 404 } };
    },
    async deleteUser(id: string) {
      cagrilar.push({ ad: "deleteUser", arg: id });
      silindi = true;
      return { data: {}, error: ayar.silmeYanitiHata ?? null };
    },
  };
  return { admin, cagrilar, kullanicilar };
}

/** Bütün çıktıyı toplayan çalıştırma; sızıntı denetimi için. */
async function kos(argv: string[], ek: Record<string, unknown> = {}) {
  const satirlar: string[] = [];
  const acilan: string[] = [];
  const fabrika = { cagrildi: 0, anahtar: "" };
  const s = (ek.sahte as ReturnType<typeof sahteAdmin>) ?? sahteAdmin();
  const baslangic = s.cagrilar.length;
  const kod = await calistir(argv, {
    env: { NEXT_PUBLIC_SUPABASE_URL: URL_TEST, SUPABASE_SECRET_KEY: SAHTE_ANAHTAR, ...(ek.env as object) },
    cikti: (m: string) => satirlar.push(m),
    hataCikti: (m: string) => satirlar.push(m),
    simdi: SIMDI,
    kayitYolu,
    ac: async (l: string) => {
      acilan.push(l);
    },
    adminFabrikasi: async (_url: string, anahtar: string) => {
      fabrika.cagrildi++;
      fabrika.anahtar = anahtar;
      return s.admin;
    },
    ...((ek.secenek as object) ?? {}),
  });
  // Yalnızca BU koşuda yapılan çağrılar (aynı sahte istemci birden çok koşuda paylaşılabiliyor).
  return { kod, cikti: satirlar.join("\n"), acilan, fabrika, cagrilar: s.cagrilar.slice(baslangic), sahte: s };
}

/** Diskteki defter (imza doğrulanmadan; yalnızca test gözlemi). */
const defter = () => JSON.parse(fs.readFileSync(kayitYolu, "utf8"));

/* Betik JS olduğu için Dur'un tipi yok; instanceof daraltmıyor. */
function durMu(e: unknown, cikis: number, desen?: RegExp) {
  const d = e as { cikis?: number; message?: string };
  return e instanceof Dur && d.cikis === cikis && (!desen || desen.test(d.message ?? ""));
}

const SIRLAR = [SAHTE_ANAHTAR, SAHTE_TOKEN, SAHTE_ACTION, "SAHTE-ACTION-TOKEN", "token_hash"];
function sizintiYok(metin: string) {
  for (const sir of SIRLAR) assert.ok(!metin.includes(sir), `çıktıda gizli değer: ${sir.slice(0, 12)}…`);
}

describe("kuru kip (varsayılan)", () => {
  test("ağ isteği yok, anahtar okunmuyor, yönetim istemcisi kurulmuyor, tarayıcı açılmıyor, dosya yazılmıyor", async () => {
    const eskiFetch = globalThis.fetch;
    let fetchCagrisi = 0;
    globalThis.fetch = (() => {
      fetchCagrisi++;
      throw new Error("ağ yasak");
    }) as typeof fetch;
    const eskiIstek = http.request;
    let httpCagrisi = 0;
    (http as { request: unknown }).request = () => {
      httpCagrisi++;
      throw new Error("ağ yasak");
    };
    // Anahtarın OKUNMASINI yakalamak için ortam bir vekil.
    const okunan: string[] = [];
    const env = new Proxy({ NEXT_PUBLIC_SUPABASE_URL: URL_TEST, SUPABASE_SECRET_KEY: SAHTE_ANAHTAR } as Record<string, string>, {
      get(h, k) {
        okunan.push(String(k));
        return h[k as string];
      },
    });
    try {
      for (const argv of [[], ["plan"], ["olustur"], ["dogrulama"], ["kurtarma"], ["durum"], ["temizle"], ["plan", "--calistir"]]) {
        const satirlar: string[] = [];
        let fabrika = 0;
        let acildi = 0;
        const kod = await calistir(argv, {
          env,
          cikti: (m: string) => satirlar.push(m),
          hataCikti: (m: string) => satirlar.push(m),
          simdi: SIMDI,
          kayitYolu,
          ac: async () => {
            acildi++;
          },
          adminFabrikasi: async () => {
            fabrika++;
            throw new Error("kurulmamalı");
          },
        });
        assert.equal(kod, 0, argv.join(" "));
        assert.equal(fabrika, 0, `yönetim istemcisi kuruldu: ${argv.join(" ")}`);
        assert.equal(acildi, 0);
        assert.match(satirlar.join("\n"), /KURU KİP/);
        sizintiYok(satirlar.join("\n"));
      }
      assert.equal(fetchCagrisi, 0);
      assert.equal(httpCagrisi, 0);
      assert.ok(!okunan.includes("SUPABASE_SECRET_KEY"), "kuru kipte anahtar okundu");
      assert.equal(fs.existsSync(kayitYolu), false);
    } finally {
      globalThis.fetch = eskiFetch;
      (http as { request: unknown }).request = eskiIstek;
    }
  });
});

describe("hedef kapıları (ağsız, anahtardan önce)", () => {
  test("Test adresi kabul edilir; sondaki eğik çizgi tolere edilir", () => {
    assert.equal(hedefDenetle({ NEXT_PUBLIC_SUPABASE_URL: URL_TEST }), URL_TEST);
    assert.equal(hedefDenetle({ NEXT_PUBLIC_SUPABASE_URL: `${URL_TEST}/`, ARVOLAB_TEST_SUPABASE_REF: TEST_REF }), URL_TEST);
  });
  test("Production adresi her biçimde reddedilir (kaçış bayrağı ve yanlış değişkenlerle de)", () => {
    for (const env of [
      { NEXT_PUBLIC_SUPABASE_URL: URL_URETIM },
      { NEXT_PUBLIC_SUPABASE_URL: URL_URETIM, ARVOLAB_TEK_PROJE: "1" },
      { NEXT_PUBLIC_SUPABASE_URL: URL_URETIM, ARVOLAB_TEST_SUPABASE_REF: URETIM_REF, ARVOLAB_TEK_PROJE: "1" },
      { NEXT_PUBLIC_SUPABASE_URL: `https://${URETIM_REF.toUpperCase()}.supabase.co` },
      { NEXT_PUBLIC_SUPABASE_URL: URL_TEST, ARVOLAB_TEST_SUPABASE_REF: URETIM_REF },
    ]) {
      // Ret, sonraki "Test değil" kapısından değil, bağımsız üretim kapısından gelmeli (savunma derinliği sınansın).
      assert.throws(() => hedefDenetle(env), (e: unknown) => durMu(e, 2, /üretim projesini gösteriyor/), JSON.stringify(env));
    }
  });
  test("başka proje, yol eklenmiş adres, http ve boş adres reddedilir", () => {
    for (const url of ["https://cccccccccccccccccccc.supabase.co", `${URL_TEST}/rest/v1`, `http://${TEST_REF}.supabase.co`, "", "http://127.0.0.1:54321", `https://${TEST_REF}.supabase.co.kotu.example`]) {
      assert.throws(() => hedefDenetle({ NEXT_PUBLIC_SUPABASE_URL: url }), Dur, url);
    }
    assert.throws(() => hedefDenetle({ NEXT_PUBLIC_SUPABASE_URL: URL_TEST, ARVOLAB_TEST_SUPABASE_REF: "cccccccccccccccccccc" }), Dur);
  });
  test("ARVOLAB_TEK_PROJE kaynakta hiç okunmuyor", () => {
    const kaynak = fs.readFileSync("scripts/test-ortami/g1-86-baglanti.mjs", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(!kaynak.includes("TEK_PROJE"));
  });
  test("gerçek kipte de kapı reddi anahtar okunmadan ve istemci kurulmadan çıkış 2 verir", async () => {
    const r = await kos(["olustur", "--calistir"], { env: { NEXT_PUBLIC_SUPABASE_URL: URL_URETIM, ARVOLAB_TEK_PROJE: "1" } });
    assert.equal(r.kod, 2);
    assert.equal(r.fabrika.cagrildi, 0);
    assert.equal(r.cagrilar.length, 0);
    sizintiYok(r.cikti);
  });
  test("bağlantı kökü yalnızca izinli liste; bilinmeyen argüman reddedilir", () => {
    assert.equal(argumanlariCoz([]).islem, "plan");
    assert.equal(argumanlariCoz(["olustur", "--calistir"]).calistir, true);
    assert.equal(argumanlariCoz(["plan", "--calistir"]).calistir, false);
    assert.equal(argumanlariCoz(["--origin=http://localhost:3000"]).kok, "http://localhost:3000");
    for (const argv of [["--origin=https://kotu.example"], ["--origin=https://arvo-lab-git-entegrasyon-g1-tasarim-arvo-os.vercel.app.kotu.example"], ["sil"], ["olustur", "temizle"], ["--anahtar=x"]]) {
      assert.throws(() => argumanlariCoz(argv), Dur, argv.join(" "));
    }
  });
  test("G1-D: izinli kökler tam olarak üç; yalnızca g1d Preview'u eklendi, varsayılan değişmedi", () => {
    const G1D = "https://arvo-lab-git-g1d-sifre-politikasi-arvo-os.vercel.app";
    assert.deepEqual(IZINLI_KOKLER, ["https://arvo-lab-git-entegrasyon-g1-tasarim-arvo-os.vercel.app", "http://localhost:3000", G1D]);
    assert.equal(VARSAYILAN_KOK, "https://arvo-lab-git-entegrasyon-g1-tasarim-arvo-os.vercel.app");
    assert.equal(argumanlariCoz([]).kok, VARSAYILAN_KOK);
    assert.equal(argumanlariCoz(["kurtarma", `--origin=${G1D}`]).kok, G1D);
    // Üretim adresi ve alan adı yok; her kök ya yerel ya da arvo-os ekibinin Vercel Preview'u.
    for (const k of IZINLI_KOKLER) {
      const u = new URL(k);
      assert.ok(u.hostname === "localhost" || (u.protocol === "https:" && /^arvo-lab-git-[a-z0-9-]+-arvo-os\.vercel\.app$/.test(u.hostname)), k);
      assert.notEqual(u.hostname, "lab.arvo-os.com");
      assert.equal(u.pathname, "/");
    }
    // Birebir eşleşme: benzer, uzatılmış, yollu, eğik çizgili, http ve başka dal adresleri reddedilir.
    for (const kotu of [
      `${G1D}/`,
      `${G1D}/auth`,
      `${G1D}.kotu.example`,
      G1D.replace("https://", "http://"),
      G1D.replace("arvo-os.vercel.app", "arvo-os.vercel.app:8443"),
      "https://arvo-lab-git-g1d-sifre-politikasi-baska-arvo-os.vercel.app",
      "https://arvo-lab-git-main-arvo-os.vercel.app",
      "https://arvo-1ru0f9owj-arvo-os.vercel.app",
      "https://lab.arvo-os.com",
      "https://arvo-lab.vercel.app",
    ]) {
      assert.throws(() => argumanlariCoz(["kurtarma", `--origin=${kotu}`]), Dur, kotu);
    }
  });
  test("G1-D: g1d kökünde kurtarma bağlantısı aynı kökte kalır ve yalnızca /reset-password'e gider", () => {
    const G1D = "https://arvo-lab-git-g1d-sifre-politikasi-arvo-os.vercel.app";
    const u = new URL(baglantiKur(G1D, SAHTE_TOKEN, "recovery"));
    assert.equal(u.origin, G1D);
    assert.equal(u.pathname, "/auth/confirm");
    assert.equal(u.searchParams.get("type"), "recovery");
    assert.equal(u.searchParams.get("next"), "/reset-password");
    assert.equal(u.searchParams.get("token_hash"), SAHTE_TOKEN);
    assert.deepEqual([...u.searchParams.keys()].sort(), ["next", "token_hash", "type"]);
  });
  test("anahtar: publishable ve başka projeye ait JWT reddedilir; eksikse ret", async () => {
    const jwt = (yuk: object) => `x.${Buffer.from(JSON.stringify(yuk)).toString("base64url")}.y`;
    for (const anahtar of ["", "sb_publishable_abc", jwt({ ref: URETIM_REF, role: "service_role" }), jwt({ ref: TEST_REF, role: "anon" })]) {
      const r = await kos(["durum", "--calistir"], { env: { SUPABASE_SECRET_KEY: anahtar } });
      assert.equal(r.kod, 2, anahtar.slice(0, 20));
      assert.equal(r.fabrika.cagrildi, 0);
    }
  });
});

describe("sentetik e-posta", () => {
  /* G1-B (8.6B.7): u2 de geçerli rol oldu; eskiden yalnızca u1 kabul ediliyordu. */
  test("yalnızca arvolab-g1-86-(u1|u2)-<12 hane>@example.com", () => {
    assert.equal(U1_EPOSTA, "arvolab-g1-86-u1-202611110830@example.com");
    assert.ok(epostaGecerli(U1_EPOSTA));
    assert.ok(epostaGecerli("arvolab-g1-86-u2-202611110830@example.com"));
    for (const e of ["", "arvolab-test-d@example.com", "arvolab-g1-86-u3-202611110830@example.com", "arvolab-g1-86-u1-202611110830@example.org", "ARVOLAB-G1-86-U1-202611110830@example.com", "arvolab-g1-86-u1-2026111108@example.com", "x+arvolab-g1-86-u1-202611110830@example.com", undefined]) {
      assert.equal(epostaGecerli(e), false, String(e));
    }
  });
});

describe("oluşturma ve kayıt defteri", () => {
  test("U1 oluşturulur, kayıt defteri bağlantıdan ÖNCE yazılır (0600), mevcut kimliklerin yalnızca özeti tutulur", async () => {
    let defterVardi = false;
    const r = await kos(["olustur", "--calistir"], {
      secenek: {
        ac: async () => {
          defterVardi = fs.existsSync(kayitYolu);
        },
      },
    });
    assert.equal(r.kod, 0, r.cikti);
    assert.equal(r.fabrika.anahtar, SAHTE_ANAHTAR);
    assert.ok(defterVardi, "kayıt defteri bağlantı açılmadan önce yazılmalı");
    const kayit = JSON.parse(fs.readFileSync(kayitYolu, "utf8"));
    assert.equal(kayit.userId, U1_ID);
    assert.equal(kayit.eposta, U1_EPOSTA);
    assert.equal(kayit.proje, TEST_REF);
    assert.deepEqual(kayit.korunanOzetler.sort(), MEVCUT.map(kimlikOzeti).sort());
    const ham = fs.readFileSync(kayitYolu, "utf8");
    for (const id of MEVCUT) assert.ok(!ham.includes(id), "mevcut kimlik ham yazılmamalı");
    assert.ok(!ham.includes("@kurum.edu"), "mevcut kullanıcının e-postası yazılmamalı");
    sizintiYok(ham);
    assert.equal((fs.statSync(kayitYolu).mode & 0o777).toString(8), "600");
    // Yönetim çağrıları: önce liste, sonra tek generateLink (signup, U1 adresi).
    assert.deepEqual(r.cagrilar.map((c) => c.ad), ["listUsers", "generateLink"]);
    assert.deepEqual(r.cagrilar[1].arg, { type: "signup", email: U1_EPOSTA });
  });
  test("açılan bağlantı uygulamanın biçiminde; çıktıya hiçbir belirteç ya da bağlantı yazılmaz", async () => {
    const r = await kos(["olustur", "--calistir"]);
    assert.equal(r.acilan.length, 1);
    const u = new URL(r.acilan[0]);
    assert.equal(u.origin, "https://arvo-lab-git-entegrasyon-g1-tasarim-arvo-os.vercel.app");
    assert.equal(u.pathname, "/auth/confirm");
    assert.equal(u.searchParams.get("type"), "signup");
    assert.equal(u.searchParams.get("next"), "/reset-password?ilk=1");
    assert.equal(u.searchParams.get("token_hash"), SAHTE_TOKEN);
    sizintiYok(r.cikti);
    assert.ok(!r.cikti.includes(r.acilan[0]));
  });
  test("kayıt defterinde U1 varken ikinci oluşturma reddedilir, hiçbir çağrı yapılmaz", async () => {
    await kos(["olustur", "--calistir"]);
    const r = await kos(["olustur", "--calistir"]);
    assert.equal(r.kod, 2);
    assert.equal(r.cagrilar.length, 0);
  });
  /*
    Eskiden bu üç senaryo "kayıt defteri yazılmaz" bekliyordu: defter ancak
    doğrulanmış yanıttan SONRA yazılıyordu ve arada izi olmayan kullanıcı
    kalabiliyordu. Artık önce NİYET yazılıyor; doğrulanamayan her yanıt
    defteri "olusturuluyor" bırakıyor ve `uzlastir` çözüyor.
  */
  test("adres zaten varsa (dönen kullanıcı mevcut kimlik) bağlantı açılmaz; defter niyet durumunda kalır", async () => {
    const sahte = sahteAdmin({ kullanicilar: [{ id: MEVCUT[0], email: U1_EPOSTA, created_at: "2026-11-01T00:00:00Z", user_metadata: {} }] });
    const r = await kos(["olustur", "--calistir"], { sahte });
    assert.equal(r.kod, 1);
    assert.equal(r.acilan.length, 0);
    assert.equal(defter().durum, "olusturuluyor");
    assert.equal(defter().userId, null);
  });
  test("dönen kullanıcı eski tarihliyse, işaretsizse ya da e-postası farklıysa bağlantı açılmaz; defter niyette kalır", async () => {
    for (const olusturulan of [{ created_at: "2026-10-01T00:00:00Z" }, { user_metadata: {} }, { email: "baska@example.com" }]) {
      const r = await kos(["olustur", "--calistir"], { sahte: sahteAdmin({ olusturulan }) });
      assert.equal(r.kod, 1, JSON.stringify(olusturulan));
      assert.equal(r.acilan.length, 0);
      assert.equal(defter().durum, "olusturuluyor");
      fs.rmSync(kayitYolu);
    }
  });
  test("işlem başarısızlığında güvenli durur: yalnızca kod ve HTTP durumu yazılır", async () => {
    const hata = { code: "email_exists", status: 422, message: `Ayrıntı ${SAHTE_TOKEN} ${SAHTE_ANAHTAR}`, body: SAHTE_ACTION };
    const r = await kos(["olustur", "--calistir"], { sahte: sahteAdmin({ hata }) });
    assert.equal(r.kod, 1);
    assert.match(r.cikti, /kod=email_exists http=422/);
    sizintiYok(r.cikti);
    assert.equal(r.acilan.length, 0);
    assert.equal(defter().durum, "olusturuluyor");
  });
  test("beklenmeyen istisna ayrıntısız yakalanır", async () => {
    const r = await kos(["olustur", "--calistir"], {
      secenek: {
        adminFabrikasi: async () => {
          throw new Error(`patladı ${SAHTE_ANAHTAR} ${SAHTE_TOKEN}`);
        },
      },
    });
    assert.equal(r.kod, 1);
    sizintiYok(r.cikti);
  });
  test("guvenliHata: kod biçimi denetlenir, mesaj ve gövde atılır", () => {
    assert.equal(guvenliHata({ code: "user_not_found", status: 404, message: "gizli" }), "kod=user_not_found http=404");
    assert.equal(guvenliHata({ code: `kotu ${SAHTE_TOKEN}`, status: "500" }), "kod=bilinmiyor http=-");
    assert.equal(guvenliHata(null), "kod=bilinmiyor http=-");
  });
});

describe("bağlantı işlemleri yalnızca U1 için", () => {
  test("kurtarma: onaysız U1'de reddedilir; onaylı U1'de recovery bağlantısı açılır", async () => {
    const s = sahteAdmin();
    await kos(["olustur", "--calistir"], { sahte: s });
    let r = await kos(["kurtarma", "--calistir"], { sahte: s });
    assert.equal(r.kod, 2);
    s.kullanicilar.get(U1_ID)!.email_confirmed_at = "2026-11-11T08:31:00Z";
    r = await kos(["kurtarma", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    assert.equal(new URL(r.acilan[0]).searchParams.get("type"), "recovery");
    assert.equal(new URL(r.acilan[0]).searchParams.get("next"), "/reset-password");
    sizintiYok(r.cikti);
    r = await kos(["dogrulama", "--calistir"], { sahte: s });
    assert.equal(r.kod, 2, "onaylı U1 için kayıt bağlantısı üretilmemeli");
  });
  test("kayıt defteri yoksa bağlantı, durum ve silme reddedilir; hiçbir yönetim çağrısı yapılmaz", async () => {
    for (const islem of ["dogrulama", "kurtarma", "durum", "temizle"]) {
      const r = await kos([islem, "--calistir"]);
      assert.equal(r.kod, 2, islem);
      assert.equal(r.cagrilar.length, 0, islem);
    }
  });
  test("kayıt defteri mevcut bir kullanıcıyı gösterirse (elle değiştirilmiş) hiçbir işlem yapılmaz", async () => {
    const s = sahteAdmin();
    await kos(["olustur", "--calistir"], { sahte: s });
    const kayit = JSON.parse(fs.readFileSync(kayitYolu, "utf8"));
    fs.writeFileSync(kayitYolu, JSON.stringify({ ...kayit, userId: MEVCUT[0] }));
    for (const islem of ["kurtarma", "dogrulama", "temizle"]) {
      const r = await kos([islem, "--calistir"], { sahte: s });
      assert.notEqual(r.kod, 0, islem);
      assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser" || c.ad === "generateLink"), islem);
    }
  });
});

describe("silme yalnızca kayıt defterindeki U1", () => {
  test("yetkili silme: kimlik ve e-posta yeniden doğrulanır, silinir, kayıt defteri arşivlenir", async () => {
    const s = sahteAdmin();
    await kos(["olustur", "--calistir"], { sahte: s });
    const r = await kos(["temizle", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    assert.deepEqual(r.cagrilar.map((c) => c.ad), ["getUserById", "deleteUser", "getUserById"]);
    assert.equal(r.cagrilar[1].arg, U1_ID);
    assert.equal(fs.existsSync(kayitYolu), false);
    assert.ok(fs.readdirSync(dizin).some((f) => f.startsWith("kayit.json.silindi-")));
  });
  test("yetkisiz silme reddedilir: e-posta, işaret, zaman ya da kimlik uyuşmazlığında deleteUser çağrılmaz", async () => {
    const bozucular: ((k: Kullanici) => void)[] = [
      (k) => (k.email = "baska@example.com"),
      (k) => (k.user_metadata = {}),
      (k) => (k.created_at = "2026-11-11T08:00:00Z"),
      (k) => (k.email = "arvolab-g1-86-u1-209912312359@example.com"),
    ];
    for (const boz of bozucular) {
      const s = sahteAdmin();
      await kos(["olustur", "--calistir"], { sahte: s });
      boz(s.kullanicilar.get(U1_ID)!);
      const r = await kos(["temizle", "--calistir"], { sahte: s });
      assert.notEqual(r.kod, 0);
      assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser"));
      assert.ok(fs.existsSync(kayitYolu), "kayıt defteri korunmalı");
      fs.rmSync(kayitYolu);
    }
  });
  test("silme doğrulanamazsa (kullanıcı hâlâ var ya da belirsiz hata) kayıt defteri korunur", async () => {
    for (const ayar of [{ silmeSonrasiVar: true }, { silmeSonrasiHata: { code: "unexpected_failure", status: 500 } }]) {
      const s = sahteAdmin(ayar);
      await kos(["olustur", "--calistir"], { sahte: s });
      const r = await kos(["temizle", "--calistir"], { sahte: s });
      assert.equal(r.kod, 1, JSON.stringify(ayar));
      assert.ok(fs.existsSync(kayitYolu));
      fs.rmSync(kayitYolu);
    }
  });
  test("hedefKullaniciDenetle: korunan özetteki kimlik her durumda reddedilir", () => {
    const kayit = { surum: 2 as const, proje: TEST_REF, durum: "olusturuldu" as const, niyetZamani: "t", imza: "0".repeat(64), userId: MEVCUT[0], eposta: U1_EPOSTA, olusturuldu: "t", korunanOzetler: [kimlikOzeti(MEVCUT[0])] };
    assert.throws(() => hedefKullaniciDenetle(kayit, { id: MEVCUT[0], email: U1_EPOSTA, created_at: "t", user_metadata: { g1_86: true } }), /var olan/);
    assert.throws(() => hedefKullaniciDenetle(null, { id: U1_ID }), /Kayıt defteri yok/);
  });
  test("bozuk kayıt defteri: işlem yapılmaz", async () => {
    fs.writeFileSync(kayitYolu, "{bozuk");
    const r = await kos(["temizle", "--calistir"]);
    assert.equal(r.kod, 1);
    assert.equal(r.cagrilar.length, 0);
  });
});

describe("durum", () => {
  test("onay durumunu yazar; şifre için yalnızca salt okunur SQL önerir (şifre karmaşası seçilmez)", async () => {
    const s = sahteAdmin();
    await kos(["olustur", "--calistir"], { sahte: s });
    const r = await kos(["durum", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0);
    assert.match(r.cikti, /onaylı\s+: hayır/);
    assert.match(r.cikti, /select id, email_confirmed_at is not null as onayli, encrypted_password is null/);
    assert.ok(!/select[^;]*\bencrypted_password\s*,/.test(r.cikti));
    assert.deepEqual(r.cagrilar.map((c) => c.ad), ["getUserById"]);
    sizintiYok(r.cikti);
  });
});

describe("tarayıcıya teslim: tek kullanımlık yerel yönlendirme", () => {
  test("açıcıya yalnızca 127.0.0.1 adresi gider; yönlendirme bir kez çalışır, sonra 404", async () => {
    const hedef = `https://ornek.invalid/auth/confirm?token_hash=${SAHTE_TOKEN}&type=signup`;
    let verilen = "";
    const yanitlar: { durum: number; konum?: string; onbellek?: string; referrer?: string }[] = [];
    const al = (adres: string) =>
      new Promise<void>((coz, red) => {
        http
          .get(adres, (y) => {
            yanitlar.push({ durum: y.statusCode ?? 0, konum: y.headers.location, onbellek: y.headers["cache-control"], referrer: y.headers["referrer-policy"] as string | undefined });
            y.resume();
            y.on("end", coz);
          })
          .on("error", red);
      });
    await baglantiyiAc(hedef, {
      acici: async (adres: string) => {
        verilen = adres;
        await al(`${adres}x`); // yanlış yol
        await al(adres); // tek geçerli istek
      },
      bekleme: 5000,
    });
    assert.match(verilen, /^http:\/\/127\.0\.0\.1:\d+\/[A-Za-z0-9_-]{32}$/);
    assert.ok(!verilen.includes(SAHTE_TOKEN));
    assert.equal(yanitlar[0].durum, 404);
    assert.equal(yanitlar[1].durum, 302);
    assert.equal(yanitlar[1].konum, hedef);
    assert.equal(yanitlar[1].onbellek, "no-store");
    assert.equal(yanitlar[1].referrer, "no-referrer");
    // Sunucu kapandı: ikinci kullanım mümkün değil.
    await assert.rejects(al(verilen));
  });
  test("tarayıcı süresinde açmazsa güvenli durur", async () => {
    await assert.rejects(baglantiyiAc("https://ornek.invalid/x", { acici: async () => {}, bekleme: 50 }), (e: unknown) => durMu(e, 1));
  });
});

describe("kaynak sözleşmesi", () => {
  const kaynak = fs.readFileSync("scripts/test-ortami/g1-86-baglanti.mjs", "utf8");
  const kod = kaynak.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  test("yalnızca beş yönetim çağrısı türü var; başka auth.admin yöntemi kullanılmıyor", () => {
    const yontemler = new Set([...kod.matchAll(/auth\.admin\.(\w+)/g)].map((m) => m[1]));
    assert.deepEqual([...yontemler].sort(), ["deleteUser", "generateLink", "getUserById", "listUsers"]);
    const turler = new Set([...kod.matchAll(/type: "(\w+)"/g)].map((m) => m[1]));
    assert.deepEqual([...turler].sort(), ["recovery", "signup"]);
  });
  test("konsola ya da dosyaya belirteç/bağlantı yazan bir satır yok", () => {
    // Dizge içerikleri boşaltılır (Türkçe metindeki "anahtar" sözcüğü değişken değildir); ${…} ifadeleri korunur.
    const ifadeler = (satir: string) =>
      satir
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\$]|\\.|\$(?!\{))*/g, "`")
        .replace(/\}(?:[^`\\$]|\\.|\$(?!\{))*`/g, "}`");
    for (const satir of kod.split("\n")) {
      if (/cikti\(|console\.|writeFileSync|hataCikti\(/.test(satir)) {
        assert.ok(!/hashed_token|action_link|\bbaglanti\b|\banahtar\b|SUPABASE_SECRET_KEY|properties/.test(ifadeler(satir)), satir.trim());
      }
    }
  });
  test("anahtar yalnızca ortam değişkeninden; supabase-js yalnızca gerçek kipte, dinamik olarak yükleniyor", () => {
    assert.match(kod, /env\.SUPABASE_SECRET_KEY/);
    assert.ok(!/process\.argv[^\n]*SECRET|--anahtar|readFileSync\([^)]*key/i.test(kod));
    assert.ok(!/^import[^\n]*@supabase\/supabase-js/m.test(kod));
    assert.match(kod, /await import\("@supabase\/supabase-js"\)/);
  });
  test("Test kimliği koda gömülü; Production kimliği ortak sabitten", () => {
    assert.match(kaynak, /export const TEST_REF = "kyvjftrsweqjlgjeobnq";/);
    assert.equal(URETIM_REF, "zpfpocyajnxcketdjbxm");
  });
});

/*
  YETİM KULLANICI VE DEFTER BÜTÜNLÜĞÜ (G1 Aşama 8.6B.0, commit öncesi
  düzeltmeler). Gerçek Supabase yok: sahte istemci sunucu tarafını taklit
  ediyor (kullanıcı oluşur ama yanıt kaybolur, yanıt eksik gelir vb.).
*/
describe("yetim kullanıcı riski: niyet önce yazılır, uzlaştırma hiçbir şey silmez", () => {
  test("niyet, oluşturma çağrısından ÖNCE yazılır; niyet yazılamazsa hiçbir kullanıcı oluşturulmaz", async () => {
    // Defter yolunu yazılamaz bir yere çevir: dizin değil dosya.
    const engel = path.join(dizin, "engel");
    fs.writeFileSync(engel, "x");
    const r = await kos(["olustur", "--calistir"], { secenek: { kayitYolu: path.join(engel, "kayit.json") } });
    assert.notEqual(r.kod, 0);
    assert.ok(!r.cagrilar.some((c) => c.ad === "generateLink"), "niyet yazılamadan kullanıcı oluşturuldu");
    sizintiYok(r.cikti);
  });

  test("kullanıcı oluştu, created_at eksik → bağlantı açılmaz, defter niyette; uzlaştırma kullanıcıyı bulur ve bağlar", async () => {
    const s = sahteAdmin({ yanitEksik: () => ({ created_at: undefined as unknown as string }) });
    let r = await kos(["olustur", "--calistir"], { sahte: s });
    assert.equal(r.kod, 1);
    assert.match(r.cikti, /oluşturulma zamanı yok/);
    assert.equal(r.acilan.length, 0);
    assert.equal(defter().durum, "olusturuluyor");
    r = await kos(["uzlastir", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    assert.equal(defter().durum, "olusturuldu");
    assert.equal(defter().userId, U1_ID);
    assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser" || c.ad === "generateLink"), "uzlaştırma silmemeli ve bağlantı üretmemeli");
    assert.equal(r.acilan.length, 0);
  });

  test("kullanıcı oluştu, kayıt defterinin ikinci yazımı başarısız → yeniden çalıştırmada uzlaştırma çözer", async () => {
    const s = sahteAdmin();
    let yazim = 0;
    const gercekRename = fs.renameSync;
    // İkinci defter yazımı (kimliği bağlayan) düşsün: niyet diskte kalır.
    (fs as { renameSync: unknown }).renameSync = (a: string, b: string) => {
      if (String(b) === kayitYolu && ++yazim === 2) throw Object.assign(new Error("disk dolu"), { code: "ENOSPC" });
      return gercekRename(a, b);
    };
    let r;
    try {
      r = await kos(["olustur", "--calistir"], { sahte: s });
    } finally {
      (fs as { renameSync: unknown }).renameSync = gercekRename;
    }
    assert.equal(r.kod, 1);
    assert.equal(r.acilan.length, 0, "kimlik deftere bağlanmadan bağlantı açılmamalı");
    assert.equal(defter().durum, "olusturuluyor");
    r = await kos(["uzlastir", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    assert.equal(defter().userId, U1_ID);
  });

  test("kullanıcı oluştu, tarayıcı açılamadı → defter 'olusturuldu'; temizle ve dogrulama çalışır", async () => {
    const s = sahteAdmin();
    let r = await kos(["olustur", "--calistir"], {
      sahte: s,
      secenek: {
        ac: async () => {
          throw new Dur("Tarayıcı açılamadı.", 1);
        },
      },
    });
    assert.equal(r.kod, 1);
    assert.equal(defter().durum, "olusturuldu");
    r = await kos(["dogrulama", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    r = await kos(["temizle", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
  });

  test("işlem kesildi (yanıt kayboldu), yeniden çalıştırıldı: olustur reddeder, uzlastir çözer, sonra temizle", async () => {
    const s = sahteAdmin({ yanitKaybolur: true });
    let r = await kos(["olustur", "--calistir"], { sahte: s });
    assert.equal(r.kod, 1);
    assert.match(r.cikti, /uzlastir/);
    sizintiYok(r.cikti);
    r = await kos(["olustur", "--calistir"], { sahte: s });
    assert.equal(r.kod, 2, "yarım koşu varken ikinci kullanıcı oluşturulmamalı");
    assert.equal(r.cagrilar.length, 0);
    r = await kos(["temizle", "--calistir"], { sahte: s });
    assert.equal(r.kod, 2, "niyet durumunda silme yok");
    r = await kos(["uzlastir", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    r = await kos(["temizle", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    assert.equal(s.kullanicilar.has(U1_ID), true, "sahte kullanıcı kaydı korunur; silme çağrısı yapılmış olmalı");
    assert.ok(r.cagrilar.some((c) => c.ad === "deleteUser" && c.arg === U1_ID));
  });

  test("oluşturma hiç gerçekleşmediyse uzlaştırma defteri 'olusmadi' olarak arşivler; yeniden olustur mümkün", async () => {
    const s = sahteAdmin({ hata: { code: "unexpected_failure", status: 500 } });
    let r = await kos(["olustur", "--calistir"], { sahte: s });
    assert.equal(r.kod, 1);
    r = await kos(["uzlastir", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    assert.equal(fs.existsSync(kayitYolu), false);
    assert.ok(fs.readdirSync(dizin).some((f) => f.startsWith("kayit.json.olusmadi-")));
    r = await kos(["olustur", "--calistir"]);
    assert.equal(r.kod, 0, r.cikti);
  });

  test("belirsiz uzlaştırma: hiçbir şey silinmez, defter değişmez", async () => {
    const vakalar: { ad: string; kur: (s: ReturnType<typeof sahteAdmin>) => void }[] = [
      { ad: "işaretsiz", kur: (s) => (s.kullanicilar.get(U1_ID)!.user_metadata = {}) },
      { ad: "niyetten önce oluşmuş", kur: (s) => (s.kullanicilar.get(U1_ID)!.created_at = "2026-11-01T00:00:00Z") },
      { ad: "zamansız", kur: (s) => (s.kullanicilar.get(U1_ID)!.created_at = undefined as unknown as string) },
      { ad: "aynı e-postayla iki kullanıcı", kur: (s) => s.kullanicilar.set("88888888-8888-8888-8888-888888888888", { ...s.kullanicilar.get(U1_ID)!, id: "88888888-8888-8888-8888-888888888888" }) },
      { ad: "başlangıç kümesindeki kimlik", kur: (s) => { const u = s.kullanicilar.get(U1_ID)!; s.kullanicilar.delete(U1_ID); s.kullanicilar.set(MEVCUT[0], { ...u, id: MEVCUT[0] }); } },
    ];
    for (const v of vakalar) {
      const s = sahteAdmin({ yanitKaybolur: true });
      await kos(["olustur", "--calistir"], { sahte: s });
      v.kur(s);
      const once = fs.readFileSync(kayitYolu, "utf8");
      const r = await kos(["uzlastir", "--calistir"], { sahte: s });
      assert.equal(r.kod, 1, v.ad);
      assert.match(r.cikti, /Belirsiz/, v.ad);
      assert.equal(fs.readFileSync(kayitYolu, "utf8"), once, `${v.ad}: defter değişmemeli`);
      assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser" || c.ad === "generateLink"), v.ad);
      fs.rmSync(kayitYolu);
    }
  });

  test("yönetim API'si belirsiz yanıt verdi: liste hatası, okuma hatası, silme hatası → silinmiş sayılmaz, defter korunur", async () => {
    // Liste hatası: uzlaştırma defteri değiştirmez.
    let s = sahteAdmin({ yanitKaybolur: true });
    await kos(["olustur", "--calistir"], { sahte: s });
    const once = fs.readFileSync(kayitYolu, "utf8");
    let r = await kos(["uzlastir", "--calistir"], { sahte: sahteAdmin({ listeHatasi: { code: "unexpected_failure", status: 500 } }) });
    assert.equal(r.kod, 1);
    assert.equal(fs.readFileSync(kayitYolu, "utf8"), once);
    fs.rmSync(kayitYolu);
    // Silme öncesi belirsiz okuma: silme çağrılmaz.
    s = sahteAdmin();
    await kos(["olustur", "--calistir"], { sahte: s });
    r = await kos(["temizle", "--calistir"], { sahte: sahteAdmin({ kullanicilar: [...s.kullanicilar.values()], okumaHatasi: { code: "unexpected_failure", status: 500 } }) });
    assert.equal(r.kod, 1);
    assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser"));
    assert.equal(defter().durum, "olusturuldu");
    fs.rmSync(kayitYolu);
    // Silme hata döndürdü ama kullanıcı gerçekte silindi: defter korunur; tekrar temizle silmeyi ÇAĞIRMADAN kapatır.
    s = sahteAdmin({ silmeYanitiHata: { code: "unexpected_failure", status: 502 } });
    await kos(["olustur", "--calistir"], { sahte: s });
    r = await kos(["temizle", "--calistir"], { sahte: s });
    assert.equal(r.kod, 1);
    assert.equal(defter().durum, "olusturuldu");
    r = await kos(["temizle", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser"), "zaten silinmiş kullanıcı için silme yeniden çağrılmamalı");
    assert.ok(fs.readdirSync(dizin).some((f) => f.startsWith("kayit.json.zaten-yoktu-")));
  });
});

describe("kayıt defteri bütünlüğü (imza + canlı doğrulama)", () => {
  async function olusturulmus() {
    const s = sahteAdmin();
    const r = await kos(["olustur", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0, r.cikti);
    return s;
  }
  test("defter alanları: kimlik, sentetik e-posta, oluşturulma zamanı, niyet zamanı, başlangıç kümesi, durum ve imza", async () => {
    await olusturulmus();
    const d = defter();
    assert.deepEqual(Object.keys(d).sort(), ["durum", "eposta", "imza", "korunanOzetler", "niyetZamani", "olusturuldu", "proje", "surum", "userId"].sort());
    assert.equal(d.surum, 2);
    assert.equal(d.durum, "olusturuldu");
    assert.match(d.imza, /^[0-9a-f]{64}$/);
    sizintiYok(JSON.stringify(d));
  });
  test("elle değiştirilen her alan imzayı bozar: hiçbir işlem yapılmaz", async () => {
    const degisiklikler: Record<string, unknown>[] = [
      { userId: MEVCUT[0] },
      { userId: "77777777-7777-7777-7777-777777777777" },
      { eposta: "arvolab-g1-86-u1-209912312359@example.com" },
      { olusturuldu: "2026-11-11T08:31:00.000Z" },
      { korunanOzetler: [] },
      { durum: "olusturuldu", niyetZamani: "2026-01-01T00:00:00.000Z" },
    ];
    for (const d of degisiklikler) {
      const s = await olusturulmus();
      const k = defter();
      fs.writeFileSync(kayitYolu, JSON.stringify({ ...k, ...d }));
      for (const islem of ["temizle", "kurtarma", "dogrulama", "durum", "uzlastir"]) {
        const r = await kos([islem, "--calistir"], { sahte: s });
        assert.equal(r.kod, 1, `${JSON.stringify(d)} ${islem}`);
        assert.match(r.cikti, /imzası doğrulanamadı/);
        assert.equal(r.cagrilar.length, 0, `${JSON.stringify(d)} ${islem}: yönetim çağrısı yapılmamalı`);
      }
      fs.rmSync(kayitYolu);
    }
  });
  test("imza başka bir anahtarla yazılmışsa (farklı proje anahtarı) defter reddedilir", async () => {
    const s = await olusturulmus();
    const r = await kos(["temizle", "--calistir"], { sahte: s, env: { SUPABASE_SECRET_KEY: "sb_secret_BASKA-ANAHTAR-9876543210" } });
    assert.equal(r.kod, 1);
    assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser"));
  });
  test("eski sürüme dönüş: silindikten sonra arşiv geri konursa hiçbir işlem yapılmaz", async () => {
    const s = await olusturulmus();
    let r = await kos(["temizle", "--calistir"], { sahte: s });
    assert.equal(r.kod, 0);
    const arsiv = fs.readdirSync(dizin).find((f) => f.startsWith("kayit.json.silindi-"))!;
    fs.copyFileSync(path.join(dizin, arsiv), kayitYolu); // imzası geçerli, durumu "silindi"
    for (const islem of ["temizle", "kurtarma", "dogrulama", "uzlastir"]) {
      r = await kos([islem, "--calistir"], { sahte: s });
      assert.equal(r.kod, 2, islem);
      assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser" || c.ad === "generateLink"), islem);
    }
  });
  test("eski sürüme dönüş: önceki koşunun geçerli imzalı 'olusturuldu' defteri yeni bir kullanıcıyla eşleşmez", async () => {
    const s = await olusturulmus();
    const eski = fs.readFileSync(kayitYolu, "utf8");
    await kos(["temizle", "--calistir"], { sahte: s });
    // Eski defter geri kondu; o kimlikte artık başka bir sentetik kullanıcı var (ör. sonraki bir koşu): zamanı ve e-postası farklı.
    const sonraki = sahteAdmin({ kullanicilar: [...MEVCUT.map((id) => ({ id, email: "x@kurum.edu", created_at: "2026-11-01T00:00:00Z" })), { id: U1_ID, email: "arvolab-g1-86-u1-202611120900@example.com", created_at: "2026-11-12T09:00:00.000Z", user_metadata: { g1_86: true } }] });
    fs.writeFileSync(kayitYolu, eski);
    const r = await kos(["temizle", "--calistir"], { sahte: sonraki });
    assert.notEqual(r.kod, 0);
    assert.match(r.cikti, /eşleşmiyor/);
    assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser"));
    // Kimlik artık hiç yoksa: silme ÇAĞRILMAZ, yalnızca defter kapanır.
    fs.writeFileSync(kayitYolu, eski);
    const bos = await kos(["temizle", "--calistir"], { sahte: sahteAdmin() });
    assert.equal(bos.kod, 0);
    assert.ok(!bos.cagrilar.some((c) => c.ad === "deleteUser"));
  });
  test("başlangıçtaki mevcut kullanıcı kimliğiyle silme her yoldan reddedilir", async () => {
    // Geçerli imzalı ama mevcut kimliği gösteren bir defteri doğrudan kuramıyoruz (imza); en güçlü saldırı:
    // canlı kullanıcı nesnesi U1'in bütün alanlarını taşısa bile kimliği başlangıç kümesindeyse ret.
    const s = await olusturulmus();
    const k = defter();
    const kopya = { ...s.kullanicilar.get(U1_ID)! };
    s.kullanicilar.delete(U1_ID);
    // Sahte API, U1 kimliği sorulunca başlangıç kümesindeki bir kimliği döndürüyor.
    const admin = { ...s.admin, getUserById: async () => ({ data: { user: { ...kopya, id: MEVCUT[0] } }, error: null }) };
    const r = await kos(["temizle", "--calistir"], { sahte: { ...s, admin } });
    assert.notEqual(r.kod, 0);
    assert.match(r.cikti, /var olan/);
    assert.ok(!s.cagrilar.some((c) => c.ad === "deleteUser"));
    assert.equal(defter().imza, k.imza, "defter değişmemeli");
  });
  test("kuru kip defteri imza olmadan okur ama hiçbir şeyi değiştirmez", async () => {
    await olusturulmus();
    const once = fs.readFileSync(kayitYolu, "utf8");
    const r = await kos(["temizle"]);
    assert.equal(r.kod, 0);
    assert.match(r.cikti, /durum olusturuldu/);
    assert.equal(r.fabrika.cagrildi, 0);
    assert.equal(fs.readFileSync(kayitYolu, "utf8"), once);
  });
});

/*
  Ö1 — AÇICI ALT SÜRECİNİN ORTAMI (G1 Aşama 8.6B.3). Eskiden açıcı betiğin
  bütün ortamını (SUPABASE_SECRET_KEY dahil) devralıyordu.
*/
describe("Ö1: anahtar hiçbir alt sürece geçmez", () => {
  const KIRLI: Record<string, string> = {
    PATH: "/usr/bin",
    Path: "C:\\Windows\\System32",
    SYSTEMROOT: "C:\\Windows",
    HOME: "/home/x",
    USERPROFILE: "C:\\Users\\x",
    DISPLAY: ":0",
    SUPABASE_SECRET_KEY: SAHTE_ANAHTAR,
    SUPABASE_SERVICE_ROLE_KEY: SAHTE_ANAHTAR,
    NEXT_PUBLIC_SUPABASE_URL: URL_TEST,
    GITHUB_TOKEN: "sahte-token",
    AWS_SECRET_ACCESS_KEY: "sahte",
    MY_PASSWORD: "sahte",
    BROWSER: "firefox",
  };
  test("üç platformda da yalnızca izin listesi; sır biçimli hiçbir ad yok", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const o = aciciOrtami(KIRLI, platform);
      sizintiYok(JSON.stringify(o));
      for (const ad of Object.keys(o)) {
        assert.ok(ACICI_DEGISKENLERI[platform].includes(ad), `${platform}: ${ad}`);
        assert.doesNotMatch(ad, /SECRET|KEY|TOKEN|PASSWORD|SUPABASE/i);
      }
      assert.ok(!Object.values(o).includes(SAHTE_ANAHTAR));
      assert.ok(!Object.values(o).includes("sahte-token"));
    }
  });
  test("izin listesine yanlışlıkla sır adı eklense de süzgeç geçirmez (savunma derinliği)", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const liste = ACICI_DEGISKENLERI[platform];
      liste.push("SUPABASE_SECRET_KEY", "GITHUB_TOKEN");
      try {
        const o = aciciOrtami(KIRLI, platform);
        assert.ok(!("SUPABASE_SECRET_KEY" in o) && !("GITHUB_TOKEN" in o), platform);
      } finally {
        liste.splice(liste.length - 2, 2);
      }
    }
  });
  test("Windows: ad araması büyük/küçük harf duyarsız (Path → PATH, SYSTEMROOT → SystemRoot)", () => {
    const o = aciciOrtami({ Path: "C:\\Windows\\System32", SYSTEMROOT: "C:\\Windows", SUPABASE_SECRET_KEY: SAHTE_ANAHTAR }, "win32");
    assert.equal(o.PATH, "C:\\Windows\\System32");
    assert.equal(o.SystemRoot, "C:\\Windows");
    assert.equal(Object.keys(o).length, 2);
  });
  /*
    8.6B.4: eskiden süzgeçteki genel "SESSION" sözcüğü Linux izin listesindeki
    DBUS_SESSION_BUS_ADDRESS'i eliyordu ve test yalnızca DISPLAY/BROWSER'a
    baktığı için bunu görmüyordu. Artık listedeki HER ad tek tek sınanıyor.
  */
  test("üç platformda izin listesindeki HER değişken tek tek geçer (DBUS_SESSION_BUS_ADDRESS dahil)", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      for (const ad of ACICI_DEGISKENLERI[platform]) {
        const o = aciciOrtami({ [ad]: `deger-${ad}`, SUPABASE_SECRET_KEY: SAHTE_ANAHTAR }, platform);
        assert.deepEqual(o, { [ad]: `deger-${ad}` }, `${platform}: ${ad} geçmeli, başka hiçbir şey geçmemeli`);
      }
    }
    const l = aciciOrtami({ DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus", DISPLAY: ":0", SUPABASE_SECRET_KEY: SAHTE_ANAHTAR }, "linux");
    assert.equal(l.DBUS_SESSION_BUS_ADDRESS, "unix:path=/run/user/1000/bus");
    assert.ok(!("SUPABASE_SECRET_KEY" in l));
  });
  test("oturum sırrı biçimli adlar listede olsalar bile geçmez; liste dışı hiçbir ad geçmez", () => {
    const sirlar = ["SESSION_TOKEN", "AUTH_SESSION", "SESSION_COOKIE", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "GITHUB_TOKEN", "DB_PASSWORD", "FTP_PASSWD", "AWS_CREDENTIALS", "API_KEY", "MY_SECRET", "BEARER_AUTH", "SESSION_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_DB_URL"];
    // Her koruma sözcüğünü TEK BAŞINA taşıyan en az bir ad olmalı; yoksa sözcüğün kaldırılması ölçülemez.
    for (const sozcuk of ["SECRET", "KEY", "TOKEN", "PASSWORD", "PASSWD", "CREDENTIAL", "SUPABASE", "AUTH", "COOKIE"]) {
      const digerleri = ["SECRET", "KEY", "TOKEN", "PASSWORD", "PASSWD", "CREDENTIAL", "SUPABASE", "AUTH", "COOKIE"].filter((d) => d !== sozcuk && !(sozcuk === "PASSWORD" && d === "PASSWD") && !(sozcuk === "PASSWD" && d === "PASSWORD"));
      assert.ok(sirlar.some((ad) => ad.includes(sozcuk) && !digerleri.some((d) => ad.includes(d))), `${sozcuk} yalnız başına sınanmıyor`);
    }
    const kaynak = Object.fromEntries([...sirlar, "RASTGELE_DEGISKEN", "NODE_OPTIONS", "HTTPS_PROXY"].map((a) => [a, `sir-${a}`]));
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const liste = ACICI_DEGISKENLERI[platform];
      // Liste dışı: hiçbiri geçmez.
      assert.deepEqual(aciciOrtami(kaynak, platform), {}, `${platform}: liste dışı ad geçti`);
      // Listeye yanlışlıkla eklenmiş olsalar bile sır biçimliler geçmez.
      liste.push(...sirlar);
      try {
        const o = aciciOrtami(kaynak, platform);
        assert.deepEqual(o, {}, `${platform}: ${Object.keys(o).join(",")}`);
      } finally {
        liste.splice(liste.length - sirlar.length, sirlar.length);
      }
    }
  });
  test("Linux/macOS: ad araması büyük/küçük harf duyarlı; masaüstü oturum değişkenleri geçer", () => {
    const l = aciciOrtami(KIRLI, "linux");
    assert.equal(l.PATH, "/usr/bin");
    assert.equal(l.DISPLAY, ":0");
    assert.equal(l.BROWSER, "firefox");
    assert.ok(!("Path" in l));
    assert.deepEqual(Object.keys(aciciOrtami(KIRLI, "darwin")).sort(), ["HOME", "PATH"]);
  });

  type Cagri = { komut: string; args: string[]; secenek: { env: Record<string, string>; shell: boolean } };
  function sahteSpawn(davranis: "spawn" | "error" | "throw") {
    const cagrilar: Cagri[] = [];
    const fn = (komut: string, args: string[], secenek: Cagri["secenek"]) => {
      cagrilar.push({ komut, args, secenek });
      if (davranis === "throw") throw new Error(`spawn patladı ${SAHTE_ANAHTAR}`);
      const c = Object.assign(new EventEmitter(), { unref() {} });
      setImmediate(() => c.emit(davranis === "spawn" ? "spawn" : "error", new Error(`ENOENT ${SAHTE_ANAHTAR}`)));
      return c;
    };
    return { fn, cagrilar };
  }
  test("açıcı: doğru komut, tek argüman (yerel adres), kabuksuz, daraltılmış ortam", async () => {
    for (const [platform, komut] of [["win32", "explorer.exe"], ["darwin", "open"], ["linux", "xdg-open"]] as const) {
      const sp = sahteSpawn("spawn");
      await sistemAcicisiKur({ platform, env: KIRLI, spawnFn: sp.fn as never })("http://127.0.0.1:1234/nonce");
      const c = sp.cagrilar[0];
      assert.equal(c.komut, komut);
      assert.deepEqual(c.args, ["http://127.0.0.1:1234/nonce"]);
      assert.equal(c.secenek.shell, false);
      assert.ok(!("SUPABASE_SECRET_KEY" in c.secenek.env), platform);
      sizintiYok(JSON.stringify(c.secenek.env));
    }
  });
  test("açıcı hata yolları (başlatılamadı / spawn istisnası): güvenli durur, ortam yine temiz, hata metninde sır yok", async () => {
    for (const davranis of ["error", "throw"] as const) {
      const sp = sahteSpawn(davranis);
      await assert.rejects(sistemAcicisiKur({ platform: "win32", env: KIRLI, spawnFn: sp.fn as never })("http://127.0.0.1:1/x"), (e: unknown) => {
        assert.ok(durMu(e, 1));
        sizintiYok(String((e as Error).message));
        return true;
      });
      assert.ok(!("SUPABASE_SECRET_KEY" in sp.cagrilar[0].secenek.env));
    }
  });
  test("gerçek kipte anahtar okunduktan sonra ortamdan silinir; yönetim istemcisi anahtarı yine alır", async () => {
    const env: Record<string, string> = { NEXT_PUBLIC_SUPABASE_URL: URL_TEST, SUPABASE_SECRET_KEY: SAHTE_ANAHTAR };
    let anahtarAcilistaOrtamdaydi: boolean | null = null;
    const r = await kos(["olustur", "--calistir"], {
      secenek: {
        env,
        adminFabrikasi: async (_u: string, anahtar: string) => {
          anahtarAcilistaOrtamdaydi = "SUPABASE_SECRET_KEY" in env;
          assert.equal(anahtar, SAHTE_ANAHTAR);
          return sahteAdmin().admin;
        },
        ac: async () => {
          assert.ok(!("SUPABASE_SECRET_KEY" in env), "tarayıcı açılırken anahtar ortamda olmamalı");
        },
      },
    });
    assert.equal(r.kod, 0, r.cikti);
    assert.equal(anahtarAcilistaOrtamdaydi, false);
    assert.ok(!("SUPABASE_SECRET_KEY" in env));
  });
  test("anahtar geçersizse de ortamdan silinir; hata ve zaman aşımı yollarında ortam temiz kalır", async () => {
    for (const anahtar of ["sb_publishable_xyz", `x.${Buffer.from(JSON.stringify({ ref: URETIM_REF, role: "service_role" })).toString("base64url")}.y`]) {
      const env: Record<string, string> = { NEXT_PUBLIC_SUPABASE_URL: URL_TEST, SUPABASE_SECRET_KEY: anahtar };
      const r = await kos(["durum", "--calistir"], { secenek: { env } });
      assert.equal(r.kod, 2);
      assert.ok(!("SUPABASE_SECRET_KEY" in env));
    }
    // İşlem sırasında hata (oluşturma yanıtı kayboldu) ve tarayıcı zaman aşımı.
    for (const ayar of [{ sahte: sahteAdmin({ yanitKaybolur: true }), ac: undefined }, { sahte: sahteAdmin(), ac: async () => { throw new Dur("Tarayıcı bağlantıyı süresinde açmadı; belirteç kullanılmadı.", 1); } }]) {
      const env: Record<string, string> = { NEXT_PUBLIC_SUPABASE_URL: URL_TEST, SUPABASE_SECRET_KEY: SAHTE_ANAHTAR };
      const r = await kos(["olustur", "--calistir"], { sahte: ayar.sahte, secenek: { env, ...(ayar.ac ? { ac: ayar.ac } : {}) } });
      assert.equal(r.kod, 1);
      assert.ok(!("SUPABASE_SECRET_KEY" in env));
      sizintiYok(r.cikti);
      fs.rmSync(kayitYolu, { force: true });
    }
  });
  test("kuru kipte anahtar ne okunur ne silinir (dokunulmaz)", async () => {
    const env: Record<string, string> = { NEXT_PUBLIC_SUPABASE_URL: URL_TEST, SUPABASE_SECRET_KEY: SAHTE_ANAHTAR };
    const r = await kos(["olustur"], { secenek: { env } });
    assert.equal(r.kod, 0);
    assert.equal(env.SUPABASE_SECRET_KEY, SAHTE_ANAHTAR);
  });
});

/*
  Ö2 — DOĞRUDAN ÇALIŞTIRMA (Windows yol farkları). Eskiden birebir URL
  karşılaştırması vardı; Windows'ta sürücü harfi/ayraç farkı betiği sessizce
  çıkış 0 ile bitirebiliyordu.
*/
describe("Ö2: doğrudan çalıştırma tespiti", () => {
  const kimlik = (y: string) => y; // realpath sahte: dosya sistemine dokunulmaz
  const W = { platform: "win32" as const, realpath: kimlik };
  const P = { platform: "linux" as const, realpath: kimlik };
  const winUrl = "file:///C:/Users/Ali%20Veli/Belgeler/ArvoLab/scripts/test-ortami/g1-86-baglanti.mjs";
  test("Windows: sürücü harfi, ayraç, boşluklu yol ve harf büyüklüğü farkları eşleşir", () => {
    for (const argv1 of [
      "C:\\Users\\Ali Veli\\Belgeler\\ArvoLab\\scripts\\test-ortami\\g1-86-baglanti.mjs",
      "c:\\users\\ali veli\\belgeler\\arvolab\\scripts\\test-ortami\\g1-86-baglanti.mjs",
      "C:/Users/Ali Veli/Belgeler/ArvoLab/scripts/test-ortami/g1-86-baglanti.mjs",
      "C:\\Users\\Ali Veli\\Belgeler\\ArvoLab\\scripts\\test-ortami\\..\\test-ortami\\G1-86-BAGLANTI.mjs",
    ]) {
      assert.equal(dogrudanCalistirildiMi(winUrl, argv1, W), "ana", argv1);
    }
    assert.equal(dogrudanCalistirildiMi("file:///c:/Users/Ali%20Veli/Belgeler/ArvoLab/scripts/test-ortami/g1-86-baglanti.mjs", "C:\\Users\\Ali Veli\\Belgeler\\ArvoLab\\scripts\\test-ortami\\g1-86-baglanti.mjs", W), "ana");
  });
  test("Windows: içe aktarıldığında (argv başka dosya) ana blok başlamaz", () => {
    assert.equal(dogrudanCalistirildiMi(winUrl, "C:\\Users\\Ali Veli\\Belgeler\\ArvoLab\\node_modules\\x\\test.js", W), "baska");
    assert.equal(dogrudanCalistirildiMi(winUrl, undefined as unknown as string, W), "baska");
  });
  test("aynı adlı ama başka yoldaki dosya: sessizce geçmez, 'belirsiz'", () => {
    assert.equal(dogrudanCalistirildiMi(winUrl, "D:\\kopya\\g1-86-baglanti.mjs", W), "belirsiz");
    assert.equal(dogrudanCalistirildiMi(winUrl, "C:\\Users\\Baska\\g1-86-BAGLANTI.MJS", W), "belirsiz");
  });
  test("Linux/macOS: harf duyarlı; tam eşleşme ana, farklı harf belirsiz", () => {
    const u = "file:///home/ali%20veli/ArvoLab/scripts/test-ortami/g1-86-baglanti.mjs";
    assert.equal(dogrudanCalistirildiMi(u, "/home/ali veli/ArvoLab/scripts/test-ortami/g1-86-baglanti.mjs", P), "ana");
    assert.equal(dogrudanCalistirildiMi(u, "/home/ali veli/ArvoLab/scripts/test-ortami/../test-ortami/g1-86-baglanti.mjs", P), "ana");
    assert.equal(dogrudanCalistirildiMi(u, "/home/ali veli/arvolab/scripts/test-ortami/g1-86-baglanti.mjs", P), "belirsiz");
    assert.equal(dogrudanCalistirildiMi(u, "/home/ali veli/ArvoLab/tests/unit/x.test.ts", P), "baska");
  });
  test("gerçek süreç: doğrudan çalıştırılınca ana blok başlar (göreli ve mutlak yol), içe aktarılınca başlamaz", () => {
    const env = { PATH: process.env.PATH ?? "", HOME: dizin, NEXT_PUBLIC_SUPABASE_URL: URL_TEST } as unknown as NodeJS.ProcessEnv;
    for (const yol of ["scripts/test-ortami/g1-86-baglanti.mjs", "./scripts/test-ortami/../test-ortami/g1-86-baglanti.mjs", path.resolve("scripts/test-ortami/g1-86-baglanti.mjs")]) {
      const r = spawnSync(process.execPath, ["--import", "./tests/register.mjs", yol, "plan"], { env, encoding: "utf8", timeout: 30_000 });
      assert.equal(r.status, 0, yol);
      assert.match(r.stdout, /KURU KİP/, yol);
    }
    // İçe aktarma: hiçbir çıktı ve yan etki yok.
    const ice = spawnSync(process.execPath, ["--import", "./tests/register.mjs", "-e", "await import('./scripts/test-ortami/g1-86-baglanti.mjs')", "--input-type=module"], { env, encoding: "utf8", timeout: 30_000 });
    assert.equal(ice.status, 0, ice.stderr);
    assert.equal(ice.stdout, "");
    assert.equal(fs.existsSync(path.join(dizin, ".arvolab-g1-86")), false);
  });
});

/* Ö3 — YÖNLENDİRME SUNUCUSUNUN KAPANIŞI. */
describe("Ö3: tek kullanımlık yönlendirme hemen kapanır, yanıt yarıda kesilmez", () => {
  test("keep-alive istemciyle: 302 yanıtı tam alınır, sunucu 1 sn içinde kapanır, aynı bağlantı tekrar kullanılamaz", async () => {
    const hedef = `https://ornek.invalid/auth/confirm?token_hash=${SAHTE_TOKEN}&type=signup`;
    const ajan = new http.Agent({ keepAlive: true, maxSockets: 1 });
    let verilen = "";
    let yanit: { durum?: number; konum?: string; baglanti?: string; govdeBitti?: boolean } = {};
    let acildiZaman = 0;
    const t0 = Date.now();
    await baglantiyiAc(hedef, {
      bekleme: 10_000,
      acici: async (adres: string) => {
        verilen = adres;
        await new Promise<void>((coz, red) => {
          http
            .get(adres, { agent: ajan }, (y) => {
              yanit = { durum: y.statusCode, konum: y.headers.location, baglanti: y.headers.connection };
              y.resume();
              y.on("end", () => {
                yanit.govdeBitti = true;
                acildiZaman = Date.now();
                coz();
              });
            })
            .on("error", red);
        });
      },
    });
    const kapanma = Date.now() - t0;
    assert.equal(yanit.durum, 302);
    assert.equal(yanit.konum, hedef);
    assert.equal(yanit.baglanti, "close");
    assert.equal(yanit.govdeBitti, true, "yanıt yarıda kesilmemeli");
    assert.ok(kapanma < 1000, `sunucu ${kapanma} ms'de kapandı (eskiden ~6000)`);
    assert.ok(acildiZaman > 0);
    await assert.rejects(
      new Promise((coz, red) => http.get(verilen, { agent: ajan }, coz).on("error", red)),
      "ikinci istek aynı ajanla da yapılamamalı",
    );
    ajan.destroy();
  });
  test("zaman aşımında bağlantıyı açık tutan istemci olsa da sunucu kapanır ve güvenli durur", async () => {
    let soket: import("node:net").Socket | null = null;
    const net = await import("node:net");
    await assert.rejects(
      baglantiyiAc("https://ornek.invalid/x", {
        bekleme: 300,
        acici: async (adres: string) => {
          const u = new URL(adres);
          // Yarım istek: bağlantı açık kalır, yönlendirme hiç tüketilmez.
          soket = net.connect(Number(u.port), "127.0.0.1", () => soket!.write("GET /yanlis HTTP/1.1\r\nHost: x\r\n"));
          soket.on("error", () => {});
        },
      }),
      (e: unknown) => durMu(e, 1),
    );
    (soket as import("node:net").Socket | null)?.destroy();
  });
});

/*
  G1-B — U2 (8.6B.7): bilinen test şifresiyle oluşturma, onay öncesi bekleme,
  AYNI bağlantının açılması. Gerçek Supabase yok; sahte istemci.
*/
describe("G1-B: U2 bilinen şifre ve onay öncesi bekleme", () => {
  const SAHTE_SIFRE = "Sahte-U2-Sifre-77!x";
  const U2_EPOSTA = sentetikEposta("u2", SIMDI);
  const sirlarU2 = [...SIRLAR, SAHTE_SIFRE];
  const sizintiYokU2 = (m: string) => {
    for (const sir of sirlarU2) assert.ok(!m.includes(sir), `sızıntı: ${sir.slice(0, 10)}…`);
  };
  /** Sahte istemci generateLink parametresini (şifre dahil) yakalar; test yalnızca eşitliği karşılaştırır. */
  function u2Admin(ayar: Parameters<typeof sahteAdmin>[0] = {}) {
    const s = sahteAdmin(ayar);
    const gelenler: Record<string, unknown>[] = [];
    const asil = s.admin.generateLink;
    s.admin.generateLink = async (p: { type: string; email: string }) => {
      gelenler.push(p as unknown as Record<string, unknown>);
      const r = await asil(p);
      if (r.data?.user) r.data.user.user_metadata = { ...(r.data.user.user_metadata ?? {}), ...((p as { options?: { data?: object } }).options?.data ?? {}) };
      return r;
    };
    return { ...s, gelenler };
  }
  const u2Env = (ek: Record<string, string> = {}) => ({ NEXT_PUBLIC_SUPABASE_URL: URL_TEST, SUPABASE_SECRET_KEY: SAHTE_ANAHTAR, G1_86_U2_SIFRE: SAHTE_SIFRE, ...ek }) as Record<string, string>;

  test("sentetik adres ve rol: u2 deseni, epostaRolu, bilinmeyen rol reddi", () => {
    assert.equal(U2_EPOSTA, "arvolab-g1-86-u2-202611110830@example.com");
    assert.equal(epostaRolu(U2_EPOSTA), "u2");
    assert.equal(epostaRolu(U1_EPOSTA), "u1");
    assert.equal(epostaRolu("arvolab-g1-86-u3-202611110830@example.com"), null);
    assert.throws(() => sentetikEposta("u3"), Dur);
  });

  test("--u2 yalnızca olustur/plan ile; diğer işlemlerde ret", () => {
    assert.equal(argumanlariCoz(["olustur", "--u2", "--calistir"]).rol, "u2");
    assert.equal(argumanlariCoz(["olustur"]).rol, "u1");
    assert.equal(argumanlariCoz(["plan", "--u2"]).rol, "u2");
    for (const islem of ["temizle", "durum", "dogrulama", "kurtarma", "uzlastir"]) assert.throws(() => argumanlariCoz([islem, "--u2"]), Dur, islem);
  });

  test("kuru kip: U2 şifresi okunmaz, istemci kurulmaz, bekleme ve tarayıcı yok, ortam değişmez", async () => {
    const okunan: string[] = [];
    const ham = u2Env();
    const env = new Proxy(ham, { get: (h, k) => (okunan.push(String(k)), h[k as string]) });
    let bekledi = 0;
    const r = await kos(["olustur", "--u2"], { secenek: { env, bekle: async () => (bekledi++, "devam") } });
    assert.equal(r.kod, 0);
    assert.match(r.cikti, /KURU KİP/);
    assert.match(r.cikti, /arvolab-g1-86-u2-/);
    assert.ok(!okunan.includes("G1_86_U2_SIFRE") && !okunan.includes("SUPABASE_SECRET_KEY"));
    assert.equal(r.fabrika.cagrildi, 0);
    assert.equal(bekledi, 0);
    assert.equal(r.acilan.length, 0);
    assert.equal(ham.G1_86_U2_SIFRE, SAHTE_SIFRE);
    assert.equal(fs.existsSync(kayitYolu), false);
    sizintiYokU2(r.cikti);
  });

  test("gerçek kip: bilinen şifre generateLink'e gider; 'devam' gelmeden bağlantı AÇILMAZ; sonra AYNI bağlantı açılır", async () => {
    const s = u2Admin();
    const env = u2Env();
    const sira: string[] = [];
    const r = await kos(["olustur", "--u2", "--calistir"], {
      sahte: s,
      secenek: {
        env,
        bekle: async (soru: string) => {
          sira.push("bekle");
          assert.ok(fs.existsSync(kayitYolu), "kayıt defteri beklemeden ÖNCE yazılmış olmalı");
          assert.equal(defter().durum, "olusturuldu");
          sizintiYokU2(soru);
          return "devam";
        },
        ac: async (l: string) => {
          sira.push("ac");
          const u = new URL(l);
          assert.equal(u.searchParams.get("type"), "signup");
          assert.equal(u.searchParams.get("token_hash"), SAHTE_TOKEN);
          assert.ok(!l.includes(SAHTE_SIFRE));
        },
      },
    });
    assert.equal(r.kod, 0, r.cikti);
    assert.deepEqual(sira, ["bekle", "ac"]);
    // Tek generateLink: yeniden üretim yok; şifre bilinen değer; rol işareti u2.
    assert.equal(s.gelenler.length, 1);
    assert.equal(s.gelenler[0].password, SAHTE_SIFRE);
    assert.equal(s.gelenler[0].email, U2_EPOSTA);
    assert.equal((s.gelenler[0].options as { data: { g1_86_rol: string } }).data.g1_86_rol, "u2");
    assert.ok(!("G1_86_U2_SIFRE" in env) && !("SUPABASE_SECRET_KEY" in env), "şifre ve anahtar ortamdan silinmeli");
    assert.match(r.cikti, /email-not-confirmed/);
    assert.match(r.cikti, /invalid-credentials/);
    assert.match(r.cikti, /ŞİFRE BELİRLEMEYİN/);
    sizintiYokU2(r.cikti);
    sizintiYokU2(fs.readFileSync(kayitYolu, "utf8"));
  });

  test("G1-B prosedürü ekranda: B0 SQL (U2 kimliğiyle), B1a/B1b karşıt deneme, BLOCKED kuralı, şifre/sözleşme yasağı; hepsi bağlantı açılmadan ÖNCE", async () => {
    const s = u2Admin();
    let beklemeAnindaCikti = "";
    const satirlar: string[] = [];
    const r = await kos(["olustur", "--u2", "--calistir"], {
      sahte: s,
      secenek: {
        env: u2Env(),
        cikti: (m: string) => satirlar.push(m),
        bekle: async () => {
          beklemeAnindaCikti = satirlar.join("\n");
          return "iptal";
        },
      },
    });
    assert.equal(r.kod, 1);
    const o = beklemeAnindaCikti;
    assert.match(o, /B0/);
    assert.match(o, new RegExp(`encrypted_password is null or encrypted_password = '' as sifre_yok from auth\\.users where id = '${U1_ID}'`));
    assert.match(o, /onayli = false, sifre_yok = false/);
    assert.match(o, /B1a YANLIŞ[^\n]*invalid-credentials/);
    assert.match(o, /B1b U2 test şifresiyle[^\n]*email-not-confirmed/);
    assert.match(o, /FARKLI olmalı/);
    assert.match(o, /"devam" YAZMAYIN[^\n]*BLOCKED[^\n]*temizle/);
    assert.ok(o.indexOf("B0") < o.indexOf("B1a") && o.indexOf("B1a") < o.indexOf("B1b"));
    sizintiYokU2(o);
    // Kaynakta prosedür ve Ctrl+C notu belgelenmiş.
    const kaynak = fs.readFileSync("scripts/test-ortami/g1-86-baglanti.mjs", "utf8");
    assert.match(kaynak, /G1-B KABUL PROSEDÜRÜ/);
    assert.match(kaynak, /birim testinde DOĞRULANMADI/);
    assert.match(kaynak, /sözleşme KABUL EDİLMEZ/);
  });

  test("'iptal' ya da giriş kapanırsa bağlantı açılmaz; U2 kayıt defterinde kalır ve temizlenebilir", async () => {
    for (const yanit of ["iptal", "kapandi"]) {
      const s = u2Admin();
      const r = await kos(["olustur", "--u2", "--calistir"], { sahte: s, secenek: { env: u2Env(), bekle: async () => yanit } });
      assert.equal(r.kod, 1, yanit);
      assert.equal(r.acilan.length, 0);
      assert.equal(defter().durum, "olusturuldu");
      assert.match(r.cikti, /temizle/);
      const t = await kos(["temizle", "--calistir"], { sahte: s });
      assert.equal(t.kod, 0, t.cikti);
      assert.ok(t.cagrilar.some((c) => c.ad === "deleteUser" && c.arg === U1_ID));
    }
  });

  test("bekleme sınırı aşılırsa bağlantı açılmaz ve YENİ bağlantı üretilmez", async () => {
    const s = u2Admin();
    let t = 1_000_000;
    const r = await kos(["olustur", "--u2", "--calistir"], {
      sahte: s,
      secenek: { env: u2Env(), saat: () => t, bekle: async () => ((t += U2_BEKLEME_SINIRI_MS + 1), "devam") },
    });
    assert.equal(r.kod, 1);
    assert.equal(r.acilan.length, 0);
    assert.match(r.cikti, /Yeni bağlantı ÜRETİLMEDİ/);
    assert.equal(s.gelenler.length, 1, "ikinci generateLink çağrılmamalı");
  });

  test("U2 için dogrulama (kayıt bağlantısını yeniden üretme) reddedilir; generateLink çağrılmaz", async () => {
    const s = u2Admin();
    await kos(["olustur", "--u2", "--calistir"], { sahte: s, secenek: { env: u2Env(), bekle: async () => "iptal" } });
    const r = await kos(["dogrulama", "--calistir"], { sahte: s });
    assert.equal(r.kod, 2);
    assert.match(r.cikti, /şifresini değiştirebilir/);
    assert.ok(!r.cagrilar.some((c) => c.ad === "generateLink"));
  });

  test("şifre kuralları: eksik/kısa/uzun/boşluklu/anahtarla aynı → ret; her durumda ortamdan silinir, mesajda şifre yok", () => {
    const vakalar: [string | undefined, RegExp][] = [
      [undefined, /tanımlı değil/],
      ["kisa1!", /en az 8/],
      ["a".repeat(73), /72 bayt/],
      [" bosluklu-sifre1 ", /boşluk/],
      [SAHTE_ANAHTAR, /anahtarla aynı/],
    ];
    for (const [sifre, desen] of vakalar) {
      const env: Record<string, string | undefined> = sifre === undefined ? {} : { G1_86_U2_SIFRE: sifre };
      assert.throws(() => u2SifresiOku(env, SAHTE_ANAHTAR), (e: unknown) => {
        assert.ok(durMu(e, 2, desen), String((e as Error).message));
        if (sifre) assert.ok(!(e as Error).message.includes(sifre));
        return true;
      });
      assert.ok(!("G1_86_U2_SIFRE" in env));
    }
    const env = { G1_86_U2_SIFRE: SAHTE_SIFRE } as Record<string, string | undefined>;
    assert.equal(u2SifresiOku(env, SAHTE_ANAHTAR), SAHTE_SIFRE);
    assert.ok(!("G1_86_U2_SIFRE" in env));
  });

  test("geçersiz şifrede hiçbir yönetim çağrısı yapılmaz; şifre ve anahtar ortamdan silinir", async () => {
    const env = u2Env({ G1_86_U2_SIFRE: "kisa" });
    const r = await kos(["olustur", "--u2", "--calistir"], { secenek: { env } });
    assert.equal(r.kod, 2);
    assert.equal(r.fabrika.cagrildi, 0);
    assert.ok(!("G1_86_U2_SIFRE" in env) && !("SUPABASE_SECRET_KEY" in env));
  });

  test("oluşturma hatası ve beklenmeyen istisnada şifre sızmaz", async () => {
    const hata = { code: "weak_password", status: 422, message: `şifre ${SAHTE_SIFRE} zayıf`, body: SAHTE_SIFRE };
    const r = await kos(["olustur", "--u2", "--calistir"], { sahte: u2Admin({ hata }), secenek: { env: u2Env(), bekle: async () => "devam" } });
    assert.equal(r.kod, 1);
    assert.match(r.cikti, /kod=weak_password http=422/);
    sizintiYokU2(r.cikti);
    fs.rmSync(kayitYolu, { force: true });
    const r2 = await kos(["olustur", "--u2", "--calistir"], {
      secenek: { env: u2Env(), adminFabrikasi: async () => { throw new Error(`patladı ${SAHTE_SIFRE}`); } },
    });
    assert.equal(r2.kod, 1);
    sizintiYokU2(r2.cikti);
  });

  test("U1 akışı değişmedi: bekleme yok, bağlantı hemen açılır, şifre okunmaz ama ortamdan temizlenir", async () => {
    const env = u2Env();
    let bekledi = 0;
    const s = u2Admin();
    const r = await kos(["olustur", "--calistir"], { sahte: s, secenek: { env, bekle: async () => (bekledi++, "devam") } });
    assert.equal(r.kod, 0, r.cikti);
    assert.equal(bekledi, 0);
    assert.equal(r.acilan.length, 1);
    assert.notEqual(s.gelenler[0].password, SAHTE_SIFRE);
    assert.equal(s.gelenler[0].email, U1_EPOSTA);
    assert.ok(!("G1_86_U2_SIFRE" in env));
  });

  test("rol işareti e-postayla çelişirse silme reddedilir", async () => {
    const s = u2Admin();
    await kos(["olustur", "--u2", "--calistir"], { sahte: s, secenek: { env: u2Env(), bekle: async () => "iptal" } });
    s.kullanicilar.get(U1_ID)!.user_metadata = { g1_86: true, g1_86_rol: "u1" };
    const r = await kos(["temizle", "--calistir"], { sahte: s });
    assert.notEqual(r.kod, 0);
    assert.match(r.cikti, /rol işareti/);
    assert.ok(!r.cagrilar.some((c) => c.ad === "deleteUser"));
  });

  test("U2 şifre değişkeni açıcı ortamına hiçbir koşulda geçmez (izin listesi + SIFRE/PAROLA süzgeci)", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const liste = ACICI_DEGISKENLERI[platform];
      liste.push("G1_86_U2_SIFRE", "MY_PAROLA");
      try {
        const o = aciciOrtami({ G1_86_U2_SIFRE: SAHTE_SIFRE, MY_PAROLA: "x", PATH: "/p" }, platform);
        assert.ok(!("G1_86_U2_SIFRE" in o) && !("MY_PAROLA" in o), platform);
      } finally {
        liste.splice(liste.length - 2, 2);
      }
    }
  });

  test("devamBekleKur: yalnızca 'devam'/'iptal' kabul; Enter tek başına yetmez; EOF 'kapandi'", async () => {
    const { PassThrough } = await import("node:stream");
    const calistirBekle = async (satirlar: string[], kapat: boolean) => {
      const girdi = new PassThrough();
      const cikti = new PassThrough();
      const yazilan: string[] = [];
      cikti.on("data", (d) => yazilan.push(String(d)));
      const p = devamBekleKur({ girdi, cikti })("soru: ");
      for (const s of satirlar) girdi.write(`${s}\n`);
      if (kapat) girdi.end();
      return { sonuc: await p, yazilan: yazilan.join("") };
    };
    assert.equal((await calistirBekle(["", "evet", "DEVAM"], false)).sonuc, "devam");
    assert.equal((await calistirBekle(["", "iptal"], false)).sonuc, "iptal");
    assert.equal((await calistirBekle(["", ""], true)).sonuc, "kapandi");
    assert.match((await calistirBekle(["x", "devam"], false)).yazilan, /"devam" ya da "iptal"/);
  });

  test("uygulamanın gerçek davranışı (kaynak sözleşmesi): giriş hataları beklenen yönlendirmeye ve metne bağlı", () => {
    const auth = fs.readFileSync("app/actions/auth.ts", "utf8");
    assert.match(auth, /if \(error\.code === "email_not_confirmed"\) redirect\(`\/\?error=email-not-confirmed\$\{nextQuery\}`\);\s*redirect\(`\/\?error=invalid-credentials\$\{nextQuery\}`\);/);
    const sayfa = fs.readFileSync("app/page.tsx", "utf8");
    assert.match(sayfa, /"invalid-credentials": \{ tr: "E-posta adresi veya şifre hatalı\."/);
    assert.match(sayfa, /"email-not-confirmed": \{\s*tr: "E-posta adresiniz henüz doğrulanmadı\./);
    // Onay anında şifreyi silen tetikleyici migration'da (G1-B'nin sınadığı kural).
    const mig = fs.readFileSync("supabase/migrations/20261106184046_eposta_onayi_kimlik_sabitleme.sql", "utf8");
    assert.match(mig, /if old\.email_confirmed_at is null and new\.email_confirmed_at is not null then\s*new\.encrypted_password := null;/);
    assert.match(mig, /before update of email_confirmed_at on auth\.users/);
    // Kayıt doğrulaması ilk şifre ekranına gider (B2).
    assert.match(fs.readFileSync("app/auth/confirm/route.ts", "utf8"), /type === "signup" \? "\/reset-password\?ilk=1"/);
  });
});
