import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { ADMIN_ROLES } from "@/lib/project-labels";
import { KAYIT_ROLLERI } from "@/lib/ai/kayit-gorunum";
import {
  anaUygulamalar,
  aracUygulamalari,
  yardimUygulamalari,
  dahaFazlasi,
  gorunenUygulamalar,
  hesapUygulamalari,
  komutHedefleri,
  labUygulamalari,
  osSayfalari,
  personelAraclari,
  type OsUygulama,
} from "@/lib/os/uygulamalar";

/*
  MERKEZİ GEZİNME MODELİ VE CTRL+K TEKİLLİĞİ (Phase 5.1d-2, 14.11.2026).

  14.11.2026'ya kadar osSayfalari "yalnızca başlatıcıda" duran uygulamaları
  da döndürüyordu; palet ise bütün uygulamaları ayrıca listelediği için beş
  uygulama Ctrl+K'da iki kez çıkıyordu (iç ekipte 27 sonuçtan 5'i). Bu
  dosya o mükerrerliği ve yeni `yer` sınıflandırmasının görünürlüğü
  DEĞİŞTİRMEDİĞİNİ sabitler. Paletin tarayıcıdaki davranışı:
  scripts/onizleme/komut-paleti-kabul.mjs.
*/

const hepsi = labUygulamalari();
const gorunen = (rol: string | undefined) => gorunenUygulamalar(labUygulamalari(), rol);
const hrefler = (liste: { href: string }[]) => liste.map((x) => x.href);
/* Eskiden beşti; doçentlik 20.11.2026'da kaldırıldı (modül ArvoLab'dan çıktı). */
const MUKERRER = ["yardim", "abonelik", "asistan", "ekip"];

describe("Ctrl+K gezinme hedefleri tekil", () => {
  test("eski mükerrer: beş uygulama hem uygulamada hem 'yalnızca başlatıcı' sayfasındaydı", () => {
    // Kaynağın kendisi: bu beşi yalnizBaslatici. Eski osSayfalari onları
    // ikinci kez ekliyordu; palet uygulamaları da listeliyordu.
    const baslatici = hepsi.filter((u) => u.yalnizBaslatici).map((u) => u.key);
    assert.deepEqual([...baslatici].sort(), [...MUKERRER].sort());
  });

  test("osSayfalari yalnızca gerçek alt bölümleri döndürür, uygulamanın kendisini değil", () => {
    assert.deepEqual(osSayfalari(hepsi), []);
    const bolumlu: OsUygulama[] = [
      { key: "x", label: "X", href: "/dashboard/x", ikon: "apps", yollar: ["/dashboard/x"], yalnizBaslatici: true, bolumler: [{ key: "a", label: "A", href: "/dashboard/x/a" }] },
    ];
    assert.deepEqual(osSayfalari(bolumlu), [{ label: "A", href: "/dashboard/x/a", uygulama: "x" }]);
  });

  for (const rol of ["client", "employee", "controller", "academic_manager", "expert", "system_admin", "founder", undefined]) {
    test(`${rol ?? "rolsüz (önizleme)"}: aynı adres en fazla bir kez`, () => {
      const h = hrefler(komutHedefleri(gorunen(rol)));
      assert.equal(new Set(h).size, h.length, h.join(", "));
      const k = komutHedefleri(gorunen(rol)).map((x) => x.key);
      assert.equal(new Set(k).size, k.length, "anahtarlar da tekil (React key)");
    });
  }

  test("iç ekip: eski mükerrer komutların her biri TAM bir kez, adı ve adresi aynı", () => {
    const hedefler = komutHedefleri(gorunen("system_admin"));
    for (const key of MUKERRER) {
      const u = hepsi.find((x) => x.key === key)!;
      const eslesen = hedefler.filter((h) => h.href === u.href);
      assert.equal(eslesen.length, 1, key);
      assert.equal(eslesen[0].label, u.label, key);
      assert.equal(eslesen[0].grup, "uygulama", key);
    }
  });

  test("bir bölümün adresi uygulamanınkiyle aynıysa uygulama kalır", () => {
    const liste: OsUygulama[] = [
      { key: "y", label: "Y", href: "/dashboard/y", ikon: "apps", yollar: ["/dashboard/y"], bolumler: [{ key: "ilk", label: "İlk", href: "/dashboard/y" }, { key: "iki", label: "İki", href: "/dashboard/y/iki" }] },
    ];
    const h = komutHedefleri(liste);
    assert.deepEqual(h.map((x) => [x.grup, x.href]), [["uygulama", "/dashboard/y"], ["sayfa", "/dashboard/y/iki"]]);
  });

  test("öğrenci ve rolsüz kullanıcı personel komutlarını görmez", () => {
    for (const rol of ["client", undefined]) {
      const h = hrefler(komutHedefleri(gorunen(rol)));
      for (const yok of ["/dashboard/associate-professorship", "/dashboard/asistan", "/dashboard/team"]) assert.ok(!h.includes(yok), `${rol} ${yok}`);
      // Hesap sayfaları herkese açık kalır.
      for (const var_ of ["/dashboard/settings", "/dashboard/yardim", "/dashboard/abonelik"]) assert.ok(h.includes(var_), `${rol} ${var_}`);
    }
  });

  test("personel (employee) öğrenciyle aynı paleti görür: doçentlik, Yönetim ve iç ekip araçları yok", () => {
    const h = hrefler(komutHedefleri(gorunen("employee")));
    for (const yok of ["/dashboard/associate-professorship", "/dashboard/yonetim", "/dashboard/asistan", "/dashboard/team"]) assert.ok(!h.includes(yok), yok);
    assert.deepEqual(h, hrefler(komutHedefleri(gorunen("client"))));
  });

  test("palet hedef sayısı rol başına beklenen: öğrenci ve personel 9, iç ekip 11", () => {
    // Eskiden iç ekipte 17 gezinme hedefi çıkıyordu (12 uygulama + 5 mükerrer).
    // 20.11.2026: doçentlik ve Yönetim kalktı; personelin paleti öğrencininkiyle aynı.
    assert.equal(komutHedefleri(gorunen("client")).length, 9);
    assert.equal(komutHedefleri(gorunen("employee")).length, 9);
    assert.equal(komutHedefleri(gorunen("system_admin")).length, 11);
  });
});

