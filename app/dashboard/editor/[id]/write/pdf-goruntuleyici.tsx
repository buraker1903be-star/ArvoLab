"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Search, StretchHorizontal, LocateFixed, X } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { pasajParcalari } from "@/lib/pdf-pasaj";
import { kanitMetniNormallestir } from "@/lib/kanit/alinti";
import { olcekSinirla, OLCEK_ADIM } from "@/lib/pdf-goruntu";

/*
  PDF GÖRÜNTÜLEYİCİ (16.11.2026, Yazım Stüdyosu). pdf.js (pdfjs-dist
  5.4.296 — sunucudaki metin çıkarımının, pdf-parse'ın kullandığı sürümle
  AYNI; seçimin sunucuda doğrulanmasında boşluk farkı dışında fark kalmasın
  diye bilerek eşlendi).

  - PDF baytları /api/kaynak-pdf/<id>'den gelir: oturum ve RLS denetimli,
    önbelleksiz; depo adresi ya da imzalı bağlantı istemciye hiç gelmez.
  - Bellek: aynı anda TEK sayfa çizilir (kanvas + metin katmanı). Kanvasın
    piksel alanı sınırlanır (cihaz piksel oranı en fazla 2, alan en fazla
    ~16 MP): büyük sayfa yüksek yakınlaştırmada telefonu kilitlemesin.
  - Metin katmanı pdf.js'in TextLayer'ı: kanvasın üstünde görünmez, seçilebilir
    metin. Seçim bırakıldığında üst bileşene sayfa numarasıyla bildirilir;
    doğrulama sunucuda (lib/pdf-secim.ts).
  - Arama: sayfa metinleri ilk aramada bir kez çıkarılır ve bu oturumda
    saklanır; eşleşen sayfalar arasında ileri/geri gidilir, çizili sayfadaki
    eşleşen parçalar vurgulanır.
*/

const KANVAS_ALAN_SINIRI = 16_000_000;

