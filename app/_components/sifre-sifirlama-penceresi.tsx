"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { sifreSifirlamaIste, type SifirlamaDurumu } from "@/app/actions/auth";
import { useCeviri } from "./dil-saglayici";

/*
  "Şifremi unuttum" penceresi (02.11.2026, kurum sahibinin isteği; kayıt
  penceresinin eşi, kayit-penceresi.tsx). Eskiden bağlantı /forgot-password
  sayfasına gidiyordu ve kullanıcı giriş ekranından ayrılıyordu.

  Bağlantı yine href="/forgot-password" ile başlıyor: JavaScript yüklenmeden
  tıklanırsa sayfa açılır; e-postalardaki "şifremi unuttum" bağlantıları da
  o sayfaya gidiyor. Girişte yazılmış e-posta pencereye taşınır — aynı
  adresi ikinci kez yazdırmamak için.
*/
function GonderDugmesi() {
  const t = useCeviri();
  const { pending } = useFormStatus();
  return (
    <button className="login-button" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <LoaderCircle size={18} className="giris-donen" aria-hidden="true" />
          {t({ tr: "Gönderiliyor…", en: "Sending…" })}
        </>
      ) : (
        <>
          {t({ tr: "Sıfırlama bağlantısı gönder", en: "Send reset link" })}
          <ArrowRight size={18} aria-hidden="true" />
        </>
      )}
    </button>
  );
}

const BASLANGIC: SifirlamaDurumu = { durum: "bos" };

export default function SifreSifirlamaPenceresi() {
  const t = useCeviri();
  const [acik, setAcik] = useState(false);
  const [eposta, setEposta] = useState("");
  // Pencere her açılışta temiz formla başlasın: anahtar değişince form ve durumu sıfırlanır.
  const [oturum, setOturum] = useState(0);

  return (
    <>
      <a
        href="/forgot-password"
        onClick={(e) => {
          e.preventDefault();
          const girisAlani = document.getElementById("email");
          setEposta(girisAlani instanceof HTMLInputElement ? girisAlani.value.trim() : "");
          setOturum((n) => n + 1);
          setAcik(true);
        }}
      >
        {t({ tr: "Şifremi unuttum", en: "Forgot password" })}
      </a>
      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker={t({ tr: "Şifre sıfırlama", en: "Password reset" })}
        title={t({ tr: "Şifrenizi mi unuttunuz?", en: "Forgot your password?" })}
        description={t({
          tr: "Hesabınıza bağlı e-posta adresini girin, şifrenizi yenilemeniz için bir bağlantı gönderelim.",
          en: "Enter the email address linked to your account and we will send you a link to reset your password.",
        })}
      >
        <SifirlamaFormu key={oturum} eposta={eposta} kapat={() => setAcik(false)} />
      </Dialog>
    </>
  );
}

function SifirlamaFormu({ eposta, kapat }: { eposta: string; kapat: () => void }) {
  const t = useCeviri();
  const [durum, eylem] = useActionState(sifreSifirlamaIste, BASLANGIC);

  // Gönderildikten sonra odak "Tamam" düğmesine: klavyeyle kullanan kapatabilsin.
  useEffect(() => {
    if (durum.durum === "gonderildi") document.getElementById("sifirlama-tamam")?.focus();
  }, [durum.durum]);

  if (durum.durum === "gonderildi") {
    return (
      <div className="stack">
        <p className="alert" data-tone="success" role="status">
          {t({
            tr: "Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelecek. Bağlantıyı bu cihazda ve aynı tarayıcıda açın; spam klasörünü de kontrol edin.",
            en: "If this address is registered, a reset link will arrive within a few minutes. Open it on this device in the same browser, and check your spam folder.",
          })}
        </p>
        <button id="sifirlama-tamam" type="button" className="login-button" onClick={kapat}>
          {t({ tr: "Tamam", en: "OK" })}
        </button>
      </div>
    );
  }

  return (
    <form className="login-form" action={eylem}>
      {durum.durum === "eksik" ? (
        <p className="alert" role="alert">
          {t({ tr: "E-posta adresi zorunludur.", en: "Email address is required." })}
        </p>
      ) : null}
      <label htmlFor="sifirlama-eposta">{t({ tr: "E-posta adresi", en: "Email address" })}</label>
      <input
        id="sifirlama-eposta"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={eposta}
        placeholder={t({ tr: "ornek@universite.edu.tr", en: "name@university.edu" })}
        required
        autoFocus
      />
      <GonderDugmesi />
    </form>
  );
}
