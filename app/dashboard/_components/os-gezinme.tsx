"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, Ellipsis, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";
import {
  ALT_CUBUK,
  anaUygulamalar,
  calismaBaglantilari,
  calismaIcindeMi,
  dahaFazlasi,
  etkinBaglanti,
  etkinUygulama,
  type OsUygulama,
} from "@/lib/os/uygulamalar";
import { grupAcikMi } from "@/lib/os5/gezinme";
import { OsSimge } from "./os-simge";
import { useCalismaBaglami } from "./calisma-baglami";
import { gezinmeAbone, gezinmeDarMi, gezinmeTercihiniUygula } from "@/app/_components/gezinme";

/*
  UYARLANIR GEZİNME (Phase 3, 04.11.2026; Signature OS 5 / Phase 3,
  12.11.2026). Tek bileşen, tek liste (lib/os/uygulamalar.ts), ekran
  boyuna göre üç biçim (os-shell.css; kırılımlar lib/os/kirilimlar.ts):

  - masaüstü (≥1200): solda 240 px koyu lacivert, sabit kenar çubuğu.
    Üstte resmî logo, altta hesap menüsü. Bir çalışmanın
    içindeyken o çalışmanın bölümleri "Çalışmalarım"ın ALT MENÜSÜ olarak
    açılır (eskiden listenin üstünde ayrı bir "Açık çalışma" kutusuydu;
    çalışma bağlamı artık ana gezinmenin bir parçası, ikinci bir sistem
    değil). Yalnızca akademik uygulamalar: hesap sayfaları ve personel
    araçları hesap menüsünde (Phase 5.1d-3; eskiden altta bir "Diğer"
    grubu ve ayrı bir Ayarlar bağlantısı vardı).
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
  const sorgu = useSearchParams();
  const pencere = useRef<HTMLDialogElement>(null);
  const baglam = useCalismaBaglami();
  const etkin = etkinUygulama(uygulamalar, yol);
  const ana = anaUygulamalar(uygulamalar);
  const cubukta = new Set<string>(ALT_CUBUK);

  const baglamGorunur = Boolean(baglam && calismaIcindeMi(baglam.id, yol, new URLSearchParams(sorgu.toString())));
  const baglantilar = baglam && baglamGorunur ? calismaBaglantilari(baglam, t) : [];
  const baglamEtkin = baglamGorunur ? etkinBaglanti(baglantilar, yol) : null;
  const calismaBolumleri = baglantilar.filter((b) => b.grup === "calisma");
  const calismaAraclari = baglantilar.filter((b) => b.grup === "arac");

  /*
    Oturum içi seçimler o anki ADRESE bağlı: başka sayfaya geçince seçim
    düşer ve varsayılan kural yeniden işler (etkin sayfanın grubu açık).
    Efektte sıfırlamak yerine adresle anahtarlamak, çizim sırasında
    durum değiştirmeden aynı sonucu verir.
  */
  const [calismaSecimi, setCalismaSecimi] = useState<{ yol: string; acik: boolean } | null>(null);
  /*
    Masaüstü dar/açık (Phase 5.1c). Durum <html data-gezinme>'den okunur;
    genişliği yalnızca CSS belirler, bu yüzden sunucu çizimi ("açık") ile
    istemci arasındaki fark yalnızca düğmenin aria-expanded'ı olur ve
    hydration'dan hemen sonra düzelir — yerleşim hiç kaymaz.
  */
  const dar = useSyncExternalStore(gezinmeAbone, gezinmeDarMi, () => false);

  const calismaAcik = grupAcikMi({
    secim: calismaSecimi?.yol === yol ? calismaSecimi.acik : null,
    etkinIcinde: Boolean(baglamEtkin),
    kayitli: null,
    varsayilan: true,
  });

  /*
    Tek etkin işaret: çalışmaya süzülmüş bir araçtayken (Kaynaklar
    ?calisma=…) işaret alt menüdeki bağlantıda; ana listedeki "Kaynaklar"
    ikinci kez işaretlenmez. "Çalışmalarım" o sırada üst öğe olarak
    belirginleşir (is-ust), sayfa işareti taşımaz.
  */
  const anaEtkinKey = baglamEtkin ? null : etkin?.key;

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
    const acik = anaEtkinKey === u.key;
    return (
      <li key={u.key} data-alt-cubuk={cubukta.has(u.key) || undefined}>
        <Link href={u.href} className={acik ? "os-gezinme-oge is-active" : "os-gezinme-oge"} aria-current={acik ? "page" : undefined} title={u.label}>
          {ogeIcerik(u)}
        </Link>
      </li>
    );
  };

  /* "Çalışmalarım" + açık çalışmanın alt menüsü (yalnızca masaüstünde görünür). */
  const calismaOgesi = (u: OsUygulama) => {
    const acik = anaEtkinKey === u.key;
    const sinif = ["os-gezinme-oge", acik ? "is-active" : "", baglamEtkin ? "is-ust" : ""].filter(Boolean).join(" ");
    return (
      <li key={u.key} data-alt-cubuk={cubukta.has(u.key) || undefined} className="os-gezinme-ust-oge">
        <div className="os-gezinme-satir">
          <Link href={u.href} className={sinif} aria-current={acik ? "page" : undefined} title={u.label}>
            {ogeIcerik(u)}
          </Link>
          <button
            type="button"
            className="os-gezinme-ac"
            aria-expanded={calismaAcik}
            aria-controls="os-gezinme-calisma"
            aria-label={t({ tr: "Açık çalışmanın bölümleri", en: "Sections of the open work" })}
            onClick={() => setCalismaSecimi({ yol, acik: !calismaAcik })}
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
        <div id="os-gezinme-calisma" className="os-gezinme-baglam" hidden={!calismaAcik}>
          <b className="os-gezinme-calisma" title={baglam?.baslik}>
            {baglam?.baslik}
          </b>
          <ul className="os-gezinme-liste" aria-label={t({ tr: `Açık çalışma: ${baglam?.baslik ?? ""}`, en: `Open work: ${baglam?.baslik ?? ""}` })}>
            {calismaBolumleri.map((b) => (
              <li key={b.key}>
                <Link href={b.href} className={baglamEtkin?.key === b.key ? "os-gezinme-alt is-active" : "os-gezinme-alt"} aria-current={baglamEtkin?.key === b.key ? "page" : undefined}>
                  {b.label}
                </Link>
              </li>
            ))}
          </ul>
          <span className="os-gezinme-alt-baslik">{t({ tr: "Bu çalışmada", en: "In this work" })}</span>
          <ul className="os-gezinme-liste">
            {calismaAraclari.map((b) => (
              <li key={b.key}>
                <Link href={b.href} className={baglamEtkin?.key === b.key ? "os-gezinme-alt is-active" : "os-gezinme-alt"} aria-current={baglamEtkin?.key === b.key ? "page" : undefined}>
                  {b.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </li>
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
          <ul className="os-gezinme-liste os-gezinme-ana">{ana.map((u) => (u.key === "tez" && baglamGorunur ? calismaOgesi(u) : oge(u)))}</ul>
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
