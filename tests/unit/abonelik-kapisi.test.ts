import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kapaliErisimCumlesi, kapisizYolMu } from "@/lib/abonelik-kapisi";
import { erkenYenilemeDonemi } from "@/lib/license-summary";

describe("kapalı erişimde açık kalan sayfalar", () => {
  test("ödeme, destek ve ayarlar açık", () => {
    // AGENTS.md: ödeme, giriş ve destek yolları asla kapatılmaz.
    for (const yol of ["/dashboard/abonelik", "/dashboard/expert-requests", "/dashboard/support", "/dashboard/settings", "/dashboard/expert-requests/abc"]) {
      assert.equal(kapisizYolMu(yol), true, yol);
    }
  });

  test("çalışma ekranları kapalı; önek benzerliği kapıyı açmaz", () => {
    for (const yol of ["/dashboard", "/dashboard/editor", "/dashboard/analysis", "/dashboard/abonelikler", "/dashboard/settings-x", null]) {
      assert.equal(kapisizYolMu(yol), false, String(yol));
    }
  });
});

describe("kapalı erişim cümlesi", () => {
  test("deneme bitince düzgün Türkçe", () => {
    // Eskiden: "ArvoLab aboneliğiniz deneme süreniz doldu."
    assert.equal(kapaliErisimCumlesi({ kind: "individual", status: "trialing" }), "ArvoLab deneme süreniz doldu.");
  });

  test("kurum adıyla", () => {
    assert.equal(
      kapaliErisimCumlesi({ kind: "organization", status: "suspended", organizationName: "Gazi Üniversitesi" }),
      "Gazi Üniversitesi ArvoLab aboneliği askıya alındı.",
    );
  });

  test("süresi dolan ve hiç başlamayan ayrı", () => {
    assert.equal(kapaliErisimCumlesi({ kind: "individual", status: "past_due", periodEnd: "2026-10-01" }), "ArvoLab aboneliğiniz sona erdi.");
    assert.equal(kapaliErisimCumlesi({ kind: "individual", status: "none" }), "ArvoLab aboneliğiniz henüz başlatılmadı.");
  });
});

describe("erken yenileme", () => {
  const simdi = Date.parse("2026-10-28T12:00:00Z");
  test("son 14 günde açık", () => {
    assert.equal(erkenYenilemeDonemi("2026-11-05T00:00:00Z", simdi), true);
  });
  test("dönem başında kapalı; bitiş bilinmiyorsa kapalı", () => {
    assert.equal(erkenYenilemeDonemi("2026-12-20T00:00:00Z", simdi), false);
    assert.equal(erkenYenilemeDonemi(null, simdi), false);
    assert.equal(erkenYenilemeDonemi("bozuk", simdi), false);
  });
});

describe("kapalı erişim cümlesi İngilizce", () => {
  test("bireysel deneme", () => {
    assert.equal(kapaliErisimCumlesi({ kind: "individual", status: "trialing" }, "en"), "Your ArvoLab trial has ended.");
  });
  test("kurum askıda", () => {
    assert.equal(
      kapaliErisimCumlesi({ kind: "organization", status: "suspended", organizationName: "MIT" }, "en"),
      "The ArvoLab subscription of MIT has been suspended.",
    );
  });
});
