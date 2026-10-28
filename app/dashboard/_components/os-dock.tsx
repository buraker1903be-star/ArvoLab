"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X } from "lucide-react";
import { docktakiler, etkinBolum, etkinUygulama, type OsUygulama } from "@/lib/os/uygulamalar";
import { OsSimge } from "./os-simge";

/*
  DOCK (25.10.2026). Kenar çubuğunun yerini alır: ekranın altında yüzen
  tek sıra uygulama, açık uygulamanın altında marka renginde bir nokta.
  Telefonda aynı dock alt gezinme çubuğu olur.

  Düzen ArvoOS ve ArvoARC'takinin aynısı — kurum sahibinin isteği "aynı
  sistem" olduğu için davranışı da birebir taşındı, yeniden icat
  edilmedi: fareyle ikonun üstüne gelince bölümler ikinci bir dock'ta
  açılır, dokunmatikte bölümü olan ikona DOKUNMAK uygulamayı açmaz
  ikinci dock'u açar, klavyede ikondayken ↑ açar ve Esc kapatır.
  Telefonda (≤760px) bu ara menü hiç açılmaz: orada dokunuş doğrudan
  uygulamayı açıyor, bölümler üstteki şeritte (os-bolum-seridi.tsx).
  ArvoOS'ta ara menü telefonda yazıyı kaydırıyor ve bağlantılar dokunuşu
  kaçırıyordu.

  BAŞLATICI. Sağdaki ızgara düğmesi ortada bir pencere açar: kullanıcının
  görebildiği bütün uygulamalar, rolüne bağlı olanlar dahil (dock'ta yer
  kaplamayanlar yalnızca burada).
*/

