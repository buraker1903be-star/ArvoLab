import type { NextConfig } from "next";
import { guvenlikBasliklari } from "./lib/guvenlik-basliklari";
import { onizlemeTakmalari } from "./lib/onizleme-takmalari";
import { anahtarAyrimiKarari, ortamGirdisi, supabaseOrtamKarari } from "./lib/supabase/ortam-guvenligi";

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
    Çekirdekler. worker-script/node/getCore.js wasm özellik algılamasına
    göre (relaxedsimd / simd / düz) birini istiyor; hangisi olacağı çalışma
    anında belli, bu yüzden hepsi izde.

    Eskiden yalnızca LSTM sürümleri listedeydi: createWorker'ın öntanımlı
    OEM'i LSTM_ONLY olduğu için getCore'un onları isteyeceği sanıldı. Oysa
    tesseract.js 7.0.0'da işçi getCore'a OEM sayısını değil `lstmOnly`
    BOOLEAN'ını geçiriyor (worker-script/index.js) ve getCore onu
    [OEM.DEFAULT, OEM.LSTM_ONLY] = [3, 1] içinde arıyor: true hiçbir zaman
    eşleşmiyor, Node'da HER ZAMAN tam çekirdek isteniyor. İşçi betiği pakete
    girdikten sonraki ilk gece (26.10.2026) tur
    "Cannot find module 'tesseract.js-core/tesseract-core-relaxedsimd'" ile
    düştü. LSTM sürümleri de kalıyor: kütüphane bu hatayı düzelttiği gün
    onlar istenecek. tests/unit/ocr-paketi.test.ts getCore'un istediği her
    dosyanın burada olduğunu sınıyor.

    *.wasm.js yedekleri (25 MB) bilerek dışarıda: onlar WebAssembly'nin
    hiç bulunmadığı ortam için ve Node 22'de o dal çalışmıyor.
  */
  "./node_modules/tesseract.js-core/package.json",
  "./node_modules/tesseract.js-core/tesseract-core.js",
  "./node_modules/tesseract.js-core/tesseract-core.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-lstm.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-simd.js",
  "./node_modules/tesseract.js-core/tesseract-core-simd.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-simd-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd.js",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm",
];

/*
  YEREL ÖNİZLEME (04.11.2026, `npm run onizleme`): Supabase istemcileri
  örnek veri döndüren sahteleriyle değiştirilir (scripts/onizleme/). Panel
  ekranları geliştirme makinesinde veritabanı ve oturum olmadan
  açılabilsin, tasarım görülerek yapılsın diye. Üretim derlemesinde
  bayrak açıksa derleme DURUR: sahte istemcinin canlıya çıkması, her
  sorgunun "başarılı" görünüp hiçbir şey yazmaması demek.
*/
/* Takmalar ve üretim yasağı tek yerde, testli (lib/onizleme-takmalari.ts); 4.3'te test asistanı eklendi. */
const ONIZLEME_TAKMALARI = onizlemeTakmalari(process.env);

/*
  SUPABASE ORTAM GÜVENLİĞİ — DERLEME ANI (Güvenli Test Ortamı, Aşama 1).
  Karar lib/supabase/ortam-guvenligi.ts'te. Ret varsa derleme (ve `next
  dev`, `next start`) DURUR: Vercel'de başarısız bir dağıtım öncekini
  canlıda bırakır, yani yanlış yapılandırılmış bir ortam hiç yayına
  çıkmaz. Tarayıcı istemcisi adresi derlemede gömdüğü için onun asıl
  korunması da budur; çalışma anındaki denetim (sunucu, ara katman,
  yönetim istemcisi) ikinci savunma hattı.
  Denetim yalnızca Next'in yapılandırmayı KULLANDIĞI evrelerde çalışır;
  dosyayı okuyan birim testleri (ocr-paketi) etkilenmez.
*/
// next/constants'taki PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER (test yükleyicisi alt yolu çözemediği için metin olarak).
const DENETLENEN_EVRELER = new Set<string>(["phase-development-server", "phase-production-build", "phase-production-server"]);
function ortamDenetimi() {
  const karar = supabaseOrtamKarari(ortamGirdisi(process.env));
  if (karar.tur === "red") throw new Error(`Supabase ortam güvenliği: ${karar.mesaj} (${karar.neden}). Ayrıntı: docs/test-ortami.md`);
  if (karar.uyari) console.warn(`[supabase-ortam] ${karar.uyari}`);
  /* Test ortamında üretimin AI, e-posta, cron ve köprü anahtarları kullanılmasın (beyan kuralı, aynı modül). */
  const anahtar = anahtarAyrimiKarari(process.env);
  if (anahtar.tur === "red") throw new Error(`Anahtar ayrımı: ${anahtar.mesaj} Ayrıntı: docs/test-ortami.md`);
}

