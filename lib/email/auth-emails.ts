/**
 * Kimlik doğrulama e-postaları: şifre sıfırlama ve ekip daveti.
 *
 * Supabase'in kendi şablonları yerine buradakiler kullanılıyor; gönderim de
 * bizde (lib/email/resend.ts). Böylece hem ArvoLab kimliğinde görünüyorlar
 * hem de Supabase'in üretim için uygun olmayan gönderim sınırına takılmıyorlar.
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lab.arvo-os.com").replace(/\/$/, "");

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const shell = (title: string, body: string) => `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 12px;background:#f5f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;">
    <tr>
      <td style="padding:32px 28px;">
        <img src="${SITE}/arvolab-logo.png" alt="ArvoLab" height="22"
             style="display:block;max-width:150px;height:auto;margin:0 0 22px;border:0;">
        <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#14181a;font-weight:600;">
          ${escape(title)}
        </h1>
        ${body}
      </td>
    </tr>
  </table>
  <p style="max-width:520px;margin:16px auto 0;font-size:11px;line-height:1.6;color:#878d8a;text-align:center;">
    ArvoLab · Akademik çalışma ve editöryal kontrol
  </p>
</body>
</html>`;

const button = (href: string, label: string) => `
  <a href="${escape(href)}"
     style="display:inline-block;margin:20px 0 8px;padding:13px 26px;border-radius:999px;background:#14181a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;">
    ${label}
  </a>`;

/** Şifre sıfırlama. */
export function resetPasswordEmail(link: string) {
  return {
    subject: "ArvoLab şifre sıfırlama",
    html: shell(
      "Şifrenizi sıfırlayın",
      `<p style="margin:0;font-size:14px;line-height:1.65;color:#5b625e;">
         Şifrenizi yenilemek için aşağıdaki bağlantıya tıklayın.
       </p>
       ${button(link, "Yeni şifre belirle")}
       <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#878d8a;">
         Bağlantı 1 saat geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı
         yok sayabilirsiniz; şifreniz değişmez.
       </p>`,
    ),
  };
}

/** Ekip daveti. */
export function inviteEmail(link: string, inviterName?: string | null) {
  const davetEden = inviterName?.trim();
  return {
    subject: "ArvoLab'a davet edildiniz",
    html: shell(
      "ArvoLab'a hoş geldiniz",
      `<p style="margin:0;font-size:14px;line-height:1.65;color:#5b625e;">
         ${davetEden ? `${escape(davetEden)} sizi ArvoLab'a davet etti.` : "ArvoLab'a davet edildiniz."}
         Hesabınızı açmak ve şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın.
       </p>
       ${button(link, "Hesabımı oluştur")}
       <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#878d8a;">
         Bağlantı 24 saat geçerlidir.
       </p>`,
    ),
  };
}
