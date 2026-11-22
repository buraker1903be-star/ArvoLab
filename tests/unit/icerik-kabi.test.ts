import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/*
  ORTAK İÇERİK KABI (22.11.2026).

  Panelin bütün sayfaları aynı kapta: aynı azami genişlik
  (--content-max) ve aynı yan boşluklar (.dashboard-main-content).
  Başlıklar, üst eylemler ve ana kartların dış kenarları sayfa
  geçişinde yerinden oynamamalı.

  Eskiden `gb` yardımcı sınıfı sınırı sessizce kaldırıyordu
  (.dashboard-page.gb { max-width: none }). Onu taşıyan on üç sayfa
  geniş ekranda tam genişliğe yayılırken Çalışmalarım 1480'de
  duruyordu; 1920 px'te ölçülen fark: Ana Sayfa ve Kaynaklar 272–1888,
  Çalışmalarım 340–1820. Ana sayfanın kendi `max-width` kuralı da ölüydü
  (daha düşük özgüllük), yani üç ayrı niyet, iki ayrı sonuç vardı.

  Bu testin işi: genişlik kararının TEK yerde kalmasını sabitlemek.
  Sayfa başına genişlik yaması eklenirse burası düşer.
*/
const oku = (yol: string) => readFileSync(yol, "utf8");
const yorumsuz = (m: string) => m.replace(/\/\*[\s\S]*?\*\//g, "");
const STIL_KLASORU = "app/styles";
const stiller = readdirSync(STIL_KLASORU).filter((d) => d.endsWith(".css"));

describe("içerik kabı tek yerde", () => {
  test("ortak kap .dashboard-page üzerinde ve --content-max ile", () => {
    const css = yorumsuz(oku(`${STIL_KLASORU}/components.css`));
    assert.match(css, /\.dashboard-page \{ max-width: var\(--content-max\); margin: 0 auto; \}/);
  });

  test("`gb` yardımcı sınıfı kabı kaldırmıyor", () => {
    const css = yorumsuz(oku(`${STIL_KLASORU}/genel-bakis.css`));
    assert.doesNotMatch(css, /\.dashboard-page\.gb\s*\{[^}]*max-width/);
  });

  test("ana sayfanın kendi genişlik kuralı yok (ölü kural kaldırıldı)", () => {
    const css = yorumsuz(oku(`${STIL_KLASORU}/os5-ana-sayfa.css`));
    assert.doesNotMatch(css, /\.os5-ana \{[^}]*max-width/);
  });

  /*
    TEK İSTİSNA: editörün yazım ekranı. Yerleşim kararı (sütun mu,
    çekmece mi) ölçülen genişlikten veriliyor; 1480'e sıkıştırmak geniş
    ekranda sağ paneli gereksiz yere çekmeceye düşürürdü.
  */
  test("tam genişlik istisnası yalnızca editörün yazım ekranı ve açıkça yazılı", () => {
    const istisnalar: string[] = [];
    for (const dosya of stiller) {
      const css = yorumsuz(oku(`${STIL_KLASORU}/${dosya}`));
      for (const m of css.matchAll(/([^{}]*\.dashboard-page[^{}]*)\{([^}]*)\}/g)) {
        if (/max-width:\s*none/.test(m[2])) istisnalar.push(`${dosya}: ${m[1].trim()}`);
      }
    }
    assert.deepEqual(istisnalar, ["components.css: .dashboard-page.yazma-sayfasi"]);
  });

  test("sayfa başına genişlik yaması yok: .dashboard-page dışında max-width taşıyan sayfa kökü yok", () => {
    /* Sayfa kökleri (<main>) yalnızca ortak kaptan genişlik alır. */
    const sayfaKokleri = [".calismalarim", ".kaynaklar-sayfasi", ".gb-ana-sayfa", ".os5-ana"];
    const bulunan: string[] = [];
    for (const dosya of stiller) {
      const css = yorumsuz(oku(`${STIL_KLASORU}/${dosya}`));
      for (const m of css.matchAll(/([^{}@]+)\{([^}]*)\}/g)) {
        const secici = m[1].trim();
        if (!/max-width/.test(m[2])) continue;
        for (const kok of sayfaKokleri) {
          /* Yalnızca kökün KENDİSİ (iç öğeler serbest: panel, sütun, kart). */
          if (secici.split(",").some((p) => p.trim() === kok || p.trim() === `.dashboard-page${kok}`)) {
            bulunan.push(`${dosya}: ${secici}`);
          }
        }
      }
    }
    assert.deepEqual(bulunan, []);
  });

  test("yan boşluklar da tek yerde: .dashboard-main-content padding'i", () => {
    const kabuk = yorumsuz(oku(`${STIL_KLASORU}/shell.css`));
    assert.match(kabuk, /\.dashboard-main-content \{ flex: 1; padding: 26px 32px 48px; \}/);
    /* Telefonda daha dar yan boşluk, yine aynı kuralda. */
    assert.match(kabuk, /\.dashboard-main-content \{\s*\n\s*padding: 8px max\(16px/);
  });
});
