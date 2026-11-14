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
  aramaAnahtari,
  osSayfalari,
  komutHedefleri,
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
  test("hiçbir dock uygulaması sekme şeridi çizmiyor: modüller tek sayfa", () => {
    // Kaynaklar ve Destek iki bölümlüydü; ikisi de iki kartlı tek sayfa oldu.
    for (const u of uygulamalar) assert.equal(u.bolumler, undefined, u.key);
    assert.equal(etkinBolum([], "/dashboard/support"), null);
  });
});

describe("görünürlük", () => {
  test("ROLE BAĞLI uygulamalar dock'ta yer kaplamıyor", () => {
    /* İç ekibin günde bir kez açtığı sayfalar, öğrencinin her gün
       gördüğü simgelerin arasına girmemeli. */
    const dock = docktakiler(uygulamalar).map((u) => u.key);
    for (const gizli of ["asistan", "ekip"]) {
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
  /* 26.10.2026'dan beri yalnızca iç ekip (lib/ai/kayit-gorunum.ts): kurum
     personeli Asistan Kayıtları'nı başlatıcıda da görmemeli. */
  for (const rol of ["controller", "academic_manager", "expert", "employee", "client"]) {
    assert.equal(gorunenUygulamalar(labUygulamalari(), rol).some((u) => u.key === "asistan"), false, rol);
  }
  for (const rol of ["system_admin", "founder"]) {
    assert.ok(gorunenUygulamalar(labUygulamalari(), rol).some((u) => u.key === "asistan"), rol);
  }
});

describe("Ctrl+K araması", () => {
  test("Türkçe büyük harf aramayı bozmuyor", () => {
    // "İ" ve "I" düz toLowerCase ile "i̇" ve "I" kalıyor; kullanıcı kendi
    // yazdığı başlığı bulamıyordu.
    assert.equal(aramaAnahtari("LİTERATÜR"), aramaAnahtari("literatür"));
    assert.equal(aramaAnahtari("KAYNAKÇA"), aramaAnahtari("kaynakça"));
    assert.equal(aramaAnahtari("Analiz"), "analiz");
    assert.ok(aramaAnahtari("Doçentlik Puanı").includes(aramaAnahtari("docentlik")));
  });

  test("başlatıcıya ayrılmış uygulamalar da aranabiliyor", () => {
    // Palet uygulamaları komutHedefleri'nden alıyor (osSayfalari artık
    // yalnızca gerçek alt bölümleri döndürüyor, 14.11.2026).
    const sayfalar = komutHedefleri(uygulamalar);
    assert.ok(sayfalar.some((s) => s.href === "/dashboard/team"));
    // Yönlenen eski adresler (sekmeli dönemin bölümleri) aramada çıkmıyor:
    // Destek ve Kaynaklar uygulamanın kendisiyle aranıyor.
    assert.ok(!sayfalar.some((s) => s.href === "/dashboard/support" || s.href === "/dashboard/citations"));
  });
});

describe("sade dock (26.10.2026: modüller birleştirildi)", () => {
  test("dock yedi uygulama, sırası günlük işin sırası", () => {
    /* Kılavuz kataloğu ve doçentlik dock'a geri girerse yer kaplayan
       ama öğrencinin her gün kullanmadığı simgeler geri gelir. */
    assert.deepEqual(docktakiler(gorunenUygulamalar(uygulamalar, "client")).map((u) => u.key), [
      "home", "tez", "kaynaklar", "analiz", "belge", "destek", "ayarlar",
    ]);
  });

  test("literatür ve kaynakça tek uygulama, tek sayfa: bölüm (sekme) yok", () => {
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/literature")?.key, "kaynaklar");
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/citations")?.key, "kaynaklar");
    const kaynaklar = uygulamalar.find((u) => u.key === "kaynaklar")!;
    // Bölüm listesi dock'ta sekme şeridi çiziyordu; iki kart tek sayfada.
    assert.equal(kaynaklar.bolumler, undefined);
  });

  test("doçentlik yalnızca personelin başlatıcısında; kılavuz kataloğu kaldırıldı", () => {
    // Doçentlik puanı öğrencinin işi değil. Kılavuz kataloğu 26.10.2026'da
    // kaldırıldı: kılavuz her çalışmaya öğrencinin kendisi tarafından yükleniyor.
    assert.equal(uygulamalar.some((u) => u.href === "/dashboard/guidelines"), false);
    const personelSayfalari = ["/dashboard/associate-professorship"];
    const ogrenci = komutHedefleri(gorunenUygulamalar(uygulamalar, "client")).map((s) => s.href);
    // Önizlemede rol yok sayılır (layout): rolsüz kullanıcı da görmez.
    const rolsuz = komutHedefleri(gorunenUygulamalar(uygulamalar, undefined)).map((s) => s.href);
    for (const href of personelSayfalari) {
      assert.ok(!ogrenci.includes(href), href);
      assert.ok(!rolsuz.includes(href), href);
      for (const rol of ["employee", "academic_manager", "controller", "expert", "system_admin", "founder"]) {
        assert.ok(komutHedefleri(gorunenUygulamalar(uygulamalar, rol)).some((s) => s.href === href), `${rol} ${href}`);
      }
    }
  });

  test("çalışmanın sekmeleri (kanıt, makale) Çalışmalarım'da kalıyor", () => {
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/editor/abc/kanit")?.key, "tez");
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/editor/abc/makale")?.key, "tez");
  });
});

test("doçentlik yalnızca Türkçe arayüzde (28.10.2026)", () => {
  // ÜAK puanı Türk akademik sistemine ait; İngilizce arayüzde karşılığı yok.
  assert.ok(gorunenUygulamalar(labUygulamalari(), "expert", "tr").some((u) => u.key === "docentlik"));
  assert.equal(gorunenUygulamalar(labUygulamalari(), "expert", "en").some((u) => u.key === "docentlik"), false);
});

/* Phase 3 (04.11.2026): uyarlanır gezinme tek listeden üç biçim; çalışma bağlamı. */
import { ALT_CUBUK, anaUygulamalar, calismaBaglantilari, calismaIcindeMi, dahaFazlasi, etkinBaglanti, hesapUygulamalari, personelAraclari } from "@/lib/os/uygulamalar";
import { ekranSinifi } from "@/lib/os/kirilimlar";

test("gezinme yerleri: her uygulama tam olarak bir yerde, hiçbiri kaybolmuyor", () => {
  // Phase 5.1d-3: ana gezinme + hesap menüsü (hesap ve personel araçları).
  const hepsi = labUygulamalari();
  const yerlesen = [...anaUygulamalar(hepsi), ...hesapUygulamalari(hepsi), ...personelAraclari(hepsi)].map((u) => u.key).sort();
  assert.deepEqual(yerlesen, hepsi.map((u) => u.key).sort());
});

test("telefonda alt çubuk + Daha fazla, personel araçları dışında bütün uygulamaları kapsar", () => {
  // Personel araçları telefonda da hesap menüsünde (5.1d-3); hesap sayfaları Daha fazla'da KALIR.
  const hepsi = labUygulamalari();
  const cubuk = hepsi.filter((u) => (ALT_CUBUK as readonly string[]).includes(u.key));
  assert.equal(cubuk.length, ALT_CUBUK.length, "alt çubuktaki her anahtar listede olmalı");
  assert.equal(cubuk.length + dahaFazlasi(hepsi).length + personelAraclari(hepsi).length, hepsi.length);
  const daha = dahaFazlasi(hepsi).map((u) => u.key);
  for (const k of ["ayarlar", "yardim", "abonelik"]) assert.ok(daha.includes(k), k);
  for (const k of ["docentlik", "asistan", "ekip"]) assert.ok(!daha.includes(k), k);
});

test("ekran sınıfı kırılımları", () => {
  assert.equal(ekranSinifi(390), "telefon");
  assert.equal(ekranSinifi(760), "telefon");
  assert.equal(ekranSinifi(761), "tablet");
  assert.equal(ekranSinifi(1199), "tablet");
  assert.equal(ekranSinifi(1200), "masaustu");
});

test("çalışma bağlamı: Makale yalnızca makale türünde, araçlar çalışmaya süzülü", () => {
  const tez = calismaBaglantilari({ id: "c1", baslik: "Tez", tur: "thesis" });
  const makale = calismaBaglantilari({ id: "c1", baslik: "M", tur: "article" });
  assert.equal(tez.some((b) => b.key === "makale"), false);
  assert.equal(makale.some((b) => b.key === "makale"), true);
  assert.equal(tez.find((b) => b.key === "kaynaklar")?.href, "/dashboard/literature?calisma=c1");
});

test("bağlam yalnızca o çalışmanın sayfalarında görünür", () => {
  const q = (s: string) => new URLSearchParams(s);
  assert.equal(calismaIcindeMi("c1", "/dashboard/editor/c1/write", q("")), true);
  assert.equal(calismaIcindeMi("c1", "/dashboard/editor", q("sec=c1")), true);
  assert.equal(calismaIcindeMi("c1", "/dashboard/literature", q("calisma=c1")), true);
  assert.equal(calismaIcindeMi("c1", "/dashboard/literature", q("calisma=c2")), false);
  assert.equal(calismaIcindeMi("c1", "/dashboard/editor/c2/write", q("")), false);
  assert.equal(calismaIcindeMi("c1", "/dashboard", q("")), false);
});

test("bağlamda etkin bağlantı", () => {
  const b = calismaBaglantilari({ id: "c1", baslik: "Tez", tur: "thesis" });
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/kanit")?.key, "kanit");
  assert.equal(etkinBaglanti(b, "/dashboard/editor")?.key, "merkez");
  assert.equal(etkinBaglanti(b, "/dashboard/analysis")?.key, "analiz");
});
