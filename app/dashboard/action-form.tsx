"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import { useActionState, useRef, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { ActionResult } from "@/lib/auth-guards";
import { announceActionSuccess, showToast } from "./_components/toast-events";
import PanelDrawer from "./_components/panel-drawer";

interface ActionFormProps {
  action: (formData: FormData) => Promise<ActionResult | undefined>;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Doluysa gönderimden önce onay penceresi gösterilir (silme vb. geri alınamaz işlemler için). */
  confirmMessage?: string;
  /** Başarıda gösterilecek bildirim metni */
  successMessage?: string;
  /** Onay penceresindeki düğmenin metni (varsayılan "Onayla"). */
  confirmButtonLabel?: string;
}

// Server action sonucunu kullanıcıya yansıtır:
// - hata: formun içinde, kontrolün yanında (pencerede formun en üstünde);
//   yazılanlar KORUNUR (React'in <form action> otomatik sıfırlaması hata
//   dönen gönderimlerde de formu boşaltıyordu, bu yüzden gönderimi biz başlatıyoruz)
// - başarı: iOS benzeri bildirim + form sıfırlanır + açık PanelDrawer penceresi kapanır
export default function ActionForm({ action, children, className, style, confirmMessage, successMessage, confirmButtonLabel }: ActionFormProps) {
  const t = useCeviri();
  const formRef = useRef<HTMLFormElement>(null);
  const [surum, setSurum] = useState(0);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (_previous, formData) => {
    const result = (await action(formData)) ?? null;
    if (result?.success) {
      // Uyarı varsa onu gösteriyoruz: işlem tamamlandı ama kullanıcının
      // görmesi gereken bir şey var, başarı bildirimi onu gizlemesin.
      if (result.warning) showToast("warning", result.warning);
      // Eylemin kendi metni, sayfanın sabit metninin önüne geçer.
      else showToast("success", result.message ?? successMessage ?? t({ tr: "İşlem tamamlandı.", en: "Done." }));
      /*
        Alanlar yeniden kurulur (fieldset'in anahtarı değişir), sunucunun
        yeni gönderdiği defaultValue'larla. Eskiden form.reset() çağrılıyordu:
        React 19 <select defaultValue> değişince seçeneğin varsayılanını
        güncellemediği için reset listeyi sayfanın ilk açıldığı değere
        döndürüyordu; düzenleme formunda ikinci kayıt da eski değeri geri
        yazıyordu (durum, rol, kurum, sorumlu). Ekleme formlarında sonuç aynı:
        varsayılanlar boş olduğu için alanlar temizlenir.
      */
      setSurum((s) => s + 1);
      announceActionSuccess();
    }
    return result;
  }, null);

  /*
    ONAY UYGULAMANIN KENDİ PENCERESİNDE (03.11.2026). Eskiden
    window.confirm'dü: tarayıcının gri kutusu sitenin üstünde "lab.arvo-os.com
    diyor ki" başlığıyla açılıyor, uygulamanın geri kalanına benzemiyor ve
    telefonda metnin yarısı kesiliyordu. Gönderilecek veri pencere açılırken
    alınıyor; "Onayla" onu gönderiyor.
  */
  const [bekleyen, setBekleyen] = useState<FormData | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    if (confirmMessage) {
      setBekleyen(formData);
      return;
    }
    startTransition(() => formAction(formData));
  };

  const onayla = () => {
    const formData = bekleyen;
    setBekleyen(null);
    if (formData) startTransition(() => formAction(formData));
  };

  // İlk paragraf soru (başlık), kalanı açıklama.
  const [soru, ...aciklama] = (confirmMessage ?? "").split(/\n\s*\n/);

  return (
    // method="post": sayfa henüz etkileşimli değilken gönderilse bile alanlar (notlar vb.) adres çubuğuna yazılmaz.
    <form ref={formRef} method="post" onSubmit={handleSubmit} className={className} style={style} aria-busy={pending}>
      <fieldset key={surum} disabled={pending} className="action-form-fieldset">
        {children}
      </fieldset>
      {/*
        İşlem kapsülü: gönderim sürerken ekranın altında "İşleniyor…" görünür.
        Alanlar devre dışı kalıyordu ama uzun süren kayıtlarda (dosya çözümleme,
        AI) ekranda hiçbir hareket olmuyordu; kullanıcı düğmeye tekrar basıyordu.
      */}
      {pending ? (
        <span className="action-capsule" role="status">
          <i aria-hidden="true" />
          {t({ tr: "İşleniyor…", en: "Working…" })}
        </span>
      ) : null}
      {confirmMessage ? (
        <PanelDrawer
          tetiksiz
          acik={bekleyen !== null}
          onAcikDegis={(acik) => {
            if (!acik) setBekleyen(null);
          }}
          basaridaKapan={false}
          boy="onay"
          triggerLabel=""
          title={soru.trim()}
        >
          {aciklama.length ? (
            <div className="onay-metni">
              {aciklama.map((p) => (
                <p key={p}>{p.trim()}</p>
              ))}
            </div>
          ) : null}
          <div className="onay-eylemleri">
            <button type="button" className="projects-filter-button" onClick={() => setBekleyen(null)}>
              {t({ tr: "Vazgeç", en: "Cancel" })}
            </button>
            <button type="button" className="button-danger" onClick={onayla}>
              {confirmButtonLabel ?? t({ tr: "Onayla", en: "Confirm" })}
            </button>
          </div>
        </PanelDrawer>
      ) : null}
      {state?.error ? (
        <p role="alert" className="action-form-message action-form-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
