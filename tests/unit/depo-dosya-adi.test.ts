import assert from "node:assert/strict";
import test from "node:test";
import { benzersizDosyaAdi, guvenliAd } from "@/lib/depo-dosya-adi";
import { yolCoz } from "@/lib/depo-envanteri";
import { kilavuzAdi } from "@/lib/kilavuz-dogrulama";

/*
  P52b-2D: yükleme adları tekil ve tahmin edilemez. Eskiden `<zaman>-<ad>` /
  `<zaman>.pdf` idi: aynı milisaniyede aynı adla iki yükleme aynı yola düşüyor
  ve ikincisi "already exists" alıyordu. Geçiş yalnızca adın içeriğine HİÇBİR
  okuyucunun bakmadığı beş akışta yapıldı (belge, içe aktarma, etik, ÜAK,
  doçentlik); her biri için sunucu öneki, veritabanı kısıtı ve envanter
  sınıflandırması burada eski adla yan yana sınanıyor.
*/

const U = "b4219800-20a2-492d-ac4c-8fbd295efd70";
const GIRIS = "0c4f7a52-3c1e-4c2b-9d6a-1f2e3d4c5b6a";
const ZAMAN = 1763294400000;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const eskiTemiz = (ad: string) => ad.replace(/[^a-zA-Z0-9._-]/g, "_");

test("biçim: <zaman>-<uuid>-<ad> ve <önek>-<zaman>-<uuid>.<uzantı>", () => {
  assert.match(benzersizDosyaAdi("tez.docx", { simdi: ZAMAN }), new RegExp(`^${ZAMAN}-${UUID}-tez\\.docx$`));
  assert.match(benzersizDosyaAdi(".pdf", { simdi: ZAMAN }), new RegExp(`^${ZAMAN}-${UUID}\\.pdf$`));
  assert.match(benzersizDosyaAdi(".pdf", { on: GIRIS, simdi: ZAMAN }), new RegExp(`^${GIRIS}-${ZAMAN}-${UUID}\\.pdf$`));
});

test("aynı milisaniye, aynı ad: eski biçim ÇAKIŞIR, yeni biçim 1000 çağrıda tekil", () => {
  const eski = new Set(Array.from({ length: 1000 }, () => `${U}/${ZAMAN}-${eskiTemiz("tez.pdf")}`));
  assert.equal(eski.size, 1, "eski biçimde 1000 yükleme tek yola düşüyor");
  const yeni = new Set(Array.from({ length: 1000 }, () => `${U}/${benzersizDosyaAdi(guvenliAd("tez.pdf"), { simdi: ZAMAN })}`));
  assert.equal(yeni.size, 1000);
});

test("guvenliAd: kısa adda eski temizlemeyle birebir; uzun adı uzantıyı koruyarak kısaltır", () => {
  for (const ad of ["Tez Taslağı (son).docx", "a.pdf", "ölçek_izni.PDF", "x"]) assert.equal(guvenliAd(ad), eskiTemiz(ad));
  const uzun = guvenliAd(`${"a".repeat(300)}.docx`);
  assert.equal(uzun.length, 120);
  assert.ok(uzun.endsWith(".docx"));
  assert.equal(guvenliAd(""), "dosya");
});

/* Her akış: yeni yol eski yolla aynı öneke, aynı envanter kategorisine ve aynı kısıta uyuyor. */
const akislar: { ad: string; eski: string; yeni: string; kategori: string; onek: string; ek?: (y: string) => boolean }[] = [
  {
    ad: "belge (document-upload-form)",
    eski: `${U}/${ZAMAN}-${eskiTemiz("Tez Taslağı.docx")}`,
    yeni: `${U}/${benzersizDosyaAdi(guvenliAd("Tez Taslağı.docx"))}`,
    kategori: "belge",
    onek: `${U}/`, // app/actions/document-upload.ts: startsWith(`${user.id}/`)
  },
  {
    ad: "içe aktarma (import-dialog)",
    eski: `${U}/imports/${ZAMAN}-${eskiTemiz("bölüm 1.docx")}`,
    yeni: `${U}/imports/${benzersizDosyaAdi(guvenliAd("bölüm 1.docx"))}`,
    kategori: "imports",
    onek: `${U}/imports/`, // app/actions/manuscript-import.ts
    ek: (y) => /\.docx$/i.test(y), // aynı dosyadaki uzantı denetimi
  },
  {
    ad: "etik (etik-belgeleri)",
    eski: `${U}/etik/${ZAMAN}-${eskiTemiz("yönerge.pdf")}`,
    yeni: `${U}/etik/${benzersizDosyaAdi(guvenliAd("yönerge.pdf"))}`,
    kategori: "etik",
    onek: `${U}/etik/`, // app/actions/etik-kurul.ts
  },
  {
    ad: "ÜAK (uak-yukle)",
    eski: `${U}/uak/${ZAMAN}.pdf`,
    yeni: `${U}/uak/${benzersizDosyaAdi(".pdf")}`,
    kategori: "uak",
    onek: `${U}/uak/`, // app/actions/uak-tablosu.ts
    ek: (y) => y.length <= 500, // uak_tablolari: char_length(depo_yolu) <= 500
  },
  {
    ad: "doçentlik (belge-satiri)",
    eski: `${U}/docentlik/${GIRIS}-${ZAMAN}.pdf`,
    yeni: `${U}/docentlik/${benzersizDosyaAdi(".pdf", { on: GIRIS })}`,
    kategori: "docentlik",
    onek: `${U}/docentlik/`, // app/actions/scoring.ts + academic_score_entries: belge_yolu LIKE owner_id||'/docentlik/%'
  },
];

for (const a of akislar) {
  test(`uyumluluk — ${a.ad}: önek, kısıt ve envanter kategorisi eski adla aynı`, () => {
    for (const y of [a.eski, a.yeni]) {
      assert.ok(y.startsWith(a.onek) && !y.includes(".."), `önek: ${y}`);
      if (a.ek) assert.ok(a.ek(y), `ek kısıt: ${y}`);
      const c = yolCoz(y);
      assert.equal(c.gecerli, true, y);
      assert.equal(c.kategori, a.kategori, y);
    }
  });
}

test("NEDEN kılavuz geçirilmedi: kilavuzAdi adı dosya adından okuyor; yeni biçim UUID'yi ekrana taşırdı", () => {
  // Bugünkü biçim: doğru ad.
  assert.equal(kilavuzAdi({ depoYolu: `${U}/kilavuz/${ZAMAN}-Tez_Yazim_Kilavuzu.pdf` }), "Tez Yazim Kilavuzu");
  // Yeni biçim, kilavuzAdi değişmeden: ad UUID içeriyor. Geçiş kilavuzAdi ile birlikte, ayrı bir değişiklikte yapılmalı.
  const yeni = kilavuzAdi({ depoYolu: `${U}/kilavuz/${benzersizDosyaAdi("Tez_Yazim_Kilavuzu.pdf")}` });
  assert.match(yeni ?? "", new RegExp(UUID));
});
