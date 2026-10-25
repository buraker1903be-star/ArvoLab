import type { NextConfig } from "next";

const PDF_WORKER = "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";

/*
  OCR işçisi ve wasm çekirdeği (lib/ocr.ts).

  PDF worker'la AYNI sınıf hata, aynı çözüm: tesseract.js OCR'ı
  worker_threads ile ayrı bir iş parçacığında koşuyor ve betiğin yolunu
  çalışma anında __dirname'den kuruyor (node_modules/tesseract.js/src/
  worker/node/defaultOptions.js). Böyle bir yolu dosya izleyicisi göremez;
  betik dağıtım paketine hiç girmedi. Sonuç: taranmış bir PDF kılavuz
  kuyruğa girdiği 05.10.2026'dan 25.10.2026'ya kadar
  /api/cron/guideline-refresh her gece 02:17'de
  "Cannot find module .../worker-script/node/index.js" ile DÜŞTÜ — o turun
  kılavuz keşfi ve yeniden taraması hiç koşmadı. Aynı yol panelden elle
  tarama yapan yöneticiyi de vuruyordu (/dashboard/guidelines).

  İzleyici, işçinin içinden yapılan require'ları da göremiyor; bu yüzden
  işçinin kendi bağımlılıkları da listede. Dosya eksikse işin nasıl
  davrandığı lib/ocr.ts'te yazılı.
*/
const OCR_ISCISI = [
  "./node_modules/tesseract.js/src/**/*",
  /*
    İşçinin ilk satırlarında istenen paketler. node-fetch, idb-keyval ve
    zlibjs YOK: birincisi yalnızca global fetch bulunmazsa (Node 22'de var),
    ikisi tarayıcı dalında isteniyor.
  */
  "./node_modules/regenerator-runtime/**/*",
  "./node_modules/is-url/**/*",
  "./node_modules/bmp-js/**/*",
  "./node_modules/wasm-feature-detect/**/*",
  /*
    Çekirdeğin YALNIZCA LSTM sürümleri: createWorker'ın öntanımlı OEM'i
    LSTM_ONLY ve worker-script/node/getCore.js bu üçünden birini (wasm
    özellik algılamasına göre relaxedsimd / simd / düz) istiyor, başkasını
    hiç istemiyor. Hangisinin seçileceği çalışma anında belli olduğu için
    üçü birlikte eklenir (~8 MB).

    *.wasm.js yedekleri (25 MB) bilerek dışarıda: onlar WebAssembly'nin
    hiç bulunmadığı ortam için ve Node 22'de o dal çalışmıyor.
  */
  "./node_modules/tesseract.js-core/package.json",
  "./node_modules/tesseract.js-core/tesseract-core-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-lstm.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-simd-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  /*
    tesseract.js listede: işçi yolu __dirname'den kuruluyor, yani paketin
    gerçek node_modules yerinde durması gerekiyor. Paketlenirse __dirname
    derleme çıktısını gösterir ve yol yeniden kırılır.
  */
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist", "tesseract.js"],
  /*
    pdfjs (pdf-parse içinden) worker dosyasını çalışma anında dinamik yükler;
    Vercel'in dosya izleyicisi onu görmez, pakete eklemek gerekir. Eskiden
    yalnızca cron rotasına ekliyordu: Belge Kontrol'de PDF yükleme ve
    Kılavuzlar'da PDF tarama (server action'ları bu sayfaların paketinde)
    "metin çıkarılırken hata" veriyordu. PDF okuyan yeni bir sayfa eklenirse
    buraya da ekleyin.

    OCR yalnızca kılavuz taramasının iki girişinde: cron turu ve Kılavuzlar
    sayfasının server action'ı. Belge Kontrol OCR'a hiç girmiyor
    (lib/document-extract.ts), oraya 8 MB'lık çekirdeği taşımak gereksiz.
  */
  outputFileTracingIncludes: {
    "/api/cron/guideline-refresh": [PDF_WORKER, ...OCR_ISCISI],
    "/dashboard/documents": [PDF_WORKER],
    "/dashboard/guidelines": [PDF_WORKER, ...OCR_ISCISI],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
