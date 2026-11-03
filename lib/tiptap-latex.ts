import { headingNumberMap } from "@/lib/heading-numbering";
import { sayfaKirilimlari } from "@/lib/chapter-rules";
import type { Dil } from "@/lib/dil";

/*
  LaTeX ÇIKTISI (03.11.2026). Editör belgesi Overleaf'e yüklenebilir bir
  .tex dosyasına çevrilir (Jenni'de var, bizde yoktu). Dördüncü çıktı
  yolu: editör, yazdırma (lib/tiptap-html.ts) ve Word (lib/tiptap-docx.ts)
  ile aynı belgeyi okur. Başlık numaraları ve şekil/tablo numaraları
  yazdırmadaki AYNI işlevlerden gelir (headingNumberMap, sayfaKirilimlari);
  LaTeX'in kendi sayacına bırakılsaydı kılavuzun numarasız bölümleri
  (Özet, Kaynakça) numaralanır, iki çıktı ayrışırdı. Bu yüzden başlıklar
  yıldızlı komutla, numara metne yazılarak çıkar.

  Kaynakça olduğu gibi (biçimlenmiş paragraflar) yazılır: künyeyi stilin
  kuralıyla ArvoLab ya da citeproc zaten yazdı; BibTeX'e çevirip LaTeX'e
  yeniden biçimletmek, editörde görülenden farklı bir kaynakça demekti.
  Literatür kütüphanesinin .bib dosyası pakete ayrıca konur.

  Derleyici: pdfLaTeX ile de derlensin diye istatistikte sık geçen Unicode
  simgeler (¹, −, ±, ≤, χ, η…) LaTeX komutuna çevrilir; yine de bilinmeyen
  bir karakter kalırsa XeLaTeX önerilir (dosyanın başında yazıyor).

  Saf modül; testi tests/editor/latex.test.ts.
*/

type Isaret = { type: string; attrs?: Record<string, unknown> };
type Dugum = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: Dugum[]; marks?: Isaret[] };

export type LatexGorsel = { ad: string; src: string };

export type LatexSecenek = {
  baslik: string;
  dil?: Dil;
  headingNumbering?: boolean;
  chapterNewPage?: boolean;
  numarasiz?: string[];
  kenarCm?: { top: number; right: number; bottom: number; left: number };
  puntoPt?: number;
  satirAraligi?: number;
  /** Paketteki .bib dosyasının adı (yoksa satır yazılmaz). */
  bibDosyasi?: string | null;
};

const KACIS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "%": "\\%",
  "~": "\\textasciitilde{}",
};

const UST = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const ALT = "₀₁₂₃₄₅₆₇₈₉";
/* pdfLaTeX'in tanımadığı, akademik metinde sık geçen simgeler. */
const SIMGE: Record<string, string> = {
  "−": "$-$",
  "±": "$\\pm$",
  "×": "$\\times$",
  "÷": "$\\div$",
  "≤": "$\\leq$",
  "≥": "$\\geq$",
  "≠": "$\\neq$",
  "≈": "$\\approx$",
  "∞": "$\\infty$",
  "√": "$\\surd$",
  "→": "$\\rightarrow$",
  "α": "$\\alpha$",
  "β": "$\\beta$",
  "γ": "$\\gamma$",
  "δ": "$\\delta$",
  "Δ": "$\\Delta$",
  "ε": "$\\varepsilon$",
  "η": "$\\eta$",
  "θ": "$\\theta$",
  "λ": "$\\lambda$",
  "μ": "$\\mu$",
  "π": "$\\pi$",
  "ρ": "$\\rho$",
  "σ": "$\\sigma$",
  "Σ": "$\\Sigma$",
  "τ": "$\\tau$",
  "φ": "$\\phi$",
  "χ": "$\\chi$",
  "ω": "$\\omega$",
  "…": "\\ldots{}",
  "\u00a0": "~",
  "˒": ",",
  "⁻": "-",
  "⁽": "(",
  "⁾": ")",
  "ᵖ": "p",
};

/** Düz metni LaTeX'e kaçırır; üst/alt simge rakam dizileri tek komut olur. */
export function latexKacis(metin: string): string {
  let sonuc = "";
  let i = 0;
  const karakterler = [...metin];
  while (i < karakterler.length) {
    const c = karakterler[i];
    const ustMu = (x: string) => UST.includes(x) || "˒⁻⁽⁾ᵖ".includes(x);
    if (UST.includes(c) || (ustMu(c) && i + 1 < karakterler.length && UST.includes(karakterler[i + 1]))) {
      let grup = "";
      while (i < karakterler.length && ustMu(karakterler[i])) {
        const k = karakterler[i];
        grup += UST.includes(k) ? String(UST.indexOf(k)) : SIMGE[k];
        i++;
      }
      sonuc += `\\textsuperscript{${grup}}`;
      continue;
    }
    if (ALT.includes(c)) {
      let grup = "";
      while (i < karakterler.length && ALT.includes(karakterler[i])) grup += String(ALT.indexOf(karakterler[i++]));
      sonuc += `\\textsubscript{${grup}}`;
      continue;
    }
    sonuc += KACIS[c] ?? SIMGE[c] ?? c;
    i++;
  }
  // Tırnaklar: düz " LaTeX'te ters yöne bakar; Türkçede de İngilizce tırnak kullanılıyor.
  return sonuc.replace(/"([^"]*)"/g, "``$1''");
}

