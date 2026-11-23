import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ayrintiVar, bulguSatirlari } from "@/lib/kaynakca-bulgulari";
import { dikkatKategorileri, kaynakcaOzeti, otekiKategoriler, ozetVurgusu } from "@/lib/kaynakca-ozeti";

const METIN = { atifsiz: "atıfsız", karsiliksiz: "karşılıksız", bulunamayan: "bulunamadı", ulasilamayan: "ulaşılamadı" };

describe("kaynakça bulguları: künye + gerçek uyarı", () => {
  test("aynı künyenin uyarıları TEK satırda toplanıyor", () => {
    const satirlar = bulguSatirlari({
      references: [
        { raw: "Yılmaz, A. (2020). Bir çalışma.", issues: [
          { message: "Yazar biçimi", severity: "warning" },
          { message: "Yıl parantezi", severity: "warning" },
        ] },
        { raw: "Demir, B. (2019). Başka çalışma.", issues: [] },
      ],
    }, METIN);
    assert.equal(satirlar.length, 1);
    assert.equal(satirlar[0].anahtar, "bicimUyarili");
    assert.deepEqual(satirlar[0].uyarilar, ["Yazar biçimi", "Yıl parantezi"]);
  });

  test("hata ve uyarı karışıksa satır HATA kategorisine giriyor", () => {
    const satirlar = bulguSatirlari({
      references: [{ raw: "X", issues: [{ message: "a", severity: "warning" }, { message: "b", severity: "error" }] }],
    }, METIN);
    assert.equal(satirlar[0].anahtar, "bicimHatali");
  });

  test("çapraz kontrol, dizin ve kılavuz bulguları metinleriyle geliyor", () => {
    const satirlar = bulguSatirlari({
      references: [],
      crossCheck: { citationsWithoutReference: [{ raw: "(Kaya, 2021)" }], referencesWithoutCitation: [{ raw: "Ak, C. (2018)." }] },
      academicVerification: [
        { reference: "Bulunamayan künye", status: "not_found" },
        { reference: "Ulaşılamayan künye", status: "ulasilamadi" },
        { reference: "Doğrulanan künye", status: "verified" },
      ],
      tyk: [{ atif: "(Yılmaz)", aciklama: "Yıl yok" }],
    }, METIN);
    const bul = (a: string) => satirlar.find((s) => s.anahtar === a);
    assert.equal(bul("karsiliksizAtif")?.metin, "(Kaya, 2021)");
    assert.equal(bul("atifsizKaynak")?.metin, "Ak, C. (2018).");
    assert.equal(bul("bulunamayan")?.metin, "Bulunamayan künye");
    assert.equal(bul("ulasilamayan")?.metin, "Ulaşılamayan künye");
    assert.deepEqual(bul("kilavuzAtifi")?.uyarilar, ["Yıl yok"]);
    /* Doğrulanan künye bulgu DEĞİL. */
    assert.equal(satirlar.some((s) => s.metin === "Doğrulanan künye"), false);
  });

  test("sıralama ağırlığa göre: hata başta, geçici arıza sonda", () => {
    const satirlar = bulguSatirlari({
      references: [{ raw: "U", issues: [{ message: "u", severity: "warning" }] }, { raw: "H", issues: [{ message: "h", severity: "error" }] }],
      academicVerification: [{ reference: "G", status: "ulasilamadi" }],
      crossCheck: { citationsWithoutReference: [{ raw: "K" }], referencesWithoutCitation: [] },
    }, METIN);
    assert.deepEqual(satirlar.map((s) => s.anahtar), ["bicimHatali", "karsiliksizAtif", "bicimUyarili", "ulasilamayan"]);
  });

  test("eski kayıtta ayrıntı yoksa kategori için satır üretilmiyor", () => {
    /* Dizin listesi boş ama özet "1 bulunamayan" diyor: ekran kategori
       satırına düşmeli, ayrıntı uydurulmamalı. */
    const satirlar = bulguSatirlari({ references: [], academicVerification: [] }, METIN);
    assert.equal(satirlar.length, 0);
    assert.equal(ayrintiVar(satirlar, "bulunamayan"), false);
  });

  test("satır sayısı TOPLAM değildir: toplam özetten gelir", () => {
    const girdi = {
      references: [{ raw: "A", issues: [{ message: "x", severity: "warning" }, { message: "y", severity: "warning" }] }],
      crossCheck: { referencesWithoutCitation: [], citationsWithoutReference: [] },
      citations: [{}],
    };
    const ozet = kaynakcaOzeti(girdi);
    const satirlar = bulguSatirlari(girdi, METIN);
    /* İki uyarı tek künyede: özet 1 künye sayıyor, satır da 1. */
    assert.equal(ozet.acikSorun, 1);
    assert.equal(satirlar.length, 1);
  });
});

