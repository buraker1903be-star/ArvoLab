/*
  KULLANILMAYI BEKLEYEN KAYNAKLAR (26.10.2026). Çalışmaya eklenmiş ama
  metinde henüz atıf yapılmamış kaynaklar; editörün sağ panelinde,
  tıklayınca atıf eklenecek bir liste.

  "Kullanıldı" metinden okunuyor, kaynağın durum alanından değil: durum
  atıf penceresinden eklenince "used" oluyor, sonra atıf silinse de öyle
  kalıyor. Yazar-tarih stillerinde ilk yazarın soyadı ve yıl GÖVDE
  metninde birlikte geçiyorsa kaynak kullanılmış sayılır. Kaynakça
  bölümü gövdeye katılmıyor (çağıran ayırır): kaynakçada durması, metinde
  atıf yapıldığı anlamına gelmez.

  Numaralı stillerde ([1]) metinde soyad geçmiyor; orada yalnızca durum
  alanına bakılabiliyor.

  Saf modül; testi tests/unit/bekleyen-kaynaklar.test.ts.
*/
import { splitAuthors, surname } from "@/lib/citation-format";

type Kaynak = { id: string; authors: string | null; year: string | null; title: string; status: string };

const kucuk = (s: string) => s.toLocaleLowerCase("tr-TR");

export function bekleyenKaynaklar<T extends Kaynak>(kaynaklar: T[], govdeMetni: string, numarali: boolean): T[] {
  const metin = kucuk(govdeMetni);
  return kaynaklar.filter((k) => {
    if (numarali) return k.status !== "used";
    const soyad = splitAuthors(k.authors).map(surname)[0];
    if (!soyad) return k.status !== "used";
    const yil = (k.year ?? "").match(/\d{4}/)?.[0];
    return !(metin.includes(kucuk(soyad)) && (!yil || metin.includes(yil)));
  });
}
