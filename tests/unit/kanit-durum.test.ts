import assert from "node:assert/strict";
import test from "node:test";
import { durumRozetleri, gecerliDestek, kanitZinciri, matrisOzeti, sonrakiAdim, type KanitKaydi } from "@/lib/kanit/durum";

const BOS: KanitKaydi = {
  id: "k1",
  iddia: "Harmanlanmış öğrenme öz-yeterliği artırır.",
  bolum: null,
  atif: null,
  kaynak_id: null,
  kunye_durumu: "bakilmadi",
  kunye_kaynagi: null,
  kunye_bakildi: null,
  erisim_durumu: "bilinmiyor",
  erisim_adresi: null,
  incelenen_metin: null,
  incelenen_kapsam: null,
  incelenen_surum: null,
  konum: null,
  alinti: null,
  destek_duzeyi: "degerlendirilmedi",
  degerlendiren: null,
  gerekce: null,
  degerlendirildi: null,
  insan_incelemesi: "bekliyor",
  celisen: null,
  eksik_kanit: null,
  duzeltme: null,
};

const anahtarlar = (k: KanitKaydi) => durumRozetleri(k).map((r) => r.anahtar);

test("künyenin doğrulanmış olması iddiayı desteklediği anlamına gelmez", () => {
  const k = { ...BOS, kaynak_id: "s1", kunye_durumu: "dogrulandi" as const, kunye_kaynagi: "crossref" as const };
  const rozetler = durumRozetleri(k);
  assert.ok(rozetler.some((r) => r.etiket === "Kaynak kaydı doğrulandı"));
  assert.ok(!anahtarlar(k).includes("uyum"), "uyum rozeti olmamalı");
  assert.ok(anahtarlar(k).includes("erisim"), "metin yokken erişim yetersizliği söylenmeli");
  assert.match(rozetler[0].aciklama, /desteklediğini göstermez/);
});

test("metinsiz bir 'doğrudan' hükmü (bozuk satır) doğrulanamadı sayılır", () => {
  assert.equal(gecerliDestek({ destek_duzeyi: "dogrudan", incelenen_metin: null, alinti: null }), "dogrulanamadi");
  assert.equal(gecerliDestek({ destek_duzeyi: "dogrudan", incelenen_metin: "m", alinti: "a" }), "dogrudan");
});

test("bölüm incelendi ile tam metin incelendi ayrı; asistan hükmü insan incelemesi ister", () => {
  const k: KanitKaydi = { ...BOS, incelenen_metin: "metin", incelenen_kapsam: "bolum", alinti: "alıntı", destek_duzeyi: "dogrudan", degerlendiren: "asistan" };
  const etiketler = durumRozetleri(k).map((r) => r.etiket);
  assert.ok(etiketler.includes("İlgili bölüm incelendi"));
  assert.ok(!etiketler.includes("Tam metin incelendi"));
  assert.ok(etiketler.includes("İddia ile kanıt uyumlu görünüyor"));
  assert.ok(etiketler.includes("İnsan incelemesi öneriliyor"));
  assert.ok(!durumRozetleri({ ...k, insan_incelemesi: "yapildi" }).some((r) => r.anahtar === "insan"));
});

test("zincir eksik halkaları tahminle doldurmaz", () => {
  const zincir = kanitZinciri({ ...BOS, incelenen_metin: "m", alinti: "Bir cümle burada kanıt olarak duruyor." }, null);
  assert.deepEqual(zincir.map((h) => h.anahtar), ["iddia", "atif", "kaynak", "yayin", "kanit", "sonuc"]);
  assert.equal(zincir[1].durum, "eksik");
  assert.equal(zincir[2].durum, "eksik");
  const kanit = zincir[4];
  assert.equal(kanit.durum, "kismi");
  assert.match(kanit.metin, /konum belirtilmedi/);
});

test("açık erişim varken kanıt halkası metnin incelenmediğini söyler ve adresi verir", () => {
  const zincir = kanitZinciri({ ...BOS, erisim_durumu: "acik_erisim", erisim_adresi: "https://oa/x" }, null);
  assert.match(zincir[4].metin, /henüz incelenmedi/);
  assert.equal(zincir[4].adres, "https://oa/x");
});

test("matris özeti listenin tamamından sayar", () => {
  const ozet = matrisOzeti([
    { ...BOS, incelenen_metin: "m", alinti: "a", destek_duzeyi: "dogrudan", degerlendiren: "kullanici", insan_incelemesi: "yapildi" },
    { ...BOS, incelenen_metin: "m", alinti: "a", destek_duzeyi: "celisiyor", degerlendiren: "asistan" },
    { ...BOS, incelenen_metin: "m", alinti: "a", destek_duzeyi: "dolayli", degerlendiren: "kullanici", kunye_durumu: "uyusmuyor", kunye_kaynagi: "crossref" },
    BOS,
  ]);
  assert.deepEqual(ozet, { toplam: 4, dogrudan: 1, zayif: 1, celisen: 1, degerlendirilmemis: 1, kunyeSorunlu: 1, incelemeBekleyen: 2 });
});

test("sonraki adım zincirin ilk eksik halkasını gösterir", () => {
  assert.match(sonrakiAdim(BOS), /kaynağı bağlayın/);
  assert.match(sonrakiAdim({ ...BOS, kaynak_id: "s" }), /Künyeyi/);
  assert.match(sonrakiAdim({ ...BOS, kaynak_id: "s", kunye_durumu: "dogrulandi", kunye_kaynagi: "crossref" }), /ilgili bölümü ekleyin/);
  assert.equal(sonrakiAdim({ ...BOS, duzeltme: "Kendi notum" }), "Kendi notum");
});

test("İngilizce arayüz: rozet, zincir ve sonraki adım", () => {
  const k: KanitKaydi = { ...BOS, kaynak_id: "s1", kunye_durumu: "uyusmuyor", kunye_kaynagi: "crossref", incelenen_metin: "metin", alinti: "alıntı", destek_duzeyi: "celisiyor" };
  const rozetler = durumRozetleri(k, "en");
  assert.equal(rozetler.find((r) => r.anahtar === "kunye")?.etiket, "Citation details do not match the index record");
  assert.equal(rozetler.find((r) => r.anahtar === "uyum")?.aciklama, "The reviewed evidence contradicts the claim.");
  assert.equal(rozetler.find((r) => r.anahtar === "insan")?.aciklama, "The evidence appears to contradict the claim; revisit the claim.");
  const zincir = kanitZinciri(k, null, "en");
  assert.equal(zincir.find((h) => h.anahtar === "atif")?.baslik, "In-text citation");
  assert.equal(zincir.find((h) => h.anahtar === "kanit")?.metin, "“alıntı” — location not specified · from the added section");
  assert.equal(zincir.find((h) => h.anahtar === "sonuc")?.metin, "Contradicts");
  assert.equal(sonrakiAdim(k, "en"), "Compare the reference-list entry with the index record and correct it.");
  // Kullanıcının kendi yazdığı düzeltme çevrilmez.
  assert.equal(sonrakiAdim({ ...k, duzeltme: "Kendi notum" }, "en"), "Kendi notum");
});
