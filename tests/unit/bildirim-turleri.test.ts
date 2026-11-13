import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  T2 (14.11.2026): nötr bilgilendirme bildirimi ("info"). Bileşen React'e
  bağlı olduğu için çalıştırılarak sınanamıyor (AGENTS.md, tests/unit);
  sözleşme kaynak metninden okunuyor. Mevcut success/error davranışı da
  burada sabitleniyor.
*/

const olaylar = readFileSync("app/dashboard/_components/toast-events.ts", "utf8");
const toaster = readFileSync("app/dashboard/_components/toaster.tsx", "utf8");
const css = readFileSync("app/styles/overlays.css", "utf8");
const form = readFileSync("app/dashboard/citations/citation-check-form.tsx", "utf8");

describe("bildirim türleri", () => {
  test("tür birleşimi üç değer: success, error, info", () => {
    assert.match(olaylar, /export type ToastKind = "success" \| "error" \| "info";/);
  });

  test("yalnızca hata acil uyarıdır; başarı ve bilgi kibar duyurulur", () => {
    assert.match(toaster, /const acil = toast\.kind === "error";/);
    assert.match(toaster, /role=\{acil \? "alert" : "status"\}/);
    assert.match(toaster, /aria-live=\{acil \? "assertive" : "polite"\}/);
  });

  test("süreler: başarı 3.8 sn ve hata 8 sn korunur, bilgi 6 sn", () => {
    assert.match(toaster, /const SURE: Record<ToastDetail\["kind"\], number> = \{ success: 3800, info: 6000, error: 8000 \};/);
  });

  test("hata başlığı ve başarı gövdesi değişmedi; bilgi kendi başlığını taşır", () => {
    assert.match(toaster, /t\(\{ tr: "İşlem tamamlanamadı", en: "Action failed" \}\)/);
    assert.match(toaster, /t\(\{ tr: "İşlem başarıyla tamamlandı\.", en: "Completed successfully\." \}\)/);
    assert.match(toaster, /info \? t\(\{ tr: "Bilgi", en: "Note" \}\)/);
  });

  test("bilgi stili tanımlı, kırmızı değil ve yalnızca token kullanıyor", () => {
    const blok = css.slice(css.indexOf(".toast.is-info"), css.indexOf(".toast.is-info .toast-body strong"));
    assert.ok(blok.length > 0, ".toast.is-info yok");
    assert.match(blok, /var\(--info\)/);
    assert.doesNotMatch(blok, /--danger|#[0-9a-f]{3,6}/i);
    assert.match(css, /\.toast\.is-info \.toast-body strong \{ color: var\(--ink\); \}/);
  });
});

describe("ertelenen PDF araması", () => {
  test("ulaşılamayan künye için erteleme notu 'info' türünde", () => {
    const blok = form.slice(form.indexOf("const ertelenen = adaylar.filter"), form.indexOf("if (!kuyruk.length)"));
    assert.match(blok, /showToast\("info", t\(\{/);
    assert.doesNotMatch(blok, /showToast\("error"/);
  });

  test("PDF aramasının gerçek hatası hâlâ 'error'", () => {
    assert.match(form, /if \(sonuc\.error\) \{\s*showToast\("error", sonuc\.error\);/);
  });
});
