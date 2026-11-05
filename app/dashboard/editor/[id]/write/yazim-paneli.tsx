"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Slice } from "@tiptap/pm/model";
import { ArrowUp, Check, Copy, CornerDownLeft, History, ListTree, MessageSquareText, Pencil, PenLine, RotateCcw, ShieldCheck, Sparkles, StepForward, ThumbsDown } from "lucide-react";
import { yazimAsistani } from "@/app/actions/ai-yazim";
import { asistanPuanla } from "@/app/actions/ai-puan";
import { ASISTAN_IZI } from "@/lib/tiptap-asistan-izi";
import { anaHattiCozumle } from "@/lib/ai/yazim-metni";
import { paragraflara, type SohbetMesaji } from "@/lib/ai/yazim-metni";
import type { YazimGorevi } from "@/lib/ai/yazim-asistani";
import { diffTexts } from "@/lib/text-diff";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { collectHeadings } from "./editor-navigation";
import MetinFarki from "./metin-farki";
import { aralikMetni, araligiBirak, araligiDogrula, araligiIzle, izlenenAralik } from "@/lib/tiptap-asistan-araligi";
import { ASISTAN_GOREV_OLAYI, aiAdimiBaslat, bekleyenGoreviAl, aiAdiminiKapat, geriAlmaIslemi, surumGerekir, yeniAralik } from "@/lib/ai-duzenleme";
import { kararKaydet, uygulamaIziEkle, uygulamaIziSil } from "@/lib/ai-kararlari";

/*
  YAZIM ASİSTANI PANELİ (03.11.2026, kurum sahibinin kararı: "paragrafı
  sohbette yazarız, ekleme konusunu kullanıcıya bırakırız").

  Modal DEĞİL, yazım panelinin "Asistan" görünümü: öğrenci metnini görerek
  konuşuyor, panel açıkken editörde yazmaya devam edebiliyor. Asistanın
  yazdığı metin belgeye kendiliğinden girmez.

  KARARLAR (Signature OS 4.3, 05.11.2026). Eskiden kartın altında yalnızca
  "Paragrafın altına ekle" ve "Seçilenin yerine koy" vardı; seçili metni
  yeniden yazan görevlerde (Akademikleştir, Kısalt, Genişlet, seçimle
  serbest istek) yalnızca YENİ metin görünüyordu, neyin değiştiğini
  öğrenci satır satır kendisi karşılaştırıyordu. Eklenen metin geri
  alınamıyordu (yalnızca Ctrl+Z) ve ekleme kayda OTOMATİK "faydalı" puanı
  olarak yazılıyordu. Şimdi:
  - Yeniden yazımda kelime düzeyinde önce/sonra farkı (MetinFarki,
    lib/text-diff.ts). Fark yalnızca bu panelde çizilir; belgeye, kayda,
    sürümlere ve çıktılara girmez.
  - Kabul et / Düzenleyerek kabul et / Reddet; uygulandıktan sonra
    Geri al. Geri al yalnızca asistanın yazdığı aralığı, o metin hâlâ
    aynıysa geri alır; değilse yapmaz ve Sürümler'e yönlendirir
    (lib/ai-duzenleme.ts).
  - Ana hattan ve 150 kelimeyi aşan değişiklikten önce adlı sürüm alınır.
    Sürüm alınamazsa değişiklik UYGULANMAZ; kullanıcı yalnızca yeniden
    deneyebilir ya da vazgeçebilir. 4.3'ün ilk sürümünde bir de "Sürüm
    almadan uygula" vardı; kurum sahibi kaldırttı (4.3 ek): büyük değişiklik
    geri dönüş noktası olmadan belgeye girmemeli.
  - Karar puan DEĞİLDİR (kurum sahibinin kararı, 4.3): yalnızca bu
    oturumda tutulur (lib/ai-kararlari.ts). Puan yalnızca "Beğenmedim".

  "Paragrafın altına ekle" (4.3): eskiden "İmlece ekle" yazıyordu ama metin
  imlecin olduğu yere değil, imlecin bulunduğu paragrafın ALTINA giriyordu
  (paragrafı ikiye bölmemek için; boş paragraftaysa onun yerine). Davranış
  aynı kaldı, ad yaptığı işi söylüyor.

  KONUM GÜVENLİĞİ (4.3). Eskiden hedef istek anındaki iki SAYIYDI (from,
  to) ve belge arada değişince güncellenmiyordu: öğrenci cevabı beklerken
  seçimin önüne yazdıysa YANLIŞ metin değiştiriliyordu. Artık aralık
  editörde izleniyor (lib/tiptap-asistan-araligi.ts) ve değiştirmeden hemen
  önce aralıktaki metnin istekteki seçimle birebir aynı olduğu
  doğrulanıyor; değilse değiştirme yapılmıyor. AI değişikliği geçmişte
  kendi adımıdır: Ctrl+Z öncesi ya da sonrası yazılanla birlikte geri almaz.
*/

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

