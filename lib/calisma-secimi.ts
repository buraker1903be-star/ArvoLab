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

/*
  Komut paletinden kaynak ekleme adresi (4.3.5, B2). Eskiden palet
  `/dashboard/literature?doi=…` açıyordu: çalışma kimliği yoktu, sayfa en
  son oluşturulan çalışmayı seçiyordu ve öğrenci B tezinin editöründe
  yapıştırdığı DOI'yi A çalışmasına ekliyordu. Aktif çalışma (adresten
  doğrulanmış bağlam) varsa onun kimliği gider; yoksa adres çalışmasız
  kalır ve sayfa "Hangi çalışma?" diye sorar (calismaSec). Kimlik yine de
  YETKİ KANITI DEĞİL: sayfa çalışmayı kullanıcının listesinde arar, ekleme
  sunucuda yeniden doğrulanır (lib/kaynak-hedefi.ts).
*/
export function kaynakEklemeAdresi(aktifCalismaId: string | null, ek: { doi?: string; ekle?: boolean } = {}): string {
  const ekler = { doi: ek.doi || undefined, ekle: ek.ekle ? "1" : undefined };
  if (aktifCalismaId) return secimAdresi("/dashboard/literature", aktifCalismaId, ekler);
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(ekler)) if (v) p.set(k, v);
  const q = p.toString();
  return q ? `/dashboard/literature?${q}` : "/dashboard/literature";
}
