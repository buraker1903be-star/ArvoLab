// Word içe aktarma kabulünün örnek dosyası (kabul2.mjs). Gerçek bir öğrencinin dosyası yerine
// sentetik: içinde TEK-WORD-7F3 izi ve iki başlık var, betik ikisinin de editöre ve kayda ulaştığını arar.
// Kullanım (depo kökünde): node tasarim/tek-deneyim/betikler/docx-ornek.mjs <hedef.docx>
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(`${process.env.KOK ?? process.cwd()}/package.json`);
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require("docx");
const doc = new Document({ sections: [{ children: [
  new Paragraph({ text: "Giriş", heading: HeadingLevel.HEADING_1 }),
  new Paragraph({ children: [new TextRun("Word içe aktarma kabulü: bu paragraf sentetik örnek dosyadan geldi (TEK-WORD-7F3).")] }),
  new Paragraph({ text: "Yöntem", heading: HeadingLevel.HEADING_1 }),
  new Paragraph({ children: [new TextRun({ text: "Kalın bir cümle", bold: true }), new TextRun(" ve düz devamı.")] }),
] }] });
fs.writeFileSync(process.argv[2], await Packer.toBuffer(doc));
console.log("yazildi", fs.statSync(process.argv[2]).size);
