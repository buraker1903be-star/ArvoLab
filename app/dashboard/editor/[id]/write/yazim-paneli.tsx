"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ArrowUp, Check, Copy, CornerDownLeft, ListTree, ThumbsDown, MessageSquareText, PenLine, Replace, ShieldCheck, Sparkles, StepForward } from "lucide-react";
import { yazimAsistani } from "@/app/actions/ai-yazim";
import { asistanPuanla } from "@/app/actions/ai-puan";
import { ASISTAN_IZI } from "@/lib/tiptap-asistan-izi";
import { anaHattiCozumle } from "@/lib/ai/yazim-metni";
import { paragraflara, type SohbetMesaji } from "@/lib/ai/yazim-metni";
import type { YazimGorevi } from "@/lib/ai/yazim-asistani";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { collectHeadings } from "./editor-navigation";
import { aralikMetni, araligiBirak, araligiDogrula, araligiIzle, izlenenAralik } from "@/lib/tiptap-asistan-araligi";
import { aiAdimiBaslat, aiAdiminiKapat } from "@/lib/ai-duzenleme";

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

  KONUM GÜVENLİĞİ (Signature OS 4.3, 05.11.2026). Eskiden o yer istek
  anındaki iki SAYIYDI (from, to) ve belge arada değişince güncellenmiyordu:
  öğrenci cevabı beklerken seçimin önüne yazdıysa YANLIŞ metin
  değiştiriliyordu. Artık aralık editörde izleniyor (belge değiştikçe
  kayıyor, lib/tiptap-asistan-araligi.ts) ve değiştirmeden hemen önce
  aralıktaki metnin istekteki seçimle birebir aynı olduğu doğrulanıyor;
  değilse değiştirme yapılmıyor, öğrenciden yeniden seçmesi isteniyor.
  AI değişikliği geçmişte kendi adımıdır: Ctrl+Z öncesi ya da sonrası
  yazılanla birlikte geri almaz (lib/ai-duzenleme.ts).
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
type Kayit = SohbetMesaji & {
  ekMetin?: string;
  kayitId?: string | null;
  aralik?: Aralik;
  /** İzlenen aralığın kimliği (lib/tiptap-asistan-araligi.ts) ve istekteki seçimin metni. */
  oneriId?: string;
  secimMetni?: string;
  secimVardi?: boolean;
  eklendi?: boolean;
  gorev?: YazimGorevi;
  begenilmedi?: boolean;
  /** Uygulanamadığında kartta kalan açıklama (seçim değişti, silindi…). */
  uyari?: string;
};
let oneriSayaci = 0;

