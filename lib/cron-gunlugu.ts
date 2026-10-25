/*
  ZAMANLANMIŞ İŞİN DÜŞTÜĞÜ GÖRÜLSÜN (25.10.2026)

  /api/cron/guideline-refresh 05.10–25.10.2026 arasında her gece 02:17'de
  aynı hatayla düştü (OCR işçisi dağıtım paketinde yoktu, lib/ocr.ts) ve
  20 gün boyunca kimse fark etmedi. Sebebi: rota fırlattığında Vercel 500
  döner ve günlüğe yalnızca yığın izi düşer — hangi ZAMANLANMIŞ işin
  düştüğünü, o turda neyin kaybolduğunu söyleyen tek bir satır yoktu.
  Kılavuz keşfi ve yeniden tarama 20 gün hiç koşmadı; panelde kuyruğun
  ilerlememesi "yapacak iş yok" gibi görünüyordu.

  ArvoOS'ta bunun tam karşılığı var: her tur veritabanına yazılıyor
  (lib/cron-kaydi.ts → platform_cron_kayitlari), Sistem Sağlığı ekranında
  görünüyor ve geciken iş kurucuya bildiriliyor. ArvoLab'da ne o tablo ne
  de kurucu bildirim kanalı var (bildirimler kullanıcı başına,
  20260918090000_notifications.sql). Buradaki sarmalayıcı o kalıbın
  GÜNLÜK TUTAN yarısı: işin adını, süresini ve sonucunu tek satırda yazar.
  Kalıcı kayıt ve nöbet eklenecekse yeri bu dosyadır.

  AKIŞI DEĞİŞTİRMEZ: yanıt olduğu gibi döner, hata yeniden fırlatılır
  (Vercel'in çalışma zamanı hatası kaybolmasın, hatayı bulan yol o).
  Günlük tutmanın işin kendisini bozması, günlük tutmamaktan kötüdür.
*/

/**
 * Cron rotasının gövdesini sarar; başlangıcı, süreyi ve sonucu günlüğe yazar.
 *
 * @param yol vercel.json'daki yol; işin kimliği bu.
 */
export async function cronRotasi(yol: string, govde: () => Promise<Response>): Promise<Response> {
  const basladi = Date.now();
  const saniye = () => Math.round((Date.now() - basladi) / 1000);
  console.log(`[cron:${yol}] başladı`);
  try {
    const yanit = await govde();
    /*
      Durum kodu da yazılıyor: 401 (CRON_SECRET yok ya da eşleşmiyor) sessiz
      bir "hiç koşmama" biçimidir ve hata gibi görünmez.
    */
    const satir = `[cron:${yol}] bitti · HTTP ${yanit.status} · ${saniye()} sn`;
    if (yanit.ok) console.log(satir);
    else console.error(satir);
    return yanit;
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : String(hata);
    console.error(`[cron:${yol}] TUR DÜŞTÜ · ${saniye()} sn · ${mesaj} — bu turun işi hiç yapılmadı.`);
    if (hata instanceof Error && hata.stack) console.error(hata.stack);
    throw hata;
  }
}
