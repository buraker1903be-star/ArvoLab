"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Ellipsis, X } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import {
  ALT_CUBUK,
  calismaBaglantilari,
  calismaIcindeMi,
  dahaFazlasi,
  etkinBaglanti,
  etkinUygulama,
  gezinmeGruplari,
  type OsUygulama,
} from "@/lib/os/uygulamalar";
import { OsSimge } from "./os-simge";
import { useCalismaBaglami } from "./calisma-baglami";

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
  const etkin = etkinUygulama(uygulamalar, yol);
  const { ana, diger, ayarlar } = gezinmeGruplari(uygulamalar);
  const cubukta = new Set<string>(ALT_CUBUK);

  const baglamGorunur = baglam && calismaIcindeMi(baglam.id, yol, new URLSearchParams(sorgu.toString()));
  const baglantilar = baglamGorunur ? calismaBaglantilari(baglam, t) : [];
  const baglamEtkin = baglamGorunur ? etkinBaglanti(baglantilar, yol) : null;

  const oge = (u: OsUygulama) => {
    const acik = etkin?.key === u.key;
    return (
      <li key={u.key} data-alt-cubuk={cubukta.has(u.key) || undefined}>
        <Link
          href={u.href}
          className={acik ? "os-gezinme-oge is-active" : "os-gezinme-oge"}
          aria-current={acik ? "page" : undefined}
          title={u.label}
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
      <nav className="os-gezinme" aria-label={t({ tr: "Ana gezinme", en: "Main navigation" })}>
        {baglamGorunur ? (
          <section className="os-gezinme-baglam" aria-label={t({ tr: `Açık çalışma: ${baglam.baslik}`, en: `Open work: ${baglam.baslik}` })}>
            <span className="os-gezinme-baslik">{t({ tr: "Açık çalışma", en: "Open work" })}</span>
            <b className="os-gezinme-calisma" title={baglam.baslik}>{baglam.baslik}</b>
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
        <p className="os-daha-ipucu">
          {t({ tr: "Her şeye Ctrl+K ile de ulaşabilirsiniz.", en: "You can also reach everything with Ctrl+K." })}
        </p>
      </dialog>
    </>
  );
}
