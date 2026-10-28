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

  /*
    Kart saklama açıkken (28.10.2026) "kartınız saklanmıyor" yanlış olur;
    not onaysız çekim olmadığını ve kapatmanın yerini söylemeli.
  */
  test("kart saklama açıkken yenileme notu kayıtlı karttan söz ediyor", () => {
    const ozet = bireysel({ kartSaklama: true });
    assert.doesNotMatch(ozet?.yenilemeNotu ?? "", /Otomatik ödeme yok/);
    assert.match(ozet?.yenilemeNotu ?? "", /onay vermediyseniz kendiliğinden çekim yapılmaz/);
    assert.match(ozet?.yenilemeNotu ?? "", /kapatabilirsiniz/);
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

describe("İngilizce", () => {
  test("deneme süresi kartı İngilizce, gün sayısı Türkiye takviminden", () => {
    const ozet = licenseSummary(
      { kind: "individual", status: "trialing", trialEndsAt: "2026-09-25T09:00:00Z", periodEnd: null, organizationName: null, blocked: false },
      new Date("2026-09-20T09:00:00Z"),
      "en",
    );
    assert.equal(ozet?.title, "Your ArvoLab subscription");
    assert.equal(ozet?.statusLabel, "Trial");
    assert.equal(ozet?.detail, "Your trial ends on September 25, 2026 · 5 days left.");
    assert.match(ozet?.yenilemeNotu ?? "", /^No automatic payments/);
  });
});
