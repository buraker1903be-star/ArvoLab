// Kaynakça girdilerinde sık yazım hataları: çift nokta ("t.y..", "Kitap..") ve noktalama
// işaretinden önce boşluk ("Yılmaz , A.", "Kitap ."). Üç nokta ("...", "…") ve kelime başı
// nokta (".NET") dokunulmaz. Denetim ve editördeki "Düzelt" aynı kuralı kullanır.

const DOUBLE_DOT = /(?<!\.)\.\.(?!\.)/;
// Boşluk, sekme ya da bölünmez boşluk; virgül, noktalı virgül, iki nokta her durumda, nokta
// yalnızca ardından boşluk/son geliyorsa (".NET" korunur).
const SPACE_BEFORE_PUNCT = /[ \t ]+(?=[,;:]|\.(?:\s|$))/;

export function hasReferencePunctuationIssue(text: string): boolean {
  return DOUBLE_DOT.test(text) || SPACE_BEFORE_PUNCT.test(text);
}

export function fixReferencePunctuation(text: string): string {
  return text
    .replace(new RegExp(DOUBLE_DOT.source, "g"), ".")
    .replace(new RegExp(SPACE_BEFORE_PUNCT.source, "g"), "");
}
