"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
import { Ellipsis, PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import {
  ALT_CUBUK,
  calismaBaglantilari,
  calismaIcindeMi,
  dahaFazlasi,
  etkinBaglanti,
  gezinmeVurgusu,
  gezinmeGruplari,
  type OsUygulama,
} from "@/lib/os/uygulamalar";
import { OsSimge } from "./os-simge";
import { useCalismaBaglami } from "./calisma-baglami";
import { ProjeSecici } from "./proje-secici";
import { useEkranSinifi } from "./ekran-sinifi";
import { RayIpucu } from "./ray-ipucu";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";
import { KENAR_ANAHTARI, kenarOku } from "@/lib/os/kenar";

/*
  KENAR ÇUBUĞUNUN HÂLİ <html data-kenar> özniteliğinde (lib/os/kenar.ts):
  boyamadan önce oradaki betik yazıyor, düğme de orayı değiştiriyor.
  React durumu ayrıca tutulmuyor — iki kaynak olsaydı başka sekmeden
  gelen değişiklik (storage olayı, betik) düğmenin aria-expanded'ını
  eski hâlde bırakırdı. Sunucu her zaman "geniş" çizer; hidrasyon dar
  hâli useSyncExternalStore ile uyumsuzluk uyarısı vermeden alır.
*/
function kenarAbone(dinle: () => void) {
  const gozcu = new MutationObserver(dinle);
  gozcu.observe(document.documentElement, { attributes: true, attributeFilter: ["data-kenar"] });
  return () => gozcu.disconnect();
}
const kenarDarMi = () => document.documentElement.getAttribute("data-kenar") === "dar";

function kenarDegistir(dar: boolean) {
  if (dar) document.documentElement.setAttribute("data-kenar", "dar");
  else document.documentElement.removeAttribute("data-kenar");
  try {
    localStorage.setItem(KENAR_ANAHTARI, kenarOku(dar ? "dar" : "genis"));
  } catch {
    // Gizli sekmede depolama kapalı olabilir: seçim bu sayfada geçerli kalır, kalıcı olmaz.
  }
}

/*
  UYARLANIR GEZİNME (Phase 3, 04.11.2026). Dock'un ve "Tüm uygulamalar"
  ızgarasının yerini alır; kurum sahibinin Phase 3 kararı ("tek ve
  tutarlı ana gezinme"). Tek bileşen, tek liste (lib/os/uygulamalar.ts),
  ekran boyuna göre üç biçim (CSS, os-shell.css; kırılımlar
  lib/os/kirilimlar.ts):

  - masaüstü (≥1200): solda geniş kenar çubuğu, adlar yazılı. Bir
    çalışmanın içindeyken en üstte o çalışmanın bölümleri ve ona
    süzülmüş araçlar (bağlamsal gezinme); sayfa içindeki çalışma
    sekmeleri bu genişlikte gizlenir, aynı şey iki yerde durmasın.
  - tablet (761–1199): dar ray, simge + kısa ad. Çalışma bölümleri
    sayfanın kendi sekmelerinde kalır.
  - telefon (≤760): altta dört ana uygulama + "Daha fazla". Adlar her
    zaman yazılı: dock'ta adlar yalnızca fareyle üzerine gelince
    görünüyordu, dokunmatikte hiç görünmüyordu.

  Signature OS (04.11.2026): kenar çubuğu tam boy; başında marka,
  masaüstünde daraltma düğmesi ve "Yeni çalışma". Daraltılmış masaüstü
  tabletteki rayla aynı çizilir, çalışma bölümleri o zaman sayfanın
  sekmelerine döner.

  Dock'tan farkı bilerek: ikinci dock (bölüm menüsü) yok — hiçbir
  uygulamanın bölümü kalmamıştı, kod hiç açılmayan bir menüyü
  yönetiyordu.
*/
export function OsGezinme({ uygulamalar }: { uygulamalar: OsUygulama[] }) {
  const t = useCeviri();
  const yol = usePathname();
  const sorgu = useSearchParams();
  const pencere = useRef<HTMLDialogElement>(null);
  const baglam = useCalismaBaglami();
  const dar = useSyncExternalStore(kenarAbone, kenarDarMi, () => false);
  const baglamGorunur = baglam && calismaIcindeMi(baglam.id, yol, new URLSearchParams(sorgu.toString()));
  const calismalarimda = yol === "/dashboard/editor";
  // Çalışmalarım'da bölüm listesi çizilmiyor; vurgu hesabı da onu görmesin (sayfa = Çalışmalarım).
  const baglantilar = baglamGorunur && !calismalarimda ? calismaBaglantilari(baglam, t) : [];
  /*
    Tek "burası" (UX S5): sayfa ya çalışma bölümünde ya genel menüde "page",
    ikisinde birden değil. Çalışma bölümü yalnızca geniş masaüstünde görünür
    (CSS: ≥1200 ve daraltılmamış); tablet, telefon ve daraltılmış menüde
    gizliyken genel uygulama "page" kalmalı, yoksa menüde hiç "burası" olmaz.
  */
  const ekran = useEkranSinifi();
  const baglamGoruntuleniyor = Boolean(baglamGorunur) && ekran === "masaustu" && !dar;
  const vurgu = gezinmeVurgusu(uygulamalar, yol, baglamGoruntuleniyor ? baglantilar : []);
  const etkin = vurgu.uygulama;
  const baglamEtkin = baglamGorunur ? etkinBaglanti(baglantilar, yol) : null;
  const { ana, diger, ayarlar } = gezinmeGruplari(uygulamalar);
  const cubukta = new Set<string>(ALT_CUBUK);
  /*
    64 px ray (V4.3-B1): tablette her zaman, masaüstünde daraltılınca.
    Öğeler yalnızca simge; adın görünen kopyası RayIpucu. Eskiden her öğede
    title vardı: klavye odağında hiç çıkmıyordu ve ipucuyla birlikte iki
    balon üst üste binerdi; ad artık metin olarak erişilebilir (CSS).
  */
  const ray = ekran === "tablet" || (ekran === "masaustu" && dar);


  const oge = (u: OsUygulama) => {
    const acik = etkin?.key === u.key;
    return (
      <li key={u.key} data-alt-cubuk={cubukta.has(u.key) || undefined}>
        <Link
          href={u.href}
          className={acik ? "os-gezinme-oge is-active" : "os-gezinme-oge"}
          aria-current={acik ? vurgu.uygulamaAriaCurrent : undefined}
        >
          <OsSimge ad={u.ikon} boyut={20} />
          <span className="os-gezinme-ad">{u.label}</span>
          <span className="os-gezinme-kisa" aria-hidden="true">{u.kisa ?? u.label}</span>
        </Link>
      </li>
    );
  };

  const dahaUygulamalari = dahaFazlasi(uygulamalar);
  const dahaEtkin = dahaUygulamalari.some((u) => u.key === etkin?.key);

  return (
    <>
      <nav id="os-gezinme" className="os-gezinme" aria-label={t({ tr: "Ana gezinme", en: "Main navigation" })}>
        {/*
          Kenar çubuğunun başı (tablet ve masaüstünde; telefonda gizli):
          marka, daraltma düğmesi ve ana eylem. Marka eskiden üst çubuktaydı;
          kenar çubuğu tam boy olunca üst çubuk konum yoluna ve bağlamsal
          eylemlere kaldı. Daraltma düğmesi yalnızca masaüstünde: tablette
          ray zaten dar.
        */}
        <div className="os-gezinme-bas">
          <Link href="/dashboard" className="os-gezinme-marka" aria-label={t({ tr: "ArvoLab ana sayfa", en: "ArvoLab home" })}>
            {/* Orijinal logo (05.11.2026); eskiden "A" işareti + "ArvoLab" yazısı. Ad bağlantının etiketinde. */}
            <ArvoLabLogosu alt="" />
          </Link>
          <button
            type="button"
            className="os-gezinme-daralt"
            aria-controls="os-gezinme"
            aria-expanded={!dar}
            aria-label={dar ? t({ tr: "Kenar çubuğunu genişlet", en: "Expand sidebar" }) : t({ tr: "Kenar çubuğunu daralt", en: "Collapse sidebar" })}
            title={dar ? t({ tr: "Kenar çubuğunu genişlet", en: "Expand sidebar" }) : t({ tr: "Kenar çubuğunu daralt", en: "Collapse sidebar" })}
            onClick={() => kenarDegistir(!dar)}
          >
            {dar ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
        </div>
        {/* Ana eylem: Ctrl+K'daki ve Çalışmalarım'daki "Yeni çalışma" ile aynı pencere (?yeni=1). */}
        <Link href="/dashboard/editor?yeni=1" className="os-gezinme-yeni" scroll={false}>
          <Plus size={18} aria-hidden="true" />
          <span className="os-gezinme-ad">{t({ tr: "Yeni çalışma", en: "New work" })}</span>
        </Link>

        {baglamGorunur ? (
          <section className="os-gezinme-baglam" aria-label={t({ tr: `Açık çalışma: ${baglam.baslik}`, en: `Open work: ${baglam.baslik}` })}>
            {/* Çalışmanın adı bir düğme: son çalışmalara geçiş, aynı bölüm korunur (Signature OS 2.0, proje-secici.tsx). */}
            <ProjeSecici baglam={baglam} yol={yol} sorgu={sorgu.toString()} />
            {/* Çalışmalarım'da yalnız seçici (V4.3-B2, onaylı tasarım §2.2): orası çalışma SEÇME ekranı,
                bölümler sayfanın kendi ayrıntısında. Eskiden aynı bölüm listesi burada da vardı: iki gezinme. */}
            {calismalarimda ? null : (
            <ul className="os-gezinme-liste">
              {baglantilar.map((b) => (
                <li key={b.key} className={b.grup === "arac" && baglantilar.find((x) => x.grup === "arac")?.key === b.key ? "os-gezinme-ayrac" : undefined}>
                  <Link
                    href={b.href}
                    className={baglamEtkin?.key === b.key ? "os-gezinme-alt is-active" : "os-gezinme-alt"}
                    aria-current={baglamEtkin?.key === b.key ? "page" : undefined}
                  >
                    {b.label}
                  </Link>
                </li>
              ))}
            </ul>
            )}
          </section>
        ) : null}

        <ul className="os-gezinme-liste os-gezinme-ana">{ana.map(oge)}</ul>

        {diger.length ? (
          <div className="os-gezinme-diger">
            <span className="os-gezinme-baslik">{t({ tr: "Diğer", en: "More" })}</span>
            <ul className="os-gezinme-liste">{diger.map(oge)}</ul>
          </div>
        ) : null}

        <ul className="os-gezinme-liste os-gezinme-son">
          {ayarlar ? oge(ayarlar) : null}
          <li className="os-gezinme-daha-li">
            <button
              type="button"
              className={dahaEtkin ? "os-gezinme-oge os-gezinme-daha is-active" : "os-gezinme-oge os-gezinme-daha"}
              aria-haspopup="dialog"
              onClick={() => pencere.current?.showModal()}
            >
              <Ellipsis size={20} aria-hidden="true" />
              <span className="os-gezinme-ad">{t({ tr: "Daha fazla", en: "More" })}</span>
              <span className="os-gezinme-kisa" aria-hidden="true">{t({ tr: "Daha fazla", en: "More" })}</span>
            </button>
          </li>
        </ul>
      </nav>
      <RayIpucu etkin={ray} kokId="os-gezinme" />

      {/* "Daha fazla": telefonda alt çubukta, tablette rayda olmayan her şey. Esc ve dışarı dokunuş kapatır. */}
      <dialog
        ref={pencere}
        className="os-daha"
        aria-label={t({ tr: "Bütün bölümler", en: "All sections" })}
        onClick={(olay) => {
          if (olay.target === pencere.current) pencere.current?.close();
        }}
      >
        <header className="os-daha-bas">
          <h2>{t({ tr: "Bütün bölümler", en: "All sections" })}</h2>
          <button type="button" className="os-icon-btn" aria-label={t({ tr: "Kapat", en: "Close" })} onClick={() => pencere.current?.close()}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <ul className="os-daha-liste">
          {dahaUygulamalari.map((u) => (
            <li key={u.key}>
              <Link
                href={u.href}
                className={etkin?.key === u.key ? "os-gezinme-oge is-active" : "os-gezinme-oge"}
                aria-current={etkin?.key === u.key ? vurgu.uygulamaAriaCurrent : undefined}
                onClick={() => pencere.current?.close()}
              >
                <OsSimge ad={u.ikon} boyut={20} />
                <span className="os-gezinme-ad">{u.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="os-daha-ipucu">
          {t({ tr: "Her şeye Ctrl+K ile de ulaşabilirsiniz.", en: "You can also reach everything with Ctrl+K." })}
        </p>
      </dialog>
    </>
  );
}
