"use client";

import { pdfIsaretleri, type PdfDayanagi } from "@/lib/tiptap-pdf-dayanak";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Editor } from "@tiptap/react";
import { BookOpenCheck, Copy, FileText, Link2, Loader2, Maximize2, Minimize2, Quote, ShieldCheck, Sparkles, X } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { useOturumDurumu } from "@/app/_components/oturum-durumu";
import { goruntuleyiciKaynaklari, kaynakSecimiDogrula, pdfKaynaginiBagla } from "@/app/actions/kaynak-pdf";
import { kaynaklaSohbet, type KaynakSohbetYaniti } from "@/app/actions/ai-kaynak-sohbeti";
import { getLiteratureSources, type LiteratureSource } from "@/app/actions/literature";
import { kunyeBasligi, type KaynakPdfSatiri } from "@/lib/kaynak-pdf";
import { kaynakEslesmesi, SECIM_EN_KISA, type KaynakEslesmesi } from "@/lib/pdf-secim";
import { SECIM_ANALIZ_SORUSU, type KaynakMesaji } from "@/lib/ai/kaynak-sohbeti";
import type { OkumaKonumu, PdfSecimi } from "./pdf-goruntuleyici";

/*
  KAYNAK PDF PANELİ — YAZIM STÜDYOSU (16.11.2026). Tek yolculuk:
  Kaynaklar → PDF aç → editörün yanında oku → pasaj seç → Arvo AI ile
  analiz et → doğrulanmış atfı kullanıcı onayıyla ekle.

  Yeni bir AI sistemi YOK: analiz mevcut "kaynakla sohbet" yeteneğinin
  (app/actions/ai-kaynak-sohbeti.ts) aynısı — aynı abonelik ve hak kapısı,
  aynı kayıt, aynı ret kuralları (alıntı kaynakta birebir, sayı kaynakta).
  Cevap panelde kalır, belgeye kendiliğinden girmez (AGENTS.md).

  Atıf mevcut yoldan girer (manuscript-editor.tsx handleCite → CSL/stil,
  kaynakça, dipnot): bu panel yalnızca HANGİ kaynakla ve hangi basılı
  sayfayla çağrılacağına karar verir. Kaynak eşleşmesi lib/pdf-secim.ts:
  DOI ile tek kayıt → kesin; aksi hâlde adaylar gösterilir ve kullanıcı
  açıkça seçip onaylamadan atıf eklenmez. Sayfa numarasını kullanıcı yazar:
  PDF'in sayfa sırası, makalenin basılı sayfa numarası değildir.

  Belgeye girebilecek tek kaynak metni ALINTI'dır ve o da istemcinin
  seçimi değil, sunucunun PDF metninden doğruladığı kanonik parçadır.
  Asistanın yazdığı metin belgeye bu panelden eklenmez; bu yüzden asistan
  izi gerekmiyor (eklenen alıntı kaynağın kendi sözü, asistanın değil).
*/

const PdfGoruntuleyici = dynamic(() => import("./pdf-goruntuleyici"), { ssr: false });

type Analiz = { soru: string; yanit: KaynakSohbetYaniti };
type AtifDurumu =
  | { adim: "dogrulaniyor" }
  | { adim: "hazir"; alinti: string; pdfSayfa: number; eslesme: KaynakEslesmesi; kaynaklar: LiteratureSource[] }
  | { adim: "hata"; mesaj: string };

const ozet = (metin: string, uzunluk = 180) => (metin.length > uzunluk ? `${metin.slice(0, uzunluk).trimEnd()}…` : metin);

