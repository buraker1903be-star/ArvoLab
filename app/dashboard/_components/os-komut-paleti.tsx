"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Search, type LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { aramaAnahtari, osSayfalari, type OsIkon, type OsUygulama } from "@/lib/os/uygulamalar";
import { OsSimge } from "./os-simge";

/*
  CTRL+K / ⌘K: uygulamalar, bölümler ve komutlar tek kutuda. Panelde hiç
  arama yoktu; bir ekrana gitmek menüde doğru grubu bulup açmayı
  gerektiriyordu.

  Klavye: ↑↓ gez, Enter aç, Esc kapat. Üst çubuktaki arama düğmesi de
  aynı pencereyi açıyor ("os:ara" olayı) — düğme kabuğun başka bir
  yerinde durduğu için paletin kodunu oraya taşımadan.

  Liste dock'la AYNI yerden geliyor: kullanıcıya gizlenmiş bir uygulama
  burada da çıkmasın.
*/

/* Öğeler düz veri; ne yapacakları çalıştır() içinde. */
type Oge = { id: string; grup: string; label: string; ipucu?: string; ikon: OsIkon } & (
  | { tur: "git"; href: string }
  | { tur: "tema" }
  | { tur: "cikis" }
);

const KOMUT_IKONU: Record<"tema" | "cikis", LucideIcon> = { tema: Moon, cikis: LogOut };

