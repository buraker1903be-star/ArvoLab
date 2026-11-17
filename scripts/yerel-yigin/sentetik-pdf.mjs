// Sentetik, metni bilinen PDF (Yazım Stüdyosu kabulü). Bağımlılık yok: standart
// Helvetica yazı tipiyle, her sayfası satır listesi olan geçerli bir PDF 1.4.
// Yalnızca ASCII metin (WinAnsi); kabul testinin aradığı cümleler burada sabit.

const kacis = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/**
 * @param {string[][]} sayfalar her sayfa: satırlar (yukarıdan aşağı)
 * @param {{ sutunlu?: number[], dolgu?: number }} [secenek] sutunlu: iki sütunlu çizilecek sayfaların 1 tabanlı numaraları;
 *   dolgu: sayfa başına eklenen, hiçbir yerden başvurulmayan ikili akış baytı (boyut/yük testi: dosya büyür, metin değişmez)
 * @returns {Buffer}
 */
export function sentetikPdf(sayfalar, secenek = {}) {
  const nesneler = [];
  const ekle = (govde) => {
    nesneler.push(govde);
    return nesneler.length;
  };
  const katalog = ekle(null);
  const sayfaKoku = ekle(null);
  const yazi = ekle("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const sayfaNolari = [];
  sayfalar.forEach((satirlar, i) => {
    const sutunlu = secenek.sutunlu?.includes(i + 1);
    let icerik = "BT /F1 11 Tf 14 TL\n";
    if (sutunlu) {
      const yari = Math.ceil(satirlar.length / 2);
      icerik += `1 0 0 1 56 760 Tm\n${satirlar.slice(0, yari).map((s) => `(${kacis(s)}) Tj T*`).join("\n")}\n`;
      icerik += `1 0 0 1 316 760 Tm\n${satirlar.slice(yari).map((s) => `(${kacis(s)}) Tj T*`).join("\n")}\n`;
    } else {
      icerik += `1 0 0 1 56 760 Tm\n${satirlar.map((s) => `(${kacis(s)}) Tj T*`).join("\n")}\n`;
    }
    icerik += "ET";
    const akis = ekle(`<< /Length ${Buffer.byteLength(icerik, "latin1")} >>\nstream\n${icerik}\nendstream`);
    if (secenek.dolgu) ekle(`<< /Length ${secenek.dolgu} >>\nstream\n${"\x00".repeat(secenek.dolgu)}\nendstream`);
    sayfaNolari.push(ekle(`<< /Type /Page /Parent ${sayfaKoku} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${yazi} 0 R >> >> /Contents ${akis} 0 R >>`));
  });
  nesneler[katalog - 1] = `<< /Type /Catalog /Pages ${sayfaKoku} 0 R >>`;
  nesneler[sayfaKoku - 1] = `<< /Type /Pages /Kids [${sayfaNolari.map((n) => `${n} 0 R`).join(" ")}] /Count ${sayfaNolari.length} >>`;

  let cikti = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const yerler = [];
  nesneler.forEach((g, i) => {
    yerler.push(Buffer.byteLength(cikti, "latin1"));
    cikti += `${i + 1} 0 obj\n${g}\nendobj\n`;
  });
  const xref = Buffer.byteLength(cikti, "latin1");
  cikti += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n${yerler.map((y) => `${String(y).padStart(10, "0")} 00000 n \n`).join("")}`;
  cikti += `trailer\n<< /Size ${nesneler.length + 1} /Root ${katalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(cikti, "latin1");
}
