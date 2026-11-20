"use client";

import { KomutPaletiAcOgesi } from "./os-komut-paleti";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowLeft,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  Ellipsis,
  FileCheck2,
  FileText,
  Library,
  LifeBuoy,
  ListChecks,
  ListTree,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Quote,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";
import {
  ALT_CUBUK,
  solAracBasligi,
  adrestekiCalisma,
  anaUygulamalar,
  aracUygulamalari,
  calismaBaglantilari,
  dahaFazlasi,
  etkinBaglanti,
  etkinUygulama,
  solAracOku,
  yardimUygulamalari,
  type BaglamBaglantisi,
  type CalismaIkon,
  type OsUygulama,
} from "@/lib/os/uygulamalar";
import { useCalismaBaglami } from "./calisma-baglami";
import { listeyeDonusIsaretle, useListeAdresi } from "./liste-donusu";
import { grupAcikMi } from "@/lib/os5/gezinme";
import { OsSimge } from "./os-simge";
import { gezinmeAbone, gezinmeDarMi, gezinmeTercihiniUygula } from "@/app/_components/gezinme";
import { SOL_ALAN_GENISLET_OLAYI } from "@/lib/calisma-alani-yerlesimi";

const CALISMA_IKONLARI: Record<CalismaIkon, LucideIcon> = {
  belge: FileText,
  bolumler: ListTree,
  kaynaklar: Library,
  arama: Search,
  ai: Sparkles,
  kanit: Scale,
  ozet: ClipboardList,
  etik: ShieldCheck,
  makale: Newspaper,
  analiz: ChartNoAxesCombined,
  kontrol: FileCheck2,
  kaynakca: Quote,
  kilavuz: ListChecks,
};
/*
  Telefonda çalışmanın içindeyken alt çubuk: masaüstüyle AYNI dört giriş
  (Belge, Kaynaklar, Arvo AI, Kontrol ve teslim; 20.11.2026) ve genel
  bölümler için "Daha fazla". Eskiden telefonda Belge, Araştır, Arvo AI
  ve "Çalışma" yaprağı vardı; masaüstünde dokuz öğe üç başlık altındaydı ve
  iki ekran aynı çalışmayı farklı anlatıyordu. Geri dönüş üst çubukta
  (header-title.tsx).
*/

/*
  UYARLANIR GEZİNME (Phase 3, 04.11.2026; Signature OS 5 / Phase 3,
  12.11.2026). Tek bileşen, tek liste (lib/os/uygulamalar.ts), ekran
  boyuna göre üç biçim (os-shell.css; kırılımlar lib/os/kirilimlar.ts):

  - masaüstü (≥1200): solda 240 px koyu lacivert, sabit kenar çubuğu.
    Üstte resmî logo; ortada üç ana öğe (Ana Sayfa, Çalışmalarım,
    Kaynaklar) ve açık adlı "Araçlar" grubu; altta Ayarlar, "Yardım"
    grubu ve hesap menüsü (premium çalışma alanı, 17.11.2026; onaylı
    tasarım). Personel araçları hesap menüsünde kalır.

    İKİ DÜZEY (19.11.2026, bağlamlı çalışma alanı; onaylı 2. tur
    tasarımı). Bir çalışmanın içinde (adres: /dashboard/editor/<id>/… ya
    da ?calisma=<id>) aynı yuva ÇALIŞMA gezinmesini gösterir: "Çalışmalarıma
    dön", çalışmanın adı, Yaz / Araştır / Kontrol et. 17.11.2026'daki
    "editör açılınca gezinme değişmez" kuralı bu tasarımla kalktı: genel
    menü, sayfa içindeki sekme satırı ve ayrı bir "Çalışmalarım" düğmesi
    editörde üç gezinme katmanı oluşturuyordu. Yazım ekranının sol
    araçları (bölümler, kaynaklar, makale arama) bu yuvanın içinde,
    #sol-alan-yuva'da açılır (manuscript-editor.tsx portal ile yerleşir).
  - tablet (761–1199): 64 px koyu ray, yalnızca simge. Ad, fareyle ya da
    klavyeyle üzerine gelince yanında belirir; ekran okuyucu her zaman
    okur. Çalışma bölümleri sayfanın kendi sekmelerinde kalır.
  - telefon (≤760): altta dört ana uygulama + "Daha fazla". Phase 3'te
    DEĞİŞMEDİ (kurum sahibinin şartı: mevcut kullanılabilir gezinme
    korunur).

  Kimin neyi göreceği burada değişmez: liste layout'ta rolle süzülmüş
  geliyor (gorunenUygulamalar). Bu bileşen yalnızca çizer.
*/

