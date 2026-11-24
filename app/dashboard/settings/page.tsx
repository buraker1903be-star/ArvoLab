import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ceviri } from "@/lib/dil-sunucu";
import { ayarlariOku } from "@/app/actions/ayarlar";
import AyarlarSayfasi from "./ayarlar-sayfasi";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Ayarlar", en: "Settings" }) };
}

/*
  AYARLAR SAYFASI ARTIK İNCE BİR KAP (24.11.2026).

  Bütün ayar içeriği ortak bileşende (app/dashboard/_components/
  ayarlar-icerik.tsx): uygulamanın her yerinden açılan Ayarlar penceresi
  de aynı bileşeni çiziyor. Eskiden ekranın tamamı buradaydı; pencere
  eklenince ikinci bir kopya çıkacaktı ve biri eskiyecekti.

  Adres doğrudan açıldığında (yer imi, eski bağlantı, yeni sekme,
  JavaScript kapalıyken menüdeki bağlantı) aynı ayarlara buradan
  ulaşılıyor.
*/
export default async function SettingsPage() {
  const t = await ceviri();
  const cevap = await ayarlariOku();
  if ("error" in cevap) redirect("/");

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Ayarlar", en: "Settings" })}</h1>
          <p>{t({ tr: "Hesabınız, güvenliğiniz, tercihleriniz, aboneliğiniz ve verileriniz.", en: "Your account, security, preferences, subscription and data." })}</p>
        </div>
      </section>
      <AyarlarSayfasi veri={cevap.veri} />
    </main>
  );
}
