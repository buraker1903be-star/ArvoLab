"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { sifreSifirlamaIste, type SifirlamaDurumu } from "@/app/actions/auth";
import { Bildirim } from "@/app/_components/ui/bildirim";
import { Dugme } from "@/app/_components/ui/dugme";
import { Girdi } from "@/app/_components/ui/girdi";
import GonderDugmesi from "@/app/_components/kimlik/gonder-dugmesi";
import { useCeviri } from "./dil-saglayici";

/*
  "Şifremi unuttum" penceresi (02.11.2026, kurum sahibinin isteği; kayıt
  penceresinin eşi, kayit-penceresi.tsx). Eskiden bağlantı /forgot-password
  sayfasına gidiyordu ve kullanıcı giriş ekranından ayrılıyordu.

  Bağlantı yine href="/forgot-password" ile başlıyor: JavaScript yüklenmeden
  tıklanırsa sayfa açılır; e-postalardaki "şifremi unuttum" bağlantıları da
  o sayfaya gidiyor. Girişte yazılmış e-posta pencereye taşınır — aynı
  adresi ikinci kez yazdırmamak için.

  Signature OS 5 / Phase 2: yalnızca görünüş (os5 pencere, Girdi, Bildirim).
  Eylem (sifreSifirlamaIste), durumlar ve "kayıtlıysa" cümlesi aynı: yanıt
  hesabın varlığını sızdırmamak için her adreste aynı.

  Alanda autoFocus YOK (12.11.2026). Eskiden vardı ve odak, pencere
  "beni kim açtı"yı kaydetmeden ÖNCE alana geçiyordu: Dialog açanı değil
  alanı kaydediyor, kapanınca odak sökülmüş alana dönemeyip sayfanın
  başına düşüyordu (Esc'ten sonra klavye kullanıcısı yerini kaybediyordu).
  İlk alanı Dialog zaten kendisi odaklıyor.
*/
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
        className="os5-kimlik-baglanti"
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
        gorunum="os5"
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
      <div className="os5-kimlik-formu">
        <Bildirim ton="basari" rol="status">
          {t({
            tr: "Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelecek. Bağlantıyı bu cihazda ve aynı tarayıcıda açın; spam klasörünü de kontrol edin.",
            en: "If this address is registered, a reset link will arrive within a few minutes. Open it on this device in the same browser, and check your spam folder.",
          })}
        </Bildirim>
        <Dugme id="sifirlama-tamam" tamGenislik onClick={kapat}>
          {t({ tr: "Tamam", en: "OK" })}
        </Dugme>
      </div>
    );
  }

  return (
    <form className="os5-kimlik-formu" action={eylem}>
      {durum.durum === "eksik" ? (
        <Bildirim ton="hata" rol="alert">
          {t({ tr: "E-posta adresi zorunludur.", en: "Email address is required." })}
        </Bildirim>
      ) : null}
      <Girdi
        id="sifirlama-eposta"
        name="email"
        type="email"
        etiket={t({ tr: "E-posta adresi", en: "Email address" })}
        autoComplete="email"
        inputMode="email"
        defaultValue={eposta}
        placeholder={t({ tr: "ornek@universite.edu.tr", en: "name@university.edu" })}
        required
      />
      <GonderDugmesi
        metin={t({ tr: "Sıfırlama bağlantısı gönder", en: "Send reset link" })}
        bekleyen={t({ tr: "Gönderiliyor…", en: "Sending…" })}
        sonEk={<ArrowRight size={18} aria-hidden="true" />}
      />
    </form>
  );
}
