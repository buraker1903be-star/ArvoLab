/**
 * Kimlik doğrulama e-postaları: şifre sıfırlama ve ekip daveti.
 *
 * Supabase'in kendi şablonları yerine buradakiler kullanılıyor; gönderim de
 * bizde (lib/email/resend.ts). Böylece hem ArvoLab kimliğinde görünüyorlar
 * hem de Supabase'in üretim için uygun olmayan gönderim sınırına takılmıyorlar.
 *
 * İki dilli (lib/dil.ts): dil, isteği yapanın arayüz dili. Zamanlanmış işler
 * (deneme hatırlatması) bir isteğe bağlı değil; dili kullanıcının profilinden
 * (profiles.arayuz_dili) okuyor (app/api/cron/deneme-hatirlatma).
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lab.arvo-os.com").replace(/\/$/, "");

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

import type { Dil } from "@/lib/dil";

const P = `style="margin:0;font-size:14px;line-height:1.65;color:#5b625e;"`;
const NOT = `style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#878d8a;"`;

const shell = (title: string, body: string, dil: Dil) => `<!DOCTYPE html>
<html lang="${dil}">
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
    ${dil === "tr" ? "ArvoLab · Akademik çalışma ve editöryal kontrol" : "ArvoLab · Academic writing and editorial checks"}
  </p>
</body>
</html>`;

const button = (href: string, label: string) => `
  <a href="${escape(href)}"
     style="display:inline-block;margin:20px 0 8px;padding:13px 26px;border-radius:999px;background:#14181a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;">
    ${label}
  </a>`;

/** Şifre sıfırlama. */
export function resetPasswordEmail(link: string, dil: Dil = "tr") {
  if (dil === "en") {
    return {
      subject: "ArvoLab password reset",
      html: shell(
        "Reset your password",
        `<p ${P}>Click the link below to set a new password.</p>
         ${button(link, "Set new password")}
         <p ${NOT}>The link is valid for 1 hour. If you did not make this request, you can ignore this email; your password will not change.</p>`,
        dil,
      ),
    };
  }
  return {
    subject: "ArvoLab şifre sıfırlama",
    html: shell(
      "Şifrenizi sıfırlayın",
      `<p ${P}>Şifrenizi yenilemek için aşağıdaki bağlantıya tıklayın.</p>
       ${button(link, "Yeni şifre belirle")}
       <p ${NOT}>Bağlantı 1 saat geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.</p>`,
      dil,
    ),
  };
}

