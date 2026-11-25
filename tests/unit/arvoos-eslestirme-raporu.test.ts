import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserRole } from "@/lib/project-labels";
import { anlikOku, depoIcinde, gercekYol, raporla, saltOkunurFetch } from "../../scripts/arvoos-eslestirme-raporu.mjs";

const DEPO_KOKU = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/*
  BETİĞİN KENDİSİNİN SINANMASI.

  Rapor, insanın onaylayarak kurum bağı kaldıracağı bir belge; betiğin iki
  özelliği bu yüzden sözleşme: (1) hiçbir koşulda yazmaz, (2) ArvoOS tarafı
  eksikken olumsuz hüküm üretmez. İkisi de burada sabitleniyor.
*/

const KURUM_A = "11111111-1111-1111-1111-111111111111";
const KURUM_B = "22222222-2222-2222-2222-222222222222";

describe("saltOkunurFetch", () => {
  const sayac = { istek: 0 };
  /* Parametre almıyor: sayılan şey ÇAĞRILIP çağrılmadığı. Daha az
     parametreli işlev sarmalayıcının tipine uyuyor. */
  const ic = async () => {
    sayac.istek += 1;
    return { ok: true };
  };

  test("GET ve HEAD geçer", async () => {
    const f = saltOkunurFetch(ic);
    await f("http://127.0.0.1/x", { method: "GET" });
    await f("http://127.0.0.1/x", { method: "head" });
    assert.equal(sayac.istek, 2);
  });

  test("yöntem verilmezse GET sayılır", async () => {
    const f = saltOkunurFetch(ic);
    await f("http://127.0.0.1/x");
    assert.equal(sayac.istek, 3);
  });

  /* Storage listeleme istisnası BİLEREK yok: bu rapor Storage'a dokunmuyor. */
  for (const yontem of ["POST", "PATCH", "PUT", "DELETE"]) {
    test(`${yontem} ağa çıkmadan reddedilir`, async () => {
      const oncesi = sayac.istek;
      const f = saltOkunurFetch(ic);
      await assert.rejects(() => f("http://127.0.0.1/storage/v1/object/list/x", { method: yontem }), /salt okunur/);
      assert.equal(sayac.istek, oncesi, "reddedilen istek ağa çıkmamalı");
    });
  }
});

describe("anlikOku", () => {
  test("ArvoOS alan adlarını okur, e-postayı küçük harfe indirger", () => {
    const { kayitlar, kapsam } = anlikOku(
      JSON.stringify({ uyeler: [{ arvoos_user_id: "a1", email: "Uzman@Kurum.TEST", organization_id: KURUM_A }] }),
    );
    assert.deepEqual(kayitlar, [{ arvoosUserId: "a1", eposta: "uzman@kurum.test", kurum: KURUM_A }]);
    assert.deepEqual([...kapsam], [KURUM_A]);
  });

  test("çıplak dizi de kabul edilir", () => {
    const { kayitlar } = anlikOku(JSON.stringify([{ arvoos_user_id: "a1", email: "a@b.test", organization_id: KURUM_A }]));
    assert.equal(kayitlar.length, 1);
  });

  test("e-postası ya da kurumu olmayan satır atılır", () => {
    const { kayitlar } = anlikOku(
      JSON.stringify({
        uyeler: [
          { arvoos_user_id: "a1", email: "", organization_id: KURUM_A },
          { arvoos_user_id: "a2", email: "a@b.test", organization_id: null },
          { arvoos_user_id: "a3", email: "c@d.test", organization_id: KURUM_A },
        ],
      }),
    );
    assert.deepEqual(kayitlar.map((k) => k.arvoosUserId), ["a3"]);
  });

  /*
    Üyesi kalmamış kurum anlık görüntüde satır üretmez. Kapsam yalnızca
    satırlardan çıkarılsa o kurum "veri yok" sayılır ve bağları
    "ölçülemedi" olur; dosya kurumları açıkça sayarsa hüküm verilebilir.
  */
  test("kurumlar alanı kapsamı beyan eder, satırsız kurumu da kapsar", () => {
    const { kapsam } = anlikOku(
      JSON.stringify({
        kurumlar: [KURUM_A, KURUM_B],
        uyeler: [{ arvoos_user_id: "a1", email: "a@b.test", organization_id: KURUM_A }],
      }),
    );
    assert.deepEqual([...kapsam].sort(), [KURUM_A, KURUM_B].sort());
  });

  test("uyeler dizisi yoksa açık hata", () => {
    assert.throws(() => anlikOku(JSON.stringify({ baska: 1 })), /uyeler/);
  });
});

