import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkStructure } from "@/lib/structure-check";
import { atifDenetimi } from "@/lib/atif-denetimi";
import { checkGuidelineCompliance } from "@/lib/guideline-check";
import { extractPlainText, type TiptapDoc } from "@/lib/tiptap-text";

/*
  ÖRNEK TEZİN RAPORU (03.11.2026). Kurum sahibi "Türkiye'de Enflasyon ve
  İşsizlik İlişkisinin Ekonometrik Analizi" tezinin iki raporunu belgeyle
  tek tek karşılaştırdı: yanlış alarmlar (0/100 APA puanı, eklerden ve
  koddan üretilmiş künyeler, [Haber bülteni] boş alan sayılması,
  Buyrukoğlu/Staiger "anılmıyor"…) ve kaçırılanlar (FPE, HQ, yılsız
  atıflar, Şekil 1'in adlandırıcı başlığı).

  Fixture, tezin Word dosyasının ArvoLab'ın KENDİ içe aktarıcısından
  (lib/docx-import.ts) ve editör şemasından geçmiş hâli; tek kişisel
  satır ("@ad") "Taslak" yapıldı. Rapor bir dosyaya sabitlenir: bir
  denetimdeki değişiklik bu tezin raporunu değiştirirse test kırılır ve
  fark gözle incelenir. Bilerek değiştirildiyse:
    GUNCELLE=1 npm run test:unit
*/
const KOK = fileURLToPath(new URL("../fixtures/", import.meta.url));
const belge = JSON.parse(readFileSync(`${KOK}tez-enflasyon-issizlik.json`, "utf8")) as TiptapDoc;
// Kurum sahibinin kılavuzunun (DEÜ) okunan zorunlu bölümleri.
const ZORUNLU = ["Yemin Metni", "Özet", "Abstract", "Giriş", "Sonuç ve Öneriler", "Kaynakça", "Ekler"];

function rapor(): string {
  const satirlar: string[] = [];
  const kilavuz = checkGuidelineCompliance(extractPlainText(belge), ZORUNLU, "apa7", "apa7");
  const bulunan = kilavuz.sections.filter((s) => s.found).length;
  satirlar.push(`KILAVUZ ${bulunan}/${kilavuz.sections.length}${kilavuz.missingSections.length ? ` eksik: ${kilavuz.missingSections.join(", ")}` : ""}`);
  const atif = atifDenetimi(belge, "apa7");
  satirlar.push(
    `ATIF künye=${atif.references.length} puan=${atif.complianceScore} anılmayan=${atif.crossCheck.referencesWithoutCitation.length} karşılıksız=${atif.crossCheck.citationsWithoutReference.length}`,
  );
  for (const s of checkStructure(belge, { citationStyle: "apa7", belgeDili: "tr" }, "tr")) {
    satirlar.push(`[${s.kategori}] ${s.tone}: ${s.message}`);
  }
  return `${satirlar.join("\n")}\n`;
}

test("örnek tezin raporu sabit", () => {
  const dosya = `${KOK}tez-enflasyon-issizlik.rapor.txt`;
  const uretilen = rapor();
  if (process.env.GUNCELLE === "1") writeFileSync(dosya, uretilen);
  assert.equal(uretilen, readFileSync(dosya, "utf8"));
});

test("raporda OLMAMASI gerekenler", () => {
  const metin = rapor();
  for (const yok of [
    "H1'den H3'e",
    "tablonun altında",
    "Buyrukoğlu, A., & Altunakar Mercan",
    "Staiger, D., Stock",
    "[Haber bülteni]",
    "[Yayımlanmamış yüksek lisans tezi]",
    "Yil,ENF",
    "numpy",
    "puan=0 ",
  ])
    assert.ok(!metin.includes(yok), `raporda “${yok}” geçmemeli`);
  // Aynı kaynak bir kez.
  assert.equal(metin.split("TÜİK. (2026a)").length - 1, 1);
});

test("raporda OLMASI gerekenler", () => {
  const metin = rapor();
  for (const n of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12]) assert.match(metin, new RegExp(`Tablo ${n} \\(.*metinde anılmıyor`));
  assert.doesNotMatch(metin, /Tablo 8 \(.*metinde anılmıyor/);
  assert.match(metin, /Ek 2 .*metinde anılmıyor/);
  assert.doesNotMatch(metin, /Ek 1 .*metinde anılmıyor/);
  assert.match(metin, /TÜİK\. \(2026a\).*metinde anılmıyor/);
  assert.match(metin, /TÜİK\. \(2026b\).*metinde anılmıyor/);
  assert.match(metin, /Yılsız atıf: “Granger ve Newbold'un”/);
  assert.match(metin, /Yılsız atıf: “Newey–West”/);
  assert.match(metin, /Atıf biçimi hatalı: “Engle–Granger \(1987\)”/);
  assert.match(metin, /Atıf biçimi hatalı: “Zivot–Andrews \(1992\)”/);
  assert.match(metin, /açılmamış kısaltmalar .*BIC.*FPE.*HQ/);
  assert.match(metin, /Şekil 1 için adlandırıcı başlık eksik/);
  assert.match(metin, /Doldurulmamış alan: “\[Ad SOYAD\]” \(2 kez\)/);
  assert.match(metin, /Doldurulmamış alan: “\[Unvan Ad SOYAD\]”/);
  assert.match(metin, /Doldurulmamış alan: “\[\.\.\.\.\.\.\.\.\.\]”/);
  assert.match(metin, /Doldurulmamış alan: “Tarih: \.\.\.\.\/\.\.\.\.\/2026”/);
  assert.match(metin, /Doldurulmamış alan: “İmza: \.{4,}”/);
});
