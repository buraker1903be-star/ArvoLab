"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ArrowUp, Check, Copy, CornerDownLeft, History, ListTree, ThumbsDown, MessageSquareText, PenLine, Replace, ShieldCheck, Sparkles, StepForward, X } from "lucide-react";
import { yazimAsistani } from "@/app/actions/ai-yazim";
import { asistanPuanla } from "@/app/actions/ai-puan";
import { ASISTAN_IZI, asistanKayitlari } from "@/lib/tiptap-asistan-izi";
import type { Transaction } from "@tiptap/pm/state";
import { kisaltmaUyarilari, type KisaltmaUyarisi } from "@/lib/ai/yazim-metni";
import { anaHattiCozumle } from "@/lib/ai/yazim-metni";
import { paragraflara, type SohbetMesaji } from "@/lib/ai/yazim-metni";
import type { YazimGorevi } from "@/lib/ai/yazim-asistani";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { collectHeadings } from "./editor-navigation";
import KayitliCevaplar from "./kayitli-cevaplar";

/*
  YAZIM ASİSTANI PANELİ (03.11.2026, kurum sahibinin kararı: "paragrafı
  sohbette yazarız, ekleme konusunu kullanıcıya bırakırız").

  Modal DEĞİL, sağa yaslı kalıcı panel: öğrenci metnini görerek konuşuyor,
  panel açıkken editörde yazmaya devam edebiliyor. Asistanın yazdığı metin
  belgeye kendiliğinden girmez; her cevabın altında "İmlece ekle" /
  "Seçilenin yerine koy" / "Kopyala" var ve hangisinin yapılacağına
  öğrenci karar veriyor. Ekleme, kaydın "faydalı" değerlendirmesi olarak
  yazılıyor: eğitim verisinin en güçlü işareti, öğrencinin metni
  kullanmasıdır (lib/ai/kayit.ts).

  Seçim, istek GÖNDERİLDİĞİ anda alınır ve o cevabın eklenme yeri olur:
  öğrenci bu arada imleci başka yere götürse bile "Seçilenin yerine koy"
  isteğin yapıldığı metnin yerine koyar.
*/

type Aralik = { from: number; to: number };

/* Öneri kartının başlığı: kartın ne olduğu, istek metni değil. */
const ONERI_ADI: Record<YazimGorevi, { tr: string; en: string }> = {
  serbest: { tr: "Öneri", en: "Suggestion" },
  devam: { tr: "Devamı için öneri", en: "Suggested continuation" },
  paragraf: { tr: "Önerilen paragraf", en: "Suggested paragraph" },
  akademik: { tr: "Akademik hâli", en: "Academic version" },
  kisalt: { tr: "Kısaltılmış hâli", en: "Shortened version" },
  genislet: { tr: "Genişletilmiş hâli", en: "Expanded version" },
  anahat: { tr: "Ana hat", en: "Outline" },
  tamamla: { tr: "Öneri", en: "Suggestion" },
};
type Kayit = SohbetMesaji & { ekMetin?: string; kayitId?: string | null; aralik?: Aralik; secimVardi?: boolean; eklendi?: boolean; gorev?: YazimGorevi; begenilmedi?: boolean; secimMetni?: string };

/** B-16: AI metnindeki atıfların kaynakçaya yazılması için editörün hazırlığı (manuscript-editor.tsx). */
export type AiAtifHazirlik = { uygula: (tr: Transaction, kayitId: string | null) => { donusen: number; kaynakcaya: number }; belirsiz: string[]; hata?: string };

const KISALTMA_UYARISI: Record<KisaltmaUyarisi, { tr: string; en: string }> = {
  kisalmadi: { tr: "Kısaltma aslından belirgin biçimde kısa değil.", en: "The shortened text isn't clearly shorter." },
  olumsuzluk: { tr: "Olumsuzluk ifadeleri değişmiş; anlamın tersine dönmediğini kontrol edin.", en: "Negations changed; check the meaning hasn't flipped." },
  atif: { tr: "Seçimdeki bir atıf kısaltmada yok.", en: "A citation in your selection is missing." },
  sayi: { tr: "Seçimdeki bir sayı kısaltmada yok.", en: "A number in your selection is missing." },
};

