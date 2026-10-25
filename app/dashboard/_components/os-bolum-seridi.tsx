"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { etkinBolum, etkinUygulama, type OsUygulama } from "@/lib/os/uygulamalar";

/*
  TELEFONDA BÖLÜM ŞERİDİ. Açık uygulamanın bölümleri üst çubuğun altında
  yana kayan sekmeler.

  Masaüstünde gizli (os-shell.css): orada bölümlere fareyle açılan ikinci
  dock'tan gidiliyor. Telefonda o ara menü bilerek hiç açılmıyor —
  ArvoOS'ta dokunuşla açılan menü sayfanın yazısını kaydırıyor ve
  bağlantılar dokunuşu kaçırıyordu; alttaki sekme artık uygulamayı
  doğrudan açıyor, bölümler buraya taşındı.
*/
export function OsBolumSeridi({ uygulamalar }: { uygulamalar: OsUygulama[] }) {
  const yol = usePathname();
  const serit = useRef<HTMLElement>(null);
  const uygulama = etkinUygulama(uygulamalar, yol);
  const bolumler = uygulama?.bolumler ?? [];
  const etkin = bolumler.length ? etkinBolum(bolumler, yol) : null;

  // Seçili sekme görünür kalsın: uzun şeritte sağdakine geçince kaydırılır.
  useEffect(() => {
    serit.current?.querySelector<HTMLElement>("[aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [etkin?.key]);

  // Tek bölümlü uygulamada şerit bir seçim sunmuyor, yalnızca yer kaplıyor.
  if (bolumler.length < 2) return null;
  return (
    <nav ref={serit} className="os-bolum-serit" aria-label={`${uygulama?.label ?? ""} bölümleri`}>
      {bolumler.map((bolum) => (
        <Link
          key={bolum.key}
          href={bolum.href}
          className={etkin?.key === bolum.key ? "is-active" : undefined}
          aria-current={etkin?.key === bolum.key ? "page" : undefined}
        >
          {bolum.label}
        </Link>
      ))}
    </nav>
  );
}