const guvenliAdres = (adres: unknown) => {
  const a = String(adres ?? "");
  return /^(https?:|mailto:)/i.test(a) ? a.replace(/[%#\\{}]/g, (c) => `\\${c}`) : null;
};

type Baglam = {
  dipnotlar: number;
  gorseller: LatexGorsel[];
  sekil: number;
  tablo: number;
  dil: Dil;
  numaralar: Map<Dugum, string>;
  kirilimlar: Set<Dugum>;
};

function satirIci(dugumler: Dugum[] | undefined, b: Baglam): string {
  return (dugumler ?? [])
    .map((d) => {
      if (d.type === "hardBreak") return "\\\\\n";
      if (d.type === "footnoteReference") {
        b.dipnotlar++;
        return `\\footnote{${latexKacis(String(d.attrs?.text ?? ""))}}`;
      }
      if (d.type !== "text") return satirIci(d.content, b);
      let metin = latexKacis(d.text ?? "");
      for (const isaret of d.marks ?? []) {
        switch (isaret.type) {
          case "bold":
            metin = `\\textbf{${metin}}`;
            break;
          case "italic":
            metin = `\\textit{${metin}}`;
            break;
          case "underline":
            metin = `\\uline{${metin}}`;
            break;
          case "strike":
            metin = `\\sout{${metin}}`;
            break;
          case "superscript":
            metin = `\\textsuperscript{${metin}}`;
            break;
          case "subscript":
            metin = `\\textsubscript{${metin}}`;
            break;
          case "code":
            metin = `\\texttt{${metin}}`;
            break;
          case "link": {
            const adres = guvenliAdres(isaret.attrs?.href);
            if (adres) metin = `\\href{${adres}}{${metin}}`;
            break;
          }
          // Asistan izi ve metin stili (yazı tipi/renk) LaTeX'e taşınmaz: biri görünmez, öteki şablonun işi.
        }
      }
      return metin;
    })
    .join("");
}

const BASLIK_KOMUTU = ["section", "subsection", "subsubsection", "paragraph"];
const HIZA: Record<string, [string, string]> = {
  center: ["\\begin{center}\n", "\n\\end{center}"],
  right: ["\\begin{flushright}\n", "\n\\end{flushright}"],
  left: ["\\begin{flushleft}\n", "\n\\end{flushleft}"],
};

function tablo(d: Dugum, b: Baglam): string {
  const satirlar = d.content ?? [];
  const sutun = Math.max(1, ...satirlar.map((s) => (s.content ?? []).reduce((n, h) => n + Math.max(1, Number(h.attrs?.colspan) || 1), 0)));
  const govde = satirlar
    .map((s) => {
      const hucreler = (s.content ?? []).map((h) => {
        const ic = (h.content ?? []).map((p) => satirIci(p.content, b)).filter(Boolean).join(" \\newline ");
        const metin = h.type === "tableHeader" ? `\\textbf{${ic}}` : ic;
        const kapsam = Math.max(1, Number(h.attrs?.colspan) || 1);
        return kapsam > 1 ? `\\multicolumn{${kapsam}}{|l|}{${metin}}` : metin;
      });
      return `${hucreler.join(" & ")} \\\\ \\hline`;
    })
    .join("\n");
  return `\\begin{center}\n\\begin{tabularx}{\\linewidth}{|${"X|".repeat(sutun)}}\n\\hline\n${govde}\n\\end{tabularx}\n\\end{center}`;
}

function blok(d: Dugum, b: Baglam): string {
  const attrs = d.attrs ?? {};
  switch (d.type) {
    case "heading": {
      const duzey = Math.min(Math.max(Number(attrs.level) || 1, 1), 4);
      const numara = b.numaralar.get(d);
      const metin = satirIci(d.content, b);
      if (!metin.trim()) return "";
      const kirilim = b.kirilimlar.has(d) ? "\\clearpage\n" : "";
      return `${kirilim}\\${BASLIK_KOMUTU[duzey - 1]}*{${numara ? `${latexKacis(numara)} ` : ""}${metin}}`;
    }
    case "paragraph": {
      const metin = satirIci(d.content, b);
      if (!metin.trim()) return "";
      if (attrs.caption === "figure" || attrs.caption === "table") {
        const etiket = attrs.caption === "figure" ? (b.dil === "en" ? "Figure" : "Şekil") : b.dil === "en" ? "Table" : "Tablo";
        const no = attrs.caption === "figure" ? ++b.sekil : ++b.tablo;
        return `\\begin{center}\n\\textbf{${etiket} ${no}.} ${metin}\n\\end{center}`;
      }
      const hiza = HIZA[String(attrs.textAlign ?? "")];
      return hiza ? `${hiza[0]}${metin}${hiza[1]}` : metin;
    }
    case "bulletList":
    case "orderedList": {
      const ortam = d.type === "bulletList" ? "itemize" : "enumerate";
      const maddeler = (d.content ?? []).map((m) => `  \\item ${(m.content ?? []).map((c) => blok(c, b)).filter(Boolean).join("\n\n")}`);
      return maddeler.length ? `\\begin{${ortam}}\n${maddeler.join("\n")}\n\\end{${ortam}}` : "";
    }
    case "blockquote":
      return `\\begin{quote}\n${(d.content ?? []).map((c) => blok(c, b)).filter(Boolean).join("\n\n")}\n\\end{quote}`;
    case "codeBlock":
      // verbatim kaçış istemez; yalnızca ortamı kapatan satır kırılır.
      return `\\begin{verbatim}\n${(d.content ?? []).map((c) => c.text ?? "").join("").replace(/\\end\{verbatim\}/g, "\\end {verbatim}")}\n\\end{verbatim}`;
    case "horizontalRule":
      return "\\noindent\\rule{\\linewidth}{0.4pt}";
    case "image": {
      const src = String(attrs.src ?? "");
      if (!src) return "";
      const uzanti = /^data:image\/(png|jpe?g)/i.exec(src)?.[1]?.replace("jpeg", "jpg") ?? /\.(png|jpe?g)(?:\?|$)/i.exec(src)?.[1]?.toLowerCase().replace("jpeg", "jpg") ?? "png";
      const ad = `gorseller/gorsel-${b.gorseller.length + 1}.${uzanti}`;
      b.gorseller.push({ ad, src });
      return `\\begin{center}\n\\includegraphics[width=0.9\\linewidth]{${ad}}\n\\end{center}`;
    }
    case "table":
      return tablo(d, b);
    default:
      return (d.content ?? []).map((c) => blok(c, b)).filter(Boolean).join("\n\n");
  }
}

export function tiptapLatex(doc: { content?: Dugum[] } | null | undefined, s: LatexSecenek): { tex: string; gorseller: LatexGorsel[] } {
  const dil = s.dil ?? "tr";
  const b: Baglam = {
    dipnotlar: 0,
    gorseller: [],
    sekil: 0,
    tablo: 0,
    dil,
    numaralar: (s.headingNumbering ? headingNumberMap(doc as never, s.numarasiz) : new Map()) as Map<Dugum, string>,
    kirilimlar: sayfaKirilimlari(doc as never, s.chapterNewPage ?? false) as Set<Dugum>,
  };
  const govde = (doc?.content ?? []).map((d) => blok(d, b)).filter(Boolean).join("\n\n");
  const k = s.kenarCm ?? { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 };
  const punto = [10, 11, 12].includes(s.puntoPt ?? 12) ? s.puntoPt ?? 12 : 12;
  const aralik = s.satirAraligi && s.satirAraligi > 0 && s.satirAraligi <= 3 ? s.satirAraligi : 1.5;
  const tex = `% ArvoLab'dan dışa aktarıldı. pdfLaTeX ile derlenir; derlenmeyen bir karakter
% görürseniz Overleaf'te Menü → Derleyici → XeLaTeX seçin.
% Kaynakça editördeki biçimiyle yazıldı; kaynaklarınız ayrıca ${s.bibDosyasi ?? "BibTeX dosyasında"}.
\\documentclass[${punto}pt,a4paper]{article}
\\usepackage{iftex}
\\ifPDFTeX
  \\usepackage[T1]{fontenc}
  \\usepackage[utf8]{inputenc}
\\else
  \\usepackage{fontspec}
\\fi
\\usepackage[${dil === "en" ? "english" : "turkish"}]{babel}
${dil === "en" ? "" : "\\shorthandoff{=}\n"}\\usepackage[top=${k.top}cm,right=${k.right}cm,bottom=${k.bottom}cm,left=${k.left}cm]{geometry}
\\usepackage{setspace}
\\setstretch{${aralik}}
\\usepackage{graphicx}
\\usepackage{tabularx}
\\usepackage[normalem]{ulem}
\\usepackage{hyperref}

\\title{${latexKacis(s.baslik)}}
\\date{}

\\begin{document}

${govde}

\\end{document}
`;
  return { tex, gorseller: b.gorseller };
}
