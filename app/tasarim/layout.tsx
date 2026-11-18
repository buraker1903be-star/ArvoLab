import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { vitrinAcikMi } from "@/lib/os5/vitrin";

/*
  VİTRİN KAPISI (Signature OS 5, Phase 1). Karar YERLEŞİMDE: yerleşim
  Suspense sınırından önce çalıştığı için buradaki notFound() gerçek bir
  HTTP 404 üretir (sayfada çağrılsaydı yanıt akmaya başlamış olabilir,
  "yumuşak 404" — 200 durum kodu). Karar her istekte verilir; derlemede
  sabitlenen sayfa Production'a yanlışlıkla açık çıkmasın.

  Aynı karar sayfada (page.tsx) ve başlıkta da veriliyor: App Router
  yerleşimi ve sayfayı PARALEL çizer. Eskiden (12.11.2026, ilk sürüm)
  kapı yalnızca buradaydı; durum kodu 404'tü ama sayfa ağacı ve <title>
  yine de 404 yanıtının içinde gidiyordu.
*/
export const dynamic = "force-dynamic";

const acik = () => vitrinAcikMi({ VERCEL_ENV: process.env.VERCEL_ENV, ARVOLAB_DAGITIM_ORTAMI: process.env.ARVOLAB_DAGITIM_ORTAMI });

export function generateMetadata(): Metadata {
  const robots = { index: false, follow: false };
  return acik() ? { title: "Signature OS 5 — Bileşen vitrini", robots } : { robots };
}

export default function VitrinYerlesimi({ children }: { children: ReactNode }) {
  if (!acik()) notFound();
  return children;
}
