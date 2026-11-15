import assert from "node:assert/strict";
import test from "node:test";
import { agirSorun, aranacakMi, baslikPdfteGeciyor, bosIndirmeSorunlari, indirmeSorunuBildirimleri, kaynakRaporu, kunyeAnahtari, paketAdi, paketDosyalari, pdfAdaylari, pdfDosyaAdi, pdfHazirMi, pdfMi, sorunlariTopla, tekilAdlar, type KaynakPdfSatiri } from "@/lib/kaynak-pdf";

const PESARAN =
  "Pesaran, M. H., Shin, Y., & Smith, R. J. (2001). Bounds testing approaches to the analysis of level relationships. Journal of Applied Econometrics, 16(3), 289–326. https://doi.org/10.1002/jae.616";

test("künye anahtarı noktalama, boşluk ve bağlantıdan etkilenmez; Türkçe harf korunur", () => {
  assert.equal(kunyeAnahtari("Yılmaz,  A. (2020). IŞIK."), kunyeAnahtari("yılmaz a 2020 ışık"));
  assert.equal(kunyeAnahtari(PESARAN).includes("doi"), false);
});

test("PDF imzası: %PDF- ilk 1 KB içinde; HTML giriş sayfası PDF sayılmaz", () => {
  const enc = new TextEncoder();
  assert.equal(pdfMi(enc.encode("%PDF-1.7\n...")), true);
  assert.equal(pdfMi(enc.encode("\n\n%PDF-1.4")), true);
  assert.equal(pdfMi(enc.encode("<!DOCTYPE html><title>Sign in</title>")), false);
  assert.equal(pdfMi(new Uint8Array(0)), false);
});

test("PDF adayları güven sırasıyla, tekrarsız; http(s) olmayanlar atılır", () => {
  const adaylar = pdfAdaylari({
    best_oa_location: { pdf_url: "https://a.org/x.pdf" },
    oa_locations: [{ pdf_url: "https://a.org/x.pdf" }, { pdf_url: "https://b.org/y.pdf" }, { pdf_url: null }],
    open_access: { oa_url: "ftp://c.org/z" },
  });
  assert.deepEqual(adaylar, ["https://a.org/x.pdf", "https://b.org/y.pdf"]);
  assert.deepEqual(pdfAdaylari(null), []);
});

test("dizinde kaydı olmayan künye için PDF aranmaz; DOI yoksa aranmaz", () => {
  assert.equal(aranacakMi("not_found", "10.1/x"), false);
  assert.equal(aranacakMi("verified", null), false);
  assert.equal(aranacakMi("possible_match", "10.1/x"), true);
});

test("dosya adı Soyad_Yıl_Başlık, ASCII; aynı adlar numaralanır", () => {
  assert.equal(pdfDosyaAdi(PESARAN), "Pesaran_2001_Bounds-testing-approaches-to-the-analysis.pdf");
  assert.equal(pdfDosyaAdi("Çelik, Ş. (2019). Öğretmen özyeterliği."), "Celik_2019_Ogretmen-ozyeterligi.pdf");
  assert.deepEqual(tekilAdlar(["a.pdf", "a.pdf", "b.pdf"]), ["a.pdf", "a-2.pdf", "b.pdf"]);
});

test("yüklenen PDF künyenin başlığını taşıyor mu", () => {
  assert.equal(baslikPdfteGeciyor(PESARAN, "Journal ... BOUNDS TESTING APPROACHES TO THE ANALYSIS OF LEVEL RELATIONSHIPS ..."), true);
  assert.equal(baslikPdfteGeciyor(PESARAN, "Introductory Econometrics: A Modern Approach"), false);
});

