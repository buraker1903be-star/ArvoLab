import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { dugmeSinifi, type DugmeBoyutu, type DugmeTuru } from "@/lib/os5/bilesen";

/*
  DÜĞME (Signature OS 5). Bir tür, iki boy: Paddle referansındaki gibi
  düşük radius, kapsül değil; hiyerarşi renkten ve dolgudan gelir.

  `yukleniyor`: düğme kendiliğinden kapanmaz ama aria-busy taşır ve ikinci
  tıklamayı yutar — form iki kez gönderilmesin. Yazı yerinde kalır ki
  düğmenin eni değişip yerleşim zıplamasın.
  `href` verilirse bağlantı olarak çizilir: gezinme bir düğme değildir,
  ekran okuyucu onu "bağlantı" diye okumalı.
*/
type Ortak = { tur?: DugmeTuru; boyut?: DugmeBoyutu; tamGenislik?: boolean; yukleniyor?: boolean; children: ReactNode };

export function Dugme({
  tur,
  boyut,
  tamGenislik,
  yukleniyor = false,
  className,
  type = "button",
  disabled,
  onClick,
  children,
  ...geri
}: Ortak & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...geri}
      type={type}
      className={dugmeSinifi({ tur, boyut, tamGenislik, ek: className })}
      disabled={disabled}
      aria-busy={yukleniyor || undefined}
      onClick={yukleniyor ? (olay) => olay.preventDefault() : onClick}
    >
      {yukleniyor ? <span className="os5-dugme-donen" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function DugmeBaglanti({ href, tur, boyut, tamGenislik, className, children }: Omit<Ortak, "yukleniyor"> & { href: string; className?: string }) {
  return (
    <Link href={href} className={dugmeSinifi({ tur, boyut, tamGenislik, ek: className })}>
      {children}
    </Link>
  );
}