type Mod = "degistir" | "altina";
type Kayit = SohbetMesaji & {
  ekMetin?: string;
  kayitId?: string | null;
  /** İzlenen aralığın kimliği (lib/tiptap-asistan-araligi.ts) ve istekteki seçimin metni. */
  oneriId?: string;
  secimMetni?: string;
  secimVardi?: boolean;
  gorev?: YazimGorevi;
  begenilmedi?: boolean;
  durum?: "oneri" | "uygulandi" | "reddedildi" | "geri_alindi";
  /** Uygulanan değişikliğin geri alma bilgisi: eklenen aralığın kimliği, metni ve önceki içerik. */
  uygulama?: { eklenenId: string; eklenenMetin: string; ozgun: Slice };
  /** Düzenleyerek kabulde kutudaki metin; tanımlıysa kart düzenleme kipinde. */
  duzenMetni?: string;
  /** Uygulanamadığında ya da geri alınamadığında kartta kalan açıklama. */
  uyari?: string;
  /** Sürüm alınamadı: aynı değişiklik yalnızca yeniden denenebilir ya da vazgeçilir (sürümsüz uygulama YOK). */
  surumHatasi?: { mod: Mod; metin: string };
  isleniyor?: boolean;
};
let oneriSayaci = 0;

/* Seçili metni yeniden yazan görevler: kartta fark gösterilir, birincil eylem "yerine koy". */
const SECIM_GOREVLERI = new Set<YazimGorevi>(["akademik", "kisalt", "genislet"]);
const yenidenYazim = (m: Kayit) => Boolean(m.secimVardi && m.gorev !== "anahat" && (m.gorev === "serbest" || SECIM_GOREVLERI.has(m.gorev ?? "serbest")));

