import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  PREMIUM ÇALIŞMA ALANI (17.11.2026, onaylı tasarım). Bileşenler sunucu/
  istemci bileşeni ve tarayıcıya bağlı; burada kaynak metni üzerinden
  kurum sahibinin kuralları sabitleniyor. Tarayıcıdaki ölçümler (araç
  çubuğu taşması, telefonda metnin ilk ekranda görünmesi) PR açıklamasında.
*/
const oku = (yol: string) => readFileSync(yol, "utf8");
const editor = oku("app/dashboard/editor/[id]/write/manuscript-editor.tsx");
const calisma = oku("app/styles/workspace.css");

describe("Yazım Stüdyosu: belge odakta, kontroller istenince", () => {
  test("inceleme paneli varsayılan kapalı (sunucu ve istemci aynı)", () => {
    assert.match(editor, /tercihOku\(INCELEME_TERCIHI, false\), \(\) => false\)/);
  });
  test("panel düğmesinin adı görünür: Kontroller", () => {
    assert.match(editor, /metin=\{t\(\{ tr: "Kontroller", en: "Checks" \}\)\}/);
  });
  test("kılavuz yoksa tek satırlık bilgi; iki yol da duruyor", () => {
    const blok = editor.slice(editor.indexOf('className="kilavuz-satiri"'), editor.indexOf('className="kilavuz-satiri"') + 1200);
    assert.match(blok, /role="status"/);
    assert.match(blok, /calismaAdresi\(projectId, \{ kilavuz: true \}\)/);
    assert.match(blok, /href=\{editHref\}/);
    assert.doesNotMatch(editor, /data-tone="muted" role="status">\s*<div>\s*<strong>\{t\(\{ tr: "Bu çalışmaya bağlı kılavuz yok"/);
  });
  test("Bul ve Odak modu kaldırılmadı: Belge menüsünde", () => {
    const menu = editor.slice(editor.indexOf('etiket={t({ tr: "Belge", en: "Document" })}'), editor.indexOf("</AracMenusu>", editor.indexOf('etiket={t({ tr: "Belge", en: "Document" })}')));
    assert.match(menu, /setFindOpen\(\(open\) => !open\)/);
    assert.match(menu, /setOdak\(\(o\) => !o\)/);
  });
  test("yazım ekranında birincil düğme yok; kontrol düğmesi ikincil", () => {
    assert.match(editor, /className="projects-filter-button"\s+onClick=\{handleCheck\}/);
  });
  test("telefonda sekmeler yalnızca yazım ekranında gizli; araç çubuğu dar ekranda sarar", () => {
    assert.match(calisma, /\.dashboard-page:has\(\.manuscript-layout\) > \.calisma-sekmeleri \{ display: none; \}/);
    assert.match(calisma, /@media \(min-width: 761px\) and \(max-width: 1439px\) \{\s*\.manuscript-araclar \{ flex-wrap: wrap;/);
  });
});