export default function KaynakPdfPaneli({
  projectId,
  acik,
  acilacak = null,
  onBagDegisti,
  dayanaklar = [],
  onKapat,
  onCite,
  genislik,
  onGenislik,
}: {
  editor: Editor;
  projectId: string;
  acik: boolean;
  /** Kaynaklar aracından "PDF'i aç" (sol-araclar.tsx): panel bu PDF'le açılır. */
  acilacak?: { id: string; anahtar: number; sayfa?: number; pasaj?: string } | null;
  /**
   * Belgede kullanılmış PDF pasajları (editörün belgesinden, lib/tiptap-pdf-dayanak.ts).
   * 20.11.2026'ya kadar "Dayanağa git" yalnızca bu oturumda eklenen pasajları
   * biliyordu (bellekte); sayfa yenilenince kayboluyordu. Artık belgeden okunur.
   */
  dayanaklar?: PdfDayanagi[];
  /** PDF'in kaynak bağı değişince (K2-A): editör atıf kartının verisini tazeler. */
  onBagDegisti?: () => void;
  onKapat: () => void;
  /* Sonuç döner: atıf üretilemezse panel açık kalır ve belge değişmez (20.11.2026). */
  onCite: (
    source: LiteratureSource,
    secenek: { sayfa?: string | null; alinti?: string | null; kayitliKonum?: boolean; onizle?: boolean; dayanak?: PdfDayanagi | null },
  ) => Promise<{ ok: true; atif?: string } | { ok: false; hata: string }>;
  /** Çekmecenin şu anki genişliği (px) ve kenardan çekilince yeni değer; kaydet: bırakınca kalıcı. */
  genislik?: number;
  onGenislik?: (px: number, kaydet: boolean) => void;
}) {
  const t = useCeviri();
  const kokRef = useRef<HTMLElement>(null);
  /* Tam ekran (masaüstü): çekmece bütün genişliği alır; kapanınca bir sonraki açılışta yine normal. */
  const [tamEkran, setTamEkran] = useState(false);
  /* Çekmecenin içindeki görünüm: PDF ya da bu PDF'e sorular (Arvo AI). PDF görünümü gizlenir, sökülmez. */
  const [gorunum, setGorunum] = useState<"pdf" | "ai">("pdf");
  /* Kısa durum özetinin ayrıntıları (kaynak bağı); varsayılan kapalı. */
  const [ayrintiAcik, setAyrintiAcik] = useState(false);
  /* Bu oturumda eklenen son doğrulanmış alıntı: durum özetinin "Alıntı" satırı. */
  const [sonAlinti, setSonAlinti] = useState<{ pdfId: string; sayfa: number } | null>(null);

  /*
    Çekmece açılınca odak çekmeceye geçer (ekran okuyucu adını okur, Tab
    içindeki denetimlere gider); kapanınca editör odağı geri alır
    (manuscript-editor.tsx pdfKapat). Çekmece kapalıyken SÖKÜLMEZ: PDF'in
    sayfası, yakınlaştırması, kaydırması ve sorular yerinde kalır.
  */
  const [oncekiAcik, setOncekiAcik] = useState(acik);
  if (acik !== oncekiAcik) {
    setOncekiAcik(acik);
    if (!acik) setTamEkran(false);
  }
  useEffect(() => {
    if (!acik) return;
    const kare = window.requestAnimationFrame(() => {
      if (kokRef.current && !kokRef.current.contains(document.activeElement)) kokRef.current.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(kare);
  }, [acik]);

  const [liste, setListe] = useState<KaynakPdfSatiri[] | null>(null);
  const [listeHatasi, setListeHatasi] = useState<string | null>(null);
  /*
    Seçili PDF ve okuma konumu SEKME OTURUMUNDA (19.11.2026): başka bir
    çalışma sayfasına gidip dönen ya da sayfayı yenileyen öğrenci aynı PDF'in
    aynı sayfasına döner. Eskiden konum yalnızca bellekteydi; editörden
    çıkmak PDF'i ilk kaynağın ilk sayfasına döndürüyordu.
  */
  const [pdfId, setPdfId] = useOturumDurumu<string>(`arvolab.pdf.${projectId}.secili`, "");
  const [konumlar, setKonumlar] = useOturumDurumu<Record<string, OkumaKonumu>>(`arvolab.pdf.${projectId}.konumlar`, {});
  const [secim, setSecim] = useState<PdfSecimi | null>(null);
  const [gidilecek, setGidilecek] = useState<{ sayfa: number; anahtar: number; pasaj?: string; pdfId?: string } | null>(null);
  /* "Dayanağa git"in sonucu: pasaj sayfada bulundu mu. Bulunamadıysa söylenir, hiçbir yer işaretlenmez. */
  const [pasajSonucu, setPasajSonucu] = useState<boolean | null>(null);
  const [soru, setSoru] = useState("");
  const [analizler, setAnalizler] = useState<Analiz[]>([]);
  const [soruluyor, setSoruluyor] = useState(false);
  /* Bekleyişi durdurma; gerekçe yazim-paneli.tsx'teki istekSira yorumunda. Sunucu çağrısı iptal edilmez, geç gelen cevap sohbete girmez. */
  const istekSira = useRef(0);
  const [atif, setAtif] = useState<AtifDurumu | null>(null);
  const [secilenKaynak, setSecilenKaynak] = useState<string>("");
  const [onay, setOnay] = useState(false);
  const [basiliSayfa, setBasiliSayfa] = useState("");
  const [alintiEkle, setAlintiEkle] = useState(true);
  const [ekleniyor, setEkleniyor] = useState(false);

  /*
    ATIF ÖNİZLEMESİ (20.11.2026): onay katmanında belgeye eklenecek TAM atıf
    ("(Fisher ve Other, 2023, s. 214)"). Ekle ile aynı yoldan, belgeye
    yazmadan kurulur (manuscript-editor.tsx handleCite, onizle). Kaynak ya da
    basılı sayfa değişince yenilenir; basılı sayfa yazılırken bekler.
  */
  const [onizleme, setOnizleme] = useState<{ anahtar: string; atif: string | null; hata?: string } | null>(null);
  /*
    TELEFONDA ÇEKMECE BÜTÜN EKRANI ÖRTER (20.11.2026, kurum sahibinin
    isteği). 19.11.2026'dan beri alt gezinmenin ÜSTÜNDE bitiyordu; arkadaki
    sayfa da kaydırılabiliyordu (parmak PDF'in kenarından kaçınca belge
    kayıyordu). Açıkken kök öğe işaretlenir: CSS gövdenin kaydırmasını keser,
    çekmece alt gezinme dahil her şeyin üstüne çıkar.
  */
  useEffect(() => {
    if (!acik) return;
    const dar = window.matchMedia("(max-width: 760px)");
    const kok = document.documentElement;
    const uygula = () => (dar.matches ? kok.setAttribute("data-pdf-tam-ekran", "") : kok.removeAttribute("data-pdf-tam-ekran"));
    uygula();
    dar.addEventListener("change", uygula);
    return () => {
      dar.removeEventListener("change", uygula);
      kok.removeAttribute("data-pdf-tam-ekran");
    };
  }, [acik]);
  const secimiBirak = useCallback(() => {
    setSecim(null);
    setAtif(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    if (!acik || liste) return;
    let iptal = false;
    void goruntuleyiciKaynaklari(projectId).then((sonuc) => {
      if (iptal) return;
      if ("hata" in sonuc) {
        setListeHatasi(sonuc.hata);
        return;
      }
      setListe(sonuc.satirlar);
      // Saklanan seçim artık listede yoksa (PDF silindi) ilk kaynağa düşülür.
      if (sonuc.satirlar.length) setPdfId((onceki) => (onceki && sonuc.satirlar.some((r) => r.id === onceki) ? onceki : sonuc.satirlar[0].id));
    });
    return () => {
      iptal = true;
    };
  }, [acik, liste, projectId, setPdfId]);

  const pdf = useMemo(() => liste?.find((r) => r.id === pdfId) ?? null, [liste, pdfId]);

  const pdfDegisti = (id: string) => {
    setPdfId(id);
    setSecim(null);
    setAnalizler([]);
    setAtif(null);
    // Önceki PDF'in cevabındaki "PDF s. N" isteği yeni belgeye taşınmasın.
    setGidilecek(null);
    /* Eskiden PDF değiştirilince önceki PDF'in "pasaj işaretlendi" bildirimi yeni PDF'in üstünde kalıyordu. */
    setPasajSonucu(null);
  };

  /*
    OKUMA KONUMU (17.11.2026, RELEASE CLOSURE 05): görüntüleyici panel
    kapanınca sökülüyor (asistan açılınca PDF paneli kapanır); yeniden
    açılınca 1. sayfaya ve varsayılan yakınlaştırmaya dönüyordu. Sayfa ve
    yakınlaştırma PDF BAŞINA burada tutulur (panel bileşeni kapalıyken de
    yaşıyor): bir PDF'in konumu başka bir PDF'e taşınmaz.
  */
  const konumlarRef = useRef(konumlar);
  useEffect(() => {
    konumlarRef.current = konumlar;
  }, [konumlar]);
  const konumDegisti = useCallback(
    (id: string, konum: OkumaKonumu) => {
      setKonumlar((onceki) => ({ ...onceki, [id]: konum }));
    },
    [setKonumlar],
  );
  const konumAl = useCallback((id: string) => konumlarRef.current[id] ?? null, []);

  /* PDF sürümleri (dosyanın SHA-256 özeti), görüntüleyici yükleyince bildirir. */
  const [surumlar, setSurumlar] = useState<Record<string, string>>({});
  const surumGeldi = useCallback((id: string, surum: string) => setSurumlar((o) => (o[id] === surum ? o : { ...o, [id]: surum })), []);
  const isaretler = pdf ? pdfIsaretleri(dayanaklar, pdf.id, surumlar[pdf.id] ?? null) : null;
  /* Dışarıdan istenen PDF (Kaynaklar aracı): anahtar her istekte değişir, aynı PDF'e ikinci basış da işler. */
  const [islenenAcilis, setIslenenAcilis] = useState<number | null>(null);
  /* İstenen PDF bu çalışmanın listesinde yoksa (silinmiş, başka çalışmanın, henüz işlenmemiş) panel bunu SÖYLER; sessizce başka PDF'te kalmaz. */
  const [acilamayanPdf, setAcilamayanPdf] = useState(false);
  if (acilacak && acilacak.anahtar !== islenenAcilis && liste) {
    setIslenenAcilis(acilacak.anahtar);
    setAcilamayanPdf(!liste.some((r) => r.id === acilacak.id));
    if (liste.some((r) => r.id === acilacak.id)) {
      if (acilacak.id !== pdfId) {
        setPdfId(acilacak.id);
        setSecim(null);
        setAnalizler([]);
        setAtif(null);
      }
      setPasajSonucu(null);
      setGidilecek(acilacak.sayfa ? { sayfa: acilacak.sayfa, anahtar: acilacak.anahtar, pasaj: acilacak.pasaj, pdfId: acilacak.id } : null);
    }
  }

  /* Uygulanan "git" isteği düşer: yalnızca aynı istekse (bu arada yenisi geldiyse o kalır). */
  const gidisUygulandi = useCallback((anahtar: number) => setGidilecek((g) => (g?.anahtar === anahtar ? null : g)), []);

  /* Görüntüleyici seçim bildirdiğinde: yeni seçim önceki atıf adımını sıfırlar. */
  const secimGeldi = useCallback((yeni: PdfSecimi | null) => {
    setSecim(yeni);
    setAtif(null);
  }, []);

  const sor = async (e?: FormEvent, hazirSoru?: string) => {
    e?.preventDefault();
    if (!pdf || soruluyor) return;
    const metin = (hazirSoru ?? soru).trim();
    if (metin.length < 3) return;
    setSoruluyor(true);
    /*
      Geçmişe yalnızca soru ve cevap METNİ girer, alıntılar GİRMEZ
      (21.11.2026, gerçek AI kabulü bulgusu): önceki turun kanıtı yeni
      sorunun kanıtı değildir. Her cevabın alıntıları kendi `yanit`inde
      durur ve yalnızca kendi kartının altında çizilir (aşağıdaki liste);
      hiçbir yerde sonraki cevaba taşınmaz.
    */
    const gecmis: KaynakMesaji[] = analizler.flatMap((a) => (a.yanit.cevap ? [{ rol: "kullanici" as const, metin: a.soru }, { rol: "asistan" as const, metin: a.yanit.cevap }] : [])).slice(-6);
    const sira = ++istekSira.current;
    const guncel = () => sira === istekSira.current;
    try {
      const yanit = await kaynaklaSohbet({ projectId, pdfId: pdf.id, soru: metin, gecmis, secim: secim && secim.metin.length >= SECIM_EN_KISA ? secim : null });
      if (!guncel()) return;
      setAnalizler((onceki) => [...onceki, { soru: metin, yanit }]);
      if (!yanit.hata) setSoru("");
    } catch {
      if (!guncel()) return;
      setAnalizler((onceki) => [...onceki, { soru: metin, yanit: { hata: t({ tr: "Asistana ulaşılamadı; tekrar deneyin.", en: "Couldn't reach the assistant; try again." }) } }]);
    } finally {
      if (guncel()) setSoruluyor(false);
    }
  };

  /* Bekleyişi durdurur; geç gelen cevap listeye girmez. */
  const soruyuDurdur = () => {
    istekSira.current += 1;
    setSoruluyor(false);
    setAnalizler((onceki) => [
      ...onceki,
      {
        soru: "",
        yanit: {
          hata: t({
            tr: "Bekleme bırakıldı. İstek sağlayıcıda sürer ve ücreti doğar; iptal edilmedi. Gelen cevap gösterilmeyecek; yeniden sorabilirsiniz.",
            en: "Stopped waiting. The request keeps running at the provider and is still billed; it was not cancelled. The answer won't be shown; you can ask again.",
          }),
        },
      },
    ]);
  };

  const onizlemeKaynagi = atif?.adim === "hazir" ? atif.kaynaklar.find((k) => k.id === secilenKaynak) ?? null : null;
  const onizlemeAnahtari = onizlemeKaynagi ? `${onizlemeKaynagi.id}|${basiliSayfa.trim()}` : "";
  useEffect(() => {
    if (!onizlemeKaynagi) return;
    let iptal = false;
    const zaman = window.setTimeout(() => {
      void onCite(onizlemeKaynagi, { sayfa: basiliSayfa.trim() || null, kayitliKonum: true, onizle: true })
        .then((r) => {
          if (!iptal) setOnizleme({ anahtar: onizlemeAnahtari, atif: r.ok ? r.atif ?? null : null, hata: r.ok ? undefined : r.hata });
        })
        .catch(() => {
          if (!iptal) setOnizleme({ anahtar: onizlemeAnahtari, atif: null, hata: t({ tr: "Atıf önizlemesi kurulamadı.", en: "The citation preview couldn't be built." }) });
        });
    }, 250);
    return () => {
      iptal = true;
      window.clearTimeout(zaman);
    };
    // Önizleme yalnızca kaynak ya da basılı sayfa değişince yenilenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onizlemeAnahtari]);
  const guncelOnizleme = onizleme && onizleme.anahtar === onizlemeAnahtari ? onizleme : null;

  /* alintiMi: "Alıntı ekle" (alıntı + atıf) ya da "Yalnızca atıf". */
  const atifBaslat = async (alintiMi: boolean) => {
    if (!pdf || !secim) return;
    setAlintiEkle(alintiMi);
    setAtif({ adim: "dogrulaniyor" });
    setSecilenKaynak("");
    setOnay(false);
    setBasiliSayfa("");
    const [dogrulama, kutuphane] = await Promise.all([
      kaynakSecimiDogrula({ projectId, pdfId: pdf.id, sayfa: secim.sayfa, metin: secim.metin }),
      getLiteratureSources(),
    ]);
    if ("hata" in dogrulama) {
      setAtif({ adim: "hata", mesaj: dogrulama.hata });
      return;
    }
    if (kutuphane.okunamadi) {
      setAtif({ adim: "hata", mesaj: t({ tr: "Literatür kütüphaneniz okunamadı; sayfayı yenileyip tekrar deneyin.", en: "Your Literature library couldn't be read; refresh and try again." }) });
      return;
    }
    const eslesme = kaynakEslesmesi({ doi: pdf.doi, baslik: kunyeBasligi(pdf.kunye) || pdf.kunye, kaynakId: pdf.kaynak_id ?? null }, kutuphane.satirlar, projectId);
    if (eslesme.tur === "kesin") setSecilenKaynak(eslesme.kaynakId);
    setAtif({ adim: "hazir", alinti: dogrulama.metin, pdfSayfa: dogrulama.sayfa, eslesme, kaynaklar: kutuphane.satirlar });
  };

  const atifEkle = async () => {
    if (atif?.adim !== "hazir" || ekleniyor) return;
    const kaynak = atif.kaynaklar.find((k) => k.id === secilenKaynak);
    if (!kaynak) return;
    if (atif.eslesme.tur !== "kesin" && !onay) return;
    setEkleniyor(true);
    try {
      /*
        Alıntı ile atıf TEK işlemde ve öğrencinin editörde bıraktığı yere
        (manuscript-editor.tsx handleCite). Eskiden alıntı burada önce, önüne
        boşluk konmadan yazılıyor; atıf üretilemezse alıntı belgede atıfsız
        kalıyor ve panel yine "eklendi" gibi kapanıyordu.
      */
      /*
        KALICI İŞARET (20.11.2026): doğrulanmış pasaja bağlı ekleme, alıntı ve
        atfı görünmez pdfDayanak işaretiyle yazar; PDF'teki sarı vurgu belgedeki
        bu işaretten türer. İşaret eklemeyle AYNI işlemde: ekleme başarısızsa
        işaret de yok. Sürüm (dosya özeti) bilinmiyorsa işaret konmaz.
      */
      const surum = pdf ? surumlar[pdf.id] : undefined;
      const dayanak = pdf && surum ? { pdf: pdf.id, surum, sayfa: atif.pdfSayfa, pasaj: atif.alinti, kaynak: kaynak.id } : null;
      const sonuc = await onCite(kaynak, { sayfa: basiliSayfa.trim() || null, alinti: alintiEkle ? atif.alinti : null, kayitliKonum: true, dayanak });
      if (!sonuc.ok) {
        setAtif({ adim: "hata", mesaj: sonuc.hata });
        return;
      }
      if (pdf && alintiEkle) setSonAlinti({ pdfId: pdf.id, sayfa: atif.pdfSayfa });
      secimiBirak();
      /*
        Çekmece AÇIK KALIR (20.11.2026): öğrenci aynı PDF'ten okumaya ve
        alıntılamaya devam edebilir; eklenen metin arkadaki belgede, kayıtlı
        konumda. Eskiden çekmece eklemeden sonra kapanıyordu. Telefonda tam
        ekran olduğu için belgeyi görmek üzere kapanır.
      */
      if (window.matchMedia("(max-width: 760px)").matches) onKapat();
    } finally {
      setEkleniyor(false);
    }
  };

  const eslesmeMetni = (e: KaynakEslesmesi): string => {
    if (e.tur === "kesin" && e.neden === "bag") return t({ tr: "Bu PDF'i bu kaynak kaydına siz bağladınız.", en: "You linked this PDF to this source record." });
    if (e.tur === "kesin") return t({ tr: "Kaynak DOI ile Literatür kütüphanenizdeki tek kayıtla eşleşti.", en: "The source matched a single record in your Literature library by DOI." });
    if (e.neden === "doi_coklu") return t({ tr: "Bu DOI kütüphanenizde birden çok kayıtta var. Hangisi olduğunu seçin.", en: "This DOI appears in several records in your library. Choose which one it is." });
    if (e.tur === "belirsiz")
      return t({
        tr: "Kaynak kesin olarak eşleşmedi (DOI yok ya da kütüphanede bulunamadı). Başlığı benzeyen kayıtlar aşağıda; doğru olanı kendiniz seçip onaylayın.",
        en: "The source didn't match with certainty (no DOI or not found in your library). Records with similar titles are below; choose and confirm the right one yourself.",
      });
    return t({
      tr: "Bu PDF'in kaynağı Literatür kütüphanenizde bulunamadı. Önce kaynağı Literatür'e ekleyin; sonra atfı buradan ekleyebilirsiniz.",
      en: "This PDF's source wasn't found in your Literature library. Add the source to Literature first; then you can insert the citation here.",
    });
  };

  /* Kaynak kaydının kısa adı (çekmece başlığı ve onay katmanı): "Fisher, E. W. (2023)" ya da künyenin başı. */
  const kisaAd = (r: KaynakPdfSatiri) => {
    // "Fisher, E. W., & Other, J. (2023). Başlık. Dergi." → "Fisher, E. W., & Other, J. (2023) · Başlık"
    const yazarYil = /^(.*?\(\s*\d{4}[a-z]?\s*\))/.exec(r.kunye)?.[1];
    const baslik = kunyeBasligi(r.kunye);
    return yazarYil && baslik ? `${ozet(yazarYil, 60)} · ${baslik}` : ozet(r.kunye, 110);
  };

  /*
    KATMANIN YERİ (20.11.2026): seçimin altında; görünür alanın kenarlarına
    göre sıkıştırılır. Sağ kenara yakın seçimde sola kayar; seçim görünür
    alanın altına yakınsa (ya da uzun seçimin sonu ekran dışındaysa) seçimin
    üstüne, o da sığmazsa görünür alanın altına sabitlenir. Boyutu çizildikten
    sonra ölçülür (onay katmanı araç çubuğundan uzun).
  */
  const katmanRef = (el: HTMLDivElement | null) => {
    const k = secim?.kutu;
    if (!el || !k) return;
    const W = el.offsetWidth;
    const H = el.offsetHeight;
    const pay = 8;
    const solEnAz = k.alan.sol + pay;
    const solEnCok = Math.max(solEnAz, k.alan.sol + k.alan.genislik - W - pay);
    const sol = Math.min(Math.max(k.sol, solEnAz), solEnCok);
    const gorunurAlt = k.alan.ust + k.alan.yukseklik - pay;
    let ust = k.alt + pay;
    if (ust + H > gorunurAlt) ust = k.ust - H - pay >= k.alan.ust + pay ? k.ust - H - pay : Math.max(k.alan.ust + pay, gorunurAlt - H);
    // Konum DOM API'siyle (TSX'te satır içi stil yok, check:css).
    el.style.setProperty("--katman-ust", `${Math.round(ust)}px`);
    el.style.setProperty("--katman-sol", `${Math.round(sol)}px`);
  };
  const kisaSecim = Boolean(secim && secim.metin.length < SECIM_EN_KISA);

  const secimKatmani = secim && pdf ? (
    <div
      ref={katmanRef}
      className="pdf-secim-katmani"
      data-pdf-katman=""
      data-konumlu={secim?.kutu ? "" : undefined}
      role="group"
      aria-label={t({ tr: "Seçili pasaj", en: "Selected passage" })}
    >
      {!atif ? (
        <div className="pdf-secim-arac" role="toolbar" aria-label={t({ tr: "Seçimle yapılacaklar", en: "Actions for the selection" })}>
          {kisaSecim ? (
            <span className="pdf-secim-not">{t({ tr: "Alıntı için biraz daha uzun bir pasaj seçin.", en: "Select a slightly longer passage to quote it." })}</span>
          ) : (
            <>
              <button type="button" onClick={() => void atifBaslat(true)}>
                <Quote size={14} aria-hidden="true" /> {t({ tr: "Alıntı ekle", en: "Insert quote" })}
              </button>
              <button type="button" onClick={() => void atifBaslat(false)}>
                <BookOpenCheck size={14} aria-hidden="true" /> {t({ tr: "Yalnızca atıf", en: "Citation only" })}
              </button>
              <button
                type="button"
                disabled={soruluyor}
                onClick={() => {
                  setGorunum("ai");
                  void sor(undefined, t(SECIM_ANALIZ_SORUSU));
                }}
              >
                <Sparkles size={14} aria-hidden="true" /> {t({ tr: "AI'a sor", en: "Ask AI" })}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(secim.metin).catch(() => {});
            }}
          >
            <Copy size={14} aria-hidden="true" /> {t({ tr: "Kopyala", en: "Copy" })}
          </button>
          <button type="button" className="pdf-secim-kapat" onClick={secimiBirak} aria-label={t({ tr: "Seçimi bırak", en: "Clear selection" })}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <section className="pdf-onay" data-pdf-ic-katman="" aria-live="polite" aria-label={t({ tr: "Alıntıyı onaylayın", en: "Confirm the quote" })}>
          {atif.adim === "dogrulaniyor" ? (
            <p role="status">
              <Loader2 size={14} className="spin" aria-hidden="true" /> {t({ tr: "Seçim PDF metninde doğrulanıyor…", en: "Verifying the selection against the PDF text…" })}
            </p>
          ) : atif.adim === "hata" ? (
            <>
              <p role="alert" className="kaynak-hata">{atif.mesaj}</p>
              <div className="pdf-onay-eylem">
                <button type="button" className="projects-filter-button button-compact" onClick={() => setAtif(null)}>
                  {t({ tr: "Geri", en: "Back" })}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="pdf-onay-bas">
                <b>{alintiEkle ? t({ tr: "İmlece eklenecek", en: "Will be inserted at your cursor" }) : t({ tr: "Yalnızca atıf eklenecek", en: "Only the citation will be inserted" })}</b>
                <span className="guven-cip" data-tur="kunye">
                  <ShieldCheck size={12} aria-hidden="true" /> {t({ tr: `PDF s. ${atif.pdfSayfa}'de birebir`, en: `Exact match on PDF p. ${atif.pdfSayfa}` })}
                </span>
              </p>
              {atif.eslesme.tur === "kesin" ? (
                <p className="pdf-onay-kaynak">
                  {t({ tr: "Kaynak kaydı:", en: "Source record:" })} <b>{atif.kaynaklar.find((k) => k.id === secilenKaynak)?.title}</b>
                </p>
              ) : null}
              {/* Belgeye eklenecek metnin TAMAMI: alıntı (sunucunun PDF'ten kestiği hâliyle) ve atıf. */}
              <div className="pdf-onay-onizleme" aria-live="polite">
                <span className="pdf-onay-etiket">{t({ tr: "Belgeye eklenecek", en: "Will be inserted" })}</span>
                <p>
                  {alintiEkle ? <span className="pdf-onay-alinti">“{atif.alinti}” </span> : null}
                  {!secilenKaynak ? (
                    <i>{t({ tr: "(atıf, kaynak seçilince görünür)", en: "(the citation appears once a source is chosen)" })}</i>
                  ) : guncelOnizleme?.atif ? (
                    <b className="pdf-onay-atif">{guncelOnizleme.atif}</b>
                  ) : guncelOnizleme?.hata ? (
                    <span className="kaynak-hata">{guncelOnizleme.hata}</span>
                  ) : (
                    <Loader2 size={12} className="spin" aria-label={t({ tr: "Atıf hazırlanıyor", en: "Preparing the citation" })} />
                  )}
                </p>
              </div>
              {atif.eslesme.tur === "belirsiz" ? (
                <fieldset className="kaynak-adaylar">
                  <legend>{eslesmeMetni(atif.eslesme)}</legend>
                  {atif.eslesme.adaylar.map((id) => {
                    const k = atif.kaynaklar.find((x) => x.id === id);
                    return k ? (
                      <label key={id} className="kaynak-aday">
                        <input type="radio" name="kaynak-aday" value={id} checked={secilenKaynak === id} onChange={() => setSecilenKaynak(id)} />
                        <span>
                          {k.title}
                          {k.year ? ` (${k.year})` : ""}
                        </span>
                      </label>
                    ) : null;
                  })}
                  <label className="kaynak-onay">
                    <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} />
                    <span>{t({ tr: "Bu PDF'in seçtiğim kaynak olduğunu kontrol ettim.", en: "I've checked that this PDF is the source I selected." })}</span>
                  </label>
                </fieldset>
              ) : atif.eslesme.tur === "yok" ? (
                <p className="kaynak-eslesme" data-tur="yok">{eslesmeMetni(atif.eslesme)}</p>
              ) : null}
              {atif.eslesme.tur !== "yok" ? (
                /*
                  İKİ AYRI SAYFA (20.11.2026): PDF sayfası dosyadaki sıradır ve
                  yalnızca alıntının doğrulandığı yeri söyler; atfa GİRMEZ. Atıftaki
                  sayfa makalenin basılı numarasıdır ve yalnızca kullanıcının yazdığıdır.
                */
                <div className="pdf-onay-sayfalar">
                  <p>
                    <span className="pdf-onay-etiket">{t({ tr: "PDF sayfası", en: "PDF page" })}</span> {atif.pdfSayfa}
                    <small>{t({ tr: " · dosyadaki sıra; atfa girmez", en: " · position in the file; not used in the citation" })}</small>
                  </p>
                  <label className="pdf-onay-sayfa">
                    <span className="pdf-onay-etiket">{t({ tr: "Basılı sayfa (atıfta)", en: "Printed page (in the citation)" })}</span>
                    <input
                      className="field-control"
                      value={basiliSayfa}
                      onChange={(e) => setBasiliSayfa(e.target.value.slice(0, 20))}
                      onFocus={(e) => {
                        // Telefonda klavye açılınca kutu görünür kalsın: yalnızca sayfa alanı kayar.
                        const kutu = e.currentTarget;
                        window.setTimeout(() => kutu.scrollIntoView({ block: "center", inline: "nearest" }), 250);
                      }}
                      inputMode="text"
                      placeholder={t({ tr: "ör. 214 (isteğe bağlı)", en: "e.g. 214 (optional)" })}
                      title={t({ tr: "Makalenin kendi basılı sayfa numarası", en: "The article's own printed page number" })}
                    />
                  </label>
                </div>
              ) : null}
              <div className="pdf-onay-eylem">
                <button type="button" className="projects-filter-button button-compact" onClick={() => setAtif(null)}>
                  {t({ tr: "Vazgeç", en: "Cancel" })}
                </button>
                {atif.eslesme.tur !== "yok" ? (
                  <button
                    type="button"
                    className="projects-primary-button button-compact"
                    autoFocus
                    disabled={ekleniyor || !secilenKaynak || (atif.eslesme.tur !== "kesin" && !onay)}
                    onClick={() => void atifEkle()}
                  >
                    {ekleniyor ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <BookOpenCheck size={14} aria-hidden="true" />} {t({ tr: "Ekle", en: "Insert" })}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  ) : null;

  /*
    KISA DURUM ÖZETİ (20.11.2026): kaynak kaydı eşleşmesi, PDF ve alıntı
    AYRI üç durum, tek satırda; ayrıntılar (kaynak bağı, bağla/kaldır)
    istenince açılır. Eskiden bağ satırı ve uzun açıklamalar okuma alanının
    üstünde sürekli yer kaplıyordu.
  */
  const kayitBagli = Boolean(pdf?.kaynak_id);
  /*
    Alıntı durumu belgedeki kalıcı işaretlerden de okunur (20.11.2026). Eskiden
    yalnızca bu oturumda eklenen alıntıya bakıyordu: sayfa yenilenince PDF'te
    sarı işaret görünürken başlık "Alıntı: henüz yok" diyordu.
  */
  const kaliciSayfalar = [...new Set((isaretler?.gecerli ?? []).map((d) => d.sayfa))].sort((x, y) => x - y);
  const alintiVar = Boolean(pdf && (sonAlinti?.pdfId === pdf.id || kaliciSayfalar.length));
  const durumOzeti = pdf ? (
    <div className="pdf-durum-ozeti" data-acik={ayrintiAcik ? "" : undefined}>
      {/* Telefonda tek satırlık kısa özet: üç durum ayrı işaretlerle, ayrıntılar dokununca açılır. */}
      <button
        type="button"
        className="pdf-durum-kisa"
        aria-expanded={ayrintiAcik}
        aria-controls="pdf-durum-ayrinti"
        onClick={() => setAyrintiAcik((a) => !a)}
        aria-label={t({
          tr: `Durum: kaynak kaydı ${kayitBagli ? "bağlı" : "bağlı değil"}, PDF açık, alıntı ${alintiVar ? "PDF'te birebir" : "henüz yok"}. Ayrıntılar`,
          en: `Status: source record ${kayitBagli ? "linked" : "not linked"}, PDF open, quote ${alintiVar ? "exact in PDF" : "none yet"}. Details`,
        })}
      >
        <span data-tur={kayitBagli ? "tamam" : "uyari"}>{t({ tr: "Kayıt", en: "Record" })}</span>
        <span data-tur="tamam">PDF</span>
        <span data-tur={alintiVar ? "tamam" : "bos"}>{t({ tr: "Alıntı", en: "Quote" })}</span>
      </button>
      <span className="guven-cip" data-tur={pdf.kaynak_id ? "kunye" : "uyari"}>
        {pdf.kaynak_id ? t({ tr: "Kaynak kaydı: bağlı", en: "Source record: linked" }) : t({ tr: "Kaynak kaydı: bağlı değil", en: "Source record: not linked" })}
      </span>
      <span className="guven-cip" data-tur="kunye">{t({ tr: "PDF: açık", en: "PDF: open" })}</span>
      <span className="guven-cip" data-tur={alintiVar ? "kunye" : "notr"}>
        {sonAlinti?.pdfId === pdf.id
          ? t({ tr: `Alıntı: PDF s. ${sonAlinti.sayfa}'de birebir`, en: `Quote: exact on PDF p. ${sonAlinti.sayfa}` })
          : kaliciSayfalar.length
            ? t({ tr: `Belgede kullanılan pasaj: PDF s. ${kaliciSayfalar.join(", ")}`, en: `Passage used in the document: PDF p. ${kaliciSayfalar.join(", ")}` })
            : t({ tr: "Alıntı: henüz yok", en: "Quote: none yet" })}
      </span>
      <button type="button" className="link-button" aria-expanded={ayrintiAcik} aria-controls="pdf-durum-ayrinti" onClick={() => setAyrintiAcik((a) => !a)}>
        {ayrintiAcik ? t({ tr: "Ayrıntıları gizle", en: "Hide details" }) : t({ tr: "Ayrıntılar", en: "Details" })}
      </button>
    </div>
  ) : null;

  const odaklanabilir = (kok: HTMLElement) =>
    Array.from(kok.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(
      (el) => !el.closest("[hidden]") && el.getClientRects().length > 0,
    );

  return (
    <aside
      ref={kokRef}
      className="kaynak-pdf-paneli"
      hidden={!acik}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t({ tr: "Kaynak PDF", en: "Source PDF" })}
      data-tam-ekran={tamEkran ? "" : undefined}
      onKeyDown={(e) => {
        /*
          İÇ KATMANLARIN KAPANMA SIRASI: kısa onay → seçim → AI görünümü →
          çekmece. Esc önce en içtekini kapatır ve olayı işlenmiş sayar
          (preventDefault): editörün çekmece dinleyicisi (manuscript-editor
          escIsle) işlenmiş Esc'e dokunmaz. En dışta çekmece kapanır.
        */
        if (e.key === "Escape") {
          if (atif) setAtif(null);
          else if (secim) secimiBirak();
          else if (gorunum === "ai") setGorunum("pdf");
          else return;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        /* Odak çekmecenin içinde döner (arkadaki editör karartılmış, etkileşim dışı). */
        if (e.key === "Tab" && kokRef.current) {
          const liste = odaklanabilir(kokRef.current);
          if (!liste.length) return;
          const ilk = liste[0];
          const son = liste[liste.length - 1];
          if (e.shiftKey && (document.activeElement === ilk || document.activeElement === kokRef.current)) {
            e.preventDefault();
            son.focus();
          } else if (!e.shiftKey && document.activeElement === son) {
            e.preventDefault();
            ilk.focus();
          }
        }
      }}
    >
      {onGenislik ? (
        <div
          className="pdf-cekmece-tutamak"
          role="separator"
          aria-orientation="vertical"
          aria-label={t({ tr: "Çekmece genişliği: sürükleyin ya da ok tuşlarını kullanın", en: "Drawer width: drag or use the arrow keys" })}
          aria-valuenow={genislik}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            const tutamak = e.currentTarget;
            tutamak.setPointerCapture(e.pointerId);
            const hesapla = (x: number) => window.innerWidth - 8 - x;
            const tasi = (olay: PointerEvent) => onGenislik(hesapla(olay.clientX), false);
            const birak = (olay: PointerEvent) => {
              onGenislik(hesapla(olay.clientX), true);
              tutamak.removeEventListener("pointermove", tasi);
              tutamak.removeEventListener("pointerup", birak);
            };
            tutamak.addEventListener("pointermove", tasi);
            tutamak.addEventListener("pointerup", birak);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            onGenislik((genislik ?? 0) + (e.key === "ArrowLeft" ? 40 : -40), true);
          }}
        />
      ) : null}
      <header className="pdf-cekmece-bas">
        <FileText size={16} aria-hidden="true" />
        <b className="pdf-cekmece-ad" title={pdf?.kunye}>{pdf ? kisaAd(pdf) : t({ tr: "Kaynak PDF", en: "Source PDF" })}</b>
        {liste && liste.length > 1 ? (
          <label className="pdf-cekmece-secici">
            <span className="sr-only">{t({ tr: "Kaynak", en: "Source" })}</span>
            <select className="field-control" value={pdfId} onChange={(e) => pdfDegisti(e.target.value)}>
              {liste.map((r) => (
                <option key={r.id} value={r.id}>
                  {ozet(r.kunye, 110)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {pdf ? (
          <button
            type="button"
            className="yazim-hizli-dugme"
            aria-pressed={gorunum === "ai"}
            aria-label={gorunum === "ai" ? t({ tr: "PDF'e dön", en: "Back to PDF" }) : t({ tr: "PDF'e sor", en: "Ask the PDF" })}
            onClick={() => setGorunum((g) => (g === "ai" ? "pdf" : "ai"))}
            title={t({ tr: "Bu PDF'e soru sorun; yanıtlar yalnızca bu PDF'e dayanır", en: "Ask this PDF; answers rely only on this PDF" })}
          >
            {gorunum === "ai" ? (
              <>
                <FileText size={14} aria-hidden="true" /> <span className="pdf-dugme-metin">{t({ tr: "PDF'e dön", en: "Back to PDF" })}</span>
              </>
            ) : (
              <>
                <Sparkles size={14} aria-hidden="true" /> <span className="pdf-dugme-metin">{t({ tr: "PDF'e sor", en: "Ask the PDF" })}</span>
                {analizler.length ? <span className="pdf-sayac">{analizler.length}</span> : null}
              </>
            )}
          </button>
        ) : null}
        <button
          type="button"
          className="yazim-ikon pdf-tam-ekran"
          aria-pressed={tamEkran}
          onClick={() => setTamEkran((v) => !v)}
          aria-label={tamEkran ? t({ tr: "Tam ekrandan çık", en: "Exit full screen" }) : t({ tr: "Tam ekran", en: "Full screen" })}
          title={tamEkran ? t({ tr: "Tam ekrandan çık", en: "Exit full screen" }) : t({ tr: "Tam ekran", en: "Full screen" })}
        >
          {tamEkran ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="yazim-ikon" onClick={onKapat} aria-label={t({ tr: "Kaynak panelini kapat (Esc)", en: "Close source panel (Esc)" })}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      {isaretler?.eski ? (
        <p className="pdf-durum" role="status">
          {t({
            tr: `Bu PDF dosyası değişmiş: belgede kullanılan ${isaretler.eski} pasajın işareti eski sürüme ait, bu dosyada gösterilmiyor.`,
            en: `This PDF file has changed: ${isaretler.eski} passage mark(s) used in the document belong to the old version and aren't shown on this file.`,
          })}
        </p>
      ) : null}
      {acilamayanPdf && liste ? (
        <p className="pdf-durum" role="alert">
          {t({ tr: "İstenen PDF bu çalışmada bulunamadı; aşağıdaki listeden seçin.", en: "The requested PDF wasn't found in this work; choose one from the list below." })}
        </p>
      ) : null}
      {listeHatasi ? (
        <p className="pdf-durum" role="alert">{listeHatasi}</p>
      ) : !liste ? (
        <p className="pdf-durum" role="status">
          <Loader2 size={16} className="spin" aria-hidden="true" /> {t({ tr: "Kaynaklar yükleniyor…", en: "Loading sources…" })}
        </p>
      ) : liste.length === 0 ? (
        <p className="pdf-durum">
          {t({
            tr: "Bu çalışmada PDF'i olan kaynak yok. Kaynaklar'da bir kaynağın PDF'ini arayın ya da kendi PDF'inizi yükleyin.",
            en: "No source in this work has a PDF yet. Look for a source's PDF in Sources, or upload your own.",
          })}
        </p>
      ) : (
        <>
          {durumOzeti}
          {ayrintiAcik && pdf ? (
            <div id="pdf-durum-ayrinti" className="pdf-durum-ayrinti">
              {liste && liste.length > 1 ? (
                <label className="pdf-ayrinti-secici">
                  <span>{t({ tr: "Kaynak", en: "Source" })}</span>
                  <select className="field-control" value={pdfId} onChange={(e) => pdfDegisti(e.target.value)}>
                    {liste.map((r) => (
                      <option key={r.id} value={r.id}>
                        {ozet(r.kunye, 110)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <PdfBagSatiri
                projectId={projectId}
                pdf={pdf}
                onDegisti={(kaynakId) => {
                  setListe((onceki) => onceki?.map((r) => (r.id === pdf.id ? { ...r, kaynak_id: kaynakId } : r)) ?? onceki);
                  onBagDegisti?.();
                }}
              />
              <p className="pdf-durum-not">
                {t({
                  tr: "Kaynak kaydı eşleşmesi, PDF'in bulunması ve alıntının PDF'te birebir geçmesi ayrı denetimlerdir; biri ötekinin yerine geçmez.",
                  en: "Matching the source record, finding the PDF and the quote appearing verbatim in the PDF are separate checks; none stands in for another.",
                })}
              </p>
            </div>
          ) : null}
          {pasajSonucu === false ? (
            <p className="pdf-pasaj-durum" role="status">
              {t({
                tr: "Doğrulanmış pasaj bu sayfanın metninde bulunamadı; hiçbir yer işaretlenmedi.",
                en: "The verified passage wasn't found in this page's text; nothing was highlighted.",
              })}
            </p>
          ) : pasajSonucu === true ? (
            <p className="pdf-pasaj-durum" data-tamam="" role="status">
              {t({ tr: "Doğrulanmış pasaj sarıyla işaretlendi.", en: "The verified passage is highlighted in yellow." })}
            </p>
          ) : null}

          {/*
            PDF görünümü AI görünümüne geçince SÖKÜLMEZ, yalnızca gizlenir:
            sayfa, yakınlaştırma ve sayfa içi konum PDF'e dönünce yerinde.
          */}
          <div className="pdf-gorunum" hidden={gorunum !== "pdf"}>
            {pdf ? (
              <PdfGoruntuleyici
                pdfId={pdf.id}
                gidilecekSayfa={gidilecek}
                onPasaj={setPasajSonucu}
                onGidisUygulandi={gidisUygulandi}
                onSecim={secimGeldi}
                konumAl={konumAl}
                onKonum={konumDegisti}
                katman={secimKatmani}
                kaliciPasajlar={isaretler?.gecerli.map((d) => ({ sayfa: d.sayfa, metin: d.pasaj }))}
                onSurum={surumGeldi}
              />
            ) : null}
          </div>

          {gorunum === "ai" && pdf ? (
            <section className="kaynak-analiz pdf-ai-gorunum" aria-label={t({ tr: "Bu PDF'e sorular", en: "Questions to this PDF" })}>
              <p className="yazim-bos-not">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>
                  {t({
                    tr: "Yanıtlar yalnızca bu PDF'e dayanır; doğrulanamayan cevap gösterilmez ve belgeye kendiliğinden girmez. Yazım asistanının sohbetinden ayrıdır.",
                    en: "Answers rely only on this PDF; unverifiable answers are hidden and never enter your document on their own. Separate from the writing assistant's chat.",
                  })}
                </span>
              </p>
              <div className="kaynak-analiz-liste" aria-live="polite">
                {analizler.map((a, i) => (
                  <article key={i} className="kaynak-analiz-oge">
                    {/* Durdurma kaydının sorusu yok: boş bir soru balonu çizilmez. */}
                    {a.soru ? <p className="kaynak-soru">{a.soru}</p> : null}
                    {a.yanit.hata ? (
                      <p role="alert" className="kaynak-hata">{a.yanit.hata}</p>
                    ) : (
                      <>
                        <p className="kaynak-cevap">{a.yanit.cevap}</p>
                        {a.yanit.alintilar?.length ? (
                          <ul className="kaynak-alintilar">
                            {a.yanit.alintilar.map((al, j) => (
                              <li key={j}>
                                <button
                                  type="button"
                                  className="result-link"
                                  onClick={() => {
                                    setGidilecek({ sayfa: al.sayfa, anahtar: Date.now() });
                                    setGorunum("pdf");
                                  }}
                                >
                                  {t({ tr: `PDF s. ${al.sayfa}`, en: `PDF p. ${al.sayfa}` })}
                                </button>{" "}
                                “{ozet(al.metin, 240)}”
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {a.yanit.kunye ? <small className="kaynak-kunye">{t({ tr: "Kaynak:", en: "Source:" })} {ozet(a.yanit.kunye, 160)}</small> : null}
                        {a.yanit.krediUyarisi ? <small>{a.yanit.krediUyarisi}</small> : null}
                      </>
                    )}
                  </article>
                ))}
                {soruluyor ? (
                  <p className="pdf-durum" role="status">
                    <Loader2 size={14} className="spin" aria-hidden="true" /> {t({ tr: "PDF'e soruluyor…", en: "Asking the PDF…" })}{" "}
                    <button
                      type="button"
                      className="projects-filter-button button-compact"
                      onClick={soruyuDurdur}
                      title={t({
                        tr: "Yalnızca bu ekrandaki bekleme biter. İstek sağlayıcıda sürer, ücreti doğar ve kaydı tutulur; iptal edilmez. Gelen cevap size gösterilmez.",
                        en: "Only the wait on this screen ends. The request keeps running at the provider, is still billed and still recorded; it is not cancelled. The answer won't be shown to you.",
                      })}
                    >
                      {t({ tr: "Beklemeyi bırak", en: "Stop waiting" })}
                    </button>
                  </p>
                ) : null}
              </div>
              <form className="yazim-girdi" onSubmit={(e) => void sor(e)}>
                <label className="sr-only" htmlFor="kaynak-pdf-soru">
                  {t({ tr: "Bu PDF'e sor", en: "Ask this PDF" })}
                </label>
                <textarea
                  id="kaynak-pdf-soru"
                  className="field-control"
                  rows={2}
                  value={soru}
                  autoFocus
                  onChange={(e) => setSoru(e.target.value.slice(0, 1000))}
                  // Yazım asistanıyla aynı: Enter gönderir, Shift+Enter yeni satır.
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={secim ? t({ tr: "Seçili pasaj hakkında sorun…", en: "Ask about the selected passage…" }) : t({ tr: "Bu PDF'e sorun…", en: "Ask this PDF…" })}
                />
                <button type="submit" className="projects-primary-button" disabled={soruluyor || soru.trim().length < 3}>
                  {soruluyor ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                  <span className="sr-only">{t({ tr: "Sor", en: "Ask" })}</span>
                </button>
              </form>
            </section>
          ) : null}
        </>
      )}
    </aside>
  );
}

/*
  PDF ↔ KAYNAK KAYDI BAĞI (K2-A). Bağ varsa adıyla gösterilir ve
  kaldırılabilir; yoksa bu çalışmanın kaynaklarından biri AÇIKÇA seçilip
  bağlanır. Künye/DOI eşleşmesi yalnızca "olası" diye önerilir, kendiliğinden
  bağlanmaz. Sunucu iki tarafı da doğrular (pdfKaynaginiBagla).
*/
function PdfBagSatiri({ projectId, pdf, onDegisti }: { projectId: string; pdf: KaynakPdfSatiri; onDegisti: (kaynakId: string | null) => void }) {
  const t = useCeviri();
  const [kaynaklar, setKaynaklar] = useState<LiteratureSource[] | null>(null);
  const [secilen, setSecilen] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    let iptal = false;
    void getLiteratureSources().then((sonuc) => {
      if (!iptal && !sonuc.okunamadi) setKaynaklar(sonuc.satirlar.filter((k) => k.project_id === projectId));
    });
    return () => {
      iptal = true;
    };
  }, [projectId]);

  const bagli = pdf.kaynak_id ? kaynaklar?.find((k) => k.id === pdf.kaynak_id) ?? null : null;
  const olasi = useMemo(() => {
    if (pdf.kaynak_id || !kaynaklar) return null;
    const e = kaynakEslesmesi({ doi: pdf.doi, baslik: kunyeBasligi(pdf.kunye) || pdf.kunye }, kaynaklar, projectId);
    return e.tur === "kesin" ? [e.kaynakId] : e.tur === "belirsiz" ? e.adaylar : [];
  }, [pdf, kaynaklar, projectId]);

  const yaz = async (kaynakId: string | null) => {
    setBekliyor(true);
    setHata(null);
    const sonuc = await pdfKaynaginiBagla({ projectId, pdfId: pdf.id, kaynakId });
    setBekliyor(false);
    if ("hata" in sonuc) {
      setHata(sonuc.hata);
      return;
    }
    setAcik(false);
    setSecilen("");
    onDegisti(kaynakId);
  };

  return (
    <div className="pdf-bag" aria-live="polite">
      {pdf.kaynak_id ? (
        <p className="pdf-bag-durum">
          <span className="guven-cip" data-tur="kunye">
            <Link2 size={12} aria-hidden="true" /> {t({ tr: "Kaynağa bağlı", en: "Linked to source" })}
          </span>
          <span className="pdf-bag-ad">{bagli ? `${bagli.authors ?? ""} ${bagli.year ? `(${bagli.year})` : ""} ${bagli.title}`.trim() : t({ tr: "Kaynak kaydı", en: "Source record" })}</span>
          <button type="button" className="link-button" disabled={bekliyor} onClick={() => void yaz(null)}>
            {t({ tr: "Bağı kaldır", en: "Unlink" })}
          </button>
        </p>
      ) : (
        <p className="pdf-bag-durum">
          <span className="guven-cip" data-tur="uyari">{olasi?.length ? t({ tr: "Olası eşleşme", en: "Possible match" }) : t({ tr: "Kaynağa bağlı değil", en: "Not linked" })}</span>
          <span className="pdf-bag-ad">
            {olasi?.length
              ? t({ tr: "Künyeye göre tahmin; doğrulamak için bağlayın.", en: "Guessed from the reference; link it to confirm." })
              : t({ tr: "Bu PDF bir kaynak kaydına bağlı değil.", en: "This PDF isn't linked to a source record." })}
          </span>
          <button type="button" className="link-button" onClick={() => setAcik((a) => !a)} aria-expanded={acik}>
            {t({ tr: "Kaynağa bağla", en: "Link to source" })}
          </button>
        </p>
      )}
      {acik && !pdf.kaynak_id ? (
        <div className="pdf-bag-sec">
          <label>
            <span className="sr-only">{t({ tr: "Bağlanacak kaynak", en: "Source to link" })}</span>
            <select className="field-control" value={secilen} onChange={(e) => setSecilen(e.target.value)}>
              <option value="">{t({ tr: "Kaynak seçin…", en: "Choose a source…" })}</option>
              {(kaynaklar ?? [])
                .slice()
                .sort((a, b) => Number(olasi?.includes(b.id)) - Number(olasi?.includes(a.id)))
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {olasi?.includes(k.id) ? "★ " : ""}
                    {[k.authors, k.year ? `(${k.year})` : null, k.title].filter(Boolean).join(" ")}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" className="projects-primary-button button-compact" disabled={!secilen || bekliyor} onClick={() => void yaz(secilen)}>
            {t({ tr: "Bağla", en: "Link" })}
          </button>
        </div>
      ) : null}
      {hata ? (
        <p className="kaynak-hata" role="alert">
          {hata}
        </p>
      ) : null}
    </div>
  );
}
