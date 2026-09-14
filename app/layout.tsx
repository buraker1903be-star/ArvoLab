import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Montserrat } from "next/font/google";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/auth.css";
import "./styles/workspace.css";
import "./styles/overlays.css";
import "./styles/print.css";

// Tek yazı ailesi: Apple cihazlarında sistemin SF Pro'su (-apple-system),
// diğerlerinde ona en yakın açık yazı tipi Inter. preload kapalı: Apple
// cihazları SF'yi bulduğu için Inter dosyasını hiç indirmez.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

// Yalnızca marka yazısı ve logo işareti için.
const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ArvoLab",
  description: "Akademik Araştırma ve Analiz Sistemi",
  applicationName: "ArvoLab",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ArvoLab" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000d1f" },
  ],
};

// Tema, boyamadan önce <html data-theme> üzerine yazılır: kayıtlı tercih
// (bkz. app/_components/theme-toggle.tsx), yoksa işletim sistemi ayarı.
// Böylece koyu temada sayfa açılırken beyaz bir an ("flash") görünmez.
const themeInit = `(function(){try{var t=localStorage.getItem("arvolab.theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.variable} ${montserrat.variable}`}>
        {/* beforeInteractive: Next betiği <head>'e, sayfa boyanmadan önce yerleştirir */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        {children}
      </body>
    </html>
  );
}
