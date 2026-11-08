import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  _devirleriSifirla,
  bekleyenleriGonder,
  devirler,
  hataliDevriBirak,
  kayitDevret,
  yenidenDene,
  type Devir,
  type DevirSonucu,
} from "@/lib/bekleyen-kayit";

afterEach(() => _devirleriSifirla());
const hizli = { uyu: async () => {} };
const devir = (ek: Partial<Devir> & { gonder: () => Promise<DevirSonucu> }): Devir => ({
  anahtar: "c1",
  baslik: "Tez",
  adres: "/dashboard/editor/c1/write",
  taslakYazildi: true,
  ...ek,
});

describe("bekleyen kayıt devri", () => {
  it("başarılı devir listeden düşer", async () => {
    let gonderildi = 0;
    kayitDevret(devir({ gonder: async () => (gonderildi++, { tur: "kaydedildi" }) }));
    assert.equal(devirler()[0].durum, "bekliyor");
    await bekleyenleriGonder(hizli);
    assert.equal(gonderildi, 1);
    assert.equal(devirler().length, 0);
  });

  it("geçici hatada yeniden dener; sonunda başarırsa uyarı kalmaz", async () => {
    let n = 0;
    kayitDevret(devir({ gonder: async () => (++n < 3 ? { tur: "hata", neden: "ağ", kalici: false } : { tur: "kaydedildi" }) }));
    await bekleyenleriGonder({ ...hizli, yenidenDeneme: 2 });
    assert.equal(n, 3);
    assert.equal(devirler().length, 0);
  });

  it("geçici hata sürerse UYARI kalır (sessiz kayıp yok), nedeni yazılı", async () => {
    kayitDevret(devir({ gonder: async () => ({ tur: "hata", neden: "Bağlantı yok", kalici: false }) }));
    await bekleyenleriGonder({ ...hizli, yenidenDeneme: 1 });
    assert.equal(devirler().length, 1);
    assert.equal(devirler()[0].durum, "hata");
    assert.equal(devirler()[0].neden, "Bağlantı yok");
  });

  it("kalıcı hatada (oturum, yetki, çakışma) yeniden denemez", async () => {
    let n = 0;
    kayitDevret(devir({ gonder: async () => (n++, { tur: "hata", neden: "Oturum kapandı", kalici: true }) }));
    await bekleyenleriGonder({ ...hizli, yenidenDeneme: 5 });
    assert.equal(n, 1);
    assert.equal(devirler()[0].kalici, true);
  });

  it("gönderim fırlatırsa geçici hata sayılır", async () => {
    kayitDevret(devir({ gonder: async () => { throw new Error("Failed to fetch"); } }));
    await bekleyenleriGonder({ ...hizli, yenidenDeneme: 0 });
    assert.equal(devirler()[0].durum, "hata");
    assert.match(devirler()[0].neden ?? "", /Failed to fetch/);
  });

  it("aynı çalışmanın yeni devri eskisinin yerini alır (en güncel içerik gider)", async () => {
    const giden: string[] = [];
    kayitDevret(devir({ gonder: async () => (giden.push("eski"), { tur: "kaydedildi" }) }));
    kayitDevret(devir({ gonder: async () => (giden.push("yeni"), { tur: "kaydedildi" }) }));
    assert.equal(devirler().length, 1);
    await bekleyenleriGonder(hizli);
    assert.deepEqual(giden, ["yeni"]);
  });

  it("'Yeniden dene' hatalıyı sıraya alır; editör geri açılınca hatalı devir bırakılır", async () => {
    let basarsin = false;
    kayitDevret(devir({ gonder: async () => (basarsin ? { tur: "kaydedildi" } : { tur: "hata", neden: "ağ", kalici: false }) }));
    await bekleyenleriGonder({ ...hizli, yenidenDeneme: 0 });
    assert.equal(devirler()[0].durum, "hata");
    basarsin = true;
    yenidenDene("c1");
    await bekleyenleriGonder(hizli);
    assert.equal(devirler().length, 0);

    basarsin = false;
    kayitDevret(devir({ gonder: async () => ({ tur: "hata", neden: "ağ", kalici: false }) }));
    await bekleyenleriGonder({ ...hizli, yenidenDeneme: 0 });
    hataliDevriBirak("c1");
    assert.equal(devirler().length, 0);
  });

  it("bekleyen (hatalı olmayan) devir editör açılınca bırakılmaz: kayıt bitsin", () => {
    kayitDevret(devir({ gonder: async () => ({ tur: "kaydedildi" }) }));
    hataliDevriBirak("c1");
    assert.equal(devirler().length, 1);
  });
});
