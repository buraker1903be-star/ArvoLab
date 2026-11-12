import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KimlikYerlesimi from "@/app/_components/kimlik/kimlik-yerlesimi";
import { Dugme } from "@/app/_components/ui/dugme";
import { ceviri } from "@/lib/dil-sunucu";
import { safeConfirmNext } from "@/lib/auth-link";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Bağlantıyı onaylayın", en: "Confirm the link" }), robots: { index: false, follow: false } };
}

/*
  E-posta bağlantısının onay adımı (app/auth/confirm/route.ts). Sayfa
  belirteci HARCAMAZ; yalnızca düğme gönderilince doğrulanır. Kurumsal
  posta kutularının bağlantı tarayıcıları adresi açar ama form göndermez:
  tek kullanımlık bağlantı gerçek kullanıcıya kalır. Kendiliğinden
  gönderen bir betik bilerek yok — o, korumanın kendisini kaldırırdı.

  Signature OS 5 / Phase 2: yalnızca görünüş. Biçim denetimi, gizli alanlar,
  POST hedefi ve safeConfirmNext aynı. Geçersiz bağlantıda artık giriş
  sayfasına dönüş bağlantısı var: eskiden ekran çıkışsızdı.
*/
const TURLER = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;

export default async function DogrulaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const t = await ceviri();
  const { token_hash: tokenHash = "", type = "", next } = await searchParams;
  const gecerli = /^[A-Za-z0-9_-]{8,256}$/.test(tokenHash) && (TURLER as readonly string[]).includes(type);
  const baslik =
    type === "recovery"
      ? t({ tr: "Şifrenizi sıfırlayın", en: "Reset your password" })
      : type === "invite"
        ? t({ tr: "Daveti kabul edin", en: "Accept the invitation" })
        : t({ tr: "E-posta adresinizi doğrulayın", en: "Verify your email address" });

  return (
    <KimlikYerlesimi>
      <header className="os5-kimlik-baslik">
        <h1>{gecerli ? baslik : t({ tr: "Bağlantı geçersiz", en: "Invalid link" })}</h1>
        <p>
          {gecerli
            ? t({
                tr: "Devam etmek için aşağıdaki düğmeye basın. Bu adım, e-posta güvenlik taramalarının tek kullanımlık bağlantınızı sizden önce harcamasını önler.",
                en: "Press the button below to continue. This step stops email security scanners from using up your one-time link before you do.",
              })
            : t({
                tr: "Bağlantı eksik ya da bozuk. E-postadaki bağlantıyı yeniden açın ya da yeni bir bağlantı isteyin.",
                en: "The link is incomplete or broken. Open the link in the email again or request a new one.",
              })}
        </p>
      </header>
      {gecerli ? (
        <form className="os5-kimlik-formu" method="post" action="/auth/confirm">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={safeConfirmNext(next ?? null)} />
          <Dugme type="submit" tamGenislik>
            {t({ tr: "Devam et", en: "Continue" })}
          </Dugme>
        </form>
      ) : (
        <Link href="/" className="os5-kimlik-geri">
          <ArrowLeft size={16} aria-hidden="true" />
          {t({ tr: "Giriş sayfasına dön", en: "Back to sign in" })}
        </Link>
      )}
    </KimlikYerlesimi>
  );
}