const nextConfig: NextConfig = {
  ...(ONIZLEME_TAKMALARI ? { turbopack: { resolveAlias: ONIZLEME_TAKMALARI } } : {}),
  /*
    Tarayıcı istemcisinin ortam denetimi için gömülen değerler (lib/supabase/client.ts).
    YALNIZCA gizli olmayanlar: dağıtım türü, etiket ve proje kimlikleri (adresin
    parçası). Anahtarlar buraya ASLA eklenmez — burada yazılan her şey istemci
    paketine girer.
  */
  env: {
    ARVOLAB_DAGITIM_ORTAMI: process.env.VERCEL_ENV ?? "",
    ARVOLAB_SUPABASE_ORTAMI: process.env.ARVOLAB_SUPABASE_ORTAMI ?? "",
    ARVOLAB_URETIM_SUPABASE_REF: process.env.ARVOLAB_URETIM_SUPABASE_REF ?? "",
    ARVOLAB_TEST_SUPABASE_REF: process.env.ARVOLAB_TEST_SUPABASE_REF ?? "",
    ARVOLAB_ONIZLEME: process.env.ARVOLAB_ONIZLEME ?? "",
  },
  poweredByHeader: false,
  /* Güvenlik başlıkları her yanıtta; ne zorlandığı, ne yalnızca raporlandığı ve nedeni lib/guvenlik-basliklari.ts'te. */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: guvenlikBasliklari({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          gelistirme: process.env.NODE_ENV !== "production",
        }),
      },
    ];
  },
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
    (lib/document-extract.ts), oraya ~18 MB'lık çekirdekleri taşımak gereksiz.
  */
  outputFileTracingIncludes: {
    "/api/cron/guideline-refresh": [PDF_WORKER, ...OCR_ISCISI],
    "/dashboard/documents": [PDF_WORKER],
    /*
      ÜAK tablosu okuma (app/actions/uak-tablosu.ts) ve kaynak PDF'inde
      başlık eşleşmesi (app/actions/kaynak-pdf.ts) de PDF okuyor. İkisi de
      listede yoktu: ÜAK PDF'i 27.10.2026'da canlıda okunamadı.
    */
    "/dashboard/associate-professorship": [PDF_WORKER],
    "/dashboard/citations": [PDF_WORKER],
    /*
      Öğrencinin kendi kılavuzunu yüklemesi (app/actions/calisma-kilavuzu.ts →
      lib/guideline-scan.ts) aynı tarayıcıyı ve OCR'ı kullanıyor; işlem
      Çalışmalarım ve çalışma sayfalarından çağrılıyor. Katalog sayfası
      (26.10.2026'da kaldırıldı) listede olduğu için yöneticinin taraması
      çalışıyordu, öğrencinin taranmış PDF'i ise işçi dosyası pakette
      olmadığından düşebilirdi.
    */
    "/dashboard/editor": [PDF_WORKER, ...OCR_ISCISI],
    "/dashboard/editor/**": [PDF_WORKER, ...OCR_ISCISI],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

/* Next yapılandırmayı evresiyle birlikte çağırır; ortam denetimi burada. */
export default function yapilandirma(evre: string): NextConfig {
  if (DENETLENEN_EVRELER.has(evre)) ortamDenetimi();
  return nextConfig;
}