/** Ekip daveti. */
export function inviteEmail(link: string, inviterName?: string | null, dil: Dil = "tr") {
  const davetEden = inviterName?.trim();
  if (dil === "en") {
    return {
      subject: "You have been invited to ArvoLab",
      html: shell(
        "Welcome to ArvoLab",
        `<p ${P}>${davetEden ? `${escape(davetEden)} has invited you to ArvoLab.` : "You have been invited to ArvoLab."} Click the link below to open your account and set your password.</p>
         ${button(link, "Create my account")}
         <p ${NOT}>The link is valid for 24 hours.</p>`,
        dil,
      ),
    };
  }
  return {
    subject: "ArvoLab'a davet edildiniz",
    html: shell(
      "ArvoLab'a hoş geldiniz",
      `<p ${P}>${davetEden ? `${escape(davetEden)} sizi ArvoLab'a davet etti.` : "ArvoLab'a davet edildiniz."} Hesabınızı açmak ve şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın.</p>
       ${button(link, "Hesabımı oluştur")}
       <p ${NOT}>Bağlantı 24 saat geçerlidir.</p>`,
      dil,
    ),
  };
}

/** Kendi kaydolan kullanıcının e-posta doğrulaması. */
export function signUpConfirmEmail(link: string, denemeGunu: number | null, dil: Dil = "tr") {
  const denemeVar = denemeGunu !== null && denemeGunu > 0;
  if (dil === "en") {
    const deneme = denemeVar ? `Your ${denemeGunu}-day trial starts after verification.` : "Your workspace opens after verification.";
    return {
      subject: "Verify your ArvoLab account",
      html: shell(
        "Verify your account",
        `<p ${P}>Welcome to ArvoLab. Verify your email address to start using your account. ${escape(deneme)}</p>
         ${button(link, "Verify my email")}
         <p ${NOT}>The link is valid for 24 hours. If you did not sign up, ignore this email; unverified accounts are not opened.</p>`,
        dil,
      ),
    };
  }
  const deneme = denemeVar ? `Doğrulamadan sonra ${denemeGunu} günlük deneme süreniz başlar.` : "Doğrulamadan sonra çalışma alanınız açılır.";
  return {
    subject: "ArvoLab hesabınızı doğrulayın",
    html: shell(
      "Hesabınızı doğrulayın",
      `<p ${P}>ArvoLab'a hoş geldiniz. Hesabınızı kullanmaya başlamak için e-posta adresinizi doğrulayın. ${escape(deneme)}</p>
       ${button(link, "E-postamı doğrula")}
       <p ${NOT}>Bağlantı 24 saat geçerlidir. Bu kaydı siz yapmadıysanız bu e-postayı yok sayın; doğrulanmayan hesap açılmaz.</p>`,
      dil,
    ),
  };
}

/*
  Kayıt denemesi ZATEN KAYITLI bir adrese yapıldığında gönderilir.

  Ekranda "hesabınız zaten var" demek, bir adresin kayıtlı olup olmadığını
  yabancıya söylerdi (şifre sıfırlamada da aynı sebeple ayırmıyoruz). Ama
  adresin SAHİBİNE söylemek sızıntı değil, yardım: kişi büyük ihtimalle
  kaydolmayı deniyor çünkü hesabı olduğunu unutmuş.
*/
export function accountExistsEmail(girisAdresi: string, sifreAdresi: string, dil: Dil = "tr") {
  if (dil === "en") {
    return {
      subject: "You already have an ArvoLab account",
      html: shell(
        "You already have an account",
        `<p ${P}>Someone tried to sign up to ArvoLab with this address, but your account is already open. You can sign in directly.</p>
         ${button(girisAdresi, "Sign in")}
         <p ${NOT}>If you don't remember your password, <a href="${escape(sifreAdresi)}" style="color:#5b625e;">reset your password</a>. If this wasn't you, you can ignore this email.</p>`,
        dil,
      ),
    };
  }
  return {
    subject: "ArvoLab hesabınız zaten var",
    html: shell(
      "Zaten bir hesabınız var",
      `<p ${P}>Bu adresle ArvoLab'a kaydolma denemesi yapıldı; oysa hesabınız zaten açık. Doğrudan giriş yapabilirsiniz.</p>
       ${button(girisAdresi, "Giriş yap")}
       <p ${NOT}>Şifrenizi hatırlamıyorsanız <a href="${escape(sifreAdresi)}" style="color:#5b625e;">şifrenizi sıfırlayın</a>. Bu denemeyi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`,
      dil,
    ),
  };
}

/** Deneme süresi bitmeden önceki tek hatırlatma. */
export function denemeBitiyorEmail(kalanGun: number, panelAdresi: string, dil: Dil = "tr") {
  if (dil === "en") {
    const sure = kalanGun === 1 ? "tomorrow" : `in ${kalanGun} days`;
    return {
      subject: `Your ArvoLab trial ends ${sure}`,
      html: shell(
        `Your trial ends ${sure}`,
        `<p ${P}>Your work stays where it is and is not deleted. When the trial ends, the working screens close; Subscription, Support and Settings stay open and you can download your data. When you renew your plan, you continue where you left off.</p>
         ${button(panelAdresi, "View my plan")}
         <p ${NOT}>This is the only reminder; we won't send it again.</p>`,
        dil,
      ),
    };
  }
  const sure = kalanGun === 1 ? "yarın" : `${kalanGun} gün sonra`;
  return {
    subject: `ArvoLab deneme süreniz ${sure} bitiyor`,
    html: shell(
      `Deneme süreniz ${sure} bitiyor`,
      `<p ${P}>Çalışmalarınız yerinde duruyor ve silinmiyor. Deneme bittiğinde çalışma ekranları kapanır; Abonelik, Destek ve Ayarlar açık kalır, verilerinizi indirebilirsiniz. Planınızı yenilediğinizde kaldığınız yerden devam edersiniz.</p>
       ${button(panelAdresi, "Planımı görüntüle")}
       <p ${NOT}>Bu tek hatırlatmadır; aynı uyarıyı tekrar göndermiyoruz.</p>`,
      dil,
    ),
  };
}

