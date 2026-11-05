/*
  KAYNAK FORMU → VERİTABANI SATIRI (Signature OS 4.2, 05.11.2026).

  Kaynak formunun (KunyeAlanlari + NotAlani) alanlarını literature_sources
  sütunlarına çeviren TEK yer. Eskiden bu dönüşüm sunucu işleminin
  (app/actions/literature.ts) içindeydi ve sınanamıyordu: "use server"
  dosyasından yalnızca async işlem dışa aktarılabiliyor. Şimdi düzenleme
  işlemi bunu çağırıyor; tests/db/kaynak-duzenleme.test.mjs de AYNI
  fonksiyonun ürettiği satırı RLS altında gerçek tabloya yazıyor — yani
  test, işlemin yazdığını yazıyor, kendi kopyasını değil.

  Bilerek hiçbir şey içe aktarmıyor: veritabanı testleri yol takma adı
  (@/…) olmadan Node ile koşuyor.
*/

export const KAYNAK_TURLERI = ["article", "book", "chapter", "thesis", "report", "website", "other"] as const;

const metin = (deger: unknown, enFazla: number) => {
  const sonuc = String(deger ?? "").trim().slice(0, enFazla);
  return sonuc || null;
};

/** Yayın bilgisi alanları (formdan ya da atıf penceresinden). Sütunları sonradan eklendi; yoksa işlem bunlarsız yeniden dener. */
export function yayinAlanlari(al: (ad: string) => unknown) {
  return {
    container_title: metin(al("containerTitle"), 500),
    volume: metin(al("volume"), 40),
    issue: metin(al("issue"), 40),
    pages: metin(al("pages"), 40),
    publisher: metin(al("publisher"), 300),
    publication_place: metin(al("publicationPlace"), 200),
  };
}

/*
  Düzenleme satırı. Boş bırakılan alan NULL yazılır (eski değer silinir):
  formda alanı boşaltan kullanıcı onu silmek istiyor. Başlık zorunlu; boşsa
  satır yerine "baslik" hatası döner. Bilinmeyen tür "other" olur —
  veritabanının CHECK kısıtı bilinmeyeni reddeder ve kullanıcı sebebini
  anlamadan "kaydedilemedi" görürdü.
*/
export function kaynakDuzenlemeSatiri(al: (ad: string) => unknown):
  | { hata: "baslik" }
  | { temel: Record<string, string | null>; yayin: ReturnType<typeof yayinAlanlari> } {
  const title = String(al("title") ?? "").trim();
  if (!title) return { hata: "baslik" };
  const tur = String(al("sourceType") ?? "article");
  return {
    temel: {
      title,
      authors: String(al("authors") ?? "").trim() || null,
      year: String(al("year") ?? "").trim() || null,
      source_type: (KAYNAK_TURLERI as readonly string[]).includes(tur) ? tur : "other",
      doi_or_url: String(al("doiOrUrl") ?? "").trim() || null,
      notes: String(al("notes") ?? "").trim() || null,
    },
    yayin: yayinAlanlari(al),
  };
}
