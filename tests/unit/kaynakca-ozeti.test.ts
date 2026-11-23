import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kaynakcaOzeti, type OzetGirdisi } from "@/lib/kaynakca-ozeti";

/*
  TOPLAM İLE KATEGORİLER AYRIŞAMAZ. Kaynaklar → Kaynakça ekranında
  üstte "2 açık sorun" yazarken dört kategori satırının dördü de "Yok"
  görünüyordu: toplam biçim bulgularını da sayıyor, satır listesinde ise
  BİÇİM kategorileri hiç yoktu. Artık ikisi de bu modülden geliyor.
*/
const kunye = (severity?: "error" | "warning") => ({
  issues: severity ? [{ field: "authors", message: "x", severity }] : [],
});
const bos = { referencesWithoutCitation: [], citationsWithoutReference: [] };
const girdi = (x: Partial<OzetGirdisi> = {}): OzetGirdisi => ({
  references: [kunye(), kunye()],
  crossCheck: bos,
  ...x,
});
const kategori = (o: ReturnType<typeof kaynakcaOzeti>, anahtar: string) =>
  o.kategoriler.find((k) => k.anahtar === anahtar)!;

describe("kaynakça özeti: toplam ve kategoriler", () => {
  test("ekran görüntüsündeki durum: iki biçim bulgusu, öteki kategoriler boş", () => {
    const o = kaynakcaOzeti(girdi({
      references: [kunye("error"), kunye("warning"), kunye()],
      citations: [],
      verificationSummary: { notFound: 0 },
      dogrulananSayisi: 0,
    }));
    assert.equal(o.acikSorun, 2);
    /* İki sorunun NEREDEN geldiği kategori satırlarında görünmeli. */
    assert.equal(kategori(o, "bicimHatali").sayi, 1);
    assert.equal(kategori(o, "bicimUyarili").sayi, 1);
    assert.equal(kategori(o, "bicimHatali").olculdu, true);
    /* Ölçülmeyenler "Yok" değil: atıf çıkarılamadı, dizine bakılmadı. */
    assert.equal(kategori(o, "atifsizKaynak").olculdu, false);
    assert.equal(kategori(o, "karsiliksizAtif").olculdu, false);
    assert.equal(kategori(o, "bulunamayan").olculdu, false);
    assert.equal(kategori(o, "kilavuzAtifi").olculdu, false);
  });

  test("toplam, toplama katılan ve ölçülen kategorilerin toplamıdır", () => {
    const durumlar: OzetGirdisi[] = [
      girdi(),
      girdi({ references: [kunye("error"), kunye("warning")], citations: [{}], dogrulananSayisi: 2, verificationSummary: { notFound: 1, unreachable: 2 }, tyk: [{}, {}] }),
      girdi({ crossCheck: { referencesWithoutCitation: [{}], citationsWithoutReference: [{}, {}] }, citations: [{}] }),
      girdi({ citations: [], dogrulananSayisi: 5, verificationSummary: { notFound: 3 } }),
    ];
    for (const d of durumlar) {
      const o = kaynakcaOzeti(d);
      const beklenen = o.kategoriler
        .filter((k) => k.toplamaKatilir && k.olculdu)
        .reduce((toplam, k) => toplam + k.sayi, 0);
      assert.equal(o.acikSorun, beklenen);
    }
  });

  test("ölçülmeyen kategori toplama girmiyor", () => {
    /* Atıf çıkarılamadıysa çapraz kontrolün sıfırları bir hüküm değil. */
    const olculmedi = kaynakcaOzeti(girdi({
      crossCheck: { referencesWithoutCitation: [{}], citationsWithoutReference: [{}] },
      citations: [],
    }));
    assert.equal(olculmedi.acikSorun, 0);
    const olculdu = kaynakcaOzeti(girdi({
      crossCheck: { referencesWithoutCitation: [{}], citationsWithoutReference: [{}] },
      citations: [{}],
    }));
    assert.equal(olculdu.acikSorun, 2);
  });

  test("citations verilmeyen eski çağıranda çapraz kontrol ölçülmüş sayılıyor", () => {
    /* Editör (lib/atif-denetimi.ts) citations alanını taşımıyor; davranışı
       değişmemeli, yoksa editördeki sayı sessizce düşerdi. */
    const o = kaynakcaOzeti({
      references: [kunye()],
      crossCheck: { referencesWithoutCitation: [{}], citationsWithoutReference: [] },
    });
    assert.equal(kategori(o, "atifsizKaynak").olculdu, true);
    assert.equal(o.acikSorun, 1);
  });

  test("kılavuz bulguları ölçüldüyse toplama katılıyor, eski kayıtta katılmıyor", () => {
    const olculdu = kaynakcaOzeti(girdi({ tyk: [{}, {}, {}] }));
    assert.equal(kategori(olculdu, "kilavuzAtifi").sayi, 3);
    assert.equal(olculdu.acikSorun, 3);
    const eskiKayit = kaynakcaOzeti(girdi({ tyk: null }));
    assert.equal(kategori(eskiKayit, "kilavuzAtifi").olculdu, false);
    assert.equal(eskiKayit.acikSorun, 0);
  });

  test("dizine ulaşılamayan geçici arızadır: toplama katılmaz, gizlenmez", () => {
    const o = kaynakcaOzeti(girdi({ dogrulananSayisi: 3, verificationSummary: { notFound: 0, unreachable: 2 } }));
    assert.equal(kategori(o, "ulasilamayan").sayi, 2);
    assert.equal(kategori(o, "ulasilamayan").toplamaKatilir, false);
    assert.equal(o.acikSorun, 0);
    assert.equal(o.ton, "warning");
  });
});

describe("kaynakça kartı tek kaynaktan okuyor", () => {
  const sayfa = readFileSync("app/dashboard/literature/page.tsx", "utf8");

  test("kategori satırları özetten geliyor, elle yazılmıyor", () => {
    assert.match(sayfa, /ozet\?\.kategoriler \?\? \[\]/);
    assert.match(sayfa, /kategoriler\.map\(\(k\) => \(/);
    assert.match(sayfa, /tr: "Biçim hatası olan künye"/);
    assert.match(sayfa, /tr: "Biçim uyarısı olan künye"/);
  });

  test("ölçülmeyen kategori 'Denetlenmedi' yazıyor", () => {
    assert.match(sayfa, /tr: "Denetlenmedi", en: "Not checked"/);
    assert.match(sayfa, /tr: "metinden atıf çıkarılamadı"/);
  });

  test("açık sorunun hangi kategoride olduğu özette yazılı", () => {
    assert.match(sayfa, /acikKategoriler\.map\(\(k\) => `\$\{t\(KATEGORI_ADI\[k\.anahtar\]\)\}: \$\{k\.sayi\}`\)/);
  });

  test("geçmiş satırı saatiyle yazılıyor ve kendi denetimini açıyor", () => {
    assert.match(sayfa, /className="gb-liste kaynakca-gecmis"/);
    assert.match(sayfa, /tarihSaat\(d\.created_at\)/);
    assert.match(sayfa, /&denetim=\$\{encodeURIComponent\(d\.id\)\}/);
    assert.match(sayfa, /denetimId=\{secilenDenetim\}/);
  });

  test("kategori listesi tek ekranda büyümüyor (geçmişi dibe iten boşluk)", () => {
    const stil = readFileSync("app/styles/genel-bakis.css", "utf8");
    assert.match(stil, /\.gb-tek-ekran \.kaynakca-kategoriler \{ flex: none/);
  });
});
