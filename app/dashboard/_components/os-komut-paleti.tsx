"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, ChartNoAxesCombined, Monitor, Moon, Plus, Search, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { aramaAnahtari, calismaIcindeMi, osSayfalari, type OsIkon, type OsUygulama } from "@/lib/os/uygulamalar";
import { kaynakEklemeAdresi } from "@/lib/calisma-secimi";
import { useCalismaBaglami } from "./calisma-baglami";
import { normalizeDoi } from "@/lib/doi";
import { calismaAdresi } from "@/lib/calisma-karti";
import { projectTypeLabel } from "@/lib/project-labels";
import { komutCalismalari } from "@/app/actions/projects";
import { OsSimge } from "./os-simge";
import { temaTercihiniUygula } from "@/app/_components/tema";
import type { TemaTercihi } from "@/lib/tema";

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

/*
  KOMUT MERKEZİ (Phase 3, 04.11.2026): uygulamaların yanında artık
  kullanıcının ÇALIŞMALARI (aç), hızlı işlemler (yeni çalışma, kaynak/DOI
  ekle, analiz, yazım asistanı) ve kutuya yapıştırılan bir DOI'nin kendisi
  ("DOI ile ekle"). Çalışmalar pencere ilk açıldığında bir kez okunur
  (komutCalismalari, RLS'li salt okuma); okunamazsa yalnızca o grup
  eksik kalır.
*/

/* Öğeler düz veri; ne yapacakları çalıştır() içinde. */
type Oge = { id: string; grup: string; label: string; ipucu?: string; ikon: OsIkon; simge?: LucideIcon } & (
  | { tur: "git"; href: string }
  | { tur: "tema"; tercih: TemaTercihi }
  | { tur: "cikis" }
);

const TEMA_IKONU: Record<TemaTercihi, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };
type Calisma = { id: string; title: string; project_type: string };