describe("raporla", () => {
  const profiller = [
    { id: "p1", kurum: KURUM_A, eposta: "a@kurum-a.test", epostaOnayli: true, rol: "employee" as UserRole },
    { id: "p2", kurum: KURUM_B, eposta: "b@kurum-b.test", epostaOnayli: true, rol: "expert" as UserRole },
    { id: "p3", kurum: null, eposta: "c@ogrenci.test", epostaOnayli: true, rol: "client" as UserRole },
  ];
  const atamalar = [{ proje: "c1", kurum: KURUM_A, atanan: "p1" }];

  test("yansıma listesiyle: kapsanan kurumun bağı hüküm alır, kapsanmayan ölçülemedi", () => {
    const kayitlar = [{ arvoosUserId: null, eposta: "a@kurum-a.test", kurum: KURUM_A }];
    const r = raporla({ profiller, atamalar }, { kayitlar, kapsam: new Set([KURUM_A]) });
    assert.equal(r.baglar[0].hukum, "dogrulanabilir");
    assert.equal(r.baglar[1].hukum, "olculemedi");
    assert.equal(r.baglar[2].hukum, "kapsamda_degil");
    assert.equal(r.ozet.toplam, 3);
  });

  test("atama önerisi ve rol önerisi birlikte çıkar", () => {
    const kayitlar = [{ arvoosUserId: "a1", eposta: "a@kurum-a.test", kurum: KURUM_A }];
    const r = raporla({ profiller, atamalar }, { kayitlar, kapsam: new Set([KURUM_A]) });
    assert.equal(r.atamalar.length, 1);
    assert.equal(r.atamalar[0].atananinBagi, "dogrulanabilir");
    assert.equal(r.atamalar[0].arvoosUserId, "a1");
    // client öneri almaz; employee ve expert alır.
    assert.deepEqual(r.roller.map((x) => x.profil), ["p1", "p2"]);
  });

  /*
    Rol önerisi dayanağını `raporla` içinden alıyor: hükümler bir kez
    hesaplanıp hem atama hem rol tablosuna geçiyor. Bu bağlantı kopsaydı
    CSV'deki `bagi` sütunu her satırda "profil_yok" olurdu.
  */
  test("rol önerileri bağ hükmünü raporla üzerinden taşıyor", () => {
    const kayitlar = [{ arvoosUserId: "a1", eposta: "a@kurum-a.test", kurum: KURUM_A }];
    const r = raporla({ profiller, atamalar }, { kayitlar, kapsam: new Set([KURUM_A]) });
    assert.deepEqual(r.roller.map((x) => [x.profil, x.oneri, x.bagi]), [
      ["p1", "is_yetkisi", "dogrulanabilir"],
      ["p2", "is_yetkisi", "olculemedi"],
    ]);
  });

  /* ArvoOS tarafı bütünüyle boşsa hiçbir bağ "doğrulanamadı" olmaz. */
  test("ArvoOS tarafı boşsa olumsuz hüküm üretilmez", () => {
    const r = raporla({ profiller, atamalar }, { kayitlar: [], kapsam: new Set() });
    assert.equal(r.ozet.dogrulanamadi, 0);
    assert.equal(r.ozet.olculemedi, 2);
    assert.equal(r.ozet.kapsamda_degil, 1);
  });
});

