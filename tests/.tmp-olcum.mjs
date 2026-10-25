import { checkStructure } from "../lib/structure-check.ts";

/* 200 sayfalık teze yakın belge: ~60.000 kelime, 40 başlık, 30 tablo/şekil. */
const p = (t) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const h = (level, t) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: t }] });
const cumle = "Bu çalışmada örgütsel bağlılık ile iş doyumu arasındaki ilişki incelenmiştir (Yılmaz, 2020). ";
const icerik = [];
for (let bolum = 1; bolum <= 8; bolum += 1) {
  icerik.push(h(1, `${bolum}. BÖLÜM`));
  for (let alt = 1; alt <= 5; alt += 1) {
    icerik.push(h(2, `${bolum}.${alt} Alt Başlık`));
    for (let par = 0; par < 40; par += 1) icerik.push(p(cumle.repeat(4)));
    if (alt % 2 === 0) icerik.push(p(`Tablo ${bolum}.${alt}. Betimsel istatistikler`));
  }
}
const doc = { type: "doc", content: icerik };
const kelime = JSON.stringify(doc).length;
console.log(`belge: ${icerik.length} düğüm · ${(kelime/1024).toFixed(0)} KB JSON`);

const olc = (ad, f, tur = 5) => {
  f();
  const t0 = performance.now();
  for (let i = 0; i < tur; i += 1) f();
  console.log(`  ${ad}: ${((performance.now() - t0) / tur).toFixed(1)} ms`);
};
olc("JSON.stringify (kıyas)", () => JSON.stringify(doc));
olc("checkStructure", () => checkStructure(doc, { requiredSections: ["Giriş","Yöntem","Bulgular","Tartışma","Kaynakça"], citationStyle: "apa7" }));
