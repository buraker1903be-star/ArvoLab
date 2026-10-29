/*
  Bağlantı önizleme botu mu?

  Danışman paylaşım bağlantısı WhatsApp, Slack, Outlook gibi yerlere
  yapıştırılınca uygulama sayfayı önizleme için ÇEKİYOR. Eskiden bu
  istek de görüntüleme sayılıyordu: sayaç 1 oluyor ve öğrenciye,
  danışman daha bağlantıya dokunmadan "paylaşım bağlantınız açıldı"
  bildirimi gidiyordu (29.10.2026). Sayfa yine gösterilir (önizleme
  çalışsın), yalnızca sayılmaz.

  Liste dar tutuldu: bilinmeyen bir tarayıcıyı bot sanmak, gerçek bir
  açılışı sessizce yutmak demek — o da yanlış bir "açılmadı" bilgisi.

  Saf modül; testi tests/unit/onizleme-botu.test.ts.
*/
const BOT = /bot\b|crawler|spider|facebookexternalhit|whatsapp|slackbot|skypeuripreview|microsoft preview|linkedinbot|telegrambot|discordbot|embedly|preview|bingpreview|googleother|headlesschrome/i;

export function onizlemeBotuMu(kullaniciAraci: string | null | undefined): boolean {
  // Kimliksiz istek gerçek bir tarayıcıdan gelmez.
  if (!kullaniciAraci || !kullaniciAraci.trim()) return true;
  return BOT.test(kullaniciAraci);
}