/** Hesabını doğrulayan kullanıcıya ilk selam. */
export function hosgeldinizEmail(panelAdresi: string, dil: Dil = "tr") {
  if (dil === "en") {
    return {
      subject: "Welcome to ArvoLab",
      html: shell(
        "Your account is ready",
        `<p ${P}>Your workspace is open. The quickest start: create a work, add your university's guideline and start writing — the guideline check runs as you write.</p>
         ${button(panelAdresi, "Go to my workspace")}
         <p ${NOT}>ArvoLab does not write your text for you; it checks what you write against your guideline and reference rules, and searches real indexes for sources.</p>`,
        dil,
      ),
    };
  }
  return {
    subject: "ArvoLab'a hoş geldiniz",
    html: shell(
      "Hesabınız hazır",
      `<p ${P}>Çalışma alanınız açıldı. En hızlı başlangıç: bir çalışma oluşturun, üniversitenizin kılavuzunu ekleyin ve yazmaya başlayın — kılavuz denetimi siz yazarken çalışır.</p>
       ${button(panelAdresi, "Çalışma alanıma git")}
       <p ${NOT}>ArvoLab metninizi sizin yerinize yazmaz; yazdığınızı kılavuza ve kaynakça kurallarına göre denetler, kaynakları gerçek dizinlerde arar.</p>`,
      dil,
    ),
  };
}

/*
  Sözleşme onayının kopyası (29.10.2026). Onay kaydının (sozlesme_onaylari)
  yanında kullanıcının kendi posta kutusunda da bir iz kalsın: sözleşmenin
  14. maddesi bunu vaat ediyor. Metnin tamamı postada; kayıt bilgileri
  (zaman, sürüm, özet, IP, cihaz) altta. Gövdedeki her metin kaçırılır.
*/
export function sozlesmeOnayEmail(
  girdi: {
    baslik: string;
    bolumler: { baslik: string; paragraflar: string[] }[];
    giris: string;
    surum: string;
    ozet: string;
    zaman: string;
    ip: string | null;
    cihaz: string | null;
    odemeReferansi: string | null;
  },
  dil: Dil = "tr",
) {
  const en = dil === "en";
  const metin = girdi.bolumler
    .map(
      (b) =>
        `<p style="margin:16px 0 4px;font-size:13px;font-weight:600;color:#14181a;">${escape(b.baslik)}</p>`
        + b.paragraflar.map((p) => `<p ${P}>${escape(p)}</p>`).join(""),
    )
    .join("");
  const satir = (ad: string, deger: string | null) =>
    deger ? `<tr><td style="padding:2px 10px 2px 0;font-size:12px;color:#878d8a;vertical-align:top;">${escape(ad)}</td><td style="padding:2px 0;font-size:12px;color:#14181a;word-break:break-all;">${escape(deger)}</td></tr>` : "";
  const kayit = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0;border-top:1px solid #e3e6e3;padding-top:12px;">
    ${satir(en ? "Approved at" : "Onay zamanı", girdi.zaman)}
    ${satir(en ? "Version" : "Sürüm", girdi.surum)}
    ${satir(en ? "Text digest (SHA-256)" : "Metin özeti (SHA-256)", girdi.ozet)}
    ${satir(en ? "IP address" : "IP adresi", girdi.ip)}
    ${satir(en ? "Device / browser" : "Cihaz / tarayıcı", girdi.cihaz)}
    ${satir(en ? "Payment reference" : "Ödeme referansı", girdi.odemeReferansi)}
  </table>`;
  return {
    subject: en ? `You approved the ${girdi.baslik}` : `${girdi.baslik} onayınız`,
    html: shell(
      en ? "Your approval has been recorded" : "Onayınız kaydedildi",
      `<p ${P}>${escape(en
        ? "You approved the terms below on ArvoLab. Keep this email; it is your copy of the agreement and of the approval record."
        : "Aşağıdaki sözleşmeyi ArvoLab'da onayladınız. Bu e-postayı saklayın; sözleşmenin ve onay kaydının size ait kopyasıdır.")}</p>
       <p style="margin:18px 0 0;font-size:15px;font-weight:600;color:#14181a;">${escape(girdi.baslik)}</p>
       <p ${NOT}>${escape(girdi.giris)}</p>
       ${metin}
       ${kayit}`,
      dil,
    ),
  };
}
