"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BASKA_CIHAZ_BILGISI } from "@/lib/tek-oturum";

/*
  OTURUM GÖZCÜSÜ (02.11.2026, lib/tek-oturum.ts). Panelde sayfa
  değiştirilmeden beklenirken de "başka bir cihazdan giriş yapıldı"
  durumunu fark eder: dakikada bir (yalnızca sekme görünürken) ve sekmeye
  dönüldüğünde /api/oturum'a sorar. Kapatıldıysa giriş ekranına uyarıyla
  gider. Ağ hatası ya da beklenmeyen cevap hiçbir şey yapmaz — kişiyi
  dışarı atan tek şey sunucunun net "kapatıldı" cevabıdır.
*/
const ARALIK = 60_000;

export default function OturumGozcusu() {
  const router = useRouter();
  useEffect(() => {
    let iptal = false;
    let bekliyor = false;
    const sor = async () => {
      if (iptal || bekliyor || document.visibilityState !== "visible") return;
      bekliyor = true;
      try {
        const cevap = await fetch("/api/oturum", { cache: "no-store", credentials: "same-origin" });
        if (!cevap.ok) return;
        const { kapatildi } = (await cevap.json()) as { kapatildi?: boolean };
        if (kapatildi && !iptal) router.replace(`/?bilgi=${BASKA_CIHAZ_BILGISI}`);
      } catch {
        /* geçici ağ hatası: bir sonraki turda yeniden sorulur */
      } finally {
        bekliyor = false;
      }
    };
    const zamanlayici = window.setInterval(sor, ARALIK);
    const gorunurluk = () => {
      if (document.visibilityState === "visible") void sor();
    };
    document.addEventListener("visibilitychange", gorunurluk);
    window.addEventListener("focus", gorunurluk);
    return () => {
      iptal = true;
      window.clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("focus", gorunurluk);
    };
  }, [router]);
  return null;
}
