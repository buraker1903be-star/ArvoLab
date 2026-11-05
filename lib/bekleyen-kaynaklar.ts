/*
  KULLANILMAYI BEKLEYEN KAYNAKLAR (26.10.2026). Çalışmaya eklenmiş ama
  metinde henüz atıf yapılmamış kaynaklar; editörün sağ panelinde,
  tıklayınca atıf eklenecek bir liste.

  "Kullanıldı" metinden okunuyor, kaynağın durum alanından değil: durum
  atıf penceresinden eklenince "used" oluyor, sonra atıf silinse de öyle
  kalıyor. Eşleştirme kuralı ve stil sınıflandırması Kaynaklar sayfasıyla
  ORTAK (lib/atif-eslesmesi.ts, 4.3.5). Kaynakça bölümü gövdeye katılmaz
  (çağıran ayırır): kaynakçada durması metinde atıf yapıldığı anlamına
  gelmez.

  4.3.5'e kadar dipnotlu stil yazar-tarih sanılıyordu ve dipnotta atfı
  olan her kaynak "bekliyor" çıkıyordu; yazarsız kaynak da durum alanına
  bakılarak "bekliyor" sayılıyordu. Artık metinden DOĞRULANAMAYAN kaynak
  "bekliyor" değil, ayrı sayılır ("dogrulanamayan").

  Numaralı stillerde ([1]) atıf metinden kaynağa bağlanamıyor; orada liste
  bilerek durum alanına göre ("Kullandım" işaretli değilse) ve kart bunu
  açıkça söyler (kural: "durum").

  Saf modül; testi tests/unit/bekleyen-kaynaklar.test.ts.
*/
import { atifDurumlari } from "@/lib/atif-eslesmesi";
import type { AtifTuru } from "@/lib/atif/stiller";

type Kaynak = { id: string; authors: string | null; year: string | null; title: string; status: string };

export type BekleyenSonucu<T> = {
  /** Metinden okunarak atfı bulunamayanlar (numaralı stilde: "Kullandım" işaretli olmayanlar). */
  bekleyen: T[];
  /** Metinden doğrulanamayanlar (yazarsız kaynak, dipnot okunamadı): "bekliyor" sayılmaz. */
  dogrulanamayan: T[];
  /** Listenin neye göre kurulduğu: metin mi, durum alanı mı (numaralı stil). */
  kural: "metin" | "durum";
};

export function bekleyenKaynaklar<T extends Kaynak>(
  kaynaklar: T[],
  girdi: { govdeMetni: string; atifTuru: AtifTuru; dipnotlar?: string[] | null },
): BekleyenSonucu<T> {
  if (girdi.atifTuru === "numara") return { bekleyen: kaynaklar.filter((k) => k.status !== "used"), dogrulanamayan: [], kural: "durum" };
  const durum = atifDurumlari(kaynaklar, girdi);
  return {
    bekleyen: kaynaklar.filter((k) => durum[k.id] === "bekliyor"),
    dogrulanamayan: kaynaklar.filter((k) => durum[k.id] === "okunamaz"),
    kural: "metin",
  };
}