export function OsDock({ uygulamalar }: { uygulamalar: OsUygulama[] }) {
  const t = useCeviri();
  const yol = usePathname();
  const pencere = useRef<HTMLDialogElement>(null);
  const etkin = etkinUygulama(uygulamalar, yol);
  const home = uygulamalar.find((u) => u.key === "home");
  const dockta = docktakiler(uygulamalar).filter((u) => u.key !== "home");

  const zaman = useGecikme();
  /* Açıldığı sayfa da tutuluyor: sayfa değişince ikinci dock kendiliğinden
     gizlenir (efektte state yazmadan). */
  const [altDurum, setAlt] = useState<{ key: string; x: number; alt: number; yol: string } | null>(null);
  /*
    İKONUN ADI DOCK'UN DIŞINDA ÇİZİLİYOR.

    Eskiden ad, ikonun içindeki bir <span>'di ve ikonun üstünde
    konumlanıyordu. Görünmüyordu: dock'ta `overflow-x: auto` var (dar
    ekranda on bir simge sığmıyor) ve bir eksende görünür olmayan taşma
    ÖTEKİ ekseni de kırpıyor. Ölçüldü (26.10.2026, 1200px): etiket
    kutusu 696–721, dock kutusu 718–784 — yani etiket çiziliyor ama
    dock'un kendi kaydırma kutusu onu kesiyordu.

    Şimdi kaydırıcının dışında, ikinci dock'la aynı yöntemle (sabit
    konum, ikonun ortasına hizalı) çiziliyor.
  */
  const [ipucu, setIpucu] = useState<{ ad: string; x: number; alt: number } | null>(null);
  const alt = altDurum && altDurum.yol === yol ? altDurum : null;

  const konum = (oge: HTMLElement) => {
    const r = oge.getBoundingClientRect();
    const d = oge.closest(".os-dock")?.getBoundingClientRect();
    return { x: r.left + r.width / 2, alt: d ? window.innerHeight - d.top + 10 : 96, yol };
  };
  const kapat = (gecikme = 220) => {
    if (gecikme === 0) {
      zaman.iptal();
      setAlt(null);
      return;
    }
    zaman.kur(() => setAlt(null), gecikme);
  };
  const ac = (uygulama: OsUygulama, oge: HTMLElement, gecikme = 90) => {
    if (!(uygulama.bolumler ?? []).length) {
      kapat(0);
      return;
    }
    const yer = konum(oge);
    zaman.kur(() => setAlt({ key: uygulama.key, ...yer }), gecikme);
  };

  // Dokunmatikte açıkken dışarıya dokunmak kapatır (fareyle ayrılınca zaten kapanıyor).
  const acikAnahtar = alt?.key ?? null;
  useEffect(() => {
    if (!acikAnahtar) return;
    const disari = (olay: PointerEvent) => {
      const hedef = olay.target as Element | null;
      if (hedef?.closest(".os-subdock, .os-dock-item.is-sub-open")) return;
      setAlt(null);
    };
    document.addEventListener("pointerdown", disari);
    return () => document.removeEventListener("pointerdown", disari);
  }, [acikAnahtar]);

  // Pencere boyu değişince konum bayatlar: kapanır.
  useEffect(() => {
    const yeniden = () => setAlt(null);
    window.addEventListener("resize", yeniden);
    return () => window.removeEventListener("resize", yeniden);
  }, []);

  const fareMi = (olay: ReactPointerEvent) => olay.pointerType === "mouse";
  const ikonKlavye = (uygulama: OsUygulama) => (olay: ReactKeyboardEvent<HTMLElement>) => {
    if (olay.key === "ArrowUp" && (uygulama.bolumler ?? []).length) {
      olay.preventDefault();
      zaman.iptal();
      setAlt({ key: uygulama.key, ...konum(olay.currentTarget) });
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".os-subdock a")?.focus());
    } else if (olay.key === "Escape") kapat(0);
  };

  const altUygulama = alt ? uygulamalar.find((u) => u.key === alt.key) : null;
  const altEtkin = altUygulama?.bolumler ? etkinBolum(altUygulama.bolumler, yol) : null;

  const simge = (uygulama: OsUygulama) => {
    const acik = etkin?.key === uygulama.key;
    const bolumVar = (uygulama.bolumler ?? []).length > 0;
    return (
      <Link
        key={uygulama.key}
        href={uygulama.href}
        className={["os-dock-item", acik ? "is-active" : "", alt?.key === uygulama.key ? "is-sub-open" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={uygulama.label}
        aria-current={acik ? "page" : undefined}
        aria-haspopup={bolumVar ? "true" : undefined}
        aria-expanded={bolumVar ? alt?.key === uygulama.key : undefined}
        onPointerEnter={(olay) => {
          if (!fareMi(olay)) return;
          const yer = konum(olay.currentTarget);
          setIpucu({ ad: uygulama.label, x: yer.x, alt: yer.alt });
          ac(uygulama, olay.currentTarget);
        }}
        onPointerLeave={(olay) => {
          if (!fareMi(olay)) return;
          setIpucu(null);
          kapat();
        }}
        onKeyDown={ikonKlavye(uygulama)}
        onPointerDown={(olay) => zaman.isaretciKaydet(olay.pointerType)}
        onClick={(olay) => {
          if (!zaman.dokunmaMi() || !bolumVar || window.matchMedia("(max-width: 760px)").matches) return;
          olay.preventDefault();
          if (alt?.key === uygulama.key) kapat(0);
          else {
            zaman.iptal();
            setAlt({ key: uygulama.key, ...konum(olay.currentTarget) });
          }
        }}
      >
        <OsSimge ad={uygulama.ikon} />
      </Link>
    );
  };

  return (
    <>
      {altUygulama?.bolumler && alt ? (
        <nav
          className="os-subdock"
          aria-label={`${altUygulama.label} bölümleri`}
          style={{
            left: Math.min(Math.max(alt.x, 160), (typeof window === "undefined" ? 1280 : window.innerWidth) - 160),
            bottom: alt.alt,
          }}
          onPointerEnter={() => zaman.iptal()}
          onPointerLeave={(olay) => {
            if (fareMi(olay)) kapat();
          }}
          onKeyDown={(olay) => {
            if (olay.key === "Escape") {
              const ikon = document.querySelector<HTMLElement>(".os-dock .os-dock-item.is-sub-open");
              kapat(0);
              ikon?.focus();
            }
          }}
        >
          <span className="os-subdock-title">{altUygulama.label}</span>
          {(altUygulama.bolumler ?? []).map((bolum) => (
            <Link
              key={bolum.key}
              href={bolum.href}
              className={altEtkin?.key === bolum.key ? "is-active" : undefined}
              aria-current={altEtkin?.key === bolum.key ? "page" : undefined}
              onClick={() => kapat(0)}
            >
              {bolum.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {ipucu && !alt ? (
        <span
          className="os-dock-ipucu"
          aria-hidden="true"
          style={{
            left: Math.min(Math.max(ipucu.x, 80), (typeof window === "undefined" ? 1280 : window.innerWidth) - 80),
            bottom: ipucu.alt,
          }}
        >
          {ipucu.ad}
        </span>
      ) : null}

      <nav
        className="os-dock"
        aria-label={t({ tr: "Uygulamalar", en: "Apps" })}
        onPointerLeave={(olay) => {
          if (!fareMi(olay)) return;
          setIpucu(null);
          kapat();
        }}
      >
        {home ? simge(home) : null}
        <span className="os-dock-sep" aria-hidden="true" />
        {dockta.map(simge)}
        <span className="os-dock-sep" aria-hidden="true" />
        <button
          type="button"
          className="os-dock-item"
          aria-haspopup="dialog"
          aria-label={t({ tr: "Tüm uygulamalar", en: "All apps" })}
          onPointerEnter={(olay) => {
            if (!fareMi(olay)) return;
            const yer = konum(olay.currentTarget);
            setIpucu({ ad: t({ tr: "Tüm uygulamalar", en: "All apps" }), x: yer.x, alt: yer.alt });
          }}
          onPointerLeave={(olay) => {
            if (fareMi(olay)) setIpucu(null);
          }}
          onClick={() => pencere.current?.showModal()}
        >
          <OsSimge ad="apps" />
        </button>
      </nav>

      <dialog
        ref={pencere}
        className="os-launcher"
        aria-label={t({ tr: "Uygulamalar", en: "Apps" })}
        /* Pencerenin dışına basınca kapanır: hedef dialog ise tıklama boşluğa gelmiştir. */
        onClick={(olay) => {
          if (olay.target === pencere.current) pencere.current?.close();
        }}
      >
        <header className="os-launcher-head">
          <div>
            <h2>{t({ tr: "Uygulamalar", en: "Apps" })}</h2>
            <p>{t({ tr: "Hesabınızla açabildiğiniz bütün bölümler.", en: "Everything your account can open." })}</p>
          </div>
          <button type="button" className="os-icon-btn" aria-label={t({ tr: "Kapat", en: "Close" })} onClick={() => pencere.current?.close()}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="os-launcher-grid">
          {uygulamalar.map((uygulama) => (
            <Link
              key={uygulama.key}
              href={uygulama.href}
              className="os-launcher-app"
              onClick={() => pencere.current?.close()}
            >
              <span className={etkin?.key === uygulama.key ? "os-app-tile is-active" : "os-app-tile"}>
                <OsSimge ad={uygulama.ikon} boyut={30} />
              </span>
              <span>{uygulama.label}</span>
            </Link>
          ))}
        </div>
      </dialog>
    </>
  );
}

/*
  Gecikmeli aç/kapa: tek zamanlayıcı. Yeni bir istek öncekini iptal eder
  (fare ikondan ikona geçerken önceki açma ya da kapama düşer).
*/
function useGecikme() {
  const kimlik = useRef(0);
  const isaretci = useRef("mouse");
  useEffect(() => () => window.clearTimeout(kimlik.current), []);
  return useMemo(
    () => ({
      /** Son basışın türü: dokunmatikte tıklama ikinci dock'u açar. */
      isaretciKaydet(tur: string) {
        isaretci.current = tur;
      },
      dokunmaMi() {
        return isaretci.current !== "mouse";
      },
      kur(is: () => void, ms: number) {
        window.clearTimeout(kimlik.current);
        kimlik.current = window.setTimeout(is, ms);
      },
      iptal() {
        window.clearTimeout(kimlik.current);
      },
    }),
    []
  );
}
