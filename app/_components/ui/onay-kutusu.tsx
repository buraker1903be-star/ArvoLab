import type { InputHTMLAttributes, ReactNode } from "react";

/* ONAY KUTUSU (Signature OS 5): yerel input; etiketin tamamı tıklanabilir, satır 44 px. */
export function OnayKutusu({ children, className, ...geri }: { children: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={className ? `os5-onay ${className}` : "os5-onay"}>
      <input {...geri} type="checkbox" />
      <span>{children}</span>
    </label>
  );
}