/*
  ÇIKTI YOLU DENETİMİ (25.11.2026, incelemede çıkan P2'nin regresyonu).

  Eskiden depo sınırı `process.cwd()` ile ölçülüyordu ve `scripts/` içinden
  verilen `--cikti ../gizli-rapor` geçiyordu: e-posta ve kimlik taşıyan rapor
  DEPO İÇİNE yazılabiliyordu. Üç şey birlikte sınanıyor — alt dizinden
  çağrı, henüz oluşturulmamış hedef ve depo içini gösteren bağlantı.
*/
describe("gercekYol", () => {
  let gecici = "";
  before(() => {
    gecici = mkdtempSync(join(tmpdir(), "l0-yol-"));
  });
  after(() => rmSync(gecici, { recursive: true, force: true }));

  test("var olan yol çözülür", () => {
    assert.equal(gercekYol(gecici), gercekYol(gecici));
    assert.equal(gercekYol(join(DEPO_KOKU, "scripts")), join(gercekYol(DEPO_KOKU), "scripts"));
  });

  /* Rapor dizini henüz YOK: realpath tek başına burada düşerdi. */
  test("henüz oluşturulmamış hedef, var olan atasına göre çözülür", () => {
    const hedef = join(gecici, "henuz-yok", "daha-derin");
    assert.equal(gercekYol(hedef), join(gercekYol(gecici), "henuz-yok", "daha-derin"));
  });

  test("hedefi VAR olan bağlantı çözülür", () => {
    const asil = join(gecici, "asil");
    mkdirSync(asil);
    symlinkSync(asil, join(gecici, "bag-var"));
    assert.equal(gercekYol(join(gecici, "bag-var")), gercekYol(asil));
  });

  /* En sinsi durum: bağlantının hedefi yok, realpath düşüyor, ama bağlantı
     depo içini gösteriyor. Lexical bir denetim bunu hiç görmez. */
  test("hedefi OLMAYAN bağlantı da çözülür", () => {
    const icerisi = join(DEPO_KOKU, "sizdiran-hedef");
    symlinkSync(icerisi, join(gecici, "bag-kirik"));
    assert.equal(gercekYol(join(gecici, "bag-kirik")), gercekYol(DEPO_KOKU) + "/sizdiran-hedef");
  });

  test("bağlantı döngüsü sonsuza gitmez", () => {
    symlinkSync(join(gecici, "d2"), join(gecici, "d1"));
    symlinkSync(join(gecici, "d1"), join(gecici, "d2"));
    assert.ok(gercekYol(join(gecici, "d1")).length > 0);
  });
});

describe("depoIcinde", () => {
  test("kökün kendisi ve altı içindedir", () => {
    assert.equal(depoIcinde("/depo", "/depo"), true);
    assert.equal(depoIcinde("/depo/rapor", "/depo"), true);
    assert.equal(depoIcinde("/depo/a/b/c", "/depo"), true);
  });

  /* Sınır path ayracıyla: aynı önekle başlayan KOMŞU dizin içinde değildir. */
  test("aynı önekli komşu dizin içinde değildir", () => {
    assert.equal(depoIcinde("/depo-yedek", "/depo"), false);
    assert.equal(depoIcinde("/depo-yedek/rapor", "/depo"), false);
    assert.equal(depoIcinde("/baska", "/depo"), false);
  });
});

describe("--cikti denetimi (alt dizinden çağrı)", () => {
  let gecici = "";
  before(() => {
    gecici = mkdtempSync(join(tmpdir(), "l0-cikti-"));
    // Ön koşul: geçici dizin gerçekten depo DIŞINDA olmalı, yoksa 2. senaryo anlamsız.
    assert.equal(depoIcinde(gercekYol(gecici), gercekYol(DEPO_KOKU)), false);
  });
  after(() => rmSync(gecici, { recursive: true, force: true }));

  /** Betiği `scripts/` içinden koşturur; veritabanı adresi ölü bir YEREL port. */
  const kostur = (cikti: string) =>
    spawnSync(process.execPath, ["--import", "../tests/register.mjs", "arvoos-eslestirme-raporu.mjs", "--cikti", cikti], {
      cwd: join(DEPO_KOKU, "scripts"),
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: "sahte-yerel" },
    });

  test("depo İÇİNE yönelen hedef reddedilir", () => {
    const s = kostur("../gizli-rapor");
    assert.equal(s.status, 1);
    assert.match(s.stderr, /--cikti depo içinde/);
    // Reddedilen yol GERÇEK yoluyla yazılıyor, çağıranın yazdığı göreli hâliyle değil.
    assert.match(s.stderr, /gizli-rapor/);
  });

  test("depo DIŞINDA geçerli hedef denetimi geçer", () => {
    const s = kostur(join(gecici, "dis-rapor"));
    assert.doesNotMatch(s.stderr, /depo içinde/, "denetim bu hedefi engellememeli");
    // Denetimi geçtiğinin kanıtı: akış veritabanı okumasına kadar gelmiş.
    assert.match(s.stderr, /okuma düştü/);
  });

  test("depo içini gösteren sembolik bağlantı engellenir", () => {
    const bag = join(gecici, "bag");
    symlinkSync(join(DEPO_KOKU, "sizdiran-rapor"), bag);
    const s = kostur(bag);
    assert.equal(s.status, 1);
    assert.match(s.stderr, /--cikti depo içinde/);
    assert.match(s.stderr, /sizdiran-rapor/, "bağlantının gösterdiği gerçek yol yazılmalı");
  });
});
