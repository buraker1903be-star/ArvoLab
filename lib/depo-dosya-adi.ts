/*
  Depoya yüklenen dosyanın adı (P52b-2D).

  Eskiden yüklemeler `<zaman>-<ad>` ya da yalnızca `<zaman>.pdf` adını
  kullanıyordu. Aynı milisaniyede aynı adla iki yükleme aynı yola düşüyordu
  (upsert:false ile ikincisi "already exists" hatası alıyordu), ve silinmiş bir
  dosyanın yolu yeniden yaratılabilirdi. Kalıcı silme tasarımı (P52b-2C, R6)
  "bir kez silinmeye verilen yol bir daha kullanılmaz" kuralına dayanıyor; bu,
  yolların tahmin edilemez ve tekil olmasını gerektiriyor. Kaynak PDF'ler
  P52b-1'den beri rastgele UUID kullanıyor; bu modül aynı yaklaşımı öteki
  akışlara taşır.

  Biçim GERİYE UYUMLU tutuldu:
   - baştaki `<zaman>-` korunuyor: adı `^\d{10,}-` ile ayıklayan okuyucular
     (bugün yalnızca kılavuz adı, lib/kilavuz-dogrulama.ts) bozulmasın;
   - sondaki özgün ad ya da uzantı korunuyor: `.docx`/`.pdf` uzantısına bakan
     sunucu denetimleri ve ekranlar aynı kalsın;
   - klasör öneki hiç değişmiyor: sunucu denetimleri, depo politikaları ve
     veritabanı kısıtları yalnızca öneke bakıyor.
  Eski adlı dosyalar olduğu gibi geçerli kalır; hiçbir şey taşınmaz.
*/

/** Depo adı için güvenli karakterler; uzun adı uzantıyı koruyarak kısaltır. */
export function guvenliAd(ham: string, enCok = 120): string {
  const temiz = (ham || "dosya").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (temiz.length <= enCok) return temiz;
  const nokta = temiz.lastIndexOf(".");
  const uzanti = nokta > 0 && temiz.length - nokta <= 10 ? temiz.slice(nokta) : "";
  return temiz.slice(0, enCok - uzanti.length) + uzanti;
}

/**
 * `[<önek>-]<zaman>-<uuid>-<ad>` ya da (son ek bir uzantıysa) `[<önek>-]<zaman>-<uuid>.<uzantı>`.
 * `sonEk`: güvenli ad (guvenliAd ile) ya da ".pdf" gibi bir uzantı.
 */
export function benzersizDosyaAdi(sonEk: string, o: { on?: string; simdi?: number; kimlik?: string } = {}): string {
  const simdi = o.simdi ?? Date.now();
  const kimlik = o.kimlik ?? crypto.randomUUID();
  const govde = `${o.on ? `${o.on}-` : ""}${simdi}-${kimlik}`;
  return sonEk.startsWith(".") ? `${govde}${sonEk}` : `${govde}-${sonEk}`;
}
