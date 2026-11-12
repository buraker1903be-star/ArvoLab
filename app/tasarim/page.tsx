import { notFound } from "next/navigation";
import { ceviri } from "@/lib/dil-sunucu";
import { vitrinAcikMi } from "@/lib/os5/vitrin";
import ThemeToggle from "@/app/_components/theme-toggle";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";
import VitrinOrnekleri from "./vitrin-ornekleri";

/*
  BİLEŞEN VİTRİNİ. Veri okumaz, yazmaz, oturum istemez: yalnızca
  app/_components/ui bileşenlerini sabit örnek metinlerle çizer. Amaç
  Preview'da açık/koyu tema ve masaüstü/tablet/telefon görsel kabulü.
*/
export default async function VitrinSayfasi() {
  /* Yerleşimdeki kapının ikizi: yerleşim ile sayfa paralel çizildiği için içerik 404 yanıtına sızmasın. */
  if (!vitrinAcikMi({ VERCEL_ENV: process.env.VERCEL_ENV, ARVOLAB_DAGITIM_ORTAMI: process.env.ARVOLAB_DAGITIM_ORTAMI })) notFound();
  const t = await ceviri();
  return (
    <main className="os5-vitrin" id="icerik">
      <header className="os5-vitrin-ust">
        <ArvoLabLogosu className="os5-vitrin-logo" alt="ArvoLab" />
        <div className="os5-vitrin-ust-metin">
          <h1 className="os5-vitrin-baslik">{t({ tr: "Bileşen vitrini", en: "Component showcase" })}</h1>
          <p className="os5-vitrin-alt">
            {t({
              tr: "Signature OS 5 · Phase 1. Yalnızca Production dışında açılır; gerçek veri kullanmaz.",
              en: "Signature OS 5 · Phase 1. Available outside Production only; uses no real data.",
            })}
          </p>
        </div>
        <ThemeToggle />
      </header>
      <VitrinOrnekleri />
    </main>
  );
}
