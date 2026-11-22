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
    for (const gizli of ["asistan"]) {
      assert.ok(!dock.includes(gizli), gizli);
    }
    assert.ok(dock.includes("analiz"));
  });

  test("yetkisi olmayan kullanıcıdan TAMAMEN gizleniyor", () => {
    /* Başlatıcıda da görünmemeli: adresini bilmeden bulunamayan bir
       sayfa, menüde görünüp açılmayan sayfadan iyidir. */
    const ogrenci = gorunenUygulamalar(uygulamalar, "client").map((u) => u.key);
    assert.ok(!ogrenci.includes("asistan"));
    assert.ok(ogrenci.includes("tez"));

    const kurucu = gorunenUygulamalar(uygulamalar, "founder").map((u) => u.key);
    assert.ok(kurucu.includes("asistan"));
    assert.ok(!kurucu.includes("ekip"), "Ekip Yönetimi 20.11.2026'da kalktı");
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
    assert.ok(aramaAnahtari("Çalışmalarım").includes(aramaAnahtari("calismalarim")));
  });

  test("başlatıcıya ayrılmış uygulamalar da aranabiliyor", () => {
    // Palet uygulamaları komutHedefleri'nden alıyor (osSayfalari artık
    // yalnızca gerçek alt bölümleri döndürüyor, 14.11.2026).
    const sayfalar = komutHedefleri(uygulamalar);
    assert.ok(sayfalar.some((s) => s.href === "/dashboard/asistan"));
    // Ekip Yönetimi 20.11.2026'da kalktı (ArvoOS'un işi); aramaya da dönmemeli.
    assert.ok(!sayfalar.some((s) => s.href === "/dashboard/team"));
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

  test("kılavuz kataloğu, doçentlik ve Yönetim kaldırıldı: hiçbir rolün paletinde yok", () => {
    // Kılavuz kataloğu 26.10.2026'da (kılavuz her çalışmaya kullanıcının
    // kendisi yüklüyor), doçentlik ve Yönetim 20.11.2026'da kalktı (ArvoLab
    // tek tip araştırma ve yazma ürünü). Eski adresler Ana Sayfa'ya iner.
    const kaldirilan = ["/dashboard/guidelines", "/dashboard/associate-professorship", "/dashboard/yonetim"];
    for (const rol of ["client", undefined, "employee", "academic_manager", "controller", "expert", "system_admin", "founder"]) {
      const hedefler = komutHedefleri(gorunenUygulamalar(uygulamalar, rol)).map((s) => s.href);
      for (const href of kaldirilan) assert.ok(!hedefler.includes(href), `${rol} ${href}`);
    }
  });

  test("çalışmanın sekmeleri (kanıt, makale) Çalışmalarım'da kalıyor", () => {
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/editor/abc/kanit")?.key, "tez");
    assert.equal(etkinUygulama(uygulamalar, "/dashboard/editor/abc/makale")?.key, "tez");
  });
});


/* Phase 3 (04.11.2026): uyarlanır gezinme tek listeden üç biçim; çalışma bağlamı. */
import { ALT_CUBUK, anaUygulamalar, aracUygulamalari, calismaBaglantilari, calismaIcindeMi, dahaFazlasi, etkinBaglanti, hesapUygulamalari, kontrolSayfalari, personelAraclari, solAracBasligi, solAracGirisi, solAracOku, yardimUygulamalari } from "@/lib/os/uygulamalar";
import { ekranSinifi } from "@/lib/os/kirilimlar";

test("gezinme yerleri: her uygulama tam olarak bir yerde, hiçbiri kaybolmuyor", () => {
  // Phase 5.1d-3: ana gezinme + hesap menüsü; 17.11.2026: + Araçlar ve Yardım grupları.
  const hepsi = labUygulamalari();
  const yerlesen = [...anaUygulamalar(hepsi), ...aracUygulamalari(hepsi), ...yardimUygulamalari(hepsi), ...hesapUygulamalari(hepsi), ...personelAraclari(hepsi)].map((u) => u.key).sort();
  assert.deepEqual(yerlesen, hepsi.map((u) => u.key).sort());
});

test("telefonda alt çubuk + Daha fazla, personel araçları dışında bütün uygulamaları kapsar", () => {
  // Personel araçları telefonda da hesap menüsünde (5.1d-3); hesap sayfaları Daha fazla'da KALIR.
  const hepsi = labUygulamalari();
  const cubuk = hepsi.filter((u) => (ALT_CUBUK as readonly string[]).includes(u.key));
  assert.equal(cubuk.length, ALT_CUBUK.length, "alt çubuktaki her anahtar listede olmalı");
  assert.equal(cubuk.length + dahaFazlasi(hepsi).length + personelAraclari(hepsi).length, hepsi.length);
  const daha = dahaFazlasi(hepsi).map((u) => u.key);
  for (const k of ["analiz", "belge", "destek", "ayarlar", "yardim", "abonelik"]) assert.ok(daha.includes(k), k);
  for (const k of ["asistan"]) assert.ok(!daha.includes(k), k);
});

test("ekran sınıfı kırılımları", () => {
  assert.equal(ekranSinifi(390), "telefon");
  assert.equal(ekranSinifi(760), "telefon");
  assert.equal(ekranSinifi(761), "tablet");
  assert.equal(ekranSinifi(1199), "tablet");
  assert.equal(ekranSinifi(1200), "masaustu");
});

