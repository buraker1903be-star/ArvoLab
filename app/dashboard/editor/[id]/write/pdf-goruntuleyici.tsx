"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Search, StretchHorizontal } from "lucide-react";
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

export type PdfSecimi = { sayfa: number; metin: string };
/** Okuma konumu: PDF başına tutulur (kaynak-pdf-paneli.tsx), panel yeniden açılınca geri yüklenir. */
export type OkumaKonumu = { sayfa: number; olcek: number | "sigdir" };

export default function PdfGoruntuleyici({
  pdfId,
  gidilecekSayfa,
  onSecim,
  konumAl,
  onKonum,
  onPasaj,
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
  onSecim: (secim: PdfSecimi | null) => void;
  /** Bu PDF için hatırlanan konum (yoksa null). */
  konumAl?: (pdfId: string) => OkumaKonumu | null;
  /** Belge hazırken sayfa ya da yakınlaştırma değişince; konum PDF kimliğiyle bildirilir. */
  onKonum?: (pdfId: string, konum: OkumaKonumu) => void;
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
  const [eslesenler, setEslesenler] = useState<number[] | null>(null);
  const [araniyor, setAraniyor] = useState(false);
  const kapRef = useRef<HTMLDivElement>(null);
  const sayfaRef = useRef<HTMLDivElement>(null);
  const kanvasRef = useRef<HTMLCanvasElement>(null);
  const katmanRef = useRef<HTMLDivElement>(null);
  const metinlerRef = useRef<Map<number, string>>(new Map());
  const aramaTerimiRef = useRef("");
  /* Vurgulanacak pasaj durumda; çizim sonrası okunabilsin diye ref'e efektte aktarılır. */
  const [pasaj, setPasaj] = useState<{ sayfa: number; metin: string } | null>(null);
  const pasajRef = useRef<{ sayfa: number; metin: string } | null>(null);
  const onPasajRef = useRef(onPasaj);
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
  // Bağlanırken elde olan istek uygulanmış sayılır: panel yeniden açılınca eski "PDF s. N" isteği hatırlanan sayfayı ezmesin.
  const [uygulananGidis, setUygulananGidis] = useState<number | null>(() => gidilecekSayfa?.anahtar ?? null);
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
    setPasaj(gidilecekSayfa.pasaj ? { sayfa: n, metin: gidilecekSayfa.pasaj } : null);
    setSayfaNo(n);
    setSayfaGirdi(String(n));
  }

  useEffect(() => {
    if (durum === "hazir") onKonum?.(pdfId, { sayfa: sayfaNo, olcek });
  }, [durum, pdfId, sayfaNo, olcek, onKonum]);

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
    const pasaj = pasajRef.current;
    if (pasaj && katman.dataset.sayfa === String(pasaj.sayfa)) {
      const kapsanan = pasajParcalari(parcalar.map((p) => p.textContent ?? ""), pasaj.metin);
      kapsanan?.forEach((i) => parcalar[i].classList.add("pdf-pasaj"));
      if (kapsanan) parcalar[kapsanan[0]].scrollIntoView({ block: "center", behavior: "smooth" });
      onPasajRef.current?.(Boolean(kapsanan));
    }
  }, []);

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
  }, [belge, sayfaNo, olcek, vurgula]);

  /* Seçim bırakılınca: yalnızca metin katmanının içindeki seçim bildirilir. */
  const secimiBildir = useCallback(() => {
    window.setTimeout(() => {
      const secim = window.getSelection();
      const katman = katmanRef.current;
      const metin = secim?.toString().trim() ?? "";
      if (!secim || !katman || !metin || !secim.anchorNode || !katman.contains(secim.anchorNode)) return;
      onSecim({ sayfa: sayfaNo, metin });
    }, 0);
  }, [onSecim, sayfaNo]);

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
        </div>
        <form className="pdf-ara" onSubmit={ara} role="search">
          <label className="sr-only" htmlFor={`pdf-ara-${pdfId}`}>
            {t({ tr: "PDF içinde ara", en: "Search in PDF" })}
          </label>
          <input id={`pdf-ara-${pdfId}`} type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder={t({ tr: "PDF içinde ara", en: "Search in PDF" })} disabled={!belge} />
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

      <div className="pdf-sayfa-alani" ref={kapRef} onPointerUp={secimiBildir} onKeyUp={secimiBildir}>
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
      </div>
    </div>
  );
}
