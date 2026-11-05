import type { Metadata, Viewport } from "next";
import { aktifDil, aktifSaatDilimi, ceviri } from "@/lib/dil-sunucu";
import { DilSaglayici } from "./_components/dil-saglayici";
import { Inter } from "next/font/google";
import { TEMA_BETIGI, TEMA_RENGI } from "@/lib/tema";
import { KENAR_BETIGI } from "@/lib/os/kenar";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/os-shell.css";
import "./styles/auth.css";
import "./styles/workspace.css";
import "./styles/overlays.css";
import "./styles/genel-bakis.css";
import "./styles/sayfa-standardi.css";
import "./styles/print.css";

/*
  ARAYÜZ YAZISI HER PLATFORMDA INTER (Signature OS, 04.11.2026). Eskiden
  Apple cihazlarda sistemin SF Pro'su öndeydi ve Inter hiç indirilmiyordu
  (preload kapalı); arayüz iki platformda iki ayrı yazıyla görünüyordu.
  Artık her ekranda Inter: önceden yüklenir, yedek yazıyla çizilip sonra
  değişme (düzen kayması) olmasın.

  Phase 4.4'teki Newsreader (editoryal başlık) kaldırıldı: kurum sahibinin
  kararı, başlıklar dahil her yerde Inter. Sayfa başına 38 KB daha az.

  Belgenin yazısı arayüzden bağımsız: editör kâğıdı --font-belge
  yığınında (tokens.css), kılavuz yazı tipleri satır içi.
*/
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

// Montserrat kaldırıldı (Signature OS): her sayfada önceden yükleniyordu
// (102 KB) ama hiçbir öğe kullanmıyordu — logo bir görüntü dosyası, tek
// kullanıcısı olan .brand-wordmark sınıfı hiçbir bileşende geçmiyordu.

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return {
    /* Her sayfa kendi adını verir; eskiden bütün sekmeler "ArvoLab" yazıyordu
       ve birkaç sekme açan kullanıcı hangisinin hangisi olduğunu göremiyordu. */
    title: { default: "ArvoLab", template: "%s · ArvoLab" },
    description: t({ tr: "Akademik Araştırma ve Analiz Sistemi", en: "Academic research and analysis system" }),
    applicationName: "ArvoLab",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "ArvoLab" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Betik çalışmadan önceki (ve JavaScript kapalıyken) değer: cihazın teması.
  // Ön boyama betiği içeriği uygulanan temaya göre yeniden yazar (lib/tema.ts).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: TEMA_RENGI.light },
    { media: "(prefers-color-scheme: dark)", color: TEMA_RENGI.dark },
  ],
};

/*
  TEMA, BOYAMADAN ÖNCE <html data-theme> üzerine yazılır (betik ve
  açık/koyu/sistem kararı: lib/tema.ts, birim testi tema.test.ts).

  <head> içinde GERÇEK bir satır içi <script> (Phase 4.1 düzeltmesi,
  node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md).
  Eskiden next/script'in beforeInteractive'i kullanılıyordu; Next 16 bunu
  HTML'e çalışan kod olarak değil, self.__next_s kuyruğuna VERİ olarak
  yazıyor ve kuyruğu ancak Next'in kendi JS paketi gelince işliyor.
  Ölçüldü (04.11.2026, betik paketleri 4 sn geciktirilerek): o süre
  boyunca data-theme hiç yoktu, koyu temayı seçmiş kullanıcı sayfayı
  açık zeminle görüyordu — yavaş mobil bağlantıda saniyelerce. Tarayıcı
  satır içi betiği HTML'i ayrıştırırken, ilk boyamadan önce çalıştırır.
  suppressHydrationWarning (html'de): betik özniteliği React'ten önce yazıyor.
*/

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [dil, saatDilimi] = await Promise.all([aktifDil(), aktifSaatDilimi()]);
  return (
    <html lang={dil} suppressHydrationWarning>
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: TEMA_BETIGI }} />
        {/* Kenar çubuğunun geniş/dar tercihi de boyamadan önce (lib/os/kenar.ts): aynı sebep, düzen kayması. */}
        <script id="kenar-init" dangerouslySetInnerHTML={{ __html: KENAR_BETIGI }} />
      </head>
      <body className={inter.variable}>
        <DilSaglayici dil={dil} saatDilimi={saatDilimi}>
          {children}
        </DilSaglayici>
      </body>
    </html>
  );
}
