import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { KAGIT_ANAHTARI, KAGIT_BETIGI, KAGIT_GOC_ANAHTARI, kagitCoz, kagitGocu, kagitOku } from "@/lib/kagit-gorunumu";
import { TEMA_ANAHTARI } from "@/lib/tema";

/*
  Akademik kâğıt görünümü (Phase 4.6 D4). Ön boyama betiği tema ve kenar
  betikleri gibi Node'un vm'inde, betiğin dokunduğu en küçük yüzeyle
  sınanır; göç kuralı saf kagitGocu ile BİREBİR karşılaştırılır (iki
  yerde yazılı kural sapmasın).
*/

test("kagitOku: yalnızca 'los' loş; geri kalan her şey açık (varsayılan)", () => {
  assert.equal(kagitOku("los"), "los");
  for (const ham of [null, undefined, "", "acik", "LOS", "dark", 1]) assert.equal(kagitOku(ham), "acik");
});

test("kagitCoz: açık temada kâğıt her zaman açık; koyu temada tercih", () => {
  assert.equal(kagitCoz("los", "light"), "acik");
  assert.equal(kagitCoz("acik", "light"), "acik");
  assert.equal(kagitCoz("los", "dark"), "los");
  assert.equal(kagitCoz("acik", "dark"), "acik");
});

test("kagitGocu: yalnızca açıkça koyu seçmiş, kâğıt tercihi olmayan kullanıcıya bir kez 'los'", () => {
  assert.equal(kagitGocu("dark", null, null), "los");
  assert.equal(kagitGocu("light", null, null), null);
  assert.equal(kagitGocu("system", null, null), null, "sistem teması tercih bildirmez: yeni varsayılan");
  assert.equal(kagitGocu(null, null, null), null, "yeni kullanıcı: yeni varsayılan");
  assert.equal(kagitGocu("dark", "acik", null), null, "var olan tercih ezilmez");
  assert.equal(kagitGocu("dark", null, "1"), null, "göç bir kez: sonradan koyu seçen yeni varsayılanı alır");
});

function ortam(depoBas: Record<string, string>, depoKapali = false) {
  const oznitelik: Record<string, string> = {};
  const depo = new Map<string, string>(Object.entries(depoBas));
  const dinleyiciler: Array<(o: { key: string | null }) => void> = [];
  vm.runInNewContext(KAGIT_BETIGI, {
    window: { addEventListener: (_: string, f: (o: { key: string | null }) => void) => dinleyiciler.push(f) },
    document: { documentElement: { setAttribute: (ad: string, deger: string) => (oznitelik[ad] = deger) } },
    localStorage: {
      getItem: (a: string) => {
        if (depoKapali) throw new Error("SecurityError");
        return depo.get(a) ?? null;
      },
      setItem: (a: string, d: string) => {
        if (depoKapali) throw new Error("SecurityError");
        depo.set(a, d);
      },
    },
  });
  return {
    kagit: () => oznitelik["data-kagit"],
    depo,
    baskaSekme(deger: string | null) {
      if (deger === null) depo.delete(KAGIT_ANAHTARI);
      else depo.set(KAGIT_ANAHTARI, deger);
      dinleyiciler.forEach((f) => f({ key: KAGIT_ANAHTARI }));
    },
  };
}

test("betik: öznitelik her zaman yazılır; varsayılan açık, 'los' loş", () => {
  assert.equal(ortam({}).kagit(), "acik");
  assert.equal(ortam({ [KAGIT_ANAHTARI]: "los", [KAGIT_GOC_ANAHTARI]: "1" }).kagit(), "los");
  assert.equal(ortam({ [KAGIT_ANAHTARI]: "acayip", [KAGIT_GOC_ANAHTARI]: "1" }).kagit(), "acik");
});

test("betik: göç kuralı kagitGocu ile birebir (bütün birleşimler)", () => {
  for (const tema of [null, "light", "dark", "system"]) for (const kagit of [null, "acik", "los"]) for (const goc of [null, "1"]) {
    const bas: Record<string, string> = {};
    if (tema) bas[TEMA_ANAHTARI] = tema;
    if (kagit) bas[KAGIT_ANAHTARI] = kagit;
    if (goc) bas[KAGIT_GOC_ANAHTARI] = goc;
    const o = ortam(bas);
    const beklenenKayit = kagitGocu(tema, kagit, goc) ?? kagit;
    assert.equal(o.depo.get(KAGIT_ANAHTARI) ?? null, beklenenKayit, `tema=${tema} kagit=${kagit} goc=${goc}`);
    assert.equal(o.depo.get(KAGIT_GOC_ANAHTARI), "1", "göç işareti her durumda yazılır");
    assert.equal(o.kagit(), kagitOku(beklenenKayit));
  }
});

test("betik: göç ikinci açılışta tekrar çalışmaz (sonradan koyu seçen açık kâğıt alır)", () => {
  const ilk = ortam({});
  assert.equal(ilk.depo.get(KAGIT_GOC_ANAHTARI), "1");
  const sonra = ortam({ ...Object.fromEntries(ilk.depo), [TEMA_ANAHTARI]: "dark" });
  assert.equal(sonra.depo.get(KAGIT_ANAHTARI) ?? null, null);
  assert.equal(sonra.kagit(), "acik");
});

test("betik: başka sekmedeki seçim bu sekmeye taşınır", () => {
  const o = ortam({ [KAGIT_GOC_ANAHTARI]: "1" });
  o.baskaSekme("los");
  assert.equal(o.kagit(), "los");
  o.baskaSekme(null);
  assert.equal(o.kagit(), "acik");
});

test("betik: depolama kapalıysa (gizli sekme) düşmez, açık kâğıt", () => {
  assert.equal(ortam({}, true).kagit(), "acik");
});