test("teslim paketi: PDF'i olana benzersiz ad, rapor eksikleri nedeniyle yazar", async () => {
  const { paketDosyalari, kaynakRaporu, paketAdi } = await import("@/lib/kaynak-pdf");
  const satir = (id: string, kunye: string, durum: string, yol: string | null) =>
    ({ id, kunye_anahtari: id, kunye, doi: null, durum, depo_yolu: yol, kaynak_adres: null, baslik_eslesti: null, bakildi: "" }) as never;
  const dosyalar = paketDosyalari([
    satir("1", "Yilmaz, A. (2020). Enflasyon.", "indirildi", "p/kaynak-pdf/a.pdf"),
    satir("2", "Yilmaz, A. (2020). Enflasyon.", "yuklendi", "p/kaynak-pdf/b.pdf"),
    satir("3", "Demir, B. (2018). Kur.", "kayit_yok", null),
  ]);
  assert.deepEqual(dosyalar.map((d) => d.ad), [null, "Yilmaz_2020_Enflasyon.pdf", "Yilmaz_2020_Enflasyon-2.pdf"]);
  const rapor = kaynakRaporu("Tez", dosyalar, "26.10.2026");
  assert.match(rapor, /3 kaynak · 2 kaynağın PDF'i pakette · 1 eksik/);
  assert.match(rapor, /Crossref\/OpenAlex'te bulunamadı/);
  assert.equal(paketAdi("Türkiye'de Enflasyon ve İşsizlik"), "Turkiye-de-Enflasyon-ve-Issizlik-teslim-paketi.zip");
});

test("kaynak raporu ve paket adı İngilizce (28.10.2026)", () => {
  const satir = { id: "1", kunye: "Smith, J. (2020). Writing well.", durum: "kayit_yok", depo_yolu: null, doi: null, baslik_eslesti: null } as unknown as KaynakPdfSatiri;
  const rapor = kaynakRaporu("My Thesis", paketDosyalari([satir]), "28.10.2026", "en");
  assert.match(rapor, /^SOURCE REPORT — My Thesis\r\nCreated: 28\.10\.2026\r\n1 source · PDF in the package for 0 · 1 missing/);
  assert.match(rapor, /Status: No PDF: the source was not found in Crossref\/OpenAlex/);
  assert.match(kaynakRaporu("Tez", paketDosyalari([satir]), "28.10.2026"), /^KAYNAK RAPORU — Tez/);
  assert.equal(paketAdi("Şehir ve Kültür", "en"), "Sehir-ve-Kultur-submission-package.zip");
  assert.equal(paketAdi("Şehir ve Kültür"), "Sehir-ve-Kultur-teslim-paketi.zip");
});

/* P52-0 (15.11.2026): indirme hatası mevcut kayıtları bozmaz, nedeni doğru bildirilir. */
test("PDF'i hazır künyeye yeniden bakılmaz: yüklenen VE indirilen korunur", () => {
  assert.equal(pdfHazirMi("yuklendi"), true);
  assert.equal(pdfHazirMi("indirildi"), true, "eskiden sunucu indirilmiş satırı korumuyordu");
  for (const d of ["bulunamadi", "erisilemedi", "kayit_yok", null, undefined] as const) assert.equal(pdfHazirMi(d), false);
});

test("bir künyenin birden çok adayında en ağır neden sayılır (bizim sorunumuz örtülmez)", () => {
  assert.equal(agirSorun(null, "erisim"), "erisim");
  assert.equal(agirSorun("erisim", "pdf_degil"), "pdf_degil");
  assert.equal(agirSorun("beklenmeyen", "erisim"), "beklenmeyen");
  assert.equal(agirSorun("depo", "pdf_degil"), "depo");
});

test("sorunlar partiler boyunca toplanır; eksik alan sıfır sayılır", () => {
  const t = sorunlariTopla(sorunlariTopla(bosIndirmeSorunlari(), { erisim: 2 }), { beklenmeyen: 1, erisim: 1 });
  assert.deepEqual(t, { erisim: 3, pdf_degil: 0, depo: 0, beklenmeyen: 1 });
  assert.deepEqual(sorunlariTopla(t, undefined), t);
});

test("bildirim: sorun yoksa hiçbiri; bizim sorunumuz 'error', karşı tarafınki 'info'; başarı asla bildirilmez", () => {
  assert.deepEqual(indirmeSorunuBildirimleri(bosIndirmeSorunlari()), []);
  const yalnizKarsi = indirmeSorunuBildirimleri({ erisim: 2, pdf_degil: 1, depo: 0, beklenmeyen: 0 });
  assert.deepEqual(yalnizKarsi.map((b) => b.tur), ["info"]);
  assert.match(yalnizKarsi[0].metin.tr, /^3 kaynağın PDF'i otomatik indirilemedi/);
  assert.match(yalnizKarsi[0].metin.tr, /Kaynağa git/);
  const ikisi = indirmeSorunuBildirimleri({ erisim: 1, pdf_degil: 0, depo: 1, beklenmeyen: 2 });
  assert.deepEqual(ikisi.map((b) => b.tur), ["error", "info"]);
  assert.match(ikisi[0].metin.tr, /^3 kaynağın PDF'i bizim tarafımızdaki bir sorun/);
  assert.match(ikisi[0].metin.en, /^The PDF for 3 sources/);
  for (const b of [...yalnizKarsi, ...ikisi]) assert.notEqual(b.tur, "success" as string);
});
