import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kisaOzet, kullanimOzeti } from "@/lib/kullanim-ozeti";

/*
  Menüdeki "Kullanım" satırı SAYI UYDURMAZ: sınırsız hak, tükenmiş hak
  ve verisi alınamayan hak birbirinden ayrı. "0 kredi" yazmak, hakkı
  olmayanla ölçümü okunamayanı aynı göstermek olurdu.
*/
const satir = (x: Partial<Parameters<typeof kullanimOzeti>[0]["kredi"]> = {}) => ({
  kullanilan_karakter: 0,
  limit_kredi: 1000,
  aylik_kalan: 800,
  ek_bakiye: 0,
  bildirildi: true,
  ic_ekip: false,
  ...x,
}) as NonNullable<Parameters<typeof kullanimOzeti>[0]["kredi"]>;

describe("kullanım özeti", () => {
  test("sayılı hak: kalan ve toplam, satın alınan bakiye dahil", () => {
    const [kredi] = kullanimOzeti({ kredi: satir({ aylik_kalan: 800, ek_bakiye: 500 }), deneme: null, yenilenme: "2026-12-01T00:00:00Z" });
    assert.equal(kredi.durum, "sayili");
    assert.equal(kredi.kalan, 1300);
    assert.equal(kredi.toplam, 1500);
    assert.equal(kredi.yenilenme, "2026-12-01T00:00:00Z");
  });

  test("tükenmiş hak ayrı durumdur", () => {
    const [kredi] = kullanimOzeti({ kredi: satir({ aylik_kalan: 0, ek_bakiye: 0 }), deneme: null, yenilenme: null });
    assert.equal(kredi.durum, "tukendi");
    assert.equal(kredi.kalan, 0);
  });

  test("iç ekipte sınırsız yazıyor, sayı değil", () => {
    const [kredi] = kullanimOzeti({ kredi: satir({ ic_ekip: true }), deneme: null, yenilenme: null });
    assert.equal(kredi.durum, "sinirsiz");
    assert.equal(kredi.kalan, null);
  });

  test("okunamayan ve bildirilmemiş hak 'bilinmiyor' (0 DEĞİL)", () => {
    for (const girdi of [
      { kredi: null, deneme: null, yenilenme: null },
      { kredi: satir({ bildirildi: false }), deneme: null, yenilenme: null },
      { kredi: satir({ limit_kredi: null }), deneme: null, yenilenme: null },
    ]) {
      const [kredi] = kullanimOzeti(girdi);
      assert.equal(kredi.durum, "bilinmiyor");
      assert.equal(kredi.kalan, null);
    }
  });

  test("denemedeki kullanıcıda deneme hakkı ikinci satır", () => {
    const satirlar = kullanimOzeti({ kredi: null, deneme: { kalan: 1, toplam: 2 }, yenilenme: null });
    assert.equal(satirlar.length, 2);
    assert.equal(satirlar[1].anahtar, "denemeHakki");
    assert.equal(satirlar[1].durum, "sayili");
    assert.equal(satirlar[1].kalan, 1);
    const bitmis = kullanimOzeti({ kredi: null, deneme: { kalan: 0, toplam: 2 }, yenilenme: null });
    assert.equal(bitmis[1].durum, "tukendi");
  });

  test("kısa özet sayılı hakkı seçiyor", () => {
    const satirlar = kullanimOzeti({ kredi: satir(), deneme: { kalan: 1, toplam: 2 }, yenilenme: null });
    assert.equal(kisaOzet(satirlar)?.anahtar, "asistanKredisi");
    const yalnizBilinmiyor = kullanimOzeti({ kredi: null, deneme: null, yenilenme: null });
    assert.equal(kisaOzet(yalnizBilinmiyor)?.durum, "bilinmiyor");
  });

  test("abonelik ekranıyla AYNI kaynaklar okunuyor", () => {
    const okuyucu = readFileSync("lib/kullanim-haklarim.ts", "utf8");
    const abonelik = readFileSync("app/dashboard/abonelik/page.tsx", "utf8");
    for (const kaynak of ["ai_kredi_durumum", "denemeAsistanHakkim"]) {
      assert.ok(okuyucu.includes(kaynak), kaynak);
      assert.ok(abonelik.includes(kaynak), kaynak);
    }
  });
});

describe("gezinme ve hesap menüsü", () => {
  const menu = readFileSync("app/dashboard/_components/kullanici-menusu.tsx", "utf8");
  const gezinme = readFileSync("app/dashboard/_components/os-gezinme.tsx", "utf8");
  const stil = readFileSync("app/styles/shell.css", "utf8");

  test("sol gezinmede Ayarlar yok", () => {
    assert.doesNotMatch(gezinme, /os-gezinme-ayar">\{oge\(ayarlar\)\}/);
    assert.doesNotMatch(gezinme, /const ayarlar = uygulamalar\.find/);
  });

  test("menüde dil seçici ve teknik araçlar yok, Ayarlar bağlantısı duruyor", () => {
    assert.doesNotMatch(menu, /<DilSecici/);
    assert.doesNotMatch(menu, /personelAraclari\.map/);
    /* Ayarlar ve Abonelik merkezi listeden geliyor. */
    assert.match(menu, /hesapBaglantilari\.map/);
  });

  test("dil seçici telefonda gizlenmiyor", () => {
    assert.doesNotMatch(stil, /@media \(max-width: 760px\) \{ \.ust-dil \{ display: none; \} \}/);
  });

  test("Kullanım satırı Ayarlar bağlantılarının HEMEN ÜSTÜNDE ve katlanır", () => {
    const kullanim = menu.indexOf('className="os-kullanici-kullanim"');
    const baglantilar = menu.indexOf('className="os-kullanici-baglantilar"');
    assert.ok(kullanim > 0 && kullanim < baglantilar);
    assert.match(menu, /<details className="os-kullanici-kullanim">/);
    assert.match(stil, /\.os-kullanici-kullanim > summary \{/);
  });

  test("üç özel durum menüde ayrı yazılıyor", () => {
    assert.match(menu, /tr: "Sınırsız", en: "Unlimited"/);
    assert.match(menu, /tr: "Tükendi", en: "Used up"/);
    assert.match(menu, /tr: "Bilgi alınamadı", en: "Not available"/);
  });
});
