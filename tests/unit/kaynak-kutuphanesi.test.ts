import assert from "node:assert/strict";
import test from "node:test";
import { kaynakBaglamlari, olasiTekrarlar } from "@/lib/kaynak-kutuphanesi";

/* Kaynak kütüphanesi (Signature OS 4.2): olası tekrarlar ve kaynağın çalışmadaki yeri. */

const k = (id: string, title: string, year: string | null, doi_or_url: string | null = null, authors: string | null = null) => ({ id, title, year, doi_or_url, authors });

test("tekrar: aynı DOI farklı yazımla (adres / çıplak) tekrar sayılır", () => {
  const t = olasiTekrarlar([k("a", "Bir", "2020", "https://doi.org/10.1000/ABC"), k("b", "Başka başlık", "2021", "10.1000/abc")]);
  assert.deepEqual(t.get("a"), ["b"]);
  assert.deepEqual(t.get("b"), ["a"]);
});

test("tekrar: DOI'siz kayıt, aynı başlık + yıl ile (büyük/küçük harf, noktalama farkı) tekrar sayılır", () => {
  const t = olasiTekrarlar([k("a", "Inflation and Unemployment", "2019"), k("b", "inflation and unemployment.", "2019"), k("c", "Inflation and unemployment", "2020")]);
  assert.deepEqual(t.get("a"), ["b"]);
  assert.equal(t.has("c"), false, "yılı farklı olan ayrı eser");
});

test("tekrar: başlığı ve yılı olmayan kayıtlar birbirinin tekrarı sayılmaz", () => {
  assert.equal(olasiTekrarlar([k("a", "", null), k("b", "", null)]).size, 0);
});

test("tekrar: tekrarı olmayan liste boş harita döner", () => {
  assert.equal(olasiTekrarlar([k("a", "Bir", "2020"), k("b", "İki", "2020")]).size, 0);
});

const kaynaklar = [
  k("onder", "Phillips", "2009", null, "Önder, A. Ö."),
  k("smith", "Inflation", "2019", "https://doi.org/10.0000/ornek.2", "Smith, J., & Brown, K."),
  k("kurum", "Rapor", "2020", null, null),
];

test("metinde: yazar-tarih stilinde soyad ve yıl gövdede birlikte geçiyorsa", () => {
  const b = kaynakBaglamlari(kaynaklar, { govdeMetni: "Bulgular (Önder, 2009) ile uyumludur.", atifTuru: "yazar-tarih", kanitKaynaklari: [], pdfDoileri: [] });
  assert.equal(b.onder.metinde, true);
  assert.equal(b.smith.metinde, false);
  assert.equal(b.kurum.metinde, null, "yazarsız kaynakta aranacak ad yok: bilinmiyor");
});

test("metinde: numaralı ve dipnotlu stilde ya da metin yokken BİLİNMİYOR (false değil)", () => {
  for (const atifTuru of ["numara", "dipnot"] as const) {
    assert.equal(kaynakBaglamlari(kaynaklar, { govdeMetni: "Önder 2009", atifTuru, kanitKaynaklari: [], pdfDoileri: [] }).onder.metinde, null);
  }
  assert.equal(kaynakBaglamlari(kaynaklar, { govdeMetni: null, atifTuru: "yazar-tarih", kanitKaynaklari: [], pdfDoileri: [] }).onder.metinde, null);
  assert.equal(kaynakBaglamlari(kaynaklar, { govdeMetni: "   ", atifTuru: "yazar-tarih", kanitKaynaklari: [], pdfDoileri: [] }).onder.metinde, null);
});

test("kanıt: kaynağa bağlı iddia sayısı; pdf: yalnızca DOI birebir eşleşince", () => {
  const b = kaynakBaglamlari(kaynaklar, { govdeMetni: null, atifTuru: "yazar-tarih", kanitKaynaklari: ["onder", "onder", null, "smith"], pdfDoileri: ["10.0000/ORNEK.2", null] });
  assert.equal(b.onder.kanitSayisi, 2);
  assert.equal(b.smith.kanitSayisi, 1);
  assert.equal(b.kurum.kanitSayisi, 0);
  assert.equal(b.smith.pdf, true);
  assert.equal(b.onder.pdf, false, "DOI'siz kaynakta eşleşme aranmaz");
});
