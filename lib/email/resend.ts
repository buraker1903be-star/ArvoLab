/**
 * E-posta gönderimi.
 *
 * Supabase'in yerleşik gönderimi kullanılmıyor: üretim için tasarlanmamış,
 * saatlik sınırı çok düşük ve aşıldığında şifre sıfırlama isteyen kullanıcı
 * e-posta alamıyor. Kodda zaten 429 kontrolü vardı, yani bu sınıra takılmış.
 *
 * Anahtar yoksa gönderim sessizce atlanıyor: e-posta gönderilememesi, çağıran
 * akışı (davet oluşturma, şifre sıfırlama isteği) bozmamalı — kullanıcıya
 * "istek alındı" demek, hesabın varlığını sızdırmamak için de gerekli.
 */
const FROM = process.env.ARVOLAB_EMAIL_FROM ?? "ArvoLab <hesap@arvo-os.com>";
const REPLY_TO = process.env.ARVOLAB_EMAIL_REPLY_TO ?? "info@arvo-os.com";

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[e-posta] RESEND_API_KEY tanımlı değil; gönderim atlandı.");
    return { ok: false as const, reason: "anahtar_yok" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
    });

    if (!response.ok) {
      const detay = await response.text().catch(() => "");
      console.error("[e-posta] gönderilemedi", response.status, detay);
      return { ok: false as const, reason: "saglayici_hatasi" };
    }
    return { ok: true as const };
  } catch (error) {
    console.error("[e-posta] sağlayıcıya ulaşılamadı", error instanceof Error ? error.message : error);
    return { ok: false as const, reason: "ag_hatasi" };
  }
}
