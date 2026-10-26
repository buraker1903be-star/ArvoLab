import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { faturalamaKapsami, faturalamaOku, odemeAciklamasi, tutarYazisi } from "@/lib/faturalama";

describe("faturalama", () => {
  test("ArvoOS yanıtı okunur; fatura ve dekont yalnızca https bağlantıyla", () => {
    const f = faturalamaOku({
      toplamOdenen: 84800,
      bekleyenTutar: 0,
      odemeler: [
        { id: "a", tarih: "2026-10-26T10:00:00Z", tutar: 34900, tur: "abonelik", kanal: "kart", durum: "odendi",
          donemBaslangic: "2026-10-26T10:00:00Z", donemBitis: "2026-11-26T10:00:00Z",
          fatura: { no: "ARV2026000001", tarih: "2026-10-27", url: "https://x.supabase.co/sign/1" } },
        { id: "b", tutar: 49900, tur: "kredi", dekontUrl: "javascript:alert(1)", fatura: { no: "", url: "https://x" } },
      ],
    })!;
    assert.equal(f.odemeler.length, 2);
    assert.equal(f.odemeler[0].fatura?.no, "ARV2026000001");
    assert.equal(f.odemeler[1].dekontUrl, null, "https olmayan adres bağlantıya dönüşmez");
    assert.equal(f.odemeler[1].fatura, null, "numarasız fatura gösterilmez");
    assert.equal(f.toplamOdenen, 84800);
  });

  test("tutarı ya da kimliği okunamayan satır atılır; liste yoksa null", () => {
    const f = faturalamaOku({ odemeler: [{ id: "a" }, { tutar: 100 }, { id: "c", tutar: -5 }, { id: "d", tutar: 100 }] })!;
    assert.deepEqual(f.odemeler.map((o) => o.id), ["d"]);
    assert.equal(faturalamaOku({ status: "active" }), null);
    assert.equal(faturalamaOku(null), null);
  });

  test("açıklama ve tutar yazımı", () => {
    const [kredi, abonelik] = faturalamaOku({ odemeler: [
      { id: "k", tutar: 49900, tur: "kredi" },
      { id: "a", tutar: 34900, donemBaslangic: "2026-10-26T10:00:00Z", donemBitis: "2026-11-26T10:00:00Z" },
    ] })!.odemeler;
    assert.equal(odemeAciklamasi(kredi), "AI kredisi");
    assert.equal(odemeAciklamasi(abonelik), "ArvoLab aboneliği · 26.10.2026 – 26.11.2026");
    assert.equal(tutarYazisi(49900), "499,00 TL");
  });

  test("kurumun ödemelerini yalnızca kurum yöneticisi görür", () => {
    assert.deepEqual(faturalamaKapsami("individual", "student", null), { tur: "bireysel" });
    assert.deepEqual(faturalamaKapsami("organization", "academic_manager", "k1"), { tur: "kurum", kurumId: "k1" });
    assert.equal(faturalamaKapsami("organization", "student", "k1"), null);
    assert.equal(faturalamaKapsami("organization", "controller", "k1"), null);
    assert.equal(faturalamaKapsami("organization", "academic_manager", null), null);
    assert.equal(faturalamaKapsami("staff", "founder", null), null);
  });
});