export default function YazimPaneli({
  editor,
  projectId,
  acik,
  zorunluBolumler = [],
}: {
  editor: Editor;
  projectId: string;
  /** Asistan görünümü şu an görünür mü: görünür olunca istek kutusu odak alır. */
  acik: boolean;
  /** Kılavuzun zorunlu bölümleri: ana hat görevinin omurgası. */
  zorunluBolumler?: string[];
}) {
  const t = useCeviri();
  const [mesajlar, setMesajlar] = useState<Kayit[]>([]);
  const [istek, setIstek] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const listeRef = useRef<HTMLDivElement>(null);
  const girdiRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // preventScroll: panel yapışık bir sütun; odak sayfayı kutunun hizasına kaydırmasın.
    if (acik) window.requestAnimationFrame(() => girdiRef.current?.focus({ preventScroll: true }));
  }, [acik]);
  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: "smooth" });
  }, [mesajlar, bekliyor]);

  const gonder = async (gorev: YazimGorevi, metin = istek) => {
    if (bekliyor) return;
    const { from, to } = editor.state.selection;
    const doc = editor.state.doc;
    /* Doğrulamayla AYNI okuma (aralikMetni): uygulamadan önce bu metinle karşılaştırılır. */
    const secim = from !== to ? aralikMetni(doc, from, to) : "";
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
    /* Aralık İSTEK ANINDA izlemeye alınır; cevap gelene kadar yazılanlara göre kayar. */
    const oneriId = `oneri-${++oneriSayaci}`;
    editor.view.dispatch(araligiIzle(editor.state.tr, oneriId, from, to));
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
        { rol: "asistan", metin: cevap.yanit ?? "", ekMetin: cevap.metin || undefined, kayitId: cevap.kayitId, aralik: { from, to }, oneriId, secimMetni: secim, secimVardi: from !== to, gorev },
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

  const ekle = (indeks: number, yerineKoy: boolean) => {
    const kayit = mesajlar[indeks];
    if (!kayit?.ekMetin || !kayit.aralik || !kayit.oneriId) return;
    const uyar = (uyari: string) => {
      setMesajlar((onceki) => onceki.map((m, i) => (i === indeks ? { ...m, uyari } : m)));
      showToast("error", uyari);
    };
    /*
      Hedef: izlenen aralık (belge değiştikçe kaymış hâli). Değiştirmede
      aralığın metni istekteki seçimle BİREBİR aynı olmalı; ekleme yalnızca
      bir konum istediği için izlenen aralığın sonunu kullanır.
    */
    let from: number;
    let to: number;
    if (yerineKoy && kayit.secimVardi) {
      const d = araligiDogrula(editor.state, kayit.oneriId, kayit.secimMetni ?? "");
      if (!d.tamam) {
        uyar(
          d.neden === "degisti"
            ? t({ tr: "Seçtiğiniz metin siz beklerken değişti; yanlış metni değiştirmemek için uygulanmadı. Metni yeniden seçip tekrar isteyin.", en: "The text you selected changed while you waited; it wasn't applied so the wrong text isn't replaced. Select the text again and ask again." })
            : t({ tr: "Seçtiğiniz metin artık belgede yok ya da bulunamıyor; değiştirme yapılmadı. Metni yeniden seçip tekrar isteyin.", en: "The text you selected is no longer in the document or can't be found; nothing was replaced. Select the text again and ask again." }),
        );
        return;
      }
      ({ from, to } = d);
    } else {
      const a = izlenenAralik(editor.state, kayit.oneriId);
      const boyut = editor.state.doc.content.size;
      from = Math.min(a?.from ?? kayit.aralik.from, boyut);
      to = Math.min(a?.to ?? kayit.aralik.to, boyut);
    }
    /* Uygulanan aralık izlemeden bırakılır; AI değişikliği geçmişte kendi adımı (aiAdimiBaslat/aiAdiminiKapat). */
    const zincir = () =>
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          aiAdimiBaslat(tr);
          araligiBirak(tr, kayit.oneriId!);
          return true;
        });
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
      tamam = zincir().insertContentAt($pos.depth >= 1 ? $pos.after(1) : to, dugumlerAnaHat).run();
    } else if (yerineKoy && from !== to) {
      const paragraflar = paragraflara(kayit.ekMetin);
      // Tek paragraf seçimin yerine satır içi girer; çok paragraf blok olarak.
      tamam =
        paragraflar.length === 1
          ? zincir().insertContentAt({ from, to }, izliMetin(paragraflar[0], kayit.kayitId)).run()
          : zincir().insertContentAt({ from, to }, dugumler(kayit.ekMetin, kayit.kayitId)).run();
    } else {
      /* İmlecin bulunduğu bloğun SONUNA: paragrafın ortasına blok eklemek onu ikiye bölerdi. Boş paragraftaysa onun yerine. */
      const $pos = editor.state.doc.resolve(to);
      const blok = $pos.depth >= 1 ? $pos.node(1) : null;
      const bosParagraf = blok?.type.name === "paragraph" && blok.textContent.trim() === "";
      tamam = bosParagraf
        ? zincir().insertContentAt({ from: $pos.before(1), to: $pos.after(1) }, dugumler(kayit.ekMetin, kayit.kayitId)).run()
        : zincir().insertContentAt($pos.depth >= 1 ? $pos.after(1) : to, dugumler(kayit.ekMetin, kayit.kayitId)).run();
    }
    if (!tamam) {
      showToast("error", t({ tr: "Metin eklenemedi; imleci metnin içine koyup tekrar deneyin.", en: "Couldn't insert the text; place the cursor in the text and try again." }));
      return;
    }
    /* Sonraki yazım AI adımına eklenmesin: Ctrl+Z ikisini birden geri almasın. */
    editor.view.dispatch(aiAdiminiKapat(editor.state));
    setMesajlar((onceki) => onceki.map((m, i) => (i === indeks ? { ...m, eklendi: true, uyari: undefined } : m)));
    if (kayit.kayitId) void asistanPuanla(kayit.kayitId, "faydali", "metne eklendi").catch(() => undefined);
    showToast("success", t({ tr: "Metin eklendi; okuyup kendi sözcüklerinizle düzenleyin.", en: "Text inserted; read it and edit it in your own words." }));
  };

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

  /* Kapalıyken de kurulu kalır (yazım panelinin görünümleri gizlenir, sökülmez): sohbet sekme değişince kaybolmasın. */
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
    /*
      Signature OS Phase 2: asistan artık yazım panelinin "Asistan"
      görünümü (yan-panel.tsx). Eskiden ekranın sağına sabitlenmiş ayrı
      bir kutuydu ve "İncele" panelinin üstüne biniyordu; kendi başlığı ve
      kapat düğmesi panelin sekmesi ve kapat düğmesiyle yineleniyordu.
    */
    <div className="yazim-paneli">

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
                  <div className="yazim-oneri" data-eklendi={m.eklendi || undefined}>
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
                            disabled={m.begenilmedi || m.eklendi}
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
                    {m.uyari ? (
                      <p className="yazim-oneri-uyari" role="alert">
                        {m.uyari}
                      </p>
                    ) : null}
                    <div className="yazim-oneri-eylem">
                      <button type="button" className="projects-primary-button button-compact" onClick={() => ekle(i, false)} disabled={m.eklendi}>
                        {m.eklendi ? <Check size={14} aria-hidden="true" /> : <CornerDownLeft size={14} aria-hidden="true" />}
                        {m.eklendi ? t({ tr: "Eklendi", en: "Inserted" }) : t({ tr: "İmlece ekle", en: "Insert at cursor" })}
                      </button>
                      {m.secimVardi ? (
                        <button type="button" className="projects-filter-button button-compact" onClick={() => ekle(i, true)} disabled={m.eklendi}>
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
    </div>
  );
}
