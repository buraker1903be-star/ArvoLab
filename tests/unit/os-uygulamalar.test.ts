/*
  DOCK KABUĞUNUN UYGULAMA LİSTESİ.

  Dock, bölüm şeridi, başlatıcı, üst çubuktaki uygulama adı ve Ctrl+K
  aynı listeden besleniyor. Liste ikiye ayrılsaydı biri güncellenip
  öteki unutulurdu — ArvoARC'ta tam bu olmuştu (sol menü ayrı, komut
  paleti ayrı, mobil menü ayrı).
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { KAYIT_ROLLERI } from "@/lib/ai/kayit-gorunum";
import {
  ANA_SAYFA,
  docktakiler,
  etkinBolum,
  etkinUygulama,
  gorunenUygulamalar,
  labUygulamalari,
} from "@/lib/os/uygulamalar";

const uygulamalar = labUygulamalari();

describe("açık uygulama yoldan bulunuyor", () => {
  test("ANA SAYFA yalnızca TAM eşleşmede seçiliyor", () => {
    /*
      "/dashboard" her sayfanın öneki; önek eşleşmesine bırakılsaydı
      bütün panel Ana Sayfa'da görünür, dock hiçbir zaman doğru
      simgeyi işaretlemezdi.
    */
    assert.equal(etkinUygulama(uygulamalar, ANA_SAYFA)?.key, "home");
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/analysis")?.key, "analiz");
  });

  test("alt sayfa kendi uygulamasında kalıyor", () => {
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/editor/abc/write")?.key, "tez");
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/documents/123")?.key, "belge");
  });

  test("tanınmayan yol hiçbir uygulamaya düşmüyor", () => {
    /* Uydurma bir eşleşme, dock'ta yanlış simgeyi işaretlerdi. */
    assert.equal(etkinUygulama(uygulamalar, "/baska/yer"), null);
  });

  test("EN UZUN ÖNEK kazanıyor", () => {
    /* Destek uygulaması iki yol taşıyor; ikisi de kendi uygulamasına
       düşmeli, biri ötekini gölgelememeli. */
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/support")?.key, "destek");
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/expert-requests")?.key, "destek");
  });
});

describe("bölümler", () => {
  test("destek iki bölüme ayrılıyor", () => {
    const destek = uygulamalar.find((u) => u.key === "destek")!;
    assert.equal(destek.bolumler?.length, 2);
    assert.equal(etkinBolum(destek.bolumler!, "/dashboard/support")?.key, "uygulama");
    assert.equal(etkinBolum(destek.bolumler!, "/dashboard/expert-requests")?.key, "uzman");
  });
});

describe("görünürlük", () => {
  test("ROLE BAĞLI uygulamalar dock'ta yer kaplamıyor", () => {
    /* İç ekibin günde bir kez açtığı sayfalar, öğrencinin her gün
       gördüğü simgelerin arasına girmemeli. */
    const dock = docktakiler(uygulamalar).map((u) => u.key);
    for (const gizli of ["asistan", "ekip", "olcum"]) {
      assert.ok(!dock.includes(gizli), gizli);
    }
    assert.ok(dock.includes("analiz"));
  });

  test("yetkisi olmayan kullanıcıdan TAMAMEN gizleniyor", () => {
    /* Başlatıcıda da görünmemeli: adresini bilmeden bulunamayan bir
       sayfa, menüde görünüp açılmayan sayfadan iyidir. */
    const ogrenci = gorunenUygulamalar(uygulamalar, "client").map((u) => u.key);
    assert.ok(!ogrenci.includes("ekip"));
    assert.ok(ogrenci.includes("tez"));

    const kurucu = gorunenUygulamalar(uygulamalar, "founder").map((u) => u.key);
    assert.ok(kurucu.includes("ekip"));
  });

  test("rolü olmayan ziyaretçide kısıtlı uygulama yok", () => {
    const yok = gorunenUygulamalar(uygulamalar, undefined).map((u) => u.key);
    assert.ok(!yok.includes("asistan"));
  });
});

describe("liste tutarlılığı", () => {
  test("anahtarlar ve adresler BENZERSİZ", () => {
    /* Çift anahtar, React listesinde sessizce yanlış öğeyi
       güncellemeye yol açar. */
    const anahtarlar = uygulamalar.map((u) => u.key);
    assert.equal(new Set(anahtarlar).size, anahtarlar.length);
    const adresler = uygulamalar.map((u) => u.href);
    assert.equal(new Set(adresler).size, adresler.length);
  });

  test("Ana Sayfa dışında her uygulamanın yolu var", () => {
    for (const u of uygulamalar) {
      if (u.key === "home") continue;
      assert.ok(u.yollar.length > 0, `${u.key} yolsuz: dock'ta hiç etkin olmaz`);
    }
  });
});

test("başlatıcıdaki rol kapıları sayfanın kendi kapısıyla aynı", () => {
  const asistan = labUygulamalari().find((u) => u.key === "asistan");
  /*
    Liste bir dönem rolleri ELLE taşıyordu ve "controller" düşmüştü:
    Kontrolör, yetkisi olduğu sayfayı başlatıcıda hiç görmüyordu.
    Kapı sayfanın kendi sabitinden gelmeli.
  */
  assert.deepEqual(asistan?.roller, KAYIT_ROLLERI);
  assert.ok(asistan?.roller?.includes("controller"));
});
