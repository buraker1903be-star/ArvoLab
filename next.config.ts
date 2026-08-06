import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Server Action'ların varsayılan gövde boyutu sınırı 1 MB'dır.
      // Belge Kontrol (DOCX/PDF yükleme) ve Panelde Yazma (resim
      // ekleme) özellikleri bunu kolayca aşar; 25 MB'a yükseltiyoruz
      // (uygulama içi dosya boyutu kontrolleri zaten 20 MB'da sınırlı,
      // multipart/form-data ek yükü için biraz pay bırakıyoruz).
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
