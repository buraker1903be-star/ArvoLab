/*
  KABUL BETİKLERİNİN ÖN KOŞUL DENETİMİ (G1 Aşama 5, 10.11.2026).

  Çıkış kodları bütün kabul betiklerinde aynı anlamı taşır:
    0  PASS     — bütün denetimler geçti;
    1  FAIL     — bir denetim düştü ya da betik koşarken hata verdi
                  (betiğin KENDİ hatası da buradadır: ön koşul sayılmaz);
    2  BLOCKED  — betik hiç koşturulamadı: sunucu açılmıyor, yanlış
                  bayraklarla başlatılmış ya da argüman/dosya eksik.
  2 YALNIZCA senaryolar başlamadan önce, bu modülün açık denetimleriyle
  verilir. Senaryo sırasında olan her şey 1'dir: "ön koşul" demek bir
  düşüşü gizlemenin en kolay yolu olurdu.

  Sunucunun bayrakları x-arvolab-onizleme başlığından okunur
  (lib/onizleme-takmalari.ts → onizlemeBayraklari, next.config.ts);
  davranıştan tahmin edilmez. Neden ve kip tablosu: kabul-katalogu.mjs.
*/
import { existsSync } from "node:fs";
import { KATALOG, beyaniCoz, eksikler, sunucuOrtami } from "./kabul-katalogu.mjs";

export const CIKIS = { PASS: 0, FAIL: 1, BLOCKED: 2 };
const BASLIK = "x-arvolab-onizleme";

/** Betiği BLOCKED (2) ile durdurur. Yalnızca senaryolar başlamadan önce çağrılır. */
export function onkosulYok(mesaj) {
  console.log(`ÖNKOŞUL YOK (BLOCKED): ${mesaj}`);
  process.exit(CIKIS.BLOCKED);
}

/** Argüman ya da dosya eksikse BLOCKED. */
export function dosyaGerekli(yol, ne, kullanim) {
  if (!yol) onkosulYok(`${ne} verilmedi. Kullanım: ${kullanim}`);
  if (!existsSync(yol)) onkosulYok(`${ne} bulunamadı: ${yol}. Kullanım: ${kullanim}`);
}

const komut = (betik, kip, taban) => {
  const ortam = Object.entries(sunucuOrtami(kip)).map(([a, d]) => `${a}=${d}`).join(" ");
  const port = new URL(taban).port || "3123";
  const arg = kip.arg.map((a) => a.replace("{taban}", taban).replace("{gunluk}", "<sunucu-gunlugu>").replace("{yakalama}", "<yakalama.json>")).join(" ");
  return `${ortam} npx next dev -p ${port}${kip.taze ? "   (YENİ başlatılmış sunucu: örnek veri bellekte değişmemiş olmalı)" : ""}\n    NODE_PATH=$(npm root -g) node scripts/onizleme/${betik}.mjs ${arg}`;
};

/**
 * Sunucunun bu betiğin kipine uygun başlatılıp başlatılmadığını denetler.
 * kipAdi null ise sunucuya uyan ilk kip seçilir (betik iki hâli de sınıyorsa).
 * Uygunsa { kip, beyan } döner; değilse BLOCKED ile çıkar.
 */
export async function onkosul(betik, taban, kipAdi = null) {
  const kayit = KATALOG[betik];
  // Katalogda olmayan betik bir programlama hatasıdır (FAIL), ön koşul değil.
  if (!kayit) throw new Error(`kabul-katalogu.mjs içinde "${betik}" yok`);
  if (kipAdi !== null && !kayit.kipler[kipAdi]) {
    onkosulYok(`"${kipAdi}" bu betiğin kiplerinden değil. Geçerli kipler: ${Object.keys(kayit.kipler).join(", ")}`);
  }

  let yanit;
  try {
    // İlk istek sayfayı derletebilir; geliştirme sunucusunda dakikayı bulabiliyor.
    yanit = await fetch(`${taban}/`, { signal: AbortSignal.timeout(240000) });
  } catch (hata) {
    onkosulYok(`${taban} açılmıyor (${String(hata?.cause?.code ?? hata?.message ?? hata).slice(0, 120)}). Önizleme sunucusunu başlatın.`);
  }
  const ham = yanit.headers.get(BASLIK);
  if (!ham) {
    onkosulYok(`${taban} önizleme bayrak beyanı vermiyor (${BASLIK} başlığı yok): önizleme sunucusu değil ya da beyandan önceki bir sürüm.`);
  }
  const beyan = beyaniCoz(ham);

  const adaylar = kipAdi !== null ? [kipAdi] : Object.keys(kayit.kipler);
  for (const ad of adaylar) {
    if (eksikler(kayit.kipler[ad], beyan).length === 0) {
      console.log(`✓ önkoşul: ${betik}${ad === "varsayilan" ? "" : ` (${ad})`} — sunucu: ${ham}`);
      return { kip: ad, beyan };
    }
  }
  const ayrinti = adaylar
    .map((ad) => {
      const eksik = eksikler(kayit.kipler[ad], beyan)
        .map((e) => `${e.anahtar}=${e.bulunan ?? "?"} (gereken ${e.beklenen})`)
        .join(", ");
      return `  [${ad}] ${eksik}\n    ${komut(betik, kayit.kipler[ad], taban)}`;
    })
    .join("\n");
  onkosulYok(`sunucu bu betik için yanlış bayraklarla başlatılmış.\n  sunucu: ${ham}\n${ayrinti}`);
}
