"use client";

import { useFormStatus } from "react-dom";
import { CreditCard } from "lucide-react";

/*
  Ödeme formunun gönder düğmesi.

  Eskiden ham bir <button type="submit"> idi: gönderim sırasında kilitlenmiyor
  ve hiçbir şey olmuyormuş gibi duruyordu. PayTR yönlendirmesi geciktiğinde
  kullanıcı ikinci kez tıklıyordu. Erişimi kapalı kullanıcının kendi kilidini
  açabileceği TEK yol burası olduğu için (AGENTS.md: ödeme yolu asla
  kapatılmaz) korumasız kalmamalı.

  useFormStatus formun kendi durumunu okur; düğmenin form hakkında bilgi
  taşıması gerekmez.
*/

export default function OdemeButonu({
  etiket,
  birincil,
  ikonlu = true,
}: {
  etiket: string;
  /** İlk plan birincil düğme; diğerleri ikincil. */
  birincil: boolean;
  ikonlu?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={birincil ? "projects-primary-button" : "projects-filter-button"}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        /* ActionForm'un "İşleniyor…" kalıbıyla aynı dil; panelde tek bekleme
           anlatımı olsun diye ayrı bir dönen simge eklenmedi. */
        "Yönlendiriliyorsunuz…"
      ) : (
        <>
          {ikonlu ? <CreditCard size={16} aria-hidden="true" /> : null}
          {etiket}
        </>
      )}
    </button>
  );
}