export default function YazimPaneli({
  editor,
  projectId,
  acik,
  onKapat,
  zorunluBolumler = [],
  aiAtifHazirla,
}: {
  editor: Editor;
  projectId: string;
  acik: boolean;
  onKapat: () => void;
  /** B-16: eklenecek metindeki atıfları kaynakçaya bağlamak için hazırlık; verilmezse kaynakça güncellenmez. */
  aiAtifHazirla?: (metin: string) => Promise<AiAtifHazirlik>;
  /** Kılavuzun zorunlu bölümleri: ana hat görevinin omurgası. */
  zorunluBolumler?: string[];
}) {
  const t = useCeviri();
  const [mesajlar, setMesajlar] = useState<Kayit[]>([]);
  /* Sohbet ya da Kayıtlı. Kayıtlı sekme yalnızca açılınca okunur (KayitliCevaplar); model çağrılmaz. */
  const [sekme, setSekme] = useState<"sohbet" | "kayitli">("sohbet");
  const [istek, setIstek] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const listeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const girdiRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (acik) window.requestAnimationFrame(() => girdiRef.current?.focus());
  }, [acik]);
  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: "smooth" });
  }, [mesajlar, bekliyor]);

  const gonder = async (gorev: YazimGorevi, metin = istek) => {
    if (bekliyor) return;
    const { from, to } = editor.state.selection;
    const doc = editor.state.doc;
    const secim = from !== to ? doc.textBetween(from, to, "\n\n") : "";
    if ((gorev === "akademik" || gorev === "kisalt" || gorev === "genislet") && !secim) {
      showToast("error", t({ tr: "Önce editörde bir metin seçin.", en: "Select some text in the editor first." }));
      return;
    }
    const oncesi = doc.textBetween(Math.max(0, from - 6_000), from, "\n\n");
    const bolum = collectHeadings(doc).filter((h) => h.pos < from).at(-1)?.text ?? null;
    const gorunen =
      metin.trim() ||
      {
        serbest: "",
        devam: t({ tr: "Kaldığım yerden devam ettir.", en: "Continue from where I left off." }),
        paragraf: t({ tr: "Bu bölüm için bir paragraf yaz.", en: "Write a paragraph for this section." }),
        akademik: t({ tr: "Seçili metni akademik üsluba çevir.", en: "Make the selected text academic." }),
        kisalt: t({ tr: "Seçili metni kısalt.", en: "Shorten the selected text." }),
        genislet: t({ tr: "Seçili metni genişlet.", en: "Expand the selected text." }),
        anahat: t({ tr: "Çalışmam için bir ana hat (başlık iskeleti) çıkar.", en: "Draft an outline (heading skeleton) for my work." }),
        tamamla: "",
      }[gorev];
    if (!gorunen) return;
    const gecmis: SohbetMesaji[] = mesajlar.map((m) => ({ rol: m.rol, metin: m.rol === "asistan" ? `${m.metin}\n${m.ekMetin ?? ""}`.trim() : m.metin }));
    setMesajlar((onceki) => [...onceki, { rol: "kullanici", metin: gorunen }]);
    setIstek("");
    setBekliyor(true);
    try {
      const cevap = await yazimAsistani({ projectId, istek: gorunen, gorev, bolum, oncesi, secim: secim || null, gecmis, zorunluBolumler });
      if (cevap.hata) {
        setMesajlar((onceki) => [...onceki, { rol: "asistan", metin: cevap.hata! }]);
        return;
      }
      if (cevap.krediUyarisi) showToast("error", cevap.krediUyarisi);
      setMesajlar((onceki) => [
        ...onceki,
        { rol: "asistan", metin: cevap.yanit ?? "", ekMetin: cevap.metin || undefined, kayitId: cevap.kayitId, aralik: { from, to }, secimVardi: from !== to, gorev, secimMetni: secim || undefined },
      ]);
    } catch (hata) {
      console.error(hata);
      setMesajlar((onceki) => [...onceki, { rol: "asistan", metin: t({ tr: "Asistana ulaşılamadı; bağlantınızı kontrol edin.", en: "Couldn't reach the assistant; check your connection." }) }]);
    } finally {
      setBekliyor(false);
    }
  };

  /* Eklenen metin paragraf düğümleri olarak girer; boş satırlar paragraf sınırıdır. */
  /*
    Eklenen metin asistan iziyle girer (lib/tiptap-asistan-izi.ts):
    yazarlık raporu belgede duran asistan metnini buradan sayıyor.
  */
  const izliMetin = (text: string, kayit: string | null | undefined) => ({ type: "text", text, marks: [{ type: ASISTAN_IZI, attrs: { kayit: kayit ?? null } }] });
  const dugumler = (metin: string, kayit?: string | null) =>
    paragraflara(metin).map((p) => ({ type: "paragraph", content: [izliMetin(p, kayit)] }));

  /*
    Ekleme tek yerde: sohbetteki cevap da Kayıtlı sekmedeki cevap da buradan
    girer, ikisi de asistan izi taşır (yazarlık raporu). Kayıtlı cevapta
    istek anındaki seçim yok; ekleme o anki imlece yapılır.
  */
  /*
    B-16 (20.11.2026): metindeki atıflar kütüphanedeki TEK bir kaynakla
    eşleşiyorsa o kaynağın künyesi Kaynakça'ya, metinle AYNI işlemde yazılır
    (tek Ctrl+Z ikisini birlikte geri alır). Eskiden metin düz atıflarla
    giriyor, Kaynakça hiç güncellenmiyordu. Belirsiz eşleşme (iki "Aras,
    2020") kaynakçaya yazılmaz, doğrulanmış sayılmaz; öğrenciye söylenir.
    Hazırlık başarısızsa (CSL künyesi üretilemedi) metin de girmez: yarım
    kalan bir ekleme, atfı olup künyesi olmayan bir belge bırakırdı.
  */
  const metniEkle = async (kayit: { ekMetin: string; aralik: Aralik; gorev?: YazimGorevi | null; kayitId?: string | null }, yerineKoy: boolean): Promise<boolean> => {
    const hazirlik = kayit.gorev === "anahat" || !aiAtifHazirla ? null : await aiAtifHazirla(kayit.ekMetin).catch(() => ({ uygula: () => ({ donusen: 0, kaynakcaya: 0 }), belirsiz: [], hata: t({ tr: "Kaynakça hazırlanamadı.", en: "The reference list couldn't be prepared." }) }) as AiAtifHazirlik);
    if (hazirlik?.hata) {
      showToast("error", t({ tr: `Metin eklenmedi: ${hazirlik.hata}`, en: `Text not inserted: ${hazirlik.hata}` }));
      return false;
    }
    let baglanan = { donusen: 0, kaynakcaya: 0 };
    const bitir = (zincir: ReturnType<Editor["chain"]>) =>
      zincir
        .command(({ tr }) => {
          if (hazirlik) baglanan = hazirlik.uygula(tr, kayit.kayitId ?? null);
          return true;
        })
        .run();
    const boyut = editor.state.doc.content.size;
    const from = Math.min(kayit.aralik.from, boyut);
    const to = Math.min(kayit.aralik.to, boyut);
    let tamam: boolean;
    const anaHat = kayit.gorev === "anahat" ? anaHattiCozumle(kayit.ekMetin) : [];
    if (anaHat.length) {
      /*
        Ana hat başlık ve not olarak girer; not köşeli parantezde: öğrencinin
        yerine yazacağı yer tutucu olduğu görülsün. Hepsi asistan izli
        (yazarlık raporu başlıkları da sayar).
      */
      const dugumlerAnaHat = anaHat.flatMap((s) => [
        { type: "heading", attrs: { level: s.duzey }, content: [izliMetin(s.baslik, kayit.kayitId)] },
        ...s.notlar.map((n) => ({ type: "paragraph", content: [izliMetin(`[${n}]`, kayit.kayitId)] })),
      ]);
      const $pos = editor.state.doc.resolve(to);
      tamam = bitir(editor.chain().focus().insertContentAt($pos.depth >= 1 ? $pos.after(1) : to, dugumlerAnaHat));
    } else if (yerineKoy && from !== to) {
      const paragraflar = paragraflara(kayit.ekMetin);
      // Tek paragraf seçimin yerine satır içi girer; çok paragraf blok olarak.
      tamam =
        paragraflar.length === 1
          ? bitir(editor.chain().focus().insertContentAt({ from, to }, izliMetin(paragraflar[0], kayit.kayitId)))
          : bitir(editor.chain().focus().insertContentAt({ from, to }, dugumler(kayit.ekMetin, kayit.kayitId)));
    } else {
      /* İmlecin bulunduğu bloğun SONUNA: paragrafın ortasına blok eklemek onu ikiye bölerdi. Boş paragraftaysa onun yerine. */
      const $pos = editor.state.doc.resolve(to);
      const blok = $pos.depth >= 1 ? $pos.node(1) : null;
      const bosParagraf = blok?.type.name === "paragraph" && blok.textContent.trim() === "";
      tamam = bosParagraf
        ? bitir(editor.chain().focus().insertContentAt({ from: $pos.before(1), to: $pos.after(1) }, dugumler(kayit.ekMetin, kayit.kayitId)))
        : bitir(editor.chain().focus().insertContentAt($pos.depth >= 1 ? $pos.after(1) : to, dugumler(kayit.ekMetin, kayit.kayitId)));
    }
    if (!tamam) {
      showToast("error", t({ tr: "Metin eklenemedi; imleci metnin içine koyup tekrar deneyin.", en: "Couldn't insert the text; place the cursor in the text and try again." }));
      return false;
    }
    if (kayit.kayitId) void asistanPuanla(kayit.kayitId, "faydali", "metne eklendi").catch(() => undefined);
    const belirsiz = hazirlik?.belirsiz ?? [];
    showToast(
      belirsiz.length ? "info" : "success",
      [
        t({ tr: "Metin eklendi; okuyup kendi sözcüklerinizle düzenleyin.", en: "Text inserted; read it and edit it in your own words." }),
        baglanan.donusen ? t({ tr: `${baglanan.donusen} atıf belgenin atıf stiline çevrildi ve Kaynakça'ya bağlandı.`, en: `${baglanan.donusen} citation(s) converted to the document's citation style and linked to the reference list.` }) : "",
        baglanan.kaynakcaya ? t({ tr: `${baglanan.kaynakcaya} kaynak Kaynakça'ya yazıldı.`, en: `${baglanan.kaynakcaya} source(s) added to the reference list.` }) : "",
        belirsiz.length
          ? t({
              tr: `Belirsiz atıf: ${belirsiz.join(", ")} kütüphanenizde birden çok kaynakla eşleşiyor; Kaynakça'ya eklenmedi. Atıf penceresinden doğru kaynağı seçin.`,
              en: `Ambiguous citation: ${belirsiz.join(", ")} matches several sources in your library; not added to the reference list. Pick the right source in the citation dialog.`,
            })
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    return true;
  };

  const ekle = async (indeks: number, yerineKoy: boolean) => {
    const kayit = mesajlar[indeks];
    if (!kayit?.ekMetin || !kayit.aralik) return;
    if (await metniEkle({ ekMetin: kayit.ekMetin, aralik: kayit.aralik, gorev: kayit.gorev, kayitId: kayit.kayitId }, yerineKoy)) {
      setMesajlar((onceki) => onceki.map((m, i) => (i === indeks ? { ...m, eklendi: true } : m)));
    }
  };

  /*
    Kartın "Eklendi" durumu belgeden türetilir (20.11.2026): Ctrl+Z ile geri
    alınan metnin kartı yeniden eklenebilir olur. Tarama yazmayı izleyerek
    300 ms bekletilir; her tuşta bütün belgeyi gezmek P2.9'da kaldırılan
    maliyetin aynısı olurdu.
  */
  const [belgedekiKayitlar, setBelgedekiKayitlar] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!acik) return;
    let zamanlayici: ReturnType<typeof setTimeout> | undefined;
    const tara = () => setBelgedekiKayitlar(asistanKayitlari(editor.state.doc));
    const planla = () => {
      clearTimeout(zamanlayici);
      zamanlayici = setTimeout(tara, 300);
    };
    planla();
    editor.on("update", planla);
    return () => {
      clearTimeout(zamanlayici);
      editor.off("update", planla);
    };
  }, [editor, acik]);
  const eklendiMi = (m: Kayit) => Boolean(m.eklendi) && (!m.kayitId || !belgedekiKayitlar || belgedekiKayitlar.has(m.kayitId));

  const kopyala = async (metin: string) => {
    try {
      await navigator.clipboard.writeText(metin);
      showToast("success", t({ tr: "Kopyalandı.", en: "Copied." }));
    } catch {
      showToast("error", t({ tr: "Kopyalanamadı.", en: "Couldn't copy." }));
    }
  };

  const begenmedim = (indeks: number) => {
    const kayitId = mesajlar[indeks]?.kayitId;
    if (!kayitId) return;
    setMesajlar((onceki) => onceki.map((m, j) => (j === indeks ? { ...m, begenilmedi: true } : m)));
    void asistanPuanla(kayitId, "faydasiz", "panelde beğenilmedi").catch(() => undefined);
  };

  /*
    ALTTAN AÇILAN YAPRAK ARAÇ ÇUBUĞUNU ÖRTMEZ (17.11.2026, RELEASE CLOSURE 05).
    Telefonda (760 px ve altı; 19.11.2026'ya kadar 1180 px ve altı) panel alttan açılan bir yaprak; eskiden yüksekliği
    sabit %70'ti ve sayfa en üstteyken araç çubuğu (1024 px'te 255–313, 390
    px'te 279–337) yaprağın altında kalıyordu (studyo-kabul.mjs U3). Yaprağın
    üst kenarı açılışta ve yeniden boyutlanınca araç çubuğunun altına
    hizalanır; yaprak yine de ekranın en az %40'ını kaplar, en çok %70'ini.
    Belge kaydırılınca araç çubuğu üste yapışır, yaprağın üstünde kalır.
  */
  useEffect(() => {
    if (!acik) return;
    /*
      Son yazılan değer tutulur: kaydırma her karede bir olay üretir ve değer çoğu
      zaman aynıdır; aynı değeri yeniden yazmak her seferinde stil geçersizleştirir.
    */
    let son: string | null = null;
    const hizala = () => {
      const panel = panelRef.current;
      if (!panel) return;
      if (!window.matchMedia("(max-width: 760px)").matches) {
        if (son !== "") panel.style.removeProperty("--yaprak-ust");
        son = "";
        return;
      }
      const cubuk = document.querySelector(".manuscript-araclar")?.getBoundingClientRect();
      const yuk = window.innerHeight;
      const ust = cubuk ? Math.min(Math.max(cubuk.bottom + 8, yuk * 0.3), yuk * 0.6) : yuk * 0.3;
      const deger = `${Math.round(ust)}px`;
      if (deger === son) return;
      son = deger;
      panel.style.setProperty("--yaprak-ust", deger);
    };
    /*
      Kaydırmada ve araç çubuğunun boyu değişince de yeniden ölçülür (RC06,
      17.11.2026). Eskiden yalnızca açılışta ve "resize"da ölçülüyordu: belge
      aşağı kaydırılmışken açılan yaprak, üste yapışmış araç çubuğuna göre
      (ekranın %30'u) yerleşiyor, sayfa yukarı dönünce araç çubuğu eski yerine
      (390 px'te 279–337) iniyor ve yaprağın altında kalıyordu — bütün düğmeler
      erişilemez (studyo-kabul.mjs U3'ün aralıklı düşmesi; tıklama sayfayı
      kaydırdığında oluyordu).

      Kaydırmada ölçüm OLAYIN İÇİNDE yapılır, rAF'a ertelenmez (RC06d,
      17.11.2026). Eskiden kaydırma da rAF'a erteleniyordu: tarayıcı kaydırma
      olayını karenin başında, rAF geri çağrılarından ÖNCE dağıtıyor; ertelenen
      hizalama aynı karenin rAF sırasının sonuna düşüyor ve o aralıkta yaprak
      eski konumunda kalıyordu (denetimli deney: kaydırmadan sonraki ilk rAF'ta
      40/40 örtük, karenin çiziminden sonra 0/40). Tarayıcı her kaydırılan öğe
      için kare başına en çok bir olay dağıtır; olay başına tek ölçüm yapılır,
      değer değişmediyse stil yazılmaz.
      Boyut değişiklikleri (resize, ResizeObserver) kare başına bir ölçümle
      rAF'ta kalır: onlar bir karede birden çok kez gelebilir.
    */
    let kare = 0;
    const planla = () => {
      if (kare) return;
      kare = window.requestAnimationFrame(() => {
        kare = 0;
        hizala();
      });
    };
    hizala();
    window.addEventListener("resize", planla);
    window.addEventListener("scroll", hizala, { passive: true, capture: true });
    const cubuk = document.querySelector(".manuscript-araclar");
    const gozlem = cubuk && typeof ResizeObserver !== "undefined" ? new ResizeObserver(planla) : null;
    if (cubuk) gozlem?.observe(cubuk);
    return () => {
      window.removeEventListener("resize", planla);
      window.removeEventListener("scroll", hizala, { capture: true });
      gozlem?.disconnect();
      if (kare) window.cancelAnimationFrame(kare);
    };
  }, [acik]);

  /*
    TELEFONDA KLAVYE (görsel uyum 2, 19.11.2026). Panel telefonda tam ekran
    (gorsel-uyum.css). Android Chrome (108+) ve iOS klavye açılınca yalnızca
    GÖRÜNEN alanı küçültür; "bottom: 0" ile sabitlenmiş panelin altı (istem
    ve Gönder) klavyenin arkasında kalır ya da tarayıcı istemi göstermek için
    görünümü kaydırıp başlığı ekrandan çıkarır. Panel görünen alanın
    (visualViewport) üstüne ve yüksekliğine bağlanır: başlık, kapat ve istem
    görünür kalır, yalnızca sohbet listesi kayar. visualViewport yoksa CSS
    varsayılanı (tam ekran) geçerli. Panel kapalıyken çizilmediği için etki
    `acik`'a bağlı: her açılışta yeniden bağlanır.
  */
  useEffect(() => {
    const panel = panelRef.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!acik || !panel || !vv) return;
    const uygula = () => {
      if (!window.matchMedia("(max-width: 760px)").matches) {
        panel.style.removeProperty("--gorunur-ust");
        panel.style.removeProperty("--gorunur-h");
        return;
      }
      panel.style.setProperty("--gorunur-ust", `${Math.round(vv.offsetTop)}px`);
      panel.style.setProperty("--gorunur-h", `${Math.round(vv.height)}px`);
    };
    uygula();
    vv.addEventListener("resize", uygula);
    vv.addEventListener("scroll", uygula);
    return () => {
      vv.removeEventListener("resize", uygula);
      vv.removeEventListener("scroll", uygula);
    };
  }, [acik]);

  if (!acik) return null;
  const hizli: { gorev: YazimGorevi; ad: string }[] = [
    { gorev: "devam", ad: t({ tr: "Devam ettir", en: "Continue" }) },
    { gorev: "paragraf", ad: t({ tr: "Paragraf yaz", en: "Write paragraph" }) },
    { gorev: "akademik", ad: t({ tr: "Akademikleştir", en: "Make academic" }) },
    { gorev: "kisalt", ad: t({ tr: "Kısalt", en: "Shorten" }) },
    { gorev: "genislet", ad: t({ tr: "Genişlet", en: "Expand" }) },
    { gorev: "anahat", ad: t({ tr: "Ana hat", en: "Outline" }) },
  ];
  /* Boşken çiplerde yalnızca seçim isteyenler kalır; ötekiler kartlarda. */
  const seciliIcin = new Set<YazimGorevi>(["akademik", "kisalt", "genislet"]);
  const gorunenCipler = mesajlar.length ? hizli : hizli.filter((h) => seciliIcin.has(h.gorev));
  const ornekIstek = t({ tr: "Şu konuda bir paragraf yaz: ", en: "Write a paragraph about: " });
  /* "Kendi isteğini yaz": kutuya başlangıç koyup imleci sona götürür. */
  const kendiIstegi = () => {
    setIstek(ornekIstek);
    window.requestAnimationFrame(() => {
      const kutu = girdiRef.current;
      if (!kutu) return;
      kutu.focus();
      kutu.setSelectionRange(kutu.value.length, kutu.value.length);
    });
  };
  const baslangic = [
    {
      ikon: PenLine,
      ad: t({ tr: "Bu bölüme paragraf yaz", en: "Write a paragraph here" }),
      aciklama: t({ tr: "İmlecin olduğu bölüme ve önceki metne göre", en: "Based on the section at your cursor and the text before it" }),
      gorev: "paragraf" as YazimGorevi,
    },
    {
      ikon: StepForward,
      ad: t({ tr: "Kaldığım yerden devam et", en: "Continue where I left off" }),
      aciklama: t({ tr: "İmlecin önündeki metni sürdürür", en: "Picks up the text before your cursor" }),
      gorev: "devam" as YazimGorevi,
    },
    {
      ikon: ListTree,
      ad: t({ tr: "Ana hat çıkar", en: "Draft an outline" }),
      aciklama: t({ tr: "Kılavuzunuzun zorunlu bölümleriyle başlık iskeleti", en: "Heading skeleton with your guideline's required sections" }),
      gorev: "anahat" as YazimGorevi,
    },
    {
      ikon: MessageSquareText,
      ad: t({ tr: "Kendi isteğini yaz", en: "Ask in your own words" }),
      aciklama: t({ tr: "Kutuya bir başlangıç koyar, siz tamamlarsınız", en: "Starts the box for you to finish" }),
      gorev: null,
    },
  ];

  return (
    <aside ref={panelRef} className="yazim-paneli" aria-label={t({ tr: "Yazım asistanı", en: "Writing assistant" })}>
      <header className="yazim-paneli-bas">
        <span>
          <Sparkles size={16} aria-hidden="true" />
          <b>{t({ tr: "Yazım asistanı", en: "Writing assistant" })}</b>
        </span>
        <button type="button" className="yazim-ikon" onClick={onKapat} aria-label={t({ tr: "Paneli kapat", en: "Close panel" })}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="yazim-sekmeler" role="tablist" aria-label={t({ tr: "Asistan görünümü", en: "Assistant view" })}>
        <button type="button" role="tab" id="yazim-sekme-sohbet" aria-selected={sekme === "sohbet"} aria-controls="yazim-sekme-icerik" onClick={() => setSekme("sohbet")}>
          {t({ tr: "Sohbet", en: "Chat" })}
        </button>
        <button type="button" role="tab" id="yazim-sekme-kayitli" aria-selected={sekme === "kayitli"} aria-controls="yazim-sekme-icerik" onClick={() => setSekme("kayitli")}>
          <History size={14} aria-hidden="true" /> {t({ tr: "Kayıtlı", en: "Saved" })}
        </button>
      </div>
      {sekme === "kayitli" ? (
        <div id="yazim-sekme-icerik" role="tabpanel" aria-labelledby="yazim-sekme-kayitli" className="yazim-paneli-liste">
          <KayitliCevaplar
            projectId={projectId}
            onEkle={(c) => {
              const { from, to } = editor.state.selection;
              return metniEkle({ ekMetin: c.metin, aralik: { from, to }, gorev: c.gorev, kayitId: c.id }, false);
            }}
            onKopyala={(metin) => void kopyala(metin)}
          />
        </div>
      ) : (
        <>

      <div className="yazim-paneli-liste" ref={listeRef} aria-live="polite">
        {mesajlar.length === 0 ? (
          /*
            Boş panel bir BAŞLANGIÇ menüsü (04.11.2026). Eskiden burada iki
            paragraf kural metni vardı ve düğmeler en altta küçük çipler
            hâlindeydi: öğrenci ne isteyebileceğini metinden çıkarmak
            zorundaydı. Kartlar en sık dört işi doğrudan başlatıyor; kural
            metni (atıf ve sayı sınırı) dipnota indi ama kaybolmadı.
          */
          <div className="yazim-paneli-bos">
            <div className="yazim-bos-bas">
              <span className="yazim-bos-ikon" aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <b>{t({ tr: "Ne yazalım?", en: "What shall we write?" })}</b>
              <small>
                {t({
                  tr: "Yazdıklarım metninize kendiliğinden girmez; eklemek size kalır.",
                  en: "Nothing I write enters your text by itself; inserting it is up to you.",
                })}
              </small>
            </div>
            <div className="yazim-baslangic">
              {baslangic.map((b) => (
                <button key={b.ad} type="button" className="yazim-baslangic-kart" onClick={() => (b.gorev ? void gonder(b.gorev) : kendiIstegi())} disabled={bekliyor}>
                  <b.ikon size={16} aria-hidden="true" />
                  <span>
                    <b>{b.ad}</b>
                    <small>{b.aciklama}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="yazim-bos-not">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>
                {t({
                  tr: "Yalnızca Literatür kütüphanenizdeki kaynaklara atıf yaparım ve metninizde ya da isteğinizde olmayan bir sayı yazmam. Kurumunuzun yapay zekâ kullanım kurallarına uymak sizin sorumluluğunuzdadır.",
                  en: "I only cite sources in your Literature library and never write a number that isn't in your text or request. Following your institution's AI-use rules is your responsibility.",
                })}
              </span>
            </p>
          </div>
        ) : (
          /*
            DOLU SOHBET (04.11.2026). Asistanın önerisi artık başlıklı bir
            kart: ne olduğu yazıyor ("Önerilen paragraf", "Ana hat"…),
            metin belge yazısıyla, eylemler kartın altında. Eskiden
            asistanın açıklaması ile önerdiği metin aynı düz akıştaydı ve
            hangisinin belgeye gireceği ilk bakışta seçilmiyordu.
            "Beğenmedim" eğitim verisine olumsuz işaret yazıyor
            (lib/ai/kayit.ts); eklemek zaten olumlu işaret.
          */
          mesajlar.map((m, i) =>
            m.rol === "kullanici" ? (
              <div key={i} className="yazim-mesaj" data-rol="kullanici">
                <p>{m.metin}</p>
              </div>
            ) : (
              <div key={i} className="yazim-mesaj" data-rol="asistan">
                {m.metin ? (
                  <div className="yazim-asistan-satir">
                    <span className="yazim-asistan-ikon" aria-hidden="true">
                      <Sparkles size={12} />
                    </span>
                    <p>{m.metin}</p>
                  </div>
                ) : null}
                {m.ekMetin ? (
                  <div className="yazim-oneri" data-eklendi={eklendiMi(m) || undefined}>
                    <div className="yazim-oneri-bas">
                      <small>{t(ONERI_ADI[m.gorev ?? "serbest"])}</small>
                      <span>
                        <button type="button" className="yazim-ikon" onClick={() => void kopyala(m.ekMetin!)} aria-label={t({ tr: "Kopyala", en: "Copy" })} title={t({ tr: "Kopyala", en: "Copy" })}>
                          <Copy size={14} aria-hidden="true" />
                        </button>
                        {m.kayitId ? (
                          <button
                            type="button"
                            className="yazim-ikon"
                            data-secili={m.begenilmedi || undefined}
                            disabled={m.begenilmedi || eklendiMi(m)}
                            onClick={() => begenmedim(i)}
                            aria-label={t({ tr: "Beğenmedim", en: "Not helpful" })}
                            title={m.begenilmedi ? t({ tr: "Bildirildi, teşekkürler", en: "Noted, thanks" }) : t({ tr: "Beğenmedim", en: "Not helpful" })}
                          >
                            <ThumbsDown size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </span>
                    </div>
                    <div className="yazim-oneri-metin">
                      {m.gorev === "anahat" && anaHattiCozumle(m.ekMetin).length ? (
                        <ul className="yazim-anahat">
                          {anaHattiCozumle(m.ekMetin).map((s, j) => (
                            <li key={j} data-duzey={s.duzey}>
                              <b>{s.baslik}</b>
                              {s.notlar.map((n, k) => (
                                <small key={k}>{n}</small>
                              ))}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        paragraflara(m.ekMetin).map((p, j) => <p key={j}>{p}</p>)
                      )}
                    </div>
                    {m.gorev === "kisalt" && m.secimMetni && kisaltmaUyarilari(m.secimMetni, m.ekMetin).length ? (
                      <ul className="yazim-oneri-uyari" aria-label={t({ tr: "Kontrol edin", en: "Check" })}>
                        {kisaltmaUyarilari(m.secimMetni, m.ekMetin).map((u) => (
                          <li key={u}>{t(KISALTMA_UYARISI[u])}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="yazim-oneri-eylem">
                      <button type="button" className="projects-primary-button button-compact" onClick={() => void ekle(i, false)} disabled={eklendiMi(m)}>
                        {eklendiMi(m) ? <Check size={14} aria-hidden="true" /> : <CornerDownLeft size={14} aria-hidden="true" />}
                        {eklendiMi(m) ? t({ tr: "Eklendi", en: "Inserted" }) : t({ tr: "İmlece ekle", en: "Insert at cursor" })}
                      </button>
                      {m.secimVardi ? (
                        <button type="button" className="projects-filter-button button-compact" onClick={() => void ekle(i, true)} disabled={eklendiMi(m)}>
                          <Replace size={14} aria-hidden="true" />
                          {t({ tr: "Seçilenin yerine koy", en: "Replace selection" })}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ),
          )
        )}
        {bekliyor ? (
          <div className="yazim-mesaj" data-rol="asistan" role="status">
            <div className="yazim-asistan-satir">
              <span className="yazim-asistan-ikon" aria-hidden="true">
                <Sparkles size={12} />
              </span>
              <span className="yazim-yaziyor" aria-label={t({ tr: "Yazıyor…", en: "Writing…" })}>
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="yazim-hizli">
        {mesajlar.length ? null : <small className="yazim-hizli-etiket">{t({ tr: "Seçili metin için", en: "For selected text" })}</small>}
        {gorunenCipler.map((h) => (
          <button key={h.gorev} type="button" className="yazim-hizli-dugme" onClick={() => void gonder(h.gorev)} disabled={bekliyor}>
            {h.ad}
          </button>
        ))}
      </div>
      <form
        className="yazim-girdi"
        onSubmit={(e) => {
          e.preventDefault();
          void gonder(istek.trim() ? "serbest" : "devam");
        }}
      >
        <textarea
          ref={girdiRef}
          className="field-control"
          rows={3}
          value={istek}
          maxLength={1500}
          placeholder={t({
            tr: "Örn. Giriş için Phillips eğrisinin Türkiye'deki önemini anlatan bir paragraf yaz",
            en: "E.g. Write a paragraph for the introduction on why the Phillips curve matters for Turkey",
          })}
          onChange={(e) => setIstek(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" className="projects-primary-button button-compact" disabled={bekliyor || !istek.trim()} aria-label={t({ tr: "Gönder", en: "Send" })}>
          <ArrowUp size={16} aria-hidden="true" />
        </button>
      </form>
        </>
      )}
    </aside>
  );
}
