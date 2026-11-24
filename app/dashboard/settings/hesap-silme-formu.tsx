"use client";

import { useActionState, useState } from "react";
import { usePencereKapat } from "@/app/dashboard/_components/pencere-kapat";
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

  TEK ADIM (24.11.2026, tasarım incelemesi). Form açılışta KAPALIYDI:
  Ayarlar satırındaki "Sil" düğmesi 680 px'lik bir pencere açıyor,
  pencerenin gövdesinde yalnızca "Hesabımı silmek istiyorum" düğmesi
  duruyor, asıl onay bir adım sonra geliyordu. Kapalı başlamanın gerekçesi
  "yanlışlıkla basılma olasılığını yükseltmemek"ti, ama o koruma zaten
  e-posta kutusunda: düğme adres birebir yazılana kadar pasif. Üçüncü bir
  kapı kararı güvenli yapmıyor, yalnızca uzatıyordu — üstelik o pencerede
  "Vazgeç" bile yoktu.

  Onay denetimi İKİ yerde: burada düğmeyi kapalı tutmak için, sunucuda
  (app/actions/hesap.ts) ise gerçekten karar veren yer olarak. İstemci
  denetimi bir kolaylıktır, koruma değildir. Sunucu ayrıca ilk şifre
  kapısını ve iç ekip yasağını uyguluyor; bu ekran onların hiçbirini
  üstlenmiyor.

  DÜĞMEDE "KALICI OLARAK SİL" YAZMIYOR: sunucu eylemi profile bir silme
  TALEBİ yazıyor (silme_talebi_at), erişim hemen kapanıyor ve veri
  BEKLEME_GUNU gün duruyor. Kalıcı silme o anda olmuyor; düğmenin öyle
  demesi, geri dönüşü olan bir işlemi geri dönüşsüz göstermekti.
*/
export default function HesapSilmeFormu({ action, eposta, bireysel }: Props) {
  const t = useCeviri();
  const kapat = usePencereKapat();
  const [yazilan, setYazilan] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_onceki, formData) => (await action(formData)) ?? null,
    null
  );

  return (
    <form action={formAction} className="hesap-silme-form">
      {/* Sonuçlar sırayla: ne hemen olur, ne geri alınabilir, ne kalıcıdır. */}
      <ul className="hesap-silme-sonuc">
        <li>{t({ tr: "Erişiminiz hemen kapanır ve oturumunuz sona erer.", en: "Your access closes immediately and you are signed out." })}</li>
        <li>
          {t({
            tr: `${BEKLEME_GUNU} gün içinde giriş yaparsanız talep iptal olur, her şey geri gelir.`,
            en: `If you sign in within ${BEKLEME_GUNU} days, the request is cancelled and everything comes back.`,
          })}
        </li>
        <li>
          {t({
            tr: `${BEKLEME_GUNU} gün dolunca çalışmalarınız, tez metinleriniz, kaynaklarınız ve dosyalarınız kalıcı olarak silinir — geri getirilemez.`,
            en: `After ${BEKLEME_GUNU} days your projects, thesis texts, sources and uploaded files are permanently deleted — they cannot be recovered.`,
          })}
        </li>
      </ul>

      {bireysel ? (
        <p className="tone-text text-sm" data-tone="warning">
          {t({
            tr: "Ödemesi yapılmış ama henüz dolmamış abonelik döneminiz için iade yapılmaz.",
            en: "No refund is given for a paid subscription period that has not yet ended.",
          })}
        </p>
      ) : null}
      <p className="muted text-sm">
        {t({
          tr: "Ödeme kayıtlarınız vergi mevzuatı gereği saklanır; abonelik kaydınız kapatılır ve kişisel bilgileri silinir.",
          en: "Your payment records are retained as required by tax law; your subscription record is closed and its personal information is deleted.",
        })}
      </p>

      <p>
        <a className="link-button" href="/api/hesabim/verilerim" download>
          <Download size={15} aria-hidden="true" />
          {t({ tr: "Önce verilerimi indir", en: "Download my data first" })}
        </a>
      </p>

      <label>
        <span>{t({ tr: "Onaylamak için e-posta adresinizi yazın", en: "Type your email address to confirm" })}</span>
        <input
          /* Ortak form alanı stili: .hesap-silme-form bir project-form-grid
             değil, alan tarayıcı varsayılanıyla çiziliyordu. */
          className="field-control"
          name="onay"
          type="text"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          value={yazilan}
          onChange={(olay) => setYazilan(olay.target.value)}
          placeholder={eposta}
          required
        />
      </label>

      <div className="project-form-actions">
        {/* "Vazgeç" her zaman görünür: eskiden tek çıkış köşedeki ✕'ti. */}
        {kapat ? (
          <button type="button" className="projects-filter-button" onClick={kapat}>
            {t({ tr: "Vazgeç", en: "Cancel" })}
          </button>
        ) : null}
        <button type="submit" className="button-danger" disabled={pending || !onayGecerli(yazilan, eposta)}>
          <Trash2 size={16} aria-hidden="true" />
          {pending ? t({ tr: "Gönderiliyor…", en: "Sending…" }) : t({ tr: "Silme talebi oluştur", en: "Request deletion" })}
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
