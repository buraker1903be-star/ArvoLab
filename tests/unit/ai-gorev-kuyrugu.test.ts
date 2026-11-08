import assert from "node:assert/strict";
import test from "node:test";
import { KUYRUK_EN_FAZLA, gorevKuyrugu, type KuyrukGorevi } from "@/lib/ai-gorev-kuyrugu";

/*
  V4.3-0 P0-1: seçim menüsü görevlerinin sırası (lib/ai-gorev-kuyrugu.ts).

  Eski hata: tek yuvalı bekletme. Panel görevi alıp siliyor, önceki yanıt
  sürdüğü için gönderemiyordu: görev kayboluyordu. İlk test eski yöntemin
  bu kaybını deterministik olarak gösterir; ötekiler yeni sırayı sınar.
*/

const g = (gorev: KuyrukGorevi["gorev"], secimMetni: string, n = 1): KuyrukGorevi => ({ gorev, secimMetni, oneriId: `oneri-test-${n}` });

test("ESKİ YÖNTEM: tek yuva + 'al ve sil' + meşgulken erken dönüş görevi KAYBEDER", () => {
  let yuva: string | null = null;
  const gonder = (bekliyor: boolean) => (bekliyor ? "erken_dondu" : "gonderildi");
  // İstek sürüyor; kullanıcı menüden Kısalt'ı seçiyor.
  yuva = "kisalt";
  const alinan = yuva;
  yuva = null; // bekleyenGoreviAl(): al ve sil
  assert.equal(gonder(true), "erken_dondu");
  // Yanıt geldi: işlenecek görev kalmadı. Kullanıcının seçimi kayboldu.
  assert.equal(alinan, "kisalt");
  assert.equal(yuva, null);
});

test("yeni sıra: meşgulken eklenen görev yanıt gelene kadar bekler, sonra AYNI görev alınır", () => {
  const k = gorevKuyrugu();
  assert.equal(k.ekle(g("kisalt", "Birinci cümle.")), "eklendi");
  assert.equal(k.uzunluk(), 1);
  // Panel meşgul: almaz. Boşalınca alır.
  const alinan = k.al();
  assert.deepEqual(alinan, g("kisalt", "Birinci cümle."));
  assert.equal(k.uzunluk(), 0);
  assert.equal(k.al(), null, "aynı görev iki kez alınmaz");
});

test("sıra ilk giren ilk çıkar; her görev kendi seçimini taşır", () => {
  const k = gorevKuyrugu();
  k.ekle(g("akademik", "A", 1));
  k.ekle(g("genislet", "B", 2));
  assert.equal(k.al()?.secimMetni, "A");
  assert.equal(k.al()?.secimMetni, "B");
});

test("çift tıklama: aynı metin için aynı görev ikinci kez eklenmez", () => {
  const k = gorevKuyrugu();
  assert.equal(k.ekle(g("kisalt", "Aynı metin.", 1)), "eklendi");
  assert.equal(k.ekle(g("kisalt", "Aynı metin.", 2)), "yinelendi");
  assert.equal(k.ekle(g("akademik", "Aynı metin.", 3)), "eklendi", "farklı görev eklenir");
  assert.equal(k.uzunluk(), 2);
});

test("üst sınır: sıra doluysa eklenmez ve çağıran 'dolu' alır (görev sessizce düşmez)", () => {
  const k = gorevKuyrugu();
  for (let i = 0; i < KUYRUK_EN_FAZLA; i++) assert.equal(k.ekle(g("kisalt", `metin ${i}`, i)), "eklendi");
  assert.equal(k.ekle(g("kisalt", "fazla", 99)), "dolu");
  assert.equal(k.uzunluk(), KUYRUK_EN_FAZLA);
});

test("boşalt: çıkan görevler döner (aralıkları bırakılsın), sıra sıfırlanır", () => {
  const k = gorevKuyrugu();
  k.ekle(g("kisalt", "x", 1));
  k.ekle(g("genislet", "y", 2));
  const cikan = k.bosalt();
  assert.deepEqual(cikan.map((x) => x.oneriId), ["oneri-test-1", "oneri-test-2"]);
  assert.equal(k.uzunluk(), 0);
});