describe("özet vurgusu ve kategori sırası", () => {
  const kunye = (sev?: "error" | "warning") => ({ issues: sev ? [{ field: "a", message: "m", severity: sev }] : [] });
  test("tek kategorili bulguda türün kendisi vurgulanıyor", () => {
    const o = kaynakcaOzeti({ references: [kunye("warning"), kunye("warning"), kunye()], crossCheck: { referencesWithoutCitation: [], citationsWithoutReference: [] }, citations: [] });
    const v = ozetVurgusu(o);
    assert.equal(v.tur, "tek");
    assert.equal(v.anahtar, "bicimUyarili");
    assert.equal(v.sayi, 2);
  });
  test("çok kategorili bulguda toplam ve dağılım", () => {
    const o = kaynakcaOzeti({
      references: [kunye("error"), kunye("warning")],
      crossCheck: { referencesWithoutCitation: [{}], citationsWithoutReference: [] },
      citations: [{}],
    });
    const v = ozetVurgusu(o);
    assert.equal(v.tur, "coklu");
    assert.equal(v.sayi, o.acikSorun);
    assert.equal(v.dagilim.length, 3);
  });
  test("bulgu yoksa temiz", () => {
    const o = kaynakcaOzeti({ references: [kunye()], crossCheck: { referencesWithoutCitation: [], citationsWithoutReference: [] }, citations: [{}] });
    assert.equal(ozetVurgusu(o).tur, "temiz");
    assert.equal(dikkatKategorileri(o).length, 0);
    assert.equal(otekiKategoriler(o).length, o.kategoriler.length);
  });
  test("dikkat ve öteki kategoriler kesişmiyor, hepsini kapsıyor", () => {
    const o = kaynakcaOzeti({
      references: [kunye("error")],
      crossCheck: { referencesWithoutCitation: [], citationsWithoutReference: [{}] },
      citations: [{}],
      verificationSummary: { notFound: 0, unreachable: 1 },
      dogrulananSayisi: 1,
    });
    const d = dikkatKategorileri(o).map((k) => k.anahtar);
    const x = otekiKategoriler(o).map((k) => k.anahtar);
    assert.equal(d.length + x.length, o.kategoriler.length);
    assert.equal(d.some((k) => x.includes(k)), false);
    assert.equal(d[0], "bicimHatali");
  });
});

describe("Kaynakça ekranı yapısı", () => {
  const sayfa = readFileSync("app/dashboard/literature/page.tsx", "utf8");
  const stil = readFileSync("app/styles/genel-bakis.css", "utf8");

  test("sekmelerin altında tek şerit: durum, kapsam ve ana eylem", () => {
    assert.match(sayfa, /className="kaynakca-serit"/);
    assert.match(sayfa, /kaynakca-serit-ana/);
    assert.match(sayfa, /künye incelendi · son denetim/);
    assert.match(sayfa, /triggerClassName="projects-primary-button button-compact kaynakca-serit-eylem"/);
  });

  test("masaüstünde iki sütun: geniş bulgular, dar geçmiş", () => {
    assert.match(stil, /\.kaynakca-ikili \{ display: grid; grid-template-columns: minmax\(0, 2\.2fr\) minmax\(0, 1fr\)/);
    assert.match(sayfa, /className="gb-kart kaynakca-bulgular"/);
    assert.match(sayfa, /className="gb-kart kaynakca-gecmis-kart"/);
  });

  test("bulgu satırı künyeyi ve gerçek uyarıyı birlikte gösteriyor", () => {
    assert.match(sayfa, /gorunenBulgular\.map/);
    /* Her uyarı kendi satırında, tonlu noktasıyla (mockup). */
    assert.match(sayfa, /b\.uyarilar\.map\(\(u\) => \(/);
    assert.match(sayfa, /className="kaynakca-nokta" data-tone=\{TON\[b\.anahtar\]\}/);
    assert.match(sayfa, /className="kaynakca-satir"\s+href=\{ayrintiAdresi\}/);
  });

  test("Tüm kontroller kapalı başlıyor ve sayısı özetten geliyor", () => {
    assert.match(sayfa, /<details className="kaynakca-tum">/);
    assert.doesNotMatch(sayfa, /<details className="kaynakca-tum" open/);
    /* Sayı çizilen kategori satırlarından; bulgu satırlarından DEĞİL. */
    assert.match(sayfa, /Tüm kontroller \(\$\{dikkat\.length \+ otekiler\.length\}\)/);
    assert.doesNotMatch(sayfa, /Tüm kontroller \(\$\{(gorunenBulgular|bulgular)\.length\}\)/);
  });

  test("geçmişte son denetim tekrar edilmiyor", () => {
    assert.match(sayfa, /oncekiDenetimler\.slice\(1\)\.map/);
  });

  test("telefonda ana eylem kart genişliğinde, listeler negatif kenar boşluğu kullanmıyor", () => {
    assert.match(stil, /\.kaynakca-serit \.kaynakca-serit-eylem \{ width: 100%/);
    assert.match(stil, /\.kaynakca-liste \{ margin: 0; padding: 0; list-style: none; \}/);
  });
});
