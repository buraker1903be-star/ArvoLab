import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { KENAR_ANAHTARI, KENAR_BETIGI, kenarOku } from "@/lib/os/kenar";

/*
  Kenar çubuğu tercihi (Signature OS). Ön boyama betiği tema betiği gibi
  Node'un vm'inde, betiğin dokunduğu en küçük yüzeyle sınanır.
*/

test("kenarOku: yalnızca 'dar' dar; geri kalan her şey geniş", () => {
  assert.equal(kenarOku("dar"), "dar");
  for (const ham of [null, undefined, "", "genis", "DAR", 1]) assert.equal(kenarOku(ham), "genis");
});

function ortam(kayit: string | null, depoKapali = false) {
  const oznitelik: Record<string, string> = {};
  const depo = new Map<string, string>();
  if (kayit !== null) depo.set(KENAR_ANAHTARI, kayit);
  const dinleyiciler: Array<(o: { key: string | null }) => void> = [];
  vm.runInNewContext(KENAR_BETIGI, {
    window: { addEventListener: (_: string, f: (o: { key: string | null }) => void) => dinleyiciler.push(f) },
    document: {
      documentElement: {
        setAttribute: (ad: string, deger: string) => (oznitelik[ad] = deger),
        removeAttribute: (ad: string) => delete oznitelik[ad],
      },
    },
    localStorage: {
      getItem: (a: string) => {
        if (depoKapali) throw new Error("SecurityError");
        return depo.get(a) ?? null;
      },
    },
  });
  return {
    kenar: () => oznitelik["data-kenar"],
    baskaSekme(deger: string | null) {
      if (deger === null) depo.delete(KENAR_ANAHTARI);
      else depo.set(KENAR_ANAHTARI, deger);
      dinleyiciler.forEach((f) => f({ key: KENAR_ANAHTARI }));
    },
  };
}

test("betik: 'dar' kaydı boyamadan önce özniteliğe yazılır", () => {
  assert.equal(ortam("dar").kenar(), "dar");
});

test("betik: kayıt yoksa ya da tanınmıyorsa öznitelik yok (geniş)", () => {
  assert.equal(ortam(null).kenar(), undefined);
  assert.equal(ortam("yarim").kenar(), undefined);
});

test("betik: depolama kapalıysa düşmez, geniş kalır", () => {
  assert.equal(ortam("dar", true).kenar(), undefined);
});

test("betik: başka sekmedeki seçim bu sekmeye geçer", () => {
  const o = ortam(null);
  o.baskaSekme("dar");
  assert.equal(o.kenar(), "dar");
  o.baskaSekme(null);
  assert.equal(o.kenar(), undefined);
});