test("çalışma bağlamı: dört ana giriş, grup başlığı yok (20.11.2026)", () => {
  const tez = calismaBaglantilari({ id: "c1", baslik: "Tez", tur: "thesis" });
  assert.deepEqual(tez.map((b) => b.key), ["yazim", "kaynaklar", "ai", "kontrol"]);
  assert.ok(tez.every((b) => b.grup === "ana"));
  assert.equal(tez.find((b) => b.key === "kaynaklar")?.href, "/dashboard/editor/c1/write?sol=kaynaklar");
  assert.equal(tez.find((b) => b.key === "kontrol")?.href, "/dashboard/editor/c1/write?sol=kontrol");
});

test("Kontrol ve teslim eski 'Diğer araçlar'ı ve Özet ve teslim'i taşır; Makale yalnızca makale türünde", () => {
  const tez = kontrolSayfalari({ id: "c1", baslik: "Tez", tur: "thesis" }).map((x) => x.key);
  const makale = kontrolSayfalari({ id: "c1", baslik: "M", tur: "article" }).map((x) => x.key);
  for (const k of ["merkez", "kanit", "etik", "analiz", "belge"]) assert.ok(tez.includes(k), k);
  assert.equal(tez.includes("makale"), false);
  assert.equal(makale.includes("makale"), true);
  assert.equal(kontrolSayfalari({ id: "c1", baslik: "", tur: "" }).find((x) => x.key === "analiz")?.href, "/dashboard/analysis?calisma=c1");
});

test("eski sol değerleri bugünkü girişe düşer", () => {
  assert.equal(solAracOku("kilavuz"), "kontrol");
  assert.equal(solAracOku("arama"), "arama");
  assert.equal(solAracOku("yok"), null);
  assert.equal(solAracGirisi("arama"), "kaynaklar");
  assert.equal(solAracGirisi("kaynakca"), "kaynaklar");
  assert.equal(solAracGirisi("bolumler"), "yazim");
  assert.equal(solAracGirisi("kontrol"), "kontrol");
  assert.equal(solAracBasligi("kaynakca"), "Kaynaklar");
  assert.equal(solAracBasligi("kilavuz"), "Kontrol ve teslim");
});

test("bağlam yalnızca o çalışmanın sayfalarında görünür", () => {
  assert.equal(calismaIcindeMi("c1", "/dashboard/editor/c1/write"), true);
  assert.equal(calismaIcindeMi("c1", "/dashboard/editor/c1/kanit"), true);
  // 19.11.2026: Çalışmalarım listesi (seçili olsa da) genel düzey.
  assert.equal(calismaIcindeMi("c1", "/dashboard/editor"), false);
  assert.equal(calismaIcindeMi("c1", "/dashboard/editor/new"), false);
  /*
    22.11.2026: MODÜL SAYFALARI GENEL DÜZEY. ?calisma= ile süzülmüş
    Kaynaklar, Kaynakça, Analiz Merkezi ve Belge Kontrol artık çalışma
    menüsüne geçmiyor: dock'tan açılıyorlar, hangi çalışmaya bakıldığını
    kendi çalışma seçicileri söylüyor ve gezinme sabit kalıyor.
  */
  assert.equal(calismaIcindeMi("c1", "/dashboard/literature"), false);
  assert.equal(calismaIcindeMi("c1", "/dashboard/citations"), false);
  assert.equal(calismaIcindeMi("c1", "/dashboard/analysis"), false);
  assert.equal(calismaIcindeMi("c1", "/dashboard/documents"), false);
  assert.equal(calismaIcindeMi("c1", "/dashboard/editor/c2/write"), false);
  assert.equal(calismaIcindeMi("c1", "/dashboard"), false);
});

test("bağlamda etkin giriş", () => {
  const b = calismaBaglantilari({ id: "c1", baslik: "Tez", tur: "thesis" });
  const q = (s: string) => new URLSearchParams(s);
  // Ayrı sayfalar: kontrol ve kaynak sayfaları kendi girişlerinde.
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/kanit")?.key, "kontrol");
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/etik")?.key, "kontrol");
  assert.equal(etkinBaglanti(b, "/dashboard/editor")?.key, "kontrol");
  assert.equal(etkinBaglanti(b, "/dashboard/analysis")?.key, "kontrol");
  assert.equal(etkinBaglanti(b, "/dashboard/documents")?.key, "kontrol");
  assert.equal(etkinBaglanti(b, "/dashboard/literature")?.key, "kaynaklar");
  // Yazım ekranı: sol/sag değişkeni.
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/write", q(""))?.key, "yazim");
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/write", q("sol=bolumler"))?.key, "yazim");
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/write", q("sol=arama"))?.key, "kaynaklar");
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/write", q("sol=kaynakca"))?.key, "kaynaklar");
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/write", q("sol=kilavuz"))?.key, "kontrol");
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/write", q("sag=ai"))?.key, "ai");
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/write", q("sag=pdf"))?.key, "yazim");
  // Bilinmeyen değer belgeye düşer (elle yazılmış ya da eski adres).
  assert.equal(etkinBaglanti(b, "/dashboard/editor/c1/write", q("sol=yok"))?.key, "yazim");
});

