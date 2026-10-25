import assert from "node:assert/strict";
import test from "node:test";
import { aciliyetOlc, siradakiIs } from "@/lib/siradaki-is";
import type { Adim } from "@/lib/calisma-ozeti";
import type { ChecklistItem } from "@/lib/submission-checklist";

const adim = (anahtar: string, tamam: boolean): Adim => ({
  anahtar,
  baslik: `${anahtar} başlığı`,
  aciklama: `${anahtar} açıklaması`,
  href: `/x/${anahtar}`,
  tamam,
});

const madde = (id: string, status: ChecklistItem["status"], action?: string): ChecklistItem => ({
  id,
  label: `${id} etiketi`,
  status,
  detail: `${id} ayrıntısı`,
  ...(action ? { action: { id: "insert-sections" as const, label: action } } : {}),
});

test("sıradaki iş", async (t) => {
  await t.test("kılavuzun zorunlu tuttuğu eksik her şeyin önünde", () => {
    /*
      Literatür hiç toplanmamış OLSA BİLE, teslimi engelleyen şey eksik
      bölümdür. "Biraz daha literatür topla" ondan sonra gelir.
    */
    const is = siradakiIs({
      calismaId: "c1",
      adimlar: [adim("literatur", false), adim("yazim", true)],
      eksikler: [madde("bolumler", "todo", "Eksik bölümleri ekle")],
      kalanGun: null,
    });
    assert.equal(is.baslik, "bolumler etiketi");
    assert.equal(is.href, "/dashboard/editor/c1/write?teslim=bolumler");
    assert.equal(is.eylem, "Eksik bölümleri ekle");
    assert.equal(is.bitti, false);
  });

  await t.test("eksik yoksa boru hattındaki ilk yarım birim", () => {
    const is = siradakiIs({
      calismaId: "c1",
      adimlar: [adim("literatur", true), adim("yazim", false), adim("kaynakca", false)],
      eksikler: [],
      kalanGun: null,
    });
    assert.equal(is.baslik, "yazim başlığı");
    assert.equal(is.href, "/x/yazim");
    assert.equal(is.eylem, "Başla");
  });

  await t.test("\"eksik\" ile \"bakılacak\" ayrı: eksik önce", () => {
    const is = siradakiIs({
      calismaId: "c1",
      adimlar: [],
      eksikler: [madde("kapak", "warning"), madde("bolumler", "todo")],
      kalanGun: null,
    });
    assert.equal(is.baslik, "bolumler etiketi");
  });

  await t.test("yalnızca bakılacak varsa o gösteriliyor", () => {
    const is = siradakiIs({ calismaId: "c1", adimlar: [], eksikler: [madde("kapak", "warning")], kalanGun: null });
    assert.equal(is.baslik, "kapak etiketi");
    assert.equal(is.eylem, "Teslim kontrolünde aç");
  });

  await t.test("iş kalmadığında \"hazır\" DENMİYOR", () => {
    /*
      Otomatik denetim danışman ve jüri kontrolünün yerini tutmuyor;
      "hazır" demek öğrenciyi yanlış güvene sokardı.
    */
    const is = siradakiIs({ calismaId: "c1", adimlar: [adim("yazim", true)], eksikler: [], kalanGun: null });
    assert.equal(is.bitti, true);
    assert.match(is.baslik, /hazır görünüyor/);
    assert.match(is.aciklama, /yerini tutmaz/);
    assert.ok(!/^Teslime hazır\.$/.test(is.baslik));
  });

  await t.test("teslim tarihi İŞİ değiştirmiyor, yalnızca aciliyeti", () => {
    const ortak = { calismaId: "c1", adimlar: [adim("yazim", false)], eksikler: [] };
    const uzak = siradakiIs({ ...ortak, kalanGun: 60 });
    const yakin = siradakiIs({ ...ortak, kalanGun: 3 });
    assert.equal(uzak.href, yakin.href);
    assert.equal(uzak.baslik, yakin.baslik);
    assert.equal(uzak.aciliyet, "normal");
    assert.equal(yakin.aciliyet, "acil");
  });

  await t.test("aciliyet eşikleri", () => {
    assert.equal(aciliyetOlc(null), "normal");
    assert.equal(aciliyetOlc(7), "acil");
    assert.equal(aciliyetOlc(8), "yaklasiyor");
    assert.equal(aciliyetOlc(21), "yaklasiyor");
    assert.equal(aciliyetOlc(22), "normal");
    // Tarih geçmişse de acil; eksi gün "normal"e düşmemeli.
    assert.equal(aciliyetOlc(-3), "acil");
  });
});

test("iş bir eksikten geldiyse kaynağı bildiriliyor", () => {
  /*
    Çağıran o maddeyi kendi listesinden çıkarıyor: aynı eksik hem
    "şimdi" satırında hem alttaki listede yazarsa, sayfanın geri
    kalanında temizlediğimiz tekrarın aynısı olurdu.
  */
  const eksikten = siradakiIs({
    calismaId: "c1",
    adimlar: [],
    eksikler: [madde("bolumler", "todo")],
    kalanGun: null,
  });
  assert.equal(eksikten.kaynakMadde, "bolumler");

  // Birimden gelen işin kaynağı yok: liste zaten onu içermiyor.
  const birimden = siradakiIs({
    calismaId: "c1",
    adimlar: [adim("literatur", false)],
    eksikler: [],
    kalanGun: null,
  });
  assert.equal(birimden.kaynakMadde, undefined);
});
