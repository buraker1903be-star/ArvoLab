/*
  MODÜL SAYFASININ ÇALIŞMASI (Signature OS 4.3.5, B1). Kaynaklar, Analiz
  Merkezi ve Belge Kontrol bir çalışmanın verisini gösterir ve O ÇALIŞMAYA
  yazar (kaynak, analiz, belge). Saf modül; testi
  tests/unit/calisma-secimi.test.ts.

  ESKİ HATA: `calismalar.find(id) ?? calismalar[0]`. Adresteki çalışma
  kullanıcının listesinde yoksa (yanlış/eski bağlantı, atanmış kişi ya da
  gözetim rolüyle başkasının tezinden gelinmişse) sayfa HİÇBİR UYARI
  VERMEDEN listedeki ilk çalışmayı açıyordu: tezin editöründen "Kaynak
  kütüphanesini aç"a basan kişi başka bir çalışmanın kaynaklarını görüyor,
  oraya kaynak ekleyebiliyordu. Adreste çalışma yokken de (komut paleti,
  genel gezinme) ilk çalışma seçiliyordu; liste oluşturma tarihine göre
  sıralı olduğu için bu "en son açılan" bile değil, en son OLUŞTURULAN
  çalışmaydı ve paletten eklenen DOI oraya yazılıyordu.

  Kural:
  - Adreste çalışma VARSA: yalnızca o. Bulunamazsa "bulunamadı" — başka
    çalışmaya geçilmez. Bulunamayan ile erişilemeyen ayrılmaz (varlık
    sızdırılmaz).
  - Adreste çalışma YOKSA: tek çalışma varsa o (belirsizlik yok); birden
    çok varsa kullanıcı SEÇER. Yanlış hedefe veri yazabilecek varsayılan
    seçim yok.
  - Liste okunamadıysa karar verilmez ("okunamadı"); sayfa zaten uyarıyor.
*/

export type CalismaSecimi<T> =
  | { tur: "secili"; calisma: T; adrestenMi: boolean }
  | { tur: "bulunamadi" }
  | { tur: "secim-gerekli" }
  | { tur: "yok" }
  | { tur: "okunamadi" };

export function calismaSec<T extends { id: string }>(calismalar: T[], istenen: unknown, okunamadi = false): CalismaSecimi<T> {
  if (okunamadi) return { tur: "okunamadi" };
  const kimlik = typeof istenen === "string" ? istenen.trim().toLowerCase() : "";
  if (kimlik) {
    const bulunan = calismalar.find((c) => c.id.toLowerCase() === kimlik);
    return bulunan ? { tur: "secili", calisma: bulunan, adrestenMi: true } : { tur: "bulunamadi" };
  }
  if (!calismalar.length) return { tur: "yok" };
  if (calismalar.length === 1) return { tur: "secili", calisma: calismalar[0], adrestenMi: false };
  return { tur: "secim-gerekli" };
}

/** Seçim bağlantısı: sayfanın kendi ek parametreleri (ör. ?doi=, ?ekle=1) korunur. */
export function secimAdresi(yol: string, calismaId: string, ek: Record<string, string | undefined> = {}): string {
  const p = new URLSearchParams({ calisma: calismaId });
  for (const [k, v] of Object.entries(ek)) if (v) p.set(k, v);
  return `${yol}?${p.toString()}`;
}
