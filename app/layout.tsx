import type { Metadata, Viewport } from "next";
import { aktifDil, aktifSaatDilimi, ceviri } from "@/lib/dil-sunucu";
import { DilSaglayici } from "./_components/dil-saglayici";
import { Inter, Montserrat, Newsreader } from "next/font/google";
import { TEMA_BETIGI, TEMA_RENGI } from "@/lib/tema";
import { GEZINME_BETIGI } from "@/lib/os5/gezinme";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/os-shell.css";
import "./styles/auth.css";
import "./styles/workspace.css";
import "./styles/overlays.css";
import "./styles/genel-bakis.css";
import "./styles/print.css";
/* Signature OS 5 (Phase 1): yalnızca "os5-" önekli sınıflar; mevcut ekranları etkilemez. */
import "./styles/os5-tokens.css";
import "./styles/os5-bilesenler.css";
/* Phase 2: kimlik ekranları (giriş, kayıt, şifre, bağlantı onayı). */
import "./styles/os5-kimlik.css";
/* Phase 4: öğrencinin ana sayfası (yalnızca .os5-ana altında). */
import "./styles/os5-ana-sayfa.css";

// Tek yazı ailesi: Apple cihazlarında sistemin SF Pro'su (-apple-system),
// diğerlerinde ona en yakın açık yazı tipi Inter. preload kapalı: Apple
// cihazları SF'yi bulduğu için Inter dosyasını hiç indirmez.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

/*
  Editoryal başlık yazısı (Phase 4.1, kurum sahibinin kararı 04.11.2026):
  yalnızca sayfa ve çalışma başlıkları, bazı içerik kartı başlıkları.
  Gövde, form, tablo, menü ve düğmeler Inter'de kalır; akademik belge
  editörü kendi biçim sistemini kullanır. latin-ext: Türkçe harfler (ş, ğ, İ).

  TEK AĞIRLIK, STATİK (Phase 4.4). 4.1'de değişken dosya (ağırlık +
  optik boyut eksenleri) seçilmişti; başlıklar ona bağlanınca ölçüldü:
  sayfa başına +214 KB (latin 129 + latin-ext 85). Başlıkların hepsi
  tek ağırlıkta (500, --fw-display); statik 500 dosyası +38 KB (15 + 23).
  Başka bir ağırlık istenirse buraya eklenir — yoksa tarayıcı kalını
  kendisi üretir (sahte kalın).

  ÖNCEDEN YÜKLENİR (Phase 4.4): editoryal başlık neredeyse her sayfada
  (karşılama, modül başlıkları, çalışma adı, giriş). Yüklenmezken
  başlık önce yedek yazıyla çizilip sonra değişiyordu: giriş ekranında
  düzen kayması (CLS) 0,0126 ölçüldü; önceden yüklemeyle 0.
*/
const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  variable: "--font-newsreader",
  display: "swap",
  weight: "500",
  preload: true,
});

// Yalnızca marka yazısı ve logo işareti için.
const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-montserrat",
  display: "swap",
});

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
        {/*
          Kenar çubuğu dar/açık tercihi (Phase 5.1b): temayla aynı yöntem ve
          aynı nedenle ilk boyamadan önce <html data-gezinme> yazar. Tek
          başına görünür hiçbir şey değiştirmez; kuralları masaüstü CSS'i
          taşır (lib/os5/gezinme.ts).
        */}
        <script id="gezinme-init" dangerouslySetInnerHTML={{ __html: GEZINME_BETIGI }} />
      </head>
      <body className={`${inter.variable} ${montserrat.variable} ${newsreader.variable}`}>
        <DilSaglayici dil={dil} saatDilimi={saatDilimi}>
          {children}
        </DilSaglayici>
      </body>
    </html>
  );
}