export function OsGezinme({ uygulamalar, hesap }: { uygulamalar: OsUygulama[]; hesap?: ReactNode }) {
  const t = useCeviri();
  const yol = usePathname();
  const pencere = useRef<HTMLDialogElement>(null);
  /*
    Telefonda "Çalışma" yaprağı yarım boy açılır, tutamaçla tam boya
    genişler (görsel uyum, 19.11.2026: onaylı prototipte yaprak belgenin
    yarısını örter). Eskiden ilk açılışta ekranı tamamen kaplıyordu.
    Yarım boyda içerik kayar; hiçbir öğe gizlenmez.
  */
  const [yaprakTam, setYaprakTam] = useState(false);
  const etkin = etkinUygulama(uygulamalar, yol);
  const ana = anaUygulamalar(uygulamalar);
  const araclar = aracUygulamalari(uygulamalar);
  const yardim = yardimUygulamalari(uygulamalar);
  const ayarlar = uygulamalar.find((u) => u.key === "ayarlar");
  const cubukta = new Set<string>(ALT_CUBUK);

  /*
    Çalışma düzeyi ADRESTEN (lib/os/uygulamalar.ts: adrestekiCalisma).
    Başlık ve tür sayfanın yayınladığı bağlamdan gelir; o henüz gelmediyse
    başlık yerinde boş bir satır kalır, menü yine çalışma menüsüdür
    (makale türüne özgü "Makale" öğesi bağlam gelince eklenir).
  */
  const sorgu = useSearchParams();
  const calismaId = adrestekiCalisma(yol, sorgu);
  const yayin = useCalismaBaglami();
  const listeAdresi = useListeAdresi();
  const calisma = calismaId
    ? { id: calismaId, baslik: yayin?.id === calismaId ? yayin.baslik : "", tur: yayin?.id === calismaId ? yayin.tur : "" }
    : null;
  const calismaOgeleri = calisma ? calismaBaglantilari(calisma, t) : [];
  const calismaEtkin = calisma ? etkinBaglanti(calismaOgeleri, yol, sorgu) : null;

  /*
    SOL ARAÇ (yalnızca yazım ekranında, adreste ?sol=). Araç açıkken yuva
    göreve göre genişler ve çalışma menüsünün yerini araç alır; başında
    "Geri: çalışma menüsü" (prototip, ekran 6). Geri, aynı adresi `sol`
    olmadan açar: sağ panel (?sag=) ve belge yerinde kalır. Esc de aynı yere.
  */
  const router = useRouter();
  const yazimEkrani = Boolean(calismaId && /\/write\/?$/.test(yol));
  const solArac = yazimEkrani ? solAracOku(sorgu.get("sol")) : null;
  const solsuz = new URLSearchParams(sorgu.toString());
  solsuz.delete("sol");
  const solGeriAdresi = solsuz.toString() ? `${yol}?${solsuz.toString()}` : yol;
  const solAracAdi = solArac ? solAracBasligi(solArac, t) : "";
  const SolAracSimgesi = solArac === "bolumler" ? CALISMA_IKONLARI.bolumler : solArac === "kontrol" || solArac === "kilavuz" ? CALISMA_IKONLARI.kontrol : solArac ? CALISMA_IKONLARI.kaynaklar : PanelLeftOpen;
  /*
    BÖLÜM AĞACI Belge'nin İÇİNDE (20.11.2026). Eskiden "Bölümler" menüde
    ayrı bir öğeydi. Şimdi Belge'nin altında açılıp kapanan bir alt öğe:
    adreste yine ?sol=bolumler (eski bağlantılar çalışır), başlığa tıklamak
    belgede o yere gider, bölüm işlemleri (eksik bölümleri ekle, durum)
    aynı araçta. Telefonda zaten açık olan "Belge"ye yeniden dokunmak ağacı
    açıp kapatır; masaüstünde Belge'nin altındaki "Bölümler" satırı.
  */
  const bolumAcik = solArac === "bolumler";
  const bolumAdresi = (() => {
    const q = new URLSearchParams(sorgu.toString());
    if (bolumAcik) q.delete("sol");
    else q.set("sol", "bolumler");
    return q.toString() ? `${yol}?${q.toString()}` : yol;
  })();

  /*
    Grupların oturum içi seçimi o anki ADRESE bağlı: başka sayfaya geçince
    seçim düşer ve varsayılan kural yeniden işler (etkin sayfa gruptaysa
    açık, değilse kapalı). Efektte sıfırlamak yerine adresle anahtarlamak,
    çizim sırasında durum değiştirmeden aynı sonucu verir. Seçim grup
    başına tutulur: ilk sürümde tek bir {grup, acik} vardı ve "Yardım"ı
    açmak "Araçlar"ı varsayılana (kapalı) döndürüyordu (personel-araclari
    kabulü, 17.11.2026).
  */
  const [secim, setSecim] = useState<{ yol: string; gruplar: Record<string, boolean> } | null>(null);
  const grupAcik = (grup: string, uyeler: OsUygulama[]) =>
    grupAcikMi({
      secim: secim?.yol === yol ? (secim.gruplar[grup] ?? null) : null,
      etkinIcinde: uyeler.some((u) => u.key === etkin?.key),
      varsayilan: false,
    });
  /*
    Masaüstü dar/açık (Phase 5.1c). Durum <html data-gezinme>'den okunur;
    genişliği yalnızca CSS belirler, bu yüzden sunucu çizimi ("açık") ile
    istemci arasındaki fark yalnızca düğmenin aria-expanded'ı olur ve
    hydration'dan hemen sonra düzelir — yerleşim hiç kaymaz.
  */
  const dar = useSyncExternalStore(gezinmeAbone, gezinmeDarMi, () => false);

  const ogeIcerik = (u: OsUygulama) => (
    <>
      <OsSimge ad={u.ikon} boyut={20} />
      <span className="os-gezinme-ad">{u.label}</span>
      <span className="os-gezinme-kisa" aria-hidden="true">
        {u.kisa ?? u.label}
      </span>
    </>
  );

  const oge = (u: OsUygulama) => {
    const acik = etkin?.key === u.key;
    return (
      <li key={u.key} data-alt-cubuk={cubukta.has(u.key) || undefined}>
        <Link href={u.href} className={acik ? "os-gezinme-oge is-active" : "os-gezinme-oge"} aria-current={acik ? "page" : undefined} title={u.label}>
          {ogeIcerik(u)}
        </Link>
      </li>
    );
  };

  /*
    Açık adlı grup ("Araçlar", "Yardım"). Açık kenar çubuğunda başlık bir
    açılır düğme. Rayda (tablet ve dar masaüstü) grup hiç çizilmez; öğeleri
    "Daha fazla"da (dahaFazlasi). İlk turda rayda simge olarak duruyorlardı
    ve 500 px yüksekliğinde "Daha fazla"yı ekranın dışına itiyorlardı.
    Liste `hidden` değil data-kapali taşır: kapalılık yalnızca açık kenar
    çubuğunda anlamlı (os-shell.css).
  */
  const grup = (anahtar: string, baslik: string, simge: ReactNode, uyeler: OsUygulama[]) => {
    if (!uyeler.length) return null;
    const acik = grupAcik(anahtar, uyeler);
    const kimlik = `os-gezinme-takim-${anahtar}`;
    return (
      <div className="os-gezinme-takim" key={anahtar}>
        <button
          type="button"
          className="os-gezinme-oge os-gezinme-takim-bas"
          aria-expanded={acik}
          aria-controls={kimlik}
          onClick={() => setSecim((onceki) => ({ yol, gruplar: { ...(onceki?.yol === yol ? onceki.gruplar : {}), [anahtar]: !acik } }))}
        >
          {simge}
          <span className="os-gezinme-ad">{baslik}</span>
          <ChevronDown size={16} aria-hidden="true" className="os-gezinme-takim-ok" />
        </button>
        <ul id={kimlik} className="os-gezinme-liste os-gezinme-takim-liste" data-kapali={acik ? undefined : ""} aria-label={baslik}>
          {uyeler.map(oge)}
        </ul>
      </div>
    );
  };

  const calismaOgesi = (b: BaglamBaglantisi, telefon = false) => {
    const Ikon = CALISMA_IKONLARI[b.ikon];
    const acik = calismaEtkin?.key === b.key;
    // Telefonda açık Belge'ye dokunmak bölüm ağacını açar/kapatır (masaüstünde ayrı satır var).
    const belgeAgaci = telefon && yazimEkrani && b.key === "yazim" && acik;
    return (
      <li key={b.key} data-alt-cubuk={telefon || undefined}>
        <Link
          href={belgeAgaci ? bolumAdresi : b.href}
          className={acik ? "os-gezinme-oge is-active" : "os-gezinme-oge"}
          aria-current={acik ? "page" : undefined}
          aria-label={b.label}
          aria-expanded={belgeAgaci ? bolumAcik : undefined}
          title={belgeAgaci ? t({ tr: bolumAcik ? "Bölüm ağacını kapat" : "Bölüm ağacını aç", en: bolumAcik ? "Close section tree" : "Open section tree" }) : b.label}
          scroll={!b.href.includes("?sol=") && !b.href.includes("?sag=") && !belgeAgaci}
        >
          <Ikon size={20} aria-hidden="true" />
          <span className="os-gezinme-ad">{b.label}</span>
          <span className="os-gezinme-kisa" aria-hidden="true">
            {b.key === "kontrol" ? t({ tr: "Kontrol", en: "Review" }) : b.label}
          </span>
        </Link>
        {!telefon && b.key === "yazim" && yazimEkrani ? (
          <Link
            href={bolumAdresi}
            scroll={false}
            className={bolumAcik ? "os-gezinme-oge os-calisma-alt is-active" : "os-gezinme-oge os-calisma-alt"}
            aria-expanded={bolumAcik}
            title={t({ tr: "Bölüm ağacı", en: "Section tree" })}
          >
            <ChevronDown size={16} aria-hidden="true" className="os-gezinme-takim-ok" />
            <span className="os-gezinme-ad">{t({ tr: "Bölümler", en: "Sections" })}</span>
          </Link>
        ) : null}
        {/*
          Açık kenar çubuğunda bölüm ağacı BURAYA, Belge'nin hemen altına yerleşir
          (editör portal ile; manuscript-editor.tsx). Dar çubukta, tablette ve
          telefonda yer olmadığı için aynı ağaç sol araç alanında açılır.
        */}
        {!telefon && b.key === "yazim" && yazimEkrani ? <div id="belge-agaci-yuva" className="os-belge-agaci" hidden={!bolumAcik} /> : null}
      </li>
    );
  };
  const geriBaglantisi = (
    <Link href={listeAdresi} className="os-gezinme-oge os-calisma-geri" title={t({ tr: "Çalışmalarıma dön", en: "Back to my works" })} onClick={listeyeDonusIsaretle}>
      <ArrowLeft size={20} aria-hidden="true" />
      <span className="os-gezinme-ad">{t({ tr: "Çalışmalarıma dön", en: "Back to my works" })}</span>
      <span className="os-gezinme-kisa" aria-hidden="true">
        {t({ tr: "Çalışmalar", en: "Works" })}
      </span>
    </Link>
  );
  /* Dört ana giriş, grup başlığı yok (20.11.2026; lib/os/uygulamalar.ts). */
  const calismaListesi = (
    <ul className="os-gezinme-liste os-calisma-liste" aria-label={t({ tr: "Bu çalışma", en: "This work" })}>
      {calismaOgeleri.map((b) => calismaOgesi(b))}
    </ul>
  );
  const dahaUygulamalari = dahaFazlasi(uygulamalar);
  const dahaEtkin = dahaUygulamalari.some((u) => u.key === etkin?.key);

  /*
    Esc araç alanını kapatır. React'in onKeyDown'ı DEĞİL, yerel dinleyici:
    araçların içeriği editörden PORTAL ile geliyor ve React olayları portalda
    DOM'a göre değil React ağacına göre kabarır — onKeyDown ile yazılan ilk
    sürümde odak araç içeriğindeyken Esc bu bölüme hiç ulaşmıyordu (kabul S2,
    üretim derlemesi). Yalnızca alanın kendi başlığındaki "Geri" bağlantısında
    çalışıyordu.
  */
  const solAlanRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const alan = solAlanRef.current;
    if (!alan || !solArac) return;
    const tus = (olay: KeyboardEvent) => {
      if (olay.key !== "Escape" || olay.defaultPrevented) return;
      olay.preventDefault();
      router.push(solGeriAdresi, { scroll: false });
    };
    alan.addEventListener("keydown", tus);
    return () => alan.removeEventListener("keydown", tus);
  }, [solArac, solGeriAdresi, router]);

  return (
    <>
      <nav id="os-ana-gezinme" className="os-gezinme" data-sol={solArac ?? undefined} aria-label={t({ tr: "Ana gezinme", en: "Main navigation" })}>
        <div className="os-gezinme-bas">
          <Link href="/dashboard" className="os-gezinme-logo" aria-label={t({ tr: "ArvoLab ana sayfa", en: "ArvoLab home" })}>
            <ArvoLabLogosu alt="" />
          </Link>
          {/*
            Daraltma düğmesi yalnızca masaüstünde görünür (os-shell.css): tablet
            her zaman ray, telefon alt çubuk. Kısayol bilerek yok — Ctrl+B
            editörde kalın yazı. Tıklayınca odak düğmede kalır.
          */}
          <button
            type="button"
            className="os-gezinme-daralt"
            aria-controls="os-ana-gezinme"
            aria-expanded={!dar}
            aria-label={dar ? t({ tr: "Kenar çubuğunu genişlet", en: "Expand sidebar" }) : t({ tr: "Kenar çubuğunu daralt", en: "Collapse sidebar" })}
            title={dar ? t({ tr: "Kenar çubuğunu genişlet", en: "Expand sidebar" }) : t({ tr: "Kenar çubuğunu daralt", en: "Collapse sidebar" })}
            onClick={() => gezinmeTercihiniUygula(!dar)}
          >
            {dar ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
        </div>

        {calisma ? (
          <>
            {/*
              ÇALIŞMA DÜZEYİ. Her ekranda aynı dört giriş; telefonda alt
              çubukta, yanında genel bölümler için "Daha fazla". Geri dönüş
              telefonda üst çubukta.
            */}
            <div className="os-gezinme-govde os-calisma-govde">
              <div className="os-calisma-ust">
                {geriBaglantisi}
                <div className="os-calisma-kimlik">
                  <span className="os-calisma-etiket">{t({ tr: "Çalışma", en: "Work" })}</span>
                  <strong className="os-calisma-ad" title={calisma.baslik || undefined}>
                    {calisma.baslik || "\u00a0"}
                  </strong>
                </div>
              </div>
              {calismaListesi}
            </div>
            <ul className="os-gezinme-liste os-calisma-telefon">
              {calismaOgeleri.map((b) => calismaOgesi(b, true))}
            </ul>
          </>
        ) : (
          <>
            <div className="os-gezinme-govde">
              <ul className="os-gezinme-liste os-gezinme-ana">{ana.map(oge)}</ul>
              {grup("araclar", t({ tr: "Araçlar", en: "Tools" }), <Wrench size={20} aria-hidden="true" />, araclar)}
            </div>

            <div className="os-gezinme-alt-bolge">
              {ayarlar ? <ul className="os-gezinme-liste os-gezinme-ayar">{oge(ayarlar)}</ul> : null}
              {grup("yardim", t({ tr: "Yardım", en: "Help" }), <LifeBuoy size={20} aria-hidden="true" />, yardim)}
            </div>
          </>
        )}

        <ul className="os-gezinme-liste os-gezinme-son">
          <li className="os-gezinme-daha-li">
            <button
              type="button"
              className={dahaEtkin ? "os-gezinme-oge os-gezinme-daha is-active" : "os-gezinme-oge os-gezinme-daha"}
              aria-haspopup="dialog"
              title={t({ tr: "Daha fazla", en: "More" })}
              onClick={() => {
                setYaprakTam(false);
                pencere.current?.showModal();
              }}
            >
              <Ellipsis size={20} aria-hidden="true" />
              <span className="os-gezinme-ad">{t({ tr: "Daha fazla", en: "More" })}</span>
              <span className="os-gezinme-kisa" aria-hidden="true">
                {t({ tr: "Daha", en: "More" })}
              </span>
            </button>
          </li>
        </ul>

        {/* Hesap menüsü (sunucu bileşeni, layout'tan gelir): yalnızca masaüstünde; tablet ve telefonda üst çubukta. */}
        {hesap ? <div className="os-gezinme-hesap">{hesap}</div> : null}
      </nav>

      {/*
        SOL ARAÇ ALANI. Nav'ın İÇİNDE değil, kardeşi: nav telefonda bulanık
        (backdrop-filter) bir alt çubuk ve klavye açılınca aşağı kayıyor
        (transform); içindeki sabit konumlu bir kutu ekrana göre değil nav'a
        göre yerleşirdi (AGENTS.md, ArvoOS mobil menü hatası). Araçların
        içeriği editörden portal ile gelir (manuscript-editor.tsx) ve araç
        kapalıyken de söküLMEZ: arama ve liste konumu korunur.
      */}
      {calisma ? (
        <section
          className="os-sol-alan"
          data-acik={solArac ?? undefined}
          aria-label={solAracAdi || undefined}
          hidden={!solArac}
          ref={solAlanRef}
        >
          {/*
            ŞERİT (4. tur, 18.11.2026): PDF açılınca belge %85'in altına inecekse
            araç 64 px'e iner (lib/calisma-alani-yerlesimi.ts, "aracDar"); başlık
            ve içerik CSS ile gizlenir, yalnızca bu düğme görünür. Basınca araç
            geri açılır ve PDF geçici olarak belgenin üstünde çekmece olur.
          */}
          <button
            type="button"
            className="os-sol-genislet"
            onClick={() => window.dispatchEvent(new CustomEvent(SOL_ALAN_GENISLET_OLAYI))}
            aria-label={t({ tr: `${solAracAdi} alanını genişlet`, en: `Expand ${solAracAdi}` })}
            title={t({ tr: `${solAracAdi} alanını genişlet`, en: `Expand ${solAracAdi}` })}
          >
            <SolAracSimgesi size={20} aria-hidden="true" />
            <PanelLeftOpen size={16} aria-hidden="true" />
          </button>
          <div className="os-sol-alan-bas">
            <Link href={solGeriAdresi} scroll={false} className="os-sol-geri">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{t({ tr: "Geri: çalışma menüsü", en: "Back: work menu" })}</span>
            </Link>
            <h2 className="os-sol-alan-ad">{solAracAdi}</h2>
          </div>
          {/* Yazım ekranının sol araçları buraya yerleşir (manuscript-editor.tsx, createPortal). */}
          <div id="sol-alan-yuva" className="os-sol-alan-yuva" />
        </section>
      ) : null}

      {/* "Daha fazla": telefonda alt çubukta, tablette rayda olmayan her şey. Esc ve dışarı dokunuş kapatır. */}
      <dialog
        ref={pencere}
        className="os-daha"
        data-tam={yaprakTam ? "" : undefined}
        aria-label={t({ tr: "Bütün bölümler", en: "All sections" })}
        onClick={(olay) => {
          if (olay.target === pencere.current) pencere.current?.close();
        }}
      >
        {calisma ? (
          <button
            type="button"
            className="os-daha-tutamac"
            aria-expanded={yaprakTam}
            aria-label={yaprakTam ? t({ tr: "Yaprağı daralt", en: "Collapse sheet" }) : t({ tr: "Yaprağı genişlet", en: "Expand sheet" })}
            onClick={() => setYaprakTam((a) => !a)}
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
        <header className="os-daha-bas">
          <h2>{t({ tr: "Bütün bölümler", en: "All sections" })}</h2>
          <button type="button" className="os-icon-btn" aria-label={t({ tr: "Kapat", en: "Close" })} onClick={() => pencere.current?.close()}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {calisma ? (
          /* Çalışmanın içinde: dört giriş alt çubukta; burada çalışmanın adı ve genel bölümler. */
          <div className="os-daha-calisma" onClick={(olay) => (olay.target as HTMLElement).closest("a") && pencere.current?.close()}>
            {calisma.baslik ? <p className="os-daha-calisma-ad">{calisma.baslik}</p> : null}
            <h2 className="os-calisma-grup-ad">{t({ tr: "Genel", en: "General" })}</h2>
          </div>
        ) : null}
        <ul className="os-daha-liste">
          {dahaUygulamalari.map((u) => (
            <li key={u.key}>
              <Link
                href={u.href}
                className={etkin?.key === u.key ? "os-gezinme-oge is-active" : "os-gezinme-oge"}
                aria-current={etkin?.key === u.key ? "page" : undefined}
                onClick={() => pencere.current?.close()}
              >
                <OsSimge ad={u.ikon} boyut={20} />
                <span className="os-gezinme-ad">{u.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="os-daha-ipucu">
          {/* Palet önce bu pencereyi kapatır: iki diyalog üst üste açılmasın. */}
          <span onClickCapture={() => pencere.current?.close()}>
            <KomutPaletiAcOgesi className="os-daha-komut" />
          </span>
        </div>
      </dialog>
    </>
  );
}
