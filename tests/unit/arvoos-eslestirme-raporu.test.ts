import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { UserRole } from "@/lib/project-labels";
import { anlikOku, raporla, saltOkunurFetch } from "../../scripts/arvoos-eslestirme-raporu.mjs";

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
  const ic = async (_url: unknown, _secenek?: { method?: string }) => {
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

  /* ArvoOS tarafı bütünüyle boşsa hiçbir bağ "doğrulanamadı" olmaz. */
  test("ArvoOS tarafı boşsa olumsuz hüküm üretilmez", () => {
    const r = raporla({ profiller, atamalar }, { kayitlar: [], kapsam: new Set() });
    assert.equal(r.ozet.dogrulanamadi, 0);
    assert.equal(r.ozet.olculemedi, 2);
    assert.equal(r.ozet.kapsamda_degil, 1);
  });
});