describe("hesap menüsü sınıflandırması (yer)", () => {
  // 17.11.2026: Kullanım Kılavuzu hesap menüsünden kenar çubuğunun "Yardım" grubuna geçti.
  test("hesap: Ayarlar, Abonelik ve Kredi — her rolde aynı", () => {
    for (const rol of ["client", "employee", "system_admin", undefined]) {
      assert.deepEqual(hesapUygulamalari(gorunen(rol)).map((u) => u.key), ["ayarlar", "abonelik"], String(rol));
    }
  });

  test("premium çalışma alanı: Araçlar ve Yardım grupları her rolde aynı", () => {
    for (const rol of ["client", "employee", "system_admin", undefined]) {
      assert.deepEqual(aracUygulamalari(gorunen(rol)).map((u) => u.key), ["analiz", "belge"], String(rol));
      assert.deepEqual(yardimUygulamalari(gorunen(rol)).map((u) => u.key), ["destek", "yardim"], String(rol));
    }
  });

  test("ekip araçları rolle süzülür: öğrenci ve personel boş, iç ekip iki araç", () => {
    assert.deepEqual(personelAraclari(gorunen("client")).map((u) => u.key), []);
    assert.deepEqual(personelAraclari(gorunen(undefined)).map((u) => u.key), []);
    assert.deepEqual(personelAraclari(gorunen("employee")).map((u) => u.key), []);
    assert.deepEqual(personelAraclari(gorunen("system_admin")).map((u) => u.key), ["asistan", "ekip"]);
  });

  test("yonetim'deki her uygulamanın rol kısıtı var: yer, görünürlük kararı vermez", () => {
    for (const u of hepsi.filter((x) => x.yer === "yonetim")) assert.ok(u.roller?.length, u.key);
  });

  test("rol listeleri sabitlerden: değerler değişmedi", () => {
    const rolu = (k: string) => [...(hepsi.find((u) => u.key === k)!.roller ?? [])];
    assert.deepEqual(rolu("asistan"), [...KAYIT_ROLLERI]);
    assert.deepEqual(rolu("ekip"), [...ADMIN_ROLES]);
    assert.deepEqual(rolu("ekip"), ["system_admin", "founder"]);
  });

  test("görünürlük değişmedi: her rolde görünen uygulama anahtarları", () => {
    const anahtar = (rol: string | undefined) => gorunen(rol).map((u) => u.key);
    const temel = ["home", "tez", "kaynaklar", "analiz", "belge", "destek", "ayarlar", "yardim", "abonelik"];
    assert.deepEqual(anahtar("client"), temel);
    // 20.11.2026: personelin listesi öğrencininkiyle aynı (doçentlik ve Yönetim kalktı).
    assert.deepEqual(anahtar("employee"), temel);
    assert.deepEqual(anahtar("system_admin"), [...temel, "asistan", "ekip"]);
  });

  // 17.11.2026 (onaylı tasarım): ana gezinmede üç öğe. Eskiden altıydı (Analiz, Belge Kontrol, Destek de).
  test("ana gezinmede yalnızca Ana Sayfa, Çalışmalarım, Kaynaklar", () => {
    for (const rol of ["client", "employee", "system_admin"]) {
      assert.deepEqual(anaUygulamalar(gorunen(rol)).map((u) => u.key), ["home", "tez", "kaynaklar"], rol);
    }
  });

  test("Daha fazla (telefon/ray) araçları, yardımı ve hesap sayfalarını korur; personel araçlarını göstermez", () => {
    for (const rol of ["client", "employee", "system_admin"]) {
      assert.deepEqual(dahaFazlasi(gorunen(rol)).map((u) => u.key), ["analiz", "belge", "destek", "ayarlar", "yardim", "abonelik"], rol);
    }
  });
});

describe("palet bileşeni tek seçiciden okur", () => {
  // Yorumlar ayıklanır: gerekçe yorumu eski adı (osSayfalari) anıyor.
  const palet = fs
    .readFileSync(path.join(process.cwd(), "app/dashboard/_components/os-komut-paleti.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  test("gezinme hedefleri komutHedefleri'nden; uygulamalar ve osSayfalari ayrıca eşlenmiyor", () => {
    assert.match(palet, /\.\.\.komutHedefleri\(uygulamalar\)\.map/);
    assert.doesNotMatch(palet, /osSayfalari/);
    assert.doesNotMatch(palet, /\.\.\.uygulamalar\.map\(/);
  });

  test("hızlı işlemler korunuyor: DOI, yeni çalışma, kaynak, analiz, yazım asistanı, tema, çıkış", () => {
    for (const id of ['id: "doi"', 'id: "yeni"', 'id: "kaynak"', 'id: "analiz"', 'id: "asistan"', 'id: "komut:tema-acik"', 'id: "komut:tema-koyu"', 'id: "komut:tema-sistem"', 'id: "komut:cikis"']) {
      assert.ok(palet.includes(id), id);
    }
    assert.ok(palet.includes('href: "/dashboard/editor?yeni=1"'));
    assert.ok(palet.includes('href: "/dashboard/literature?ekle=1"'));
  });
});