export function OsKomutPaleti({ uygulamalar, cikis }: { uygulamalar: OsUygulama[]; cikis: () => Promise<void> }) {
  const t = useCeviri();
  const router = useRouter();
  const pencere = useRef<HTMLDialogElement>(null);
  const kutu = useRef<HTMLInputElement>(null);
  const cikisFormu = useRef<HTMLFormElement>(null);
  const [sorgu, setSorgu] = useState("");
  const [secili, setSecili] = useState(0);
  const [calismalar, setCalismalar] = useState<Calisma[] | null>(null);
  const yuklendi = useRef(false);
  /*
    Aktif çalışma (4.3.5, B2): sayfanın yayınladığı bağlam, ama yalnızca
    adres hâlâ o çalışmanın içindeyse (bağlam sayfa kapanınca silinmiyor).
    Adres palet AÇILIRKEN okunur (render sırasında window okumak sunucu
    çizimiyle uyuşmazlık üretirdi).
  */
  const baglam = useCalismaBaglami();
  const [adres, setAdres] = useState<{ yol: string; sorgu: string } | null>(null);
  const aktifCalisma = baglam && adres && calismaIcindeMi(baglam.id, adres.yol, new URLSearchParams(adres.sorgu)) ? baglam : null;

  const kapat = () => pencere.current?.close();

  useEffect(() => {
    const ac = () => {
      setAdres({ yol: window.location.pathname, sorgu: window.location.search });
      setSorgu("");
      setSecili(0);
      if (!yuklendi.current) {
        yuklendi.current = true;
        komutCalismalari()
          .then(setCalismalar)
          .catch(() => setCalismalar([]));
      }
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
  const hizli = t({ tr: "Hızlı işlemler", en: "Quick actions" });
  // Asistan kısayolu da önce aktif çalışmaya gider; yoksa en son çalışma (ipucunda adı yazar, veri yazmaz).
  const sonCalisma = aktifCalisma ? { id: aktifCalisma.id, title: aktifCalisma.baslik } : calismalar?.[0];
  const hedefIpucu = aktifCalisma ? aktifCalisma.baslik : t({ tr: "çalışmayı sayfada seçeceksiniz", en: "you'll choose the work on the page" });
  const doi = normalizeDoi(sorgu);
  const ogeler: Oge[] = [
    /* Kutuya DOI yapıştırıldıysa en üstte: tek Enter ile kaynak eklemeye. */
    ...(doi
      ? [{ id: "doi", grup: hizli, label: t({ tr: `DOI ile kaynak ekle: ${doi}`, en: `Add source by DOI: ${doi}` }), ipucu: hedefIpucu, ikon: "literatur" as const, simge: BookPlus, tur: "git" as const, href: kaynakEklemeAdresi(aktifCalisma?.id ?? null, { doi }) }]
      : []),
    { id: "yeni", grup: hizli, label: t({ tr: "Yeni çalışma oluştur", en: "Create a new work" }), ikon: "tez", simge: Plus, tur: "git", href: "/dashboard/editor?yeni=1" },
    { id: "kaynak", grup: hizli, label: t({ tr: "Kaynak ekle (DOI ya da arama)", en: "Add a source (DOI or search)" }), ipucu: hedefIpucu, ikon: "literatur", simge: BookPlus, tur: "git", href: kaynakEklemeAdresi(aktifCalisma?.id ?? null, { ekle: true }) },
    { id: "analiz", grup: hizli, label: t({ tr: "Veri analizi başlat", en: "Start a data analysis" }), ikon: "analiz", simge: ChartNoAxesCombined, tur: "git", href: "/dashboard/analysis" },
    ...(sonCalisma
      ? [{ id: "asistan", grup: hizli, label: t({ tr: "Yazım asistanını aç", en: "Open the writing assistant" }), ipucu: sonCalisma.title, ikon: "tez" as const, simge: Sparkles, tur: "git" as const, href: `/dashboard/editor/${sonCalisma.id}/write?asistan=1` }]
      : []),
    ...(calismalar ?? []).map((c): Oge => ({
      id: `calisma:${c.id}`,
      grup: t({ tr: "Çalışmalarım", en: "My works" }),
      label: c.title,
      ipucu: t(projectTypeLabel(c.project_type)),
      ikon: "tez",
      tur: "git",
      href: calismaAdresi(c.id),
    })),
    ...uygulamalar.map((u): Oge => ({ id: `app:${u.key}`, grup: t({ tr: "Uygulamalar", en: "Apps" }), label: u.label, ikon: u.ikon, tur: "git", href: u.href })),
    ...osSayfalari(uygulamalar).map((s): Oge => ({
      id: `sayfa:${s.href}`,
      grup: t({ tr: "Sayfalar", en: "Pages" }),
      label: s.label,
      ipucu: uygulamalar.find((u) => u.key === s.uygulama)?.label,
      ikon: ikonu.get(s.uygulama) ?? "apps",
      tur: "git",
      href: s.href,
    })),
    /* Üç tema seçeneği (Phase 4.1): eskiden tek bir "aydınlık / karanlık geç" vardı ve "sisteme uy"a dönülemiyordu. */
    { id: "komut:tema-acik", grup: t({ tr: "Komutlar", en: "Commands" }), label: t({ tr: "Tema: Açık", en: "Theme: Light" }), ikon: "settings", tur: "tema", tercih: "light" },
    { id: "komut:tema-koyu", grup: t({ tr: "Komutlar", en: "Commands" }), label: t({ tr: "Tema: Koyu", en: "Theme: Dark" }), ikon: "settings", tur: "tema", tercih: "dark" },
    { id: "komut:tema-sistem", grup: t({ tr: "Komutlar", en: "Commands" }), label: t({ tr: "Tema: Sistem", en: "Theme: System" }), ipucu: t({ tr: "cihazın ayarını izler", en: "follows your device" }), ikon: "settings", tur: "tema", tercih: "system" },
    { id: "komut:cikis", grup: t({ tr: "Komutlar", en: "Commands" }), label: t({ tr: "Çıkış yap", en: "Sign out" }), ikon: "settings", tur: "cikis" },
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
    temaTercihiniUygula(oge.tercih);
  };

  const anahtar = aramaAnahtari(sorgu.trim());
  /* Boş kutuda çalışmaların yalnızca son beşi; yazınca hepsinde aranır. */
  let gosterilenCalisma = 0;
  const sonuc = anahtar
    ? ogeler.filter(
        (oge) =>
          oge.id === "doi" ||
          /* Hızlı işlemler yalnızca KENDİ adıyla eşleşir: "Yazım asistanını aç"ın ipucu son çalışmanın adı;
             ipucuyla eşleşseydi çalışma adını yazan kullanıcı Enter'da çalışmayı değil asistanı açardı. */
          aramaAnahtari(oge.grup === hizli ? oge.label : `${oge.label} ${oge.ipucu ?? ""}`).includes(anahtar),
      )
    : ogeler.filter((oge) => !oge.id.startsWith("calisma:") || ++gosterilenCalisma <= 5);
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
      aria-label={t({ tr: "Ara veya komut çalıştır", en: "Search or run a command" })}
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
          placeholder={t({ tr: "Çalışma, sayfa, komut ara ya da DOI yapıştır", en: "Search works, pages, commands or paste a DOI" })}
          aria-label={t({ tr: "Ara", en: "Search" })}
          aria-controls="os-palette-list"
          aria-activedescendant={sonuc[etkin] ? `os-oge-${etkin}` : undefined}
          role="combobox"
          aria-expanded="true"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd>Esc</kbd>
      </div>
      <ul id="os-palette-list" className="os-palette-list" role="listbox" aria-label={t({ tr: "Sonuçlar", en: "Results" })}>
        {sonuc.map((oge, sira) => {
          const baslik = oge.grup !== sonGrup ? oge.grup : null;
          sonGrup = oge.grup;
          const KomutIkonu = oge.simge ?? (oge.tur === "tema" ? TEMA_IKONU[oge.tercih] : oge.tur === "cikis" ? LogOut : null);
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
        {sonuc.length === 0 ? <li className="os-palette-empty">{t({ tr: `“${sorgu}” için sonuç yok`, en: `No results for “${sorgu}”` })}</li> : null}
      </ul>
      <footer className="os-palette-foot">
        <span>{t({ tr: "↑↓ gez", en: "↑↓ move" })}</span>
        <span>{t({ tr: "Enter aç", en: "Enter open" })}</span>
        <span>{t({ tr: "Esc kapat", en: "Esc close" })}</span>
      </footer>
      {/* Çıkış bir sunucu eylemi: paletten de formla tetikleniyor. */}
      <form ref={cikisFormu} action={cikis} hidden />
    </dialog>
  );
}

/* Üst çubuktaki arama düğmesi: paleti açar. */
export function OsAramaDugmesi() {
  const t = useCeviri();
  return (
    <button
      type="button"
      className="os-search"
      onClick={() => window.dispatchEvent(new Event("os:ara"))}
      aria-label={t({ tr: "Ara veya komut çalıştır (Ctrl+K)", en: "Search or run a command (Ctrl+K)" })}
    >
      <Search size={18} aria-hidden="true" />
      <span className="os-search-text">{t({ tr: "Ara veya komut çalıştır", en: "Search or run a command" })}</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}
