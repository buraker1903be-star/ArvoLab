import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/*
  Bir çalışmanın kılavuzunu okuyan her ekran calismaKilavuzu /
  calismaKilavuzlari'ndan geçmeli (lib/guideline-rules.ts): katalogdaki
  ONAYLI sürüm, yoksa öğrencinin yüklediği kılavuz.

  Katalog 26.10.2026'da kaldırılıp kılavuz çalışma başına yüklenmeye
  başlayınca yalnızca kataloğu okuyan yardımcılar (loadAppliedGuideline,
  loadAppliedGuidelines) yeni çalışmalarda sessizce null döndü. 28.10.2026'da
  yedi ekranda böyleydi: Belge Kontrol, editörün kılavuz kontrolü, Word
  çıktısı, danışman paylaşımı, Çalışmalarım temposu, atıf ekranlarının sayı
  biçimi ve "Kılavuza göre düzelt". Hata vermiyorlardı; aynı çalışma bir
  ekranda kılavuzlu, ötekinde kılavuzsuz görünüyordu.
*/
function dosyalar(kok: string): string[] {
  return readdirSync(kok).flatMap((ad) => {
    const yol = join(kok, ad);
    return statSync(yol).isDirectory() ? dosyalar(yol) : /\.tsx?$/.test(ad) ? [yol] : [];
  });
}

test("app/ katalog-yalnız kılavuz yardımcılarını kullanmıyor", () => {
  const ihlal = dosyalar("app").filter((yol) => /\bloadAppliedGuidelines?\s*\(/.test(readFileSync(yol, "utf8")));
  assert.deepEqual(ihlal, []);
});
