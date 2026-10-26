/*
  DANIŞMANA GÖNDERME (bireysel abone).

  Danışmanın ArvoLab'da yorum yazabilmesi kurumun abone olmasına bağlı.
  Bireysel abonenin danışmanı sistemde değil: öğrenci metnini ona
  WhatsApp'tan ya da e-postayla gönderiyor. Bu modül o mesajı kuruyor —
  salt okunur paylaşım bağlantısı (app/actions/share-links.ts) ya da
  indirilen Word/PDF dosyası için.

  Bağlantı WhatsApp'a ve e-postaya ADRESİN İÇİNDE gidiyor; sunucumuzdan
  hiçbir mesaj gönderilmiyor. Uygulama yalnızca telefonun ya da posta
  programının kendi ekranını, metni hazır olarak açıyor; gönderen
  öğrencinin kendisi.

  Saf modül; testi tests/unit/danismana-gonder.test.ts.
*/

export function danismanMesaji(girdi: { baslik: string; url?: string | null; gun?: number | null }): string {
  const satirlar = [
    "Hocam merhaba,",
    `"${girdi.baslik}" çalışmamın güncel hâlini incelemenize sunuyorum.`,
    girdi.url
      ? `Aşağıdaki bağlantıdan giriş yapmadan okuyabilirsiniz${girdi.gun ? ` (${girdi.gun} gün geçerli)` : ""}:\n${girdi.url}`
      : "Dosyayı ekte gönderiyorum.",
    "Görüşleriniz için şimdiden teşekkür ederim.",
  ];
  return satirlar.join("\n\n");
}

/** WhatsApp'ın paylaşım adresi: alıcıyı WhatsApp'ta öğrenci seçer. */
export const whatsappAdresi = (metin: string) => `https://wa.me/?text=${encodeURIComponent(metin)}`;

/*
  mailto: konu ve gövde ayrı ayrı kodlanır. URLSearchParams KULLANILMIYOR:
  boşluğu "+" yapıyor ve posta programlarının çoğu "+"yı boşluğa çevirmiyor
  ("Hocam+merhaba").
*/
export const epostaAdresi = (konu: string, govde: string) =>
  `mailto:?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(govde)}`;
