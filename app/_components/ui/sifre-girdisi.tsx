"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { aciklamaBaglantisi } from "@/lib/os5/bilesen";
import { Alan } from "./alan";

/*
  ŞİFRE GİRDİSİ (Signature OS 5). Yalnızca görünüm ve göster/gizle.
  Şifre kuralı (uzunluk, yaygın şifre) BURADA YOK ve olmamalı: kural
  çağıranda ve sunucuda kalır; bileşen kuralı bilse iki yerde iki kural
  olurdu. Göster/gizle düğmesi formu göndermez (type="button") ve durumu
  aria-pressed ile duyurur.
*/
export function SifreGirdisi({
  etiket,
  aciklama,
  hata,
  id,
  required,
  ...geri
}: { etiket: string; aciklama?: ReactNode; hata?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const t = useCeviri();
  const uretilen = useId();
  const kimlik = id ?? uretilen;
  const [goster, setGoster] = useState(false);
  return (
    <Alan kimlik={kimlik} etiket={etiket} zorunlu={required} aciklama={aciklama} hata={hata}>
      <div className="os5-sifre-kap">
        <input
          {...geri}
          id={kimlik}
          type={goster ? "text" : "password"}
          required={required}
          className="os5-girdi"
          aria-invalid={hata ? true : undefined}
          aria-describedby={aciklamaBaglantisi(kimlik, { aciklama: Boolean(aciklama), hata: Boolean(hata) })}
        />
        <button
          type="button"
          className="os5-sifre-dugme"
          aria-pressed={goster}
          aria-controls={kimlik}
          aria-label={goster ? t({ tr: "Şifreyi gizle", en: "Hide password" }) : t({ tr: "Şifreyi göster", en: "Show password" })}
          onClick={() => setGoster((onceki) => !onceki)}
        >
          {goster ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </Alan>
  );
}
