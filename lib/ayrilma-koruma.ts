/*
  AYRILMA KORUMASI (22.11.2026).

  Bir ekranda KAYDEDİLMEMİŞ iş varken, o ekrandan çıkaran bir gezinme
  önce kullanıcıya sorulmalı. Sorunun kendisi ekranın işi (ne
  kaydedileceğini o bilir); buradaki tek şey, gezinmeyi başlatan uzak
  bileşenin (ör. çalışma seçicisi) o soruyu sorabilmesi.

  Kayıt YOKKEN hiçbir şey değişmez: `ayrilabilirMi()` doğrudan true
  döner. Bu yüzden korumayı kuran ekranın dışındaki sayfalar etkilenmez.

  Tek kayıt tutuluyor, liste değil: aynı anda iki ekran görünmüyor ve
  ikinci bir kayıt birincisini geçersiz kılar. Kaydı kuran bileşen
  söküldüğünde kendi kaydını kaldırır (dönen fonksiyon).

  Tarayıcının kendi "sayfadan ayrılıyorsunuz" uyarısının yerini tutmaz:
  o, sekmeyi kapatmak ya da tam sayfa gezinme içindir ve ekranlar onu
  ayrıca kurar. Burası uygulama içi (istemci) gezinmeler için.
*/

type Koruma = () => Promise<boolean>;

let mevcut: Koruma | null = null;

/** Korumayı kurar; dönen fonksiyon onu kaldırır (useEffect temizliği). */
export function ayrilmaKorumasiKur(koruma: Koruma): () => void {
  mevcut = koruma;
  return () => {
    if (mevcut === koruma) mevcut = null;
  };
}

/** Gezinme sürebilir mi? Koruma yoksa her zaman evet. */
export async function ayrilabilirMi(): Promise<boolean> {
  return mevcut ? mevcut() : true;
}
