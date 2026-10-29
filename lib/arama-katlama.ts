/*
  Büyük/küçük harfe duyarsız arama için katlama (29.10.2026).

  "tr-TR" ile küçültmek Türkçe için doğru ("İ" → "i", "I" → "ı") ama
  İngilizce metni bozuyordu: "Introduction" "ıntroduction" oluyor ve
  "introduction" araması HİÇ eşleşmiyordu; değiştir-hepsi o sözcükleri
  sessizce atlıyordu. "ı" da "i"ye katlanınca iki dil birlikte çalışır.
  Bedeli: Türkçede "ı" ile "i" ayırt edilmez ("kıl" araması "kil"i de
  bulur) — arama için kabul edilebilir, kaçırmaktan iyidir.

  Uzunluk korunur (her karakter tek karaktere iner): bul-değiştir konumları
  katlanmış metinden hesaplıyor. Saf modül.
*/
export const katla = (metin: string) => metin.toLocaleLowerCase("tr-TR").replace(/ı/g, "i");
