import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { licenseSummary } from "@/lib/license-summary";

const bireysel = (ek: Partial<Parameters<typeof licenseSummary>[0]> = {}) =>
  licenseSummary({
    kind: "individual",
    status: "active",
    trialEndsAt: null,
    periodEnd: null,
    organizationName: null,
    blocked: false,
    ...ek,
  });

describe("lisans kartı metinleri", () => {
  /*
    Bu üründe saklı kart ve otomatik çekim YOK; dönem, ödeme bağlantısı
    tamamlandıkça uzuyor. Karttan söz eden bir metin hem kullanıcıyı
    kartını kontrol etmeye gönderir hem de "kendiliğinden çekilecek"
    sandırır.
  */
  test("hiçbir durum metni karttan ya da otomatik çekimden söz etmiyor", () => {
    for (const status of ["active", "trialing", "past_due", "inactive", "suspended", "canceled"]) {
      const ozet = bireysel({ status, blocked: status !== "active" && status !== "trialing" });
      const metin = `${ozet?.statusLabel} ${ozet?.detail} ${ozet?.paymentNote}`;
      assert.doesNotMatch(metin, /kartınız|kart bilgi|otomatik çekim/i, `"${status}" metninde kart geçiyor`);
    }
  });

  test("bireysel aboneye yenileme kuralı açıkça yazılıyor", () => {
    const ozet = bireysel();
    assert.match(ozet?.yenilemeNotu ?? "", /Otomatik ödeme yok/);
    assert.match(ozet?.yenilemeNotu ?? "", /silinmez/);
  });

  test("kurum aboneliğinde yenileme notu yok: muhatap kurum", () => {
    const ozet = licenseSummary({
      kind: "organization", status: "active", trialEndsAt: null, periodEnd: null,
      organizationName: "AkademikMerkez", blocked: false,
    });
    assert.equal(ozet?.yenilemeNotu, "");
  });

  test("iç ekip ve bilinmeyen durumda kart hiç çizilmiyor", () => {
    assert.equal(bireysel({ kind: "staff" }), null);
    assert.equal(bireysel({ status: "unknown" }), null);
    assert.equal(bireysel({ status: "unreachable" }), null);
  });
});
