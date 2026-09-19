import type { NextConfig } from "next";

const PDF_WORKER = "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist"],
  /*
    pdfjs (pdf-parse içinden) worker dosyasını çalışma anında dinamik yükler;
    Vercel'in dosya izleyicisi onu görmez, pakete eklemek gerekir. Eskiden
    yalnızca cron rotasına ekliyordu: Belge Kontrol'de PDF yükleme ve
    Kılavuzlar'da PDF tarama (server action'ları bu sayfaların paketinde)
    "metin çıkarılırken hata" veriyordu. PDF okuyan yeni bir sayfa eklenirse
    buraya da ekleyin.
  */
  outputFileTracingIncludes: {
    "/api/cron/guideline-refresh": [PDF_WORKER],
    "/dashboard/documents": [PDF_WORKER],
    "/dashboard/guidelines": [PDF_WORKER],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
