import assert from "node:assert/strict";
import { test } from "node:test";
import { acilacakPdf, adrestekiPdf, editorPdfAdresi, kaynakDurumlari, kaynakKaydiAdresi, pdfEslesmesi } from "../../lib/kaynak-durumu";

const K = { id: "11111111-1111-4111-8111-111111111111", doi_or_url: "https://doi.org/10.1371/journal.pone.0115069" };
const P = (id: string, doi: string | null, kaynakId: string | null = null) => ({ id, doi, kaynakId });

test("açık bağ DOI eşleşmesinden önce gelir", () => {
  const e = pdfEslesmesi(K, [P("a", "10.1371/journal.pone.0115069"), P("b", null, K.id)]);
  assert.equal(e.tur, "bagli");
  assert.equal(acilacakPdf(e)?.id, "b");
});

test("tek DOI eşleşmesi açılır ama onay tonunda DEĞİL", () => {
  const e = pdfEslesmesi(K, [P("a", "doi:10.1371/JOURNAL.PONE.0115069")]);
  assert.equal(e.tur, "doi");
  assert.equal(acilacakPdf(e)?.id, "a");
  const pdf = kaynakDurumlari({ kunye: null, pdf: e })[1];
  assert.equal(pdf.ton, "uyari");
  assert.match(pdf.kisa.tr, /DOI ile eşleşti/);
});

test("aynı DOI'de iki PDF: belirsiz, açılmaz, 'PDF yok' diye de gizlenmez", () => {
  const e = pdfEslesmesi(K, [P("a", "10.1371/journal.pone.0115069"), P("b", "10.1371/journal.pone.0115069")]);
  assert.equal(e.tur, "belirsiz");
  assert.equal(acilacakPdf(e), null);
  const pdf = kaynakDurumlari({ kunye: null, pdf: e })[1];
  assert.equal(pdf.ton, "uyari");
  assert.match(pdf.kisa.tr, /2 PDF/);
});

test("başka kayda bağlı PDF DOI'si tutsa da bu kaynağa sayılmaz", () => {
  assert.equal(pdfEslesmesi(K, [P("a", "10.1371/journal.pone.0115069", "baska")]).tur, "yok");
});

test("üç durum ayrı: künye doğrulandı, PDF yok, alıntı yok — tek bir 'doğrulandı' yok", () => {
  const d = kaynakDurumlari({ kunye: { durum: "dogrulandi", dizin: "crossref" }, pdf: { tur: "yok" } });
  assert.deepEqual(
    d.map((x) => [x.anahtar, x.ton]),
    [
      ["kayit", "tamam"],
      ["pdf", "notr"],
      ["alinti", "notr"],
    ],
  );
  assert.match(d[0].aciklama.tr, /Crossref/);
});

test("eksik alan doğrulanmış künyeyi bile onay tonundan çıkarır", () => {
  const d = kaynakDurumlari({ kunye: { durum: "dogrulandi" }, eksikAlanlar: ["yıl"], pdf: { tur: "yok" } });
  assert.equal(d[0].ton, "uyari");
  assert.match(d[0].aciklama.tr, /eksik: yıl/);
});

test("kısmi/uyuşmayan/doğrulanamayan künye onay tonunda değil", () => {
  for (const durum of ["kismen", "uyusmuyor", "dogrulanamadi"] as const) {
    assert.equal(kaynakDurumlari({ kunye: { durum }, pdf: { tur: "yok" } })[0].ton, "uyari");
  }
});

test("alıntı yalnızca doğrulanmış sayfa varsa tamam", () => {
  assert.equal(kaynakDurumlari({ kunye: null, pdf: { tur: "yok" }, alintiSayfasi: 4 })[2].ton, "tamam");
  assert.equal(kaynakDurumlari({ kunye: null, pdf: { tur: "yok" }, alintiSayfasi: null })[2].ton, "notr");
});

test("adresler: kayıt ve PDF doğrudan; bozuk kimlik/sayfa yok sayılır", () => {
  assert.equal(kaynakKaydiAdresi("p 1", K.id), `/dashboard/literature?calisma=p%201&kaynak=${K.id}`);
  assert.equal(editorPdfAdresi("p", K.id, 3), `/dashboard/editor/p/write?sag=pdf&pdf=${K.id}&sayfa=3`);
  assert.equal(editorPdfAdresi("p", K.id), `/dashboard/editor/p/write?sag=pdf&pdf=${K.id}`);
  assert.deepEqual(adrestekiPdf(K.id, "7"), { id: K.id, sayfa: 7 });
  assert.deepEqual(adrestekiPdf(K.id, "-1"), { id: K.id });
  assert.deepEqual(adrestekiPdf(K.id, "abc"), { id: K.id });
  assert.equal(adrestekiPdf("javascript:alert(1)", "1"), null);
  assert.equal(adrestekiPdf(null, null), null);
});
