"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, Ellipsis, LifeBuoy, PanelLeftClose, PanelLeftOpen, Wrench, X } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";
import {
  ALT_CUBUK,
  anaUygulamalar,
  aracUygulamalari,
  dahaFazlasi,
  etkinUygulama,
  yardimUygulamalari,
  type OsUygulama,
} from "@/lib/os/uygulamalar";
import { grupAcikMi } from "@/lib/os5/gezinme";
import { OsSimge } from "./os-simge";
import { gezinmeAbone, gezinmeDarMi, gezinmeTercihiniUygula } from "@/app/_components/gezinme";

/*
  UYARLANIR GEZİNME (Phase 3, 04.11.2026; Signature OS 5 / Phase 3,
  12.11.2026). Tek bileşen, tek liste (lib/os/uygulamalar.ts), ekran
  boyuna göre üç biçim (os-shell.css; kırılımlar lib/os/kirilimlar.ts):

  - masaüstü (≥1200): solda 240 px koyu lacivert, sabit kenar çubuğu.
    Üstte resmî logo; ortada üç ana öğe (Ana Sayfa, Çalışmalarım,
    Kaynaklar) ve açık adlı "Araçlar" grubu; altta Ayarlar, "Yardım"
    grubu ve hesap menüsü (premium çalışma alanı, 17.11.2026; onaylı
    tasarım). Personel araçları hesap menüsünde kalır.

    EDİTÖR AÇILINCA GEZİNME DEĞİŞMEZ (17.11.2026, kurum sahibinin şartı).
    Eskiden bir çalışmanın içindeyken "Çalışmalarım"ın altında o
    çalışmanın bölümleri (Özet, Yazım, Kanıt, Etik, araçlar) açılıyordu:
    editöre girmek kenar çubuğunun boyunu ve içeriğini değiştiriyordu.
    Bölümler artık her ekran boyunda sayfadaki çalışma sekmelerinde
    (calisma-sekmeleri.tsx).
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
  const etkin = etkinUygulama(uygulamalar, yol);
  const ana = anaUygulamalar(uygulamalar);
  const araclar = aracUygulamalari(uygulamalar);
  const yardim = yardimUygulamalari(uygulamalar);
  const ayarlar = uygulamalar.find((u) => u.key === "ayarlar");
  const cubukta = new Set<string>(ALT_CUBUK);

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

  const dahaUygulamalari = dahaFazlasi(uygulamalar);
  const dahaEtkin = dahaUygulamalari.some((u) => u.key === etkin?.key);

  return (
    <>
      <nav id="os-ana-gezinme" className="os-gezinme" aria-label={t({ tr: "Ana gezinme", en: "Main navigation" })}>
        <div className="os-gezinme-bas">
          <Link href="/dashboard" className="os-gezinme-logo" aria-label={t({ tr: "ArvoLab ana sayfa", en: "ArvoLab home" })}>
            <ArvoLabLogosu zemin="koyu" alt="" />
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

        <div className="os-gezinme-govde">
          <ul className="os-gezinme-liste os-gezinme-ana">{ana.map(oge)}</ul>
          {grup("araclar", t({ tr: "Araçlar", en: "Tools" }), <Wrench size={20} aria-hidden="true" />, araclar)}
        </div>

        <div className="os-gezinme-alt-bolge">
          {ayarlar ? <ul className="os-gezinme-liste os-gezinme-ayar">{oge(ayarlar)}</ul> : null}
          {grup("yardim", t({ tr: "Yardım", en: "Help" }), <LifeBuoy size={20} aria-hidden="true" />, yardim)}
        </div>

        <ul className="os-gezinme-liste os-gezinme-son">
          <li className="os-gezinme-daha-li">
            <button
              type="button"
              className={dahaEtkin ? "os-gezinme-oge os-gezinme-daha is-active" : "os-gezinme-oge os-gezinme-daha"}
              aria-haspopup="dialog"
              title={t({ tr: "Daha fazla", en: "More" })}
              onClick={() => pencere.current?.showModal()}
            >
              <Ellipsis size={20} aria-hidden="true" />
              <span className="os-gezinme-ad">{t({ tr: "Daha fazla", en: "More" })}</span>
              <span className="os-gezinme-kisa" aria-hidden="true">
                {t({ tr: "Daha fazla", en: "More" })}
              </span>
            </button>
          </li>
        </ul>

        {/* Hesap menüsü (sunucu bileşeni, layout'tan gelir): yalnızca masaüstünde; tablet ve telefonda üst çubukta. */}
        {hesap ? <div className="os-gezinme-hesap">{hesap}</div> : null}
      </nav>

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
                aria-current={etkin?.key === u.key ? "page" : undefined}
                onClick={() => pencere.current?.close()}
              >
                <OsSimge ad={u.ikon} boyut={20} />
                <span className="os-gezinme-ad">{u.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="os-daha-ipucu">{t({ tr: "Her şeye Ctrl+K ile de ulaşabilirsiniz.", en: "You can also reach everything with Ctrl+K." })}</p>
      </dialog>
    </>
  );
}