export function OsKomutPaleti({ uygulamalar, cikis }: { uygulamalar: OsUygulama[]; cikis: () => Promise<void> }) {
  const router = useRouter();
  const pencere = useRef<HTMLDialogElement>(null);
  const kutu = useRef<HTMLInputElement>(null);
  const cikisFormu = useRef<HTMLFormElement>(null);
  const [sorgu, setSorgu] = useState("");
  const [secili, setSecili] = useState(0);

  const kapat = () => pencere.current?.close();

  useEffect(() => {
    const ac = () => {
      setSorgu("");
      setSecili(0);
      if (!pencere.current?.open) pencere.current?.showModal();
      window.requestAnimationFrame(() => kutu.current?.focus());
    };
    const tus = (olay: KeyboardEvent) => {
      // "en" ile küçültülüyor: Türkçe yerelde "K" → "k" aynı, ama tutarlı olsun.
      if ((olay.ctrlKey || olay.metaKey) && olay.key.toLocaleLowerCase("en") === "k") {
        olay.preventDefault();
        if (pencere.current?.open) kapat();
        else ac();
      }
    };
    window.addEventListener("keydown", tus);
    window.addEventListener("os:ara", ac);
    return () => {
      window.removeEventListener("keydown", tus);
      window.removeEventListener("os:ara", ac);
    };
  }, []);

  const ikonu = new Map(uygulamalar.map((u) => [u.key, u.ikon]));
  const ogeler: Oge[] = [
    ...uygulamalar.map((u): Oge => ({ id: `app:${u.key}`, grup: "Uygulamalar", label: u.label, ikon: u.ikon, tur: "git", href: u.href })),
    ...osSayfalari(uygulamalar).map((s): Oge => ({
      id: `sayfa:${s.href}`,
      grup: "Sayfalar",
      label: s.label,
      ipucu: uygulamalar.find((u) => u.key === s.uygulama)?.label,
      ikon: ikonu.get(s.uygulama) ?? "apps",
      tur: "git",
      href: s.href,
    })),
    { id: "komut:tema", grup: "Komutlar", label: "Aydınlık / karanlık temaya geç", ikon: "settings", tur: "tema" },
    { id: "komut:cikis", grup: "Komutlar", label: "Çıkış yap", ikon: "settings", tur: "cikis" },
  ];

  const calistir = (oge: Oge) => {
    if (oge.tur === "cikis") {
      cikisFormu.current?.requestSubmit();
      return;
    }
    kapat();
    if (oge.tur === "git") {
      router.push(oge.href);
      return;
    }
    const sonraki = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", sonraki);
    try {
      window.localStorage.setItem("arvolab.theme", sonraki);
    } catch {
      // gizli sekmede depolama kapalı olabilir; tema yine de değişsin
    }
  };

  const anahtar = aramaAnahtari(sorgu.trim());
  const sonuc = anahtar ? ogeler.filter((oge) => aramaAnahtari(`${oge.label} ${oge.ipucu ?? ""}`).includes(anahtar)) : ogeler;
  const etkin = Math.min(secili, Math.max(sonuc.length - 1, 0));

  const klavye = (olay: React.KeyboardEvent) => {
    if (olay.key === "ArrowDown") {
      olay.preventDefault();
      setSecili((etkin + 1) % Math.max(sonuc.length, 1));
    } else if (olay.key === "ArrowUp") {
      olay.preventDefault();
      setSecili((etkin - 1 + sonuc.length) % Math.max(sonuc.length, 1));
    } else if (olay.key === "Enter") {
      olay.preventDefault();
      const oge = sonuc[etkin];
      if (oge) calistir(oge);
    }
  };

  let sonGrup = "";
  return (
    <dialog
      ref={pencere}
      className="os-palette"
      aria-label="Ara veya komut çalıştır"
      onClick={(olay) => {
        if (olay.target === pencere.current) kapat();
      }}
    >
      <div className="os-palette-input">
        <Search size={20} aria-hidden="true" />
        <input
          ref={kutu}
          value={sorgu}
          onChange={(olay) => {
            setSorgu(olay.target.value);
            setSecili(0);
          }}
          onKeyDown={klavye}
          placeholder="Uygulama, sayfa ya da komut ara"
          aria-label="Ara"
          aria-controls="os-palette-list"
          aria-activedescendant={sonuc[etkin] ? `os-oge-${etkin}` : undefined}
          role="combobox"
          aria-expanded="true"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd>Esc</kbd>
      </div>
      <ul id="os-palette-list" className="os-palette-list" role="listbox" aria-label="Sonuçlar">
        {sonuc.map((oge, sira) => {
          const baslik = oge.grup !== sonGrup ? oge.grup : null;
          sonGrup = oge.grup;
          const KomutIkonu = oge.tur === "tema" || oge.tur === "cikis" ? KOMUT_IKONU[oge.tur] : null;
          return (
            <li key={oge.id} role="presentation">
              {baslik ? (
                <div className="os-palette-group" role="presentation">
                  {baslik}
                </div>
              ) : null}
              <button
                id={`os-oge-${sira}`}
                type="button"
                role="option"
                aria-selected={sira === etkin}
                className={sira === etkin ? "os-palette-item is-active" : "os-palette-item"}
                onMouseMove={() => setSecili(sira)}
                onClick={() => calistir(oge)}
              >
                <span className="os-palette-icon">
                  {KomutIkonu ? <KomutIkonu size={16} aria-hidden="true" /> : <OsSimge ad={oge.ikon} boyut={16} />}
                </span>
                <span className="os-palette-label">{oge.label}</span>
                {oge.ipucu ? <small>{oge.ipucu}</small> : null}
              </button>
            </li>
          );
        })}
        {sonuc.length === 0 ? <li className="os-palette-empty">“{sorgu}” için sonuç yok</li> : null}
      </ul>
      <footer className="os-palette-foot">
        <span>↑↓ gez</span>
        <span>Enter aç</span>
        <span>Esc kapat</span>
      </footer>
      {/* Çıkış bir sunucu eylemi: paletten de formla tetikleniyor. */}
      <form ref={cikisFormu} action={cikis} hidden />
    </dialog>
  );
}

/* Üst çubuktaki arama düğmesi: paleti açar. */
export function OsAramaDugmesi() {
  return (
    <button
      type="button"
      className="os-search"
      onClick={() => window.dispatchEvent(new Event("os:ara"))}
      aria-label="Ara veya komut çalıştır (Ctrl+K)"
    >
      <Search size={18} aria-hidden="true" />
      <span className="os-search-text">Ara veya komut çalıştır</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}