type PdfJs = typeof import("pdfjs-dist");
type Pdf = { pdfjs: PdfJs; isci: InstanceType<PdfJs["PDFWorker"]> };
let pdfjsSozu: Promise<Pdf> | null = null;
/*
  pdf.js ve işçisi yalnızca görüntüleyici açılınca yüklenir; işçi aynı kökenden
  (CSP worker-src 'self'). İşçi BİR KEZ kurulur ve getDocument'a `worker` olarak
  verilir, belgeler onu sahiplenmez. İlk sürüm GlobalWorkerOptions.workerPort
  kullanıyordu: o durumda pdf.js işçi sarmalayıcısını yükleme görevine bağlıyor
  ve belge kapatılınca (panel kapanınca ya da kaynak değişince) sarmalayıcıyı da
  yok ediyor; aynı işçiyle ikinci kez açılan PDF "PDF açılamadı" veriyordu
  (tarayıcı kabulü M6: asistanı açıp PDF'e geri dönmek).
*/
function pdfjsYukle(): Promise<Pdf> {
  pdfjsSozu ??= import("pdfjs-dist").then((pdfjs) => ({
    pdfjs,
    isci: pdfjs.PDFWorker.create({ port: new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" }) }),
  }));
  return pdfjsSozu;
}

/** kutu: seçimin sayfa alanındaki (kaydırılan içerik) dikdörtgeni; seçim araç çubuğu onun altına konur. */
export type PdfSecimi = {
  sayfa: number;
  metin: string;
  /** Seçimin ve o anki GÖRÜNÜR alanın sayfa alanındaki (kaydırılan içerik) konumu; katman kenarlara göre yerleşir. */
  kutu?: { sol: number; ust: number; alt: number; genislik: number; alan: { sol: number; ust: number; genislik: number; yukseklik: number } };
};
/*
  Okuma konumu: PDF başına tutulur (kaynak-pdf-paneli.tsx), çekmece yeniden
  açılınca geri yüklenir. 20.11.2026'dan beri sayfa içi kaydırma da
  (kaydirma) saklanıyor: eskiden çekmece kapanıp açılınca doğru sayfa ama
  sayfanın en üstü açılıyordu.
*/
export type OkumaKonumu = { sayfa: number; olcek: number | "sigdir"; kaydirma?: { x: number; y: number } };

/*
  Pasaja kaydırma YALNIZCA PDF alanının içinde. Eskiden scrollIntoView
  kullanılıyordu: tarayıcı kaydırılabilir BÜTÜN ataları kaydırıyor, telefonda
  tam ekran PDF panelinin kendisi de yukarı kayıyor ve "Kaynak PDF" başlığı
  ile kapatma düğmesi ekrandan çıkıyordu; "inline: center" da okunur ölçekte
  ekrandan geniş olan cümlenin BAŞINI kesiyordu (kabul S15, 18.11.2026).
  Pasajın başı sola (12px payla), satırı dikeyde ortaya getirilir.
*/
function pasajaKaydir(alan: HTMLElement | null, parca: Element | null) {
  if (!alan || !parca) return;
  const a = alan.getBoundingClientRect();
  const p = parca.getBoundingClientRect();
  alan.scrollTo({
    left: Math.max(0, alan.scrollLeft + p.left - a.left - 12),
    top: Math.max(0, alan.scrollTop + p.top - a.top - (alan.clientHeight - p.height) / 2),
    behavior: "smooth",
  });
}

export default function PdfGoruntuleyici({
  pdfId,
  gidilecekSayfa,
  onSecim,
  konumAl,
  onKonum,
  onPasaj,
  onGidisUygulandi,
  katman,
  kaliciPasajlar,
  onSurum,
}: {
  pdfId: string;
  /**
   * Dışarıdan istenen sayfa (ör. asistanın alıntısındaki "PDF s. N"); değişince oraya gidilir.
   * `pasaj` verilirse (atıf kartının "Dayanağa git"i) o sayfada doğrulanmış metin bütünüyle
   * bulunursa vurgulanır; bulunamazsa hiçbir şey işaretlenmez (lib/pdf-pasaj.ts).
   */
  gidilecekSayfa?: { sayfa: number; anahtar: number; pasaj?: string; pdfId?: string } | null;
  /** Pasaj vurgusunun sonucu: bulundu mu (atıf kartı/panel kullanıcıya söyler). */
  onPasaj?: (bulundu: boolean) => void;
  /** "Git" isteği uygulandı: üst bileşen isteği düşürür, panel yeniden açılınca bayat istek kalmaz. */
  onGidisUygulandi?: (anahtar: number) => void;
  onSecim: (secim: PdfSecimi | null) => void;
  /** Bu PDF için hatırlanan konum (yoksa null). */
  konumAl?: (pdfId: string) => OkumaKonumu | null;
  /** Belge hazırken sayfa ya da yakınlaştırma değişince; konum PDF kimliğiyle bildirilir. */
  onKonum?: (pdfId: string, konum: OkumaKonumu) => void;
  /** Sayfa alanının içinde, sayfayla birlikte kayan katman (seçim araç çubuğu ve kısa onay; kaynak-pdf-paneli.tsx). */
  katman?: ReactNode;
  /**
   * Belgede kullanılmış pasajlar (lib/tiptap-pdf-dayanak.ts): fosforlu sarı
   * kalıcı vurgu. Her çizimde METİNLE bulunur (koordinat saklanmaz): yakınlaştırma,
   * yeniden boyutlandırma ve iki sütunlu düzende metinle hizalı kalır.
   */
  kaliciPasajlar?: { sayfa: number; metin: string }[];
  /** Yüklenen PDF'in sürümü (pdf.js parmak izi, içerikten): dosya değişince değişir. */
  onSurum?: (pdfId: string, surum: string) => void;
}) {
  const t = useCeviri();
  const [belge, setBelge] = useState<PDFDocumentProxy | null>(null);
  /* Yüklü belgenin hangi PDF'e ait olduğu: PDF değişirken bekleyen bir "git" isteği eski belgeye uygulanmasın. */
  const [belgeninPdfi, setBelgeninPdfi] = useState<string | null>(null);
  const [durum, setDurum] = useState<"yukleniyor" | "hazir" | "hata">("yukleniyor");
  const [sayfaNo, setSayfaNo] = useState(1);
  const [sayfaGirdi, setSayfaGirdi] = useState("1");
  const [olcek, setOlcek] = useState<number | "sigdir">(() => konumAl?.(pdfId)?.olcek ?? "sigdir");
  const [cizilenOlcek, setCizilenOlcek] = useState(1);
  const [arama, setArama] = useState("");
  /* Arama kutusu istenince açılır: araç satırı tek satır kalsın (20.11.2026, yoğunluk). */
  const [aramaAcik, setAramaAcik] = useState(false);
  /*
    Sayfa alanının genişliği: YALNIZCA "genişliğe sığdır" etkinken çizimi
    tetikler (aşağıda). Eskiden genişlik yalnızca ilk çizimde okunuyordu;
    çekmece genişletilince ya da tam ekrana alınınca sayfa eski genişlikte
    kalıyordu. Elle seçilen yakınlaştırma alan değişince EZİLMEZ.
  */
  const [alanGenisligi, setAlanGenisligi] = useState(0);
  const [eslesenler, setEslesenler] = useState<number[] | null>(null);
  const [araniyor, setAraniyor] = useState(false);
  const kapRef = useRef<HTMLDivElement>(null);
  const sayfaRef = useRef<HTMLDivElement>(null);
  const kanvasRef = useRef<HTMLCanvasElement>(null);
  const katmanRef = useRef<HTMLDivElement>(null);
  const metinlerRef = useRef<Map<number, string>>(new Map());
  const aramaTerimiRef = useRef("");
  /* Vurgulanacak pasaj durumda; çizim sonrası okunabilsin diye ref'e efektte aktarılır. */
  /*
    Pasaj hangi PDF için istendiyse onunla birlikte tutulur. Eskiden yalnızca
    sayfa ve metin tutuluyordu: başka bir PDF'e geçilince görüntüleyici aynı
    pasajı YENİ PDF'in o sayfasında arıyor ve "bulunamadı" diyordu (kabul S10).
  */
  const [pasajIstegi, setPasaj] = useState<{ sayfa: number; metin: string; pdfId: string } | null>(null);
  const pasaj = pasajIstegi && pasajIstegi.pdfId === pdfId ? pasajIstegi : null;
  const pasajRef = useRef<{ sayfa: number; metin: string } | null>(null);
  /*
    Pasaj sayfada bulundu mu (null: henüz bakılmadı). "Pasaja odaklan" yalnızca
    bulunduysa çıkar: ilk sürümde düğme pasaj İSTENİNCE çıkıyordu, bulunamayan
    pasajda kullanıcıyı işaretsiz bir sayfaya götürüyordu (kabul S10).
  */
  const [pasajBulundu, setPasajBulundu] = useState<boolean | null>(null);
  const onPasajRef = useRef(onPasaj);
  const onSurumRef = useRef(onSurum);
  const kaliciRef = useRef(kaliciPasajlar ?? []);
  useEffect(() => {
    onSurumRef.current = onSurum;
  }, [onSurum]);
  useEffect(() => {
    onPasajRef.current = onPasaj;
  }, [onPasaj]);

  /*
    PDF değişince görünür durum RENDER sırasında sıfırlanır (React'in "prop
    değişince durumu ayarla" kalıbı): effect içinde setState her kaynak
    değişiminde fazladan bir çizim turu demekti.
  */
  const [gosterilenPdf, setGosterilenPdf] = useState(pdfId);
  if (gosterilenPdf !== pdfId) {
    setGosterilenPdf(pdfId);
    setDurum("yukleniyor");
    setBelge(null);
    setEslesenler(null);
    // Yeni PDF kendi hatırlanan yakınlaştırmasıyla açılır; öncekinin değeri taşınmaz.
    setOlcek(konumAl?.(pdfId)?.olcek ?? "sigdir");
  }
  const konumAlRef = useRef(konumAl);
  useEffect(() => {
    konumAlRef.current = konumAl;
  }, [konumAl]);

  /* Yükleme: önbelleksiz istek; PDF değişince öncekinin işçi kaynakları bırakılır. */
  useEffect(() => {
    let iptal = false;
    let yuklenen: PDFDocumentProxy | null = null;
    metinlerRef.current = new Map();
    onSecim(null);
    (async () => {
      try {
        const yanit = await fetch(`/api/kaynak-pdf/${pdfId}`, { cache: "no-store", credentials: "same-origin" });
        if (!yanit.ok) throw new Error(String(yanit.status));
        const veri = new Uint8Array(await yanit.arrayBuffer());
        const { pdfjs, isci } = await pdfjsYukle();
        // isEvalSupported:false — PDF içindeki yazı tipi programları eval ile derlenmesin (güvenli varsayılan).
        const gorev = pdfjs.getDocument({ data: veri, isEvalSupported: false, worker: isci });
        yuklenen = await gorev.promise;
        if (iptal) {
          void yuklenen.destroy();
          return;
        }
        // Hatırlanan sayfa (panel yeniden açıldıysa), belgenin sayfa sayısına sıkıştırılarak.
        const ilk = Math.min(Math.max(1, Math.trunc(konumAlRef.current?.(pdfId)?.sayfa ?? 1)), yuklenen.numPages);
        setBelge(yuklenen);
        setBelgeninPdfi(pdfId);
        /*
          Sürüm = dosya baytlarının SHA-256 özeti. pdf.js'in parmak izi
          (fingerprints[0]) kullanılmadı: o değer PDF'in /ID alanından gelir ve
          dosyayı değiştiren araçların çoğu ilk kimliği KORUR; aynı künyeye
          yeni PDF yüklenince (kaynak_pdfleri satırı aynı kalır) eski
          koordinatlar yeni dosyada sessizce uygulanırdı.
        */
        void yuklenen
          .getData()
          .then((veri) => crypto.subtle.digest("SHA-256", new Uint8Array(veri)))
          .then((oz) => {
            if (iptal) return;
            const hex = Array.from(new Uint8Array(oz), (b) => b.toString(16).padStart(2, "0")).join("");
            onSurumRef.current?.(pdfId, `sha256:${hex.slice(0, 32)}`);
          })
          .catch(() => {
            /* Sürüm hesaplanamazsa işaret ne konur ne gösterilir (kaynak-pdf-paneli.tsx). */
          });
        setSayfaNo(ilk);
        setSayfaGirdi(String(ilk));
        setDurum("hazir");
      } catch {
        if (!iptal) setDurum("hata");
      }
    })();
    return () => {
      iptal = true;
      if (yuklenen) void yuklenen.destroy();
    };
    // onSecim üst bileşende kararlı değil; yalnızca PDF değişince yeniden yükle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfId]);

  /* Cevaptaki "PDF s. N" bağlantısı: her istek kendi anahtarıyla bir kez uygulanır (render sırasında, aynı kalıp). */
  /*
    Eskiden bağlanırken elde olan istek "uygulanmış" sayılıyordu (panel yeniden
    açılınca eski "PDF s. N" isteği hatırlanan sayfayı ezmesin diye). Ama PDF
    paneli KAPALIYKEN basılan "Dayanağa git" de paneli açıp görüntüleyiciyi
    yeni bağlıyor: istek bağlanırken elde olduğu için hiç uygulanmıyordu —
    telefonda (panel alıntı eklenince kapanır) PDF sığdırılmış 1. sayfada,
    vurgusuz açılıyordu (kabul S15, 18.11.2026). Artık uygulanan istek üst
    bileşene bildirilir ve orada düşürülür (onGidisUygulandi); panel yeniden
    açıldığında bayat istek yoktur, elde olan her istek yenidir.
  */
  const [uygulananGidis, setUygulananGidis] = useState<number | null>(null);
  useEffect(() => {
    if (uygulananGidis !== null) onGidisUygulandi?.(uygulananGidis);
  }, [uygulananGidis, onGidisUygulandi]);
  if (
    gidilecekSayfa &&
    belge &&
    belgeninPdfi === pdfId &&
    gosterilenPdf === pdfId &&
    (!gidilecekSayfa.pdfId || gidilecekSayfa.pdfId === pdfId) &&
    gidilecekSayfa.anahtar !== uygulananGidis
  ) {
    setUygulananGidis(gidilecekSayfa.anahtar);
    const n = Math.min(Math.max(1, gidilecekSayfa.sayfa), belge.numPages);
    // Yeni gidiş eski pasaj vurgusunu düşürür; pasaj yoksa vurgu da yok.
    setPasaj(gidilecekSayfa.pasaj ? { sayfa: n, metin: gidilecekSayfa.pasaj, pdfId } : null);
    setPasajBulundu(null);
    /* Telefonda pasaj okunur ölçekte açılır (2. tur, madde 4): sığdırılmış sayfa dar ekranda okunmuyordu. Görüntüleyici yalnızca tarayıcıda çizilir (ssr: false). */
    if (gidilecekSayfa.pasaj && window.innerWidth <= 760 && (olcek === "sigdir" || olcek < 1.6)) setOlcek(1.6);
    setSayfaNo(n);
    setSayfaGirdi(String(n));
  }

  /* Sayfa içi kaydırma: kayıt sayfa ya da yakınlaştırmayla birlikte bildirilir; sayfa değişince baştan. */
  const kaydirmaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sonSayfaRef = useRef(sayfaNo);
  useEffect(() => {
    if (sonSayfaRef.current !== sayfaNo) {
      sonSayfaRef.current = sayfaNo;
      kaydirmaRef.current = { x: 0, y: 0 };
    }
    if (durum === "hazir") onKonum?.(pdfId, { sayfa: sayfaNo, olcek, kaydirma: kaydirmaRef.current });
  }, [durum, pdfId, sayfaNo, olcek, onKonum]);
  const kaydirmaKaresi = useRef(0);
  const kaydirildi = () => {
    if (kaydirmaKaresi.current || durum !== "hazir") return;
    kaydirmaKaresi.current = window.requestAnimationFrame(() => {
      kaydirmaKaresi.current = 0;
      const kap = kapRef.current;
      // Gizliyken gelen kaydırma (0) saklanan konumu ezmesin.
      if (!kap || !geriYuklendiRef.current || kap.clientWidth === 0) return;
      kaydirmaRef.current = { x: Math.round(kap.scrollLeft), y: Math.round(kap.scrollTop) };
      onKonum?.(pdfId, { sayfa: sayfaNo, olcek, kaydirma: kaydirmaRef.current });
    });
  };
  /*
    Hatırlanan kaydırma PDF yüklendikten sonraki İLK çizimde bir kez
    uygulanır. O ana kadar kaydırma olayları kaydedilmez (geriYuklendiRef):
    yükleme sırasında alan boşken gelen "0" saklanan konumu ezerdi.
  */
  const geriYuklendiRef = useRef(false);
  useEffect(() => {
    geriYuklendiRef.current = false;
  }, [pdfId]);

  /* Sayfa alanının genişliği (yalnızca "sığdır" modunda çizimi etkiler). */
  useEffect(() => {
    const kap = kapRef.current;
    if (!kap || typeof ResizeObserver === "undefined") return;
    let kare = 0;
    let gizliydi = kap.clientWidth === 0;
    const gozlemci = new ResizeObserver(() => {
      /*
        GİZLENİP YENİDEN GÖRÜNÜNCE KAYDIRMA GERİ GELİR (20.11.2026). Çekmece
        kapanınca ya da AI görünümüne geçilince görüntüleyici sökülmüyor,
        gizleniyor; ama gizlenen (display:none) öğe kaydırma konumunu
        bırakıyor ve tarayıcı yeniden gösterirken 0'dan başlatıyor (kabulde
        ölçüldü: 240 → 0). Son bilinen konum geri yazılır.
      */
      if (kap.clientWidth === 0) {
        gizliydi = true;
        return;
      }
      if (gizliydi) {
        gizliydi = false;
        const { x, y } = kaydirmaRef.current;
        if (x || y) kap.scrollTo({ left: x, top: y });
      }
      if (kare) return;
      kare = window.requestAnimationFrame(() => {
        kare = 0;
        // 8 px'lik adım: sürükleme sırasında her pikselde yeniden çizilmesin.
        setAlanGenisligi(Math.round(kap.clientWidth / 8) * 8);
      });
    });
    gozlemci.observe(kap);
    return () => {
      gozlemci.disconnect();
      if (kare) window.cancelAnimationFrame(kare);
    };
  }, []);
  const sigdirGenisligi = olcek === "sigdir" ? alanGenisligi : 0;

  /* Çizili sayfadaki arama eşleşmelerini işaretler (parça düzeyinde). */
  const vurgula = useCallback(() => {
    const katman = katmanRef.current;
    if (!katman) return;
    const terim = aramaTerimiRef.current;
    for (const parca of Array.from(katman.querySelectorAll("span"))) {
      const esles = terim.length > 1 && kanitMetniNormallestir(parca.textContent ?? "").toLocaleLowerCase("tr").includes(terim);
      parca.classList.toggle("pdf-esles", esles);
    }
    /* Doğrulanmış pasaj: yalnızca istenen sayfada ve metin bütünüyle bulunursa. */
    const parcalar = Array.from(katman.querySelectorAll<HTMLSpanElement>("span:not(.markedContent)"));
    parcalar.forEach((p) => p.classList.remove("pdf-pasaj"));
    /* Kalıcı işaretler: bu sayfadaki her kullanılmış pasaj (birden çok olabilir). */
    parcalar.forEach((p) => p.classList.remove("pdf-kalici"));
    for (const k of kaliciRef.current) {
      if (katman.dataset.sayfa !== String(k.sayfa)) continue;
      pasajParcalari(parcalar.map((p) => p.textContent ?? ""), k.metin)?.forEach((i) => parcalar[i].classList.add("pdf-kalici"));
    }
    const pasaj = pasajRef.current;
    if (pasaj && katman.dataset.sayfa === String(pasaj.sayfa)) {
      const kapsanan = pasajParcalari(parcalar.map((p) => p.textContent ?? ""), pasaj.metin);
      kapsanan?.forEach((i) => parcalar[i].classList.add("pdf-pasaj"));
      if (kapsanan) pasajaKaydir(kapRef.current, parcalar[kapsanan[0]]);
      setPasajBulundu(Boolean(kapsanan));
      onPasajRef.current?.(Boolean(kapsanan));
    }
  }, []);

  /* Belgedeki işaretler değişince (ekleme, geri alma, silme) çizili sayfa yeniden boyanır. */
  const kaliciAnahtar = JSON.stringify(kaliciPasajlar ?? []);
  useEffect(() => {
    kaliciRef.current = JSON.parse(kaliciAnahtar) as { sayfa: number; metin: string }[];
    vurgula();
  }, [kaliciAnahtar, vurgula]);
  /* Aynı sayfaya gidişte sayfa yeniden çizilmez; pasaj vurgusu burada uygulanır (farklı sayfada çizim sonrası). */
  useEffect(() => {
    pasajRef.current = pasaj;
    vurgula();
  }, [pasaj, uygulananGidis, vurgula]);

  /* Sayfa çizimi: kanvas + metin katmanı; önceki çizim iptal edilir. */
  useEffect(() => {
    if (!belge) return;
    let iptal = false;
    let cizim: RenderTask | null = null;
    let katmanIsi: { cancel(): void } | null = null;
    (async () => {
      const { pdfjs } = await pdfjsYukle();
      const sayfa = await belge.getPage(sayfaNo);
      if (iptal) return;
      const birim = sayfa.getViewport({ scale: 1 });
      const genislik = Math.max(200, (kapRef.current?.clientWidth ?? 600) - 24);
      const hedef = olcek === "sigdir" ? olcekSinirla(genislik / birim.width) : olcek;
      const gorunum = sayfa.getViewport({ scale: hedef });
      const oran = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(KANVAS_ALAN_SINIRI / (gorunum.width * gorunum.height)));
      const kanvas = kanvasRef.current;
      const kap = sayfaRef.current;
      const katman = katmanRef.current;
      if (!kanvas || !kap || !katman) return;
      kanvas.width = Math.floor(gorunum.width * oran);
      kanvas.height = Math.floor(gorunum.height * oran);
      // Boyutlar DOM API'siyle (TSX'te satır içi stil yok; AGENTS.md "Stil").
      kap.style.setProperty("--total-scale-factor", String(hedef));
      kap.style.setProperty("--scale-round-x", "1px");
      kap.style.setProperty("--scale-round-y", "1px");
      kap.style.width = `${Math.floor(gorunum.width)}px`;
      kap.style.height = `${Math.floor(gorunum.height)}px`;
      cizim = sayfa.render({ canvas: kanvas, viewport: gorunum, transform: oran !== 1 ? [oran, 0, 0, oran, 0, 0] : undefined });
      katman.replaceChildren();
      const metinKatmani = new pdfjs.TextLayer({ textContentSource: sayfa.streamTextContent(), container: katman, viewport: gorunum });
      katmanIsi = metinKatmani;
      try {
        await Promise.all([cizim.promise, metinKatmani.render()]);
        if (!iptal) {
          setCizilenOlcek(hedef);
          katman.dataset.sayfa = String(sayfaNo);
          vurgula();
          if (!geriYuklendiRef.current) {
            geriYuklendiRef.current = true;
            const k = konumAlRef.current?.(pdfId);
            const alan = kapRef.current;
            if (alan && k?.kaydirma && k.sayfa === sayfaNo) {
              alan.scrollTo({ left: k.kaydirma.x, top: k.kaydirma.y });
              kaydirmaRef.current = k.kaydirma;
            }
          }
        }
      } catch {
        /* İptal edilen çizim (sayfa ya da ölçek değişti) hata değildir. */
      }
    })();
    return () => {
      iptal = true;
      cizim?.cancel();
      katmanIsi?.cancel();
    };
    // sigdirGenisligi: yalnızca "sığdır" modunda alan değişince yeniden çiz (elle seçilen ölçek ezilmez).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [belge, sayfaNo, olcek, vurgula, sigdirGenisligi]);

  /* Seçim bırakılınca: yalnızca metin katmanının içindeki seçim bildirilir. */
  /*
    Seçim bırakılınca bildirilir. Seçim KALDIRILINCA da (sayfaya tıklayıp
    boş bırakmak) bildirilir: eskiden boş seçimde erken dönülüyordu ve
    önceki seçimin kartı ekranda kalıyordu. Seçim araç çubuğunun içine
    yapılan tıklama (data-pdf-katman) seçimi düşürmez.
  */
  const secimiBildir = useCallback(
    (olay?: { target: EventTarget | null }) => {
      if (olay?.target instanceof Element && olay.target.closest("[data-pdf-katman]")) return;
      window.setTimeout(() => {
        const secim = window.getSelection();
        const katman = katmanRef.current;
        const kap = kapRef.current;
        const metin = secim?.toString().trim() ?? "";
        if (!secim || !katman || !kap || !metin || !secim.anchorNode || !katman.contains(secim.anchorNode)) {
          onSecim(null);
          return;
        }
        const r = secim.rangeCount ? secim.getRangeAt(0).getBoundingClientRect() : null;
        const a = kap.getBoundingClientRect();
        const kutu = r
          ? {
              sol: r.left - a.left + kap.scrollLeft,
              ust: r.top - a.top + kap.scrollTop,
              alt: r.bottom - a.top + kap.scrollTop,
              genislik: r.width,
              alan: { sol: kap.scrollLeft, ust: kap.scrollTop, genislik: kap.clientWidth, yukseklik: kap.clientHeight },
            }
          : undefined;
        onSecim({ sayfa: sayfaNo, metin, kutu });
      }, 0);
    },
    [onSecim, sayfaNo],
  );

  const sayfayaGit = (n: number) => {
    if (!belge) return;
    const hedef = Math.min(Math.max(1, Math.round(n)), belge.numPages);
    setSayfaNo(hedef);
    setSayfaGirdi(String(hedef));
  };

  const ara = async (e: FormEvent) => {
    e.preventDefault();
    if (!belge) return;
    const terim = kanitMetniNormallestir(arama).toLocaleLowerCase("tr");
    aramaTerimiRef.current = terim;
    if (terim.length < 2) {
      setEslesenler(null);
      vurgula();
      return;
    }
    setAraniyor(true);
    try {
      const bulunan: number[] = [];
      for (let n = 1; n <= belge.numPages; n++) {
        let metin = metinlerRef.current.get(n);
        if (metin === undefined) {
          const icerik = await (await belge.getPage(n)).getTextContent();
          metin = kanitMetniNormallestir(icerik.items.map((o) => ("str" in o ? o.str : "")).join(" ")).toLocaleLowerCase("tr");
          metinlerRef.current.set(n, metin);
        }
        if (metin.includes(terim)) bulunan.push(n);
      }
      setEslesenler(bulunan);
      const ilk = bulunan.find((n) => n >= sayfaNo) ?? bulunan[0];
      if (ilk) sayfayaGit(ilk);
      vurgula();
    } finally {
      setAraniyor(false);
    }
  };
  const eslesmeyeGit = (yon: 1 | -1) => {
    if (!eslesenler?.length) return;
    const sirali = yon === 1 ? eslesenler : [...eslesenler].reverse();
    const sonraki = sirali.find((n) => (yon === 1 ? n > sayfaNo : n < sayfaNo)) ?? sirali[0];
    sayfayaGit(sonraki);
  };

  const sayfaSayisi = belge?.numPages ?? 0;
  const yuzde = Math.round(cizilenOlcek * 100);

  return (
    <div className="pdf-goruntuleyici">
      <div className="pdf-arac" role="toolbar" aria-label={t({ tr: "PDF araçları", en: "PDF tools" })}>
        <div className="pdf-arac-grup">
          <button type="button" className="yazim-ikon" onClick={() => sayfayaGit(sayfaNo - 1)} disabled={!belge || sayfaNo <= 1} aria-label={t({ tr: "Önceki sayfa", en: "Previous page" })}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <label className="pdf-sayfa-girdi">
            <span className="sr-only">{t({ tr: "Sayfa", en: "Page" })}</span>
            <input
              className="field-control"
              inputMode="numeric"
              value={sayfaGirdi}
              onChange={(e) => setSayfaGirdi(e.target.value.replace(/\D/g, "").slice(0, 5))}
              onBlur={() => sayfayaGit(Number(sayfaGirdi) || sayfaNo)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sayfayaGit(Number(sayfaGirdi) || sayfaNo);
              }}
              disabled={!belge}
            />
            <span aria-hidden="true">/ {sayfaSayisi || "–"}</span>
          </label>
          <button type="button" className="yazim-ikon" onClick={() => sayfayaGit(sayfaNo + 1)} disabled={!belge || sayfaNo >= sayfaSayisi} aria-label={t({ tr: "Sonraki sayfa", en: "Next page" })}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="pdf-arac-grup">
          <button type="button" className="yazim-ikon" onClick={() => setOlcek(olcekSinirla(cizilenOlcek - OLCEK_ADIM))} disabled={!belge} aria-label={t({ tr: "Uzaklaştır", en: "Zoom out" })}>
            <Minus size={16} aria-hidden="true" />
          </button>
          <span className="pdf-yuzde" aria-live="polite">{yuzde}%</span>
          <button type="button" className="yazim-ikon" onClick={() => setOlcek(olcekSinirla(cizilenOlcek + OLCEK_ADIM))} disabled={!belge} aria-label={t({ tr: "Yakınlaştır", en: "Zoom in" })}>
            <Plus size={16} aria-hidden="true" />
          </button>
          <button type="button" className="yazim-ikon" onClick={() => setOlcek("sigdir")} disabled={!belge} aria-pressed={olcek === "sigdir"} aria-label={t({ tr: "Genişliğe sığdır", en: "Fit to width" })}>
            <StretchHorizontal size={16} aria-hidden="true" />
          </button>
          {/*
            PASAJA ODAKLAN (2. tur tasarımı, madde 4): doğrulanmış pasaj varken
            (atıf kartının "Dayanağa git"i) pasajın sayfasına döner, okunur bir
            ölçeğe (en az %160, telefonda dar sütunda küçük kalmasın) getirir ve
            vurgulu satırı ortalar. Pasaj yoksa düğme yok: işaretlenecek bir şey yok.
          */}
          {pasaj && pasajBulundu ? (
            <button
              type="button"
              className="yazim-ikon pdf-pasaja-odaklan"
              disabled={!belge}
              onClick={() => {
                if (sayfaNo !== pasaj.sayfa) sayfayaGit(pasaj.sayfa);
                if (cizilenOlcek < 1.6) setOlcek(1.6);
                else window.requestAnimationFrame(() => pasajaKaydir(kapRef.current, katmanRef.current?.querySelector(".pdf-pasaj") ?? null));
              }}
              aria-label={t({ tr: "Pasaja odaklan", en: "Focus on passage" })}
              title={t({ tr: "Pasaja odaklan", en: "Focus on passage" })}
            >
              <LocateFixed size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="yazim-ikon pdf-ara-ac"
          aria-expanded={aramaAcik}
          aria-controls={`pdf-ara-${pdfId}-form`}
          onClick={() => setAramaAcik((a) => !a)}
          disabled={!belge}
          aria-label={aramaAcik ? t({ tr: "Aramayı kapat", en: "Close search" }) : t({ tr: "PDF içinde ara", en: "Search in PDF" })}
          title={t({ tr: "PDF içinde ara", en: "Search in PDF" })}
        >
          {aramaAcik ? <X size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
        </button>
        <form id={`pdf-ara-${pdfId}-form`} className="pdf-ara" onSubmit={ara} role="search" hidden={!aramaAcik}>
          <label className="sr-only" htmlFor={`pdf-ara-${pdfId}`}>
            {t({ tr: "PDF içinde ara", en: "Search in PDF" })}
          </label>
          <input id={`pdf-ara-${pdfId}`} className="field-control" type="search" autoFocus value={arama} onChange={(e) => setArama(e.target.value)} placeholder={t({ tr: "PDF içinde ara", en: "Search in PDF" })} disabled={!belge} />
          <button type="submit" className="yazim-ikon" disabled={!belge || araniyor} aria-label={t({ tr: "Ara", en: "Search" })}>
            {araniyor ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          </button>
          {eslesenler ? (
            <span className="pdf-ara-sonuc" aria-live="polite">
              {eslesenler.length
                ? t({ tr: `${eslesenler.length} sayfada`, en: `on ${eslesenler.length} page(s)` })
                : t({ tr: "Bulunamadı", en: "Not found" })}
              {eslesenler.length > 1 ? (
                <>
                  <button type="button" className="yazim-ikon" onClick={() => eslesmeyeGit(-1)} aria-label={t({ tr: "Önceki eşleşme", en: "Previous match" })}>
                    <ChevronLeft size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="yazim-ikon" onClick={() => eslesmeyeGit(1)} aria-label={t({ tr: "Sonraki eşleşme", en: "Next match" })}>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </span>
          ) : null}
        </form>
      </div>

      <div className="pdf-sayfa-alani" ref={kapRef} onPointerUp={secimiBildir} onKeyUp={secimiBildir} onScroll={kaydirildi}>
        {durum === "yukleniyor" ? (
          <p className="pdf-durum" role="status">
            <Loader2 size={16} className="spin" aria-hidden="true" /> {t({ tr: "PDF yükleniyor…", en: "Loading PDF…" })}
          </p>
        ) : null}
        {durum === "hata" ? (
          <p className="pdf-durum" role="alert">
            {t({ tr: "PDF açılamadı. Bu çalışmaya erişiminiz olduğundan emin olun ve sayfayı yenileyin.", en: "The PDF couldn't be opened. Make sure you have access to this work and refresh the page." })}
          </p>
        ) : null}
        <div className="pdf-sayfa" ref={sayfaRef} data-sayfa={sayfaNo} hidden={durum !== "hazir"}>
          <canvas ref={kanvasRef} aria-hidden="true" />
          <div className="textLayer" ref={katmanRef} />
        </div>
        {katman}
      </div>
    </div>
  );
}
