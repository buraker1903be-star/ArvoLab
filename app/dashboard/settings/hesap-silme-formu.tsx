"use client";

import { useActionState, useState } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { Download, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/auth-guards";
import { BEKLEME_GUNU, onayGecerli } from "@/lib/hesap-silme";

interface Props {
  action: (formData: FormData) => Promise<ActionResult>;
  eposta: string;
  /** Bireysel abone mi: ödenmiş dönemin iade edilmediği yalnızca ona söylenir. */
  bireysel: boolean;
}

/*
  Hesap silme formu.

  Açılışta kapalı: Ayarlar sayfasını her açanın önüne kırmızı bir "hesabımı
  sil" düğmesi koymak, yanlışlıkla basılma olasılığını kendi elimizle
  yükseltmek olurdu. Düğme yalnızca kullanıcı bölümü açtığında çıkıyor ve
  o zaman bile e-posta yazılmadan etkinleşmiyor.

  Onay denetimi İKİ yerde: burada düğmeyi kapalı tutmak için, sunucuda
  (app/actions/hesap.ts) ise gerçekten karar veren yer olarak. İstemci
  denetimi bir kolaylıktır, koruma değildir.
*/
export default function HesapSilmeFormu({ action, eposta, bireysel }: Props) {
  const t = useCeviri();
  const [acik, setAcik] = useState(false);
  const [yazilan, setYazilan] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_onceki, formData) => (await action(formData)) ?? null,
    null
  );

  if (!acik) {
    return (
      <>
        <button type="button" className="projects-filter-button" onClick={() => setAcik(true)}>
          <Trash2 size={16} aria-hidden="true" />
          {t({ tr: "Hesabımı silmek istiyorum", en: "I want to delete my account" })}
        </button>
        {state?.error ? (
          <p role="alert" className="action-form-message action-form-error">
            {state.error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <form action={formAction} className="project-form-grid">
      <div className="project-form-full">
        <p className="tone-text" data-tone="danger">
          {t({
            tr: `Silme talebi verdiğiniz an erişiminiz kapanır ve oturumunuz sona erer. Verileriniz ${BEKLEME_GUNU} gün daha durur: bu süre içinde giriş yapıp vazgeçerseniz her şey geri gelir. Süre dolunca çalışmalarınız, tez metinleriniz, kaynaklarınız ve yüklediğiniz dosyalar kalıcı olarak silinir — geri getirilemez.`,
            en: `As soon as you request deletion, your access is closed and you are signed out. Your data is kept for ${BEKLEME_GUNU} more days: if you sign in and cancel within that time, everything comes back. After that, your projects, thesis texts, sources and uploaded files are permanently deleted — they cannot be recovered.`,
          })}
        </p>
        {bireysel ? (
          <p className="tone-text" data-tone="warning">
            {t({
              tr: "Ödemesi yapılmış ama henüz dolmamış abonelik döneminiz için iade yapılmaz; silme talebiyle birlikte kalan süreden vazgeçmiş olursunuz.",
              en: "No refund is given for a paid subscription period that has not yet ended; by requesting deletion you give up the remaining time.",
            })}
          </p>
        ) : null}
        <p>
          {t({
            tr: "Ödeme kayıtlarınız vergi mevzuatı gereği saklanır; abonelik kaydınız kapatılır ve kişisel bilgileri silinir.",
            en: "Your payment records are retained as required by tax law; your subscription record is closed and its personal information is deleted.",
          })}
        </p>
        <p>
          <a className="projects-filter-button" href="/api/hesabim/verilerim" download>
            <Download size={16} aria-hidden="true" />
            {t({ tr: "Önce verilerimi indir", en: "Download my data first" })}
          </a>
        </p>
      </div>

      <label className="project-form-full">
        <span>{t({ tr: `Onaylamak için e-posta adresinizi yazın: ${eposta}`, en: `Type your email address to confirm: ${eposta}` })}</span>
        <input
          name="onay"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={yazilan}
          onChange={(olay) => setYazilan(olay.target.value)}
          placeholder={eposta}
          required
        />
      </label>

      <div className="project-form-actions">
        <button
          type="submit"
          className="button-danger"
          disabled={pending || !onayGecerli(yazilan, eposta)}
        >
          <Trash2 size={16} aria-hidden="true" />
          {pending
            ? t({ tr: "İşleniyor…", en: "Processing…" })
            : t({ tr: "Hesabımı kalıcı olarak sil", en: "Permanently delete my account" })}
        </button>
        <button type="button" className="projects-filter-button" onClick={() => setAcik(false)}>
          {t({ tr: "Vazgeç", en: "Cancel" })}
        </button>
      </div>

      {state?.error ? (
        <p role="alert" className="action-form-message action-form-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
