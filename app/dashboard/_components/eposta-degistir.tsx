"use client";

import { useActionState, useState } from "react";
import { Mail, Send } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { ActionResult } from "@/lib/auth-guards";
import { epostaDegisikligiIste } from "@/app/actions/ayarlar";
import { usePencereKapat } from "./pencere-kapat";

/*
  E-POSTA DEĞİŞİKLİĞİ, PROFİL KAYDINDAN AYRI (24.11.2026).

  Aynı formda olsaydı adını düzelten kullanıcı farkında olmadan bir
  doğrulama postası tetikleyebilirdi; e-posta değişikliği geri alınması
  zor bir iştir ve kendi onayını hak eder.

  Akış kimlik sağlayıcısının kendi akışı (app/actions/ayarlar.ts):
  updateUser({ email }) yeni adrese bağlantı yolluyor, bağlantı
  /auth/confirm → /auth/dogrula'daki onay düğmesine gidiyor. Adres o
  düğmeye basılana kadar DEĞİŞMİYOR; ekran bu sürede mevcut adresi
  gösterip yanında "Doğrulama bekleniyor" diyor.
*/
export default function EpostaDegistir({ mevcut, bekleyen }: { mevcut: string; bekleyen: string | null }) {
  const t = useCeviri();
  const kapat = usePencereKapat();
  const [yeni, setYeni] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_onceki, formData) => (await epostaDegisikligiIste(formData)) ?? null,
    null,
  );

  const gecerli = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(yeni.trim()) && yeni.trim().toLowerCase() !== mevcut.toLowerCase();

  if (state?.success) {
    return (
      <div className="stack-sm">
        <p className="alert" data-tone="success" role="status">
          {t({
            tr: `Doğrulama bağlantısını ${yeni.trim()} adresine gönderdik. Bağlantıdaki düğmeye basana kadar adresiniz ${mevcut} olarak kalır.`,
            en: `We sent a verification link to ${yeni.trim()}. Your address stays ${mevcut} until you press the button in that link.`,
          })}
        </p>
        <p className="muted text-sm">
          {t({
            tr: "Posta birkaç dakika içinde gelmezse istenmeyen klasörüne bakın.",
            en: "If the email doesn't arrive within a few minutes, check your spam folder.",
          })}
        </p>
        {kapat ? (
          <div className="project-form-actions">
            <button type="button" className="projects-primary-button" onClick={kapat}>
              {t({ tr: "Tamam", en: "Done" })}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="ayarlar-form">
      <dl className="settings-facts">
        <div>
          <dt>{t({ tr: "Mevcut adresiniz", en: "Your current address" })}</dt>
          <dd>{mevcut || "—"}</dd>
        </div>
      </dl>

      {bekleyen ? (
        <p className="alert" data-tone="warning" role="status">
          <Mail size={14} aria-hidden="true" />{" "}
          {t({
            tr: `${bekleyen} adresi için doğrulama bekleniyor. Yeni bir adres isterseniz bağlantı ona gönderilir ve öncekinin yerini alır.`,
            en: `Verification is pending for ${bekleyen}. If you request a different address, the link is sent to that one instead.`,
          })}
        </p>
      ) : null}

      <label>
        <span>{t({ tr: "Yeni e-posta adresi", en: "New email address" })}</span>
        <input
          className="field-control"
          name="yeniEposta"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          maxLength={254}
          value={yeni}
          onChange={(o) => setYeni(o.target.value)}
          required
        />
      </label>

      {state?.error ? (
        <p role="alert" className="action-form-message action-form-error">
          {state.error}
        </p>
      ) : null}

      <div className="project-form-actions">
        {kapat ? (
          <button type="button" className="projects-filter-button" onClick={kapat}>
            {t({ tr: "Vazgeç", en: "Cancel" })}
          </button>
        ) : null}
        <button type="submit" className="projects-primary-button" disabled={pending || !gecerli}>
          <Send size={15} aria-hidden="true" />
          {pending
            ? t({ tr: "Gönderiliyor…", en: "Sending…" })
            : t({ tr: "Doğrulama bağlantısı gönder", en: "Send verification link" })}
        </button>
      </div>
    </form>
  );
}
