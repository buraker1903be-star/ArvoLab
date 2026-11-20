import assert from "node:assert/strict";
import test from "node:test";
import { aramaKunyesi, pdfAramaDurumu } from "@/lib/makale-pdf-durumu";

test("PDF durumu: bulundu, bulunamadı ve servis hatası birbirine karışmaz", () => {
  assert.deepEqual(pdfAramaDurumu({ satirlar: [{ id: "p1", durum: "indirildi", kaynak_adres: "https://x/a.pdf" }] }), { durum: "bulundu", pdfId: "p1", adres: "https://x/a.pdf" });
  assert.equal(pdfAramaDurumu({ satirlar: [{ id: "p2", durum: "bulunamadi", kaynak_adres: null }] }).durum, "bulunamadi");
  assert.equal(pdfAramaDurumu({ satirlar: [{ id: "p3", durum: "kayit_yok", kaynak_adres: null }] }).durum, "bulunamadi");
  // Yayıncı engeli / ağ: geçici, "bulunamadı" DEĞİL; adres korunur.
  assert.deepEqual(pdfAramaDurumu({ satirlar: [{ id: "p4", durum: "erisilemedi", kaynak_adres: "https://pub/x" }] }), { durum: "servis_hatasi", pdfId: null, adres: "https://pub/x" });
  assert.equal(pdfAramaDurumu({ error: "x" }).durum, "servis_hatasi");
  assert.equal(pdfAramaDurumu(null).durum, "servis_hatasi");
  assert.equal(pdfAramaDurumu({ satirlar: [] }).durum, "servis_hatasi", "satır yoksa hüküm verilmez");
});

test("arama künyesi: DOI ve yıl taşır, yazarsız kayıtta da kurulur", () => {
  assert.equal(aramaKunyesi({ baslik: "Peer groups.", yazarlar: ["Demir, B."], yil: 2019, dergi: "Edu", doi: "10.1/x" }), "Demir, B. (2019). Peer groups. Edu. https://doi.org/10.1/x");
  assert.equal(aramaKunyesi({ baslik: "Başlık", yazarlar: [], yil: null }), "(t.y.). Başlık.");
});
