/*
  Resmî kılavuz kaynaklarını toplu keşfeden ve DOĞRULAYAN yerel araç.

  Neden var: sources.tr.json elle doğrulanmış kaynakların listesi ama yalnızca
  iki üniversite içeriyordu (204 üniversiteye karşılık). Listeyi elle
  büyütmek, doğrulanmamış adresler yazmak demek olurdu — yanlış bir kaynak,
  yanlış kurallara ve yanlış bir kılavuza dönüşür.

  Bu araç uygulamanın KENDİ tarayıcısını kullanır (lib/official-guideline-crawl,
  lib/guideline-scan): üniversitenin resmî alan adını YÖK dizininden çözer,
  ana alan adı ve enstitü alt alan adlarını tarar, HTML sayfalardan gerçek
  belgeye iner, belgeyi indirip kural çıkarır. Yani listeye giren her adres
  gerçekten indirilmiş ve içeriği okunmuştur.

  Veritabanına DOKUNMAZ; yalnızca dosyaya yazar. Kayıtların sisteme girişi
  insan onayından geçer (guidelines:seed-sql ile üretilen SQL).

  Kullanım:
    node --import ./tests/register.mjs scripts/guidelines/kesif-taramasi.mjs \
      [--baslangic 0] [--limit 10] [--cikti scripts/guidelines/sources.tr.json]

  Uzun sürer (üniversite başına ~10-40 sn): parça parça çalıştırılır ve her
  bulguda dosyaya yazar, böylece yarıda kesilirse ilerleme kaybolmaz.
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { crawlUniversityAndInstitutes, resolveOfficialUniversityDomain } from "@/lib/official-guideline-crawl";
import { scanGuidelineUrl } from "@/lib/guideline-scan";
import { enstituTespitEt, fakulteVeyaBolumBelgesi } from "@/lib/enstitu-tespiti";

const dizin = path.dirname(fileURLToPath(import.meta.url));

const arg = (ad, varsayilan) => {
  const i = process.argv.indexOf(`--${ad}`);
  return i === -1 ? varsayilan : process.argv[i + 1];
};
const BASLANGIC = Number(arg("baslangic", 0));
const LIMIT = Number(arg("limit", 10));
const CIKTI = path.resolve(process.cwd(), arg("cikti", path.join(dizin, "sources.tr.json")));

/** Üniversite adlarını YÖK'ün kendi dizininden alır; elle liste tutulmaz. */
async function universiteAdlari() {
  const sayfalar = await Promise.all(
    [1, 2].map(async (tur) => {
      const yanit = await fetch(`https://www.yok.gov.tr/tr/university?type=${tur}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        headers: { "user-agent": "ArvoLabGuidelineDirectory/1.0" },
      });
      if (!yanit.ok) throw new Error(`YÖK dizini alınamadı: HTTP ${yanit.status}`);
      return yanit.text();
    }),
  );
  const adlar = new Set();
  for (const eslesme of sayfalar.join("\n").matchAll(/data-name="([^"]+)"/gi)) adlar.add(eslesme[1].trim());
  return [...adlar].sort((a, b) => a.localeCompare(b, "tr"));
}

const mevcut = fs.existsSync(CIKTI) ? JSON.parse(fs.readFileSync(CIKTI, "utf8")) : [];
const bilinenAdresler = new Set(mevcut.map((k) => k.sourceUrl));
const bugun = new Date().toISOString().slice(0, 10);

/** Bir üniversitenin kılavuzlarını bulur; her enstitü için en fazla bir kayıt. */
async function universiteyiTara(ad) {
  const alanAdi = await resolveOfficialUniversityDomain(ad).catch(() => null);
  if (!alanAdi) return { durum: "alan_adi_yok" };

  const adaylar = await crawlUniversityAndInstitutes(alanAdi).catch(() => []);
  if (!adaylar.length) return { durum: "aday_yok" };

  const bulunanlar = [];
  const gorulenEnstitu = new Set();

  for (const aday of adaylar.slice(0, 8)) {
    if (bilinenAdresler.has(aday.url)) continue;
    let tarama;
    try {
      tarama = await scanGuidelineUrl(aday.url);
    } catch {
      continue;
    }

    /*
      Doğrulama ölçütü: belge gerçekten okunabilmiş ve kılavuza benziyor
      olmalı. Kural çıkmayan bir dosyayı "doğrulanmış kaynak" diye listeye
      yazmak, listenin anlamını yok ederdi.
    */
    const kuralSayisi = Object.keys(tarama.suggestedRules ?? {}).length;
    if (tarama.fullTextLength < 2000 || tarama.suggestedSections.length < 2 || kuralSayisi < 2) continue;

    const enstitu = enstituTespitEt({ metin: tarama.textPreview, url: aday.url, baslik: aday.title });
    if (!enstitu && fakulteVeyaBolumBelgesi({ metin: tarama.textPreview, baslik: aday.title })) continue;

    const anahtar = enstitu?.ad ?? "__universite__";
    if (gorulenEnstitu.has(anahtar)) continue;
    gorulenEnstitu.add(anahtar);

    bulunanlar.push({
      universityName: ad,
      instituteName: enstitu?.ad ?? null,
      documentTitle: aday.title || "Tez Yazım Kılavuzu",
      versionLabel: tarama.versionLabel,
      effectiveFrom: tarama.effectiveFrom,
      sourceUrl: aday.url,
      verifiedAt: bugun,
      statusNote: `Resmî ${alanAdi} kaynağından otomatik keşfedildi ve indirilerek doğrulandı (${tarama.suggestedSections.length} bölüm, ${kuralSayisi} kural, güven %${Math.round(tarama.confidence * 100)}${tarama.ocrKullanildi ? ", OCR" : ""}).`,
    });
  }

  return bulunanlar.length ? { durum: "bulundu", bulunanlar } : { durum: "dogrulanamadi" };
}

const adlar = await universiteAdlari();
const dilim = adlar.slice(BASLANGIC, BASLANGIC + LIMIT);
console.log(`${adlar.length} üniversite · ${BASLANGIC}–${BASLANGIC + dilim.length} taranıyor\n`);

const sayac = { bulundu: 0, kayit: 0 };
for (const [sira, ad] of dilim.entries()) {
  const t0 = Date.now();
  let sonuc;
  try {
    sonuc = await universiteyiTara(ad);
  } catch (hata) {
    sonuc = { durum: "hata", mesaj: hata instanceof Error ? hata.message : String(hata) };
  }
  const sure = `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  if (sonuc.durum === "bulundu") {
    sayac.bulundu += 1;
    sayac.kayit += sonuc.bulunanlar.length;
    for (const kayit of sonuc.bulunanlar) {
      mevcut.push(kayit);
      bilinenAdresler.add(kayit.sourceUrl);
      console.log(`  ✓ ${ad} — ${kayit.instituteName ?? "üniversite geneli"} · ${kayit.sourceUrl}`);
    }
    // Her bulguda yazılır: uzun tarama yarıda kesilirse ilerleme kaybolmasın.
    fs.writeFileSync(CIKTI, `${JSON.stringify(mevcut, null, 2)}\n`);
  } else {
    console.log(`  · ${ad} — ${sonuc.durum}${sonuc.mesaj ? ` (${sonuc.mesaj})` : ""} [${sure}]`);
  }
  if (sira % 10 === 9) console.log(`    … ${sira + 1}/${dilim.length}`);
}

console.log(`\nBitti: ${sayac.bulundu} üniversitede ${sayac.kayit} yeni kayıt · toplam ${mevcut.length}`);
console.log(`Sonraki parça:  --baslangic ${BASLANGIC + dilim.length}`);