export default function YazimPaneli({
  editor,
  projectId,
  acik,
  zorunluBolumler = [],
  surumAl,
  surumleriAc,
}: {
  editor: Editor;
  projectId: string;
  /** Asistan görünümü şu an görünür mü: görünür olunca istek kutusu odak alır. */
  acik: boolean;
  /** Kılavuzun zorunlu bölümleri: ana hat görevinin omurgası. */
  zorunluBolumler?: string[];
  /** Büyük değişiklikten önce adlı sürüm: önce kaydeder, sonra sürüm alır. Başarısızsa false. */
  surumAl: (etiket: string) => Promise<boolean>;
  surumleriAc: () => void;
}) {
  const t = useCeviri();
  const [mesajlar, setMesajlar] = useState<Kayit[]>([]);
  const [istek, setIstek] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [seciliVar, setSeciliVar] = useState(() => !editor.state.selection.empty);
  const listeRef = useRef<HTMLDivElement>(null);
  const girdiRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // preventScroll: panel yapışık bir sütun; odak sayfayı kutunun hizasına kaydırmasın.
    if (acik) window.requestAnimationFrame(() => girdiRef.current?.focus({ preventScroll: true }));
  }, [acik]);
  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: "smooth" });
  }, [mesajlar.length, bekliyor]);
  /* "Seçili metni düzenle" grubu seçim yokken pasif görünür; seçim editörde değişir. */
  useEffect(() => {
    const guncelle = () => setSeciliVar(!editor.state.selection.empty);
    editor.on("selectionUpdate", guncelle);
    editor.on("transaction", guncelle);
    return () => {
      editor.off("selectionUpdate", guncelle);
      editor.off("transaction", guncelle);
    };
  }, [editor]);

  const kartGuncelle = (indeks: number, degisim: Partial<Kayit>) => setMesajlar((onceki) => onceki.map((m, i) => (i === indeks ? { ...m, ...degisim } : m)));

  const gonder = async (gorev: YazimGorevi, metin = istek) => {
    if (bekliyor) return;
    const { from, to } = editor.state.selection;
    const doc = editor.state.doc;
    /* Doğrulamayla AYNI okuma (aralikMetni): uygulamadan önce bu metinle karşılaştırılır. */
    const secim = from !== to ? aralikMetni(doc, from, to) : "";
    if (SECIM_GOREVLERI.has(gorev) && !secim) {
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
    // Kimlik yüklemeler arasında da tekil: uygulama izi sayfa yenilense de karışmasın (lib/ai-kararlari.ts).
    const oneriId = `oneri-${Date.now().toString(36)}-${++oneriSayaci}`;
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
        { rol: "asistan", metin: cevap.yanit ?? "", ekMetin: cevap.metin || undefined, kayitId: cevap.kayitId, oneriId, secimMetni: secim, secimVardi: from !== to, gorev, durum: cevap.metin ? "oneri" : undefined },
      ]);
    } catch (hata) {
      console.error(hata);
      setMesajlar((onceki) => [...onceki, { rol: "asistan", metin: t({ tr: "Asistana ulaşılamadı; bağlantınızı kontrol edin.", en: "Couldn't reach the assistant; check your connection." }) }]);
    } finally {
      setBekliyor(false);
    }
  };

  /* Seçim üstündeki Arvo AI düğmesi ve kısayol görevi bu olayla gönderir (panel dinamik yüklenir). */
  const gonderRef = useRef(gonder);
  useEffect(() => {
    gonderRef.current = gonder;
  });
  useEffect(() => {
    const dinle = () => {
      const gorev = bekleyenGoreviAl();
      if (gorev) void gonderRef.current(gorev, "");
    };
    dinle();
    window.addEventListener(ASISTAN_GOREV_OLAYI, dinle);
    return () => window.removeEventListener(ASISTAN_GOREV_OLAYI, dinle);
  }, []);

  /*
    Eklenen metin asistan iziyle girer (lib/tiptap-asistan-izi.ts):
    yazarlık raporu belgede duran asistan metnini buradan sayıyor.
    Düzenleyerek kabul edilen metin de izli girer: çıkış noktası asistan.
  */
  const izliMetin = (text: string, kayit: string | null | undefined) => ({ type: "text", text, marks: [{ type: ASISTAN_IZI, attrs: { kayit: kayit ?? null } }] });
  const dugumler = (metin: string, kayit?: string | null) => paragraflara(metin).map((p) => ({ type: "paragraph", content: [izliMetin(p, kayit)] }));

  const uygula = async (indeks: number, mod: Mod, secenek: { metin?: string } = {}) => {
    const kayit = mesajlar[indeks];
    if (!kayit?.ekMetin || !kayit.oneriId || kayit.isleniyor) return;
    const metin = (secenek.metin ?? kayit.ekMetin).trim();
    if (!metin) return;
    const degistir = mod === "degistir" && Boolean(kayit.secimVardi);
    const gorev = kayit.gorev ?? "serbest";
    /*
      Uyarı yalnızca KARTTA (role="alert": ekran okuyucu duyurur). 4.3 ekine
      kadar aynı metin bir de hata bildirimi olarak çıkıyordu; telefonda
      bildirim ekranın altında kartın "Tekrar dene / Vazgeç" düğmelerinin
      üstüne biniyordu.
    */
    const uyar = (uyari: string, ek: Partial<Kayit> = {}) => {
      kartGuncelle(indeks, { uyari, isleniyor: false, ...ek });
    };

    /* 1) Büyük değişiklikten ÖNCE adlı sürüm. Alınamazsa değişiklik sessizce uygulanmaz. */
    let surumAlindi = false;
    if (surumGerekir(gorev, degistir ? (kayit.secimMetni ?? "") : "", metin)) {
      kartGuncelle(indeks, { isleniyor: true });
      const etiket = gorev === "anahat" ? t({ tr: "Ana hat eklenmeden önce", en: "Before outline insert" }) : t({ tr: "Asistan değişikliğinden önce", en: "Before assistant change" });
      let alindi = false;
      try {
        alindi = await surumAl(etiket);
      } catch {
        alindi = false;
      }
      if (!alindi) {
        uyar(
          t({
            tr: "Bu büyük bir değişiklik ve öncesinde sürüm alınamadı; belgeniz korunsun diye değişiklik uygulanmadı. Bağlantınızı kontrol edip tekrar deneyin ya da vazgeçin.",
            en: "This is a large change and a version couldn't be saved first; the change wasn't applied to protect your document. Check your connection and try again, or cancel.",
          }),
          { surumHatasi: { mod, metin } },
        );
        return;
      }
      surumAlindi = true;
    }

    /*
      2) Hedef: izlenen aralık (belge değiştikçe kaymış hâli). Değiştirmede
      aralığın metni istekteki seçimle BİREBİR aynı olmalı; ekleme yalnızca
      bir konum istediği için izlenen aralığın sonunu kullanır.
    */
    const state = editor.state;
    let hFrom: number;
    let hTo: number;
    if (degistir) {
      const d = araligiDogrula(state, kayit.oneriId, kayit.secimMetni ?? "");
      if (!d.tamam) {
        uyar(
          d.neden === "degisti"
            ? t({ tr: "Seçtiğiniz metin siz beklerken değişti; yanlış metni değiştirmemek için uygulanmadı. Metni yeniden seçip tekrar isteyin.", en: "The text you selected changed while you waited; it wasn't applied so the wrong text isn't replaced. Select the text again and ask again." })
            : t({ tr: "Seçtiğiniz metin artık belgede yok ya da bulunamıyor; değiştirme yapılmadı. Metni yeniden seçip tekrar isteyin.", en: "The text you selected is no longer in the document or can't be found; nothing was replaced. Select the text again and ask again." }),
        );
        return;
      }
      ({ from: hFrom, to: hTo } = d);
    } else {
      const a = izlenenAralik(state, kayit.oneriId);
      if (!a) {
        uyar(t({ tr: "Önerinin yeri bulunamadı; uygulanmadı. İmleci istediğiniz yere koyup yeniden isteyin.", en: "The suggestion's place couldn't be found; it wasn't applied. Place the cursor and ask again." }));
        return;
      }
      /* İmlecin bulunduğu bloğun SONUNA: paragrafın ortasına blok eklemek onu ikiye bölerdi. Boş paragraftaysa onun yerine. */
      const $pos = state.doc.resolve(Math.min(a.to, state.doc.content.size));
      const blok = $pos.depth >= 1 ? $pos.node(1) : null;
      const bosParagraf = gorev !== "anahat" && blok?.type.name === "paragraph" && blok.textContent.trim() === "";
      if (bosParagraf) {
        hFrom = $pos.before(1);
        hTo = $pos.after(1);
      } else {
        hFrom = hTo = $pos.depth >= 1 ? $pos.after(1) : $pos.pos;
      }
    }

    const anaHat = gorev === "anahat" ? anaHattiCozumle(metin) : [];
    const paragraflar = paragraflara(metin);
    /*
      Ana hat başlık ve not olarak girer; not köşeli parantezde: öğrencinin
      yerine yazacağı yer tutucu olduğu görülsün. Tek paragraflık yeniden
      yazım seçimin yerine satır içi girer; çok paragraf blok olarak.
    */
    const icerik = anaHat.length
      ? anaHat.flatMap((s) => [
          { type: "heading", attrs: { level: s.duzey }, content: [izliMetin(s.baslik, kayit.kayitId)] },
          ...s.notlar.map((n) => ({ type: "paragraph", content: [izliMetin(`[${n}]`, kayit.kayitId)] })),
        ])
      : degistir && paragraflar.length === 1
        ? izliMetin(paragraflar[0], kayit.kayitId)
        : dugumler(metin, kayit.kayitId);

    /* 3) Önceki içerik ve eklenen aralık: "Geri al" yalnızca bunu geri koyar. */
    const ozgun = hTo > hFrom ? state.doc.slice(hFrom, hTo) : Slice.empty;
    const eklenenId = `${kayit.oneriId}:eklenen`;
    const tamam = editor
      .chain()
      .focus()
      .command(({ tr }) => {
        aiAdimiBaslat(tr);
        return true;
      })
      .insertContentAt({ from: hFrom, to: hTo }, icerik)
      .command(({ tr }) => {
        const y = yeniAralik(tr, hFrom, hTo);
        araligiIzle(tr, eklenenId, y.from, y.to);
        return true;
      })
      .run();
    if (!tamam) {
      uyar(t({ tr: "Metin eklenemedi; imleci metnin içine koyup tekrar deneyin.", en: "Couldn't insert the text; place the cursor in the text and try again." }));
      return;
    }
    /* Sonraki yazım AI adımına eklenmesin (Ctrl+Z ikisini birden geri almasın); istek aralığı izlemeden çıkar. */
    editor.view.dispatch(araligiBirak(aiAdiminiKapat(editor.state), kayit.oneriId));
    const a = izlenenAralik(editor.state, eklenenId);
    const eklenenMetin = a ? aralikMetni(editor.state.doc, a.from, a.to) : "";
    kartGuncelle(indeks, { durum: "uygulandi", uyari: undefined, surumHatasi: undefined, duzenMetni: undefined, isleniyor: false, uygulama: { eklenenId, eklenenMetin, ozgun } });
    uygulamaIziEkle(projectId, eklenenId, surumAlindi);
    kararKaydet(kayit.kayitId, secenek.metin !== undefined && secenek.metin.trim() !== kayit.ekMetin.trim() ? "duzenleyerek_kabul" : mod === "altina" && kayit.secimVardi ? "altina_eklendi" : "kabul");
    showToast("success", t({ tr: "Metin eklendi; okuyup kendi sözcüklerinizle düzenleyin.", en: "Text inserted; read it and edit it in your own words." }));
  };

  const geriAl = (indeks: number) => {
    const kayit = mesajlar[indeks];
    if (!kayit?.uygulama) return;
    const sonuc = geriAlmaIslemi(editor.state, kayit.uygulama.eklenenId, kayit.uygulama.eklenenMetin, kayit.uygulama.ozgun);
    if ("hata" in sonuc) {
      /* Güvenli geri alma yoksa hiçbir şey yapılmaz: kullanıcının sonraki emeği silinmesin. */
      const uyari =
        sonuc.hata === "duzenlendi"
          ? t({ tr: "Asistanın eklediği metni sonradan düzenlediniz; düzenlemeniz kaybolmasın diye geri alınmadı. Önceki hâle Sürümler'den dönebilirsiniz.", en: "You edited the inserted text afterwards; it wasn't undone so your edits aren't lost. You can go back from Versions." })
          : t({ tr: "Eklenen metin artık belgede bulunamıyor; güvenle geri alınamadı. Önceki hâle Sürümler'den dönebilirsiniz.", en: "The inserted text can no longer be found; it couldn't be undone safely. You can go back from Versions." });
      // Kart içi uyarı yeter (uygula'daki uyar ile aynı gerekçe).
      kartGuncelle(indeks, { uyari });
      return;
    }
    editor.view.dispatch(sonuc.tr);
    editor.view.dispatch(aiAdiminiKapat(editor.state));
    editor.commands.focus();
    kartGuncelle(indeks, { durum: "geri_alindi", uyari: undefined, uygulama: undefined });
    uygulamaIziSil(projectId, kayit.uygulama.eklenenId);
    kararKaydet(kayit.kayitId, "geri_alindi");
    showToast("success", t({ tr: "Asistanın değişikliği geri alındı.", en: "The assistant's change was undone." }));
  };

  const reddet = (indeks: number) => {
    const kayit = mesajlar[indeks];
    if (!kayit) return;
    if (kayit.oneriId) editor.view.dispatch(araligiBirak(editor.state.tr, kayit.oneriId));
    kartGuncelle(indeks, { durum: "reddedildi", duzenMetni: undefined, uyari: undefined, surumHatasi: undefined });
    kararKaydet(kayit.kayitId, "reddedildi");
  };

  const kopyala = async (metin: string) => {
    try {
      await navigator.clipboard.writeText(metin);
      showToast("success", t({ tr: "Kopyalandı.", en: "Copied." }));
    } catch {
      showToast("error", t({ tr: "Kopyalanamadı.", en: "Couldn't copy." }));
    }
  };

  /* Puan yalnızca kullanıcının AÇIK değerlendirmesi (4.3): kabul ve ret puan yazmaz. */
  const begenmedim = (indeks: number) => {
    const kayitId = mesajlar[indeks]?.kayitId;
    if (!kayitId) return;
    kartGuncelle(indeks, { begenilmedi: true });
    void asistanPuanla(kayitId, "faydasiz", "panelde beğenilmedi").catch(() => undefined);
  };

  /*
    İKİ GRUP (4.3): "Yaz" (imleçte yeni metin) ve "Seçili metni düzenle".
    Eskiden altı çip tek sırada karışıktı ve boş panelde yalnızca seçim
    isteyenler görünüyordu. Seçim yokken düzenleme grubu odaklanabilir
    kalır (klavye kullanıcısı ulaşabilsin) ama pasif görünür; basılınca ne
    gerektiği söylenir.
  */
  const yazGrubu: { gorev: YazimGorevi; ad: string }[] = [
    { gorev: "paragraf", ad: t({ tr: "Paragraf yaz", en: "Write paragraph" }) },
    { gorev: "devam", ad: t({ tr: "Devam ettir", en: "Continue" }) },
    { gorev: "anahat", ad: t({ tr: "Ana hat", en: "Outline" }) },
  ];
  const duzenGrubu: { gorev: YazimGorevi; ad: string }[] = [
    { gorev: "akademik", ad: t({ tr: "Akademikleştir", en: "Make academic" }) },
    { gorev: "kisalt", ad: t({ tr: "Kısalt", en: "Shorten" }) },
    { gorev: "genislet", ad: t({ tr: "Genişlet", en: "Expand" }) },
  ];
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
  const secimIpucu = t({ tr: "Bunlar için önce editörde metin seçin.", en: "Select text in the editor first for these." });

  return (
    <div className="yazim-paneli">
      <div className="yazim-paneli-liste" ref={listeRef} aria-live="polite">
        {mesajlar.length === 0 ? (
          /*
            Boş panel bir BAŞLANGIÇ menüsü (04.11.2026): "Yaz" grubu kartlar
            hâlinde; kural metni (atıf ve sayı sınırı) dipnotta.
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
            <div className="yazim-baslangic" role="group" aria-label={t({ tr: "Yaz", en: "Write" })}>
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
                  <OneriKarti
                    m={m}
                    t={t}
                    uygula={(mod, secenek) => void uygula(i, mod, secenek)}
                    surumdenVazgec={() => kartGuncelle(i, { surumHatasi: undefined, uyari: undefined })}
                    duzenle={(duzenMetni) => kartGuncelle(i, { duzenMetni })}
                    reddet={() => reddet(i)}
                    geriAl={() => geriAl(i)}
                    kopyala={() => void kopyala(m.duzenMetni ?? m.ekMetin!)}
                    begenmedim={() => begenmedim(i)}
                    surumleriAc={surumleriAc}
                  />
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
        {mesajlar.length ? (
          <div className="yazim-hizli-grup" role="group" aria-label={t({ tr: "Yaz", en: "Write" })}>
            {yazGrubu.map((h) => (
              <button key={h.gorev} type="button" className="yazim-hizli-dugme" onClick={() => void gonder(h.gorev)} disabled={bekliyor}>
                {h.ad}
              </button>
            ))}
          </div>
        ) : null}
        <div className="yazim-hizli-grup" role="group" aria-labelledby="yazim-duzen-etiket" aria-describedby={seciliVar ? undefined : "yazim-duzen-ipucu"}>
          <small id="yazim-duzen-etiket" className="yazim-hizli-etiket">
            {t({ tr: "Seçili metni düzenle", en: "Edit selected text" })}
          </small>
          {duzenGrubu.map((h) => (
            <button key={h.gorev} type="button" className="yazim-hizli-dugme" data-pasif={seciliVar ? undefined : true} aria-disabled={!seciliVar || undefined} onClick={() => void gonder(h.gorev)} disabled={bekliyor}>
              {h.ad}
            </button>
          ))}
          {seciliVar ? null : (
            <small id="yazim-duzen-ipucu" className="yazim-hizli-ipucu">
              {secimIpucu}
            </small>
          )}
        </div>
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
          aria-label={t({ tr: "Asistana isteğiniz", en: "Your request to the assistant" })}
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

/*
  ÖNERİ KARTI (4.3). Başlık kartın ne olduğunu söyler; gövde yeniden
  yazımda kelime farkı, yeni metinde düz metin, düzenlemede metin kutusu.
  Eylemler kartın durumuna göre: öneri → kabul/düzenle/reddet;
  uygulandı → geri al. Renk tek başına durum taşımaz: durum metinle de yazılır.
*/
function OneriKarti({
  m,
  t,
  uygula,
  surumdenVazgec,
  duzenle,
  reddet,
  geriAl,
  kopyala,
  begenmedim,
  surumleriAc,
}: {
  m: Kayit;
  t: ReturnType<typeof useCeviri>;
  uygula: (mod: Mod, secenek?: { metin?: string }) => void;
  surumdenVazgec: () => void;
  duzenle: (metin: string | undefined) => void;
  reddet: () => void;
  geriAl: () => void;
  kopyala: () => void;
  begenmedim: () => void;
  surumleriAc: () => void;
}) {
  const kutuRef = useRef<HTMLTextAreaElement>(null);
  const duzenleniyor = m.duzenMetni !== undefined;
  useEffect(() => {
    if (duzenleniyor) kutuRef.current?.focus();
  }, [duzenleniyor]);
  const ekMetin = m.ekMetin ?? "";
  const yeniden = yenidenYazim(m);
  const birincil: Mod = yeniden ? "degistir" : "altina";
  const fark = yeniden && !duzenleniyor && m.durum === "oneri" ? diffTexts(m.secimMetni ?? "", ekMetin) : null;
  const anaHat = m.gorev === "anahat" ? anaHattiCozumle(ekMetin) : [];
  const oneri = m.durum === "oneri";
  const mesgul = Boolean(m.isleniyor);

  return (
    <div className="yazim-oneri" data-durum={m.durum}>
      <div className="yazim-oneri-bas">
        <small>{t(ONERI_ADI[m.gorev ?? "serbest"])}</small>
        <span>
          <button type="button" className="yazim-ikon" onClick={kopyala} aria-label={t({ tr: "Kopyala", en: "Copy" })} title={t({ tr: "Kopyala", en: "Copy" })}>
            <Copy size={14} aria-hidden="true" />
          </button>
          {m.kayitId ? (
            <button
              type="button"
              className="yazim-ikon"
              data-secili={m.begenilmedi || undefined}
              disabled={m.begenilmedi}
              onClick={begenmedim}
              aria-label={t({ tr: "Beğenmedim", en: "Not helpful" })}
              title={m.begenilmedi ? t({ tr: "Bildirildi, teşekkürler", en: "Noted, thanks" }) : t({ tr: "Beğenmedim", en: "Not helpful" })}
            >
              <ThumbsDown size={14} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </div>

      <div className="yazim-oneri-metin">
        {duzenleniyor ? (
          <textarea
            ref={kutuRef}
            className="field-control yazim-oneri-duzen"
            rows={Math.min(12, Math.max(4, Math.ceil(ekMetin.length / 60)))}
            value={m.duzenMetni}
            aria-label={t({ tr: "Öneriyi düzenleyin", en: "Edit the suggestion" })}
            onChange={(e) => duzenle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                uygula(birincil, { metin: m.duzenMetni });
              } else if (e.key === "Escape") {
                e.preventDefault();
                duzenle(undefined);
              }
            }}
          />
        ) : fark ? (
          <>
            <MetinFarki fark={fark} kompakt />
            <small className="yazim-oneri-ozet">
              {t({ tr: `+${fark.stats.addedWords} kelime · −${fark.stats.removedWords} kelime`, en: `+${fark.stats.addedWords} words · −${fark.stats.removedWords} words` })}
            </small>
          </>
        ) : anaHat.length ? (
          <ul className="yazim-anahat">
            {anaHat.map((s, j) => (
              <li key={j} data-duzey={s.duzey}>
                <b>{s.baslik}</b>
                {s.notlar.map((n, k) => (
                  <small key={k}>{n}</small>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          paragraflara(ekMetin).map((p, j) => <p key={j}>{p}</p>)
        )}
      </div>

      {m.uyari ? (
        <p className="yazim-oneri-uyari" role="alert">
          {m.uyari}
        </p>
      ) : null}

      <div className="yazim-oneri-eylem">
        {oneri && m.surumHatasi ? (
          <>
            <button type="button" className="projects-primary-button button-compact" disabled={mesgul} onClick={() => uygula(m.surumHatasi!.mod, { metin: m.surumHatasi!.metin })}>
              <RotateCcw size={14} aria-hidden="true" />
              {t({ tr: "Tekrar dene", en: "Try again" })}
            </button>
            <button type="button" className="projects-filter-button button-compact" disabled={mesgul} onClick={surumdenVazgec}>
              {t({ tr: "Vazgeç", en: "Cancel" })}
            </button>
          </>
        ) : oneri ? (
          <>
            <button type="button" className="projects-primary-button button-compact" disabled={mesgul} onClick={() => uygula(birincil, duzenleniyor ? { metin: m.duzenMetni } : {})}>
              {yeniden ? <Check size={14} aria-hidden="true" /> : <CornerDownLeft size={14} aria-hidden="true" />}
              {duzenleniyor
                ? yeniden
                  ? t({ tr: "Düzenlenmiş hâlini kabul et", en: "Accept edited version" })
                  : t({ tr: "Düzenlenmiş hâlini ekle", en: "Insert edited version" })
                : yeniden
                  ? t({ tr: "Kabul et", en: "Accept" })
                  : t({ tr: "Paragrafın altına ekle", en: "Insert below paragraph" })}
            </button>
            {yeniden && !duzenleniyor ? (
              <button type="button" className="projects-filter-button button-compact" disabled={mesgul} onClick={() => uygula("altina")}>
                <CornerDownLeft size={14} aria-hidden="true" />
                {t({ tr: "Paragrafın altına ekle", en: "Insert below paragraph" })}
              </button>
            ) : null}
            {duzenleniyor ? (
              <button type="button" className="projects-filter-button button-compact" disabled={mesgul} onClick={() => duzenle(undefined)}>
                {t({ tr: "Düzenlemeyi bırak", en: "Stop editing" })}
              </button>
            ) : (
              <button type="button" className="projects-filter-button button-compact" disabled={mesgul} onClick={() => duzenle(ekMetin)}>
                <Pencil size={14} aria-hidden="true" />
                {yeniden ? t({ tr: "Düzenleyerek kabul et", en: "Edit, then accept" }) : t({ tr: "Düzenleyerek ekle", en: "Edit, then insert" })}
              </button>
            )}
            <button type="button" className="yazim-reddet" disabled={mesgul} onClick={reddet}>
              {t({ tr: "Reddet", en: "Reject" })}
            </button>
          </>
        ) : m.durum === "uygulandi" ? (
          <>
            <span className="yazim-oneri-durum">
              <Check size={14} aria-hidden="true" />
              {t({ tr: "Uygulandı", en: "Applied" })}
            </span>
            <button type="button" className="projects-filter-button button-compact" onClick={geriAl}>
              <RotateCcw size={14} aria-hidden="true" />
              {t({ tr: "Geri al", en: "Undo" })}
            </button>
            {m.uyari ? (
              <button type="button" className="projects-filter-button button-compact" onClick={surumleriAc}>
                <History size={14} aria-hidden="true" />
                {t({ tr: "Sürümleri aç", en: "Open versions" })}
              </button>
            ) : null}
          </>
        ) : (
          <span className="yazim-oneri-durum">
            {m.durum === "reddedildi" ? t({ tr: "Reddedildi; belgeye eklenmedi.", en: "Rejected; not added to the document." }) : t({ tr: "Geri alındı; belge önceki hâlinde.", en: "Undone; the document is as it was." })}
          </span>
        )}
      </div>
    </div>
  );
}
