"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { komutCalismalari } from "@/app/actions/projects";
import { calismaDegistirAdresi, type CalismaBaglami } from "@/lib/os/uygulamalar";
import { projectTypeLabel } from "@/lib/project-labels";
import { useGuvenliGezinme } from "./gezinme-korumasi";
import { useAcilirKonum } from "./acilir-konum";

/*
  PROJECT SWITCHER (Signature OS 2.0 Aşama 2, 08.11.2026).

  Eskiden kenar çubuğunda açık çalışmanın adı salt bir yazıydı; başka bir
  çalışmaya geçmek Çalışmalarım'a dönüp seçmeyi, sonra aynı bölüme yeniden
  yürümeyi gerektiriyordu (3 adım). Şimdi ad bir düğme: son çalışmalar
  açılır, seçilen çalışmanın AYNI bölümüne gidilir (calismaDegistirAdresi).

  - Liste ÜST KATMANDA açılan bir pencere (Aşama 2.1): ilk sürümde kenar
    çubuğunun içinde açılıyor ve altındaki bölüm ve uygulama bağlantılarını
    aşağı itiyordu. Konum ortak menülerle aynı yardımcıdan
    (acilir-konum.ts): kayan kenar çubuğu pencereyi kırpmaz.
  - Düğme kompakt: "Açık çalışma" etiketi görünmez (ekran okuyucu adında
    duruyor), başlık en çok iki satır; tam başlık listede ve ipucunda.
  - Daraltılmış kenar çubuğunda yalnızca simge (44 px) ve aynı pencere;
    bölüm bağlantıları orada gizli, sayfadaki sekmeler görünür.
  - Erişilebilirlik: düğme aria-haspopup="listbox"; liste role="listbox",
    öğeler role="option" ve açık olan aria-selected. ↑↓ / Home / End /
    harfle atlama, Enter ya da Boşluk seçer, Esc kapatır ve odağı düğmeye
    verir, Tab listeyi kapatıp devam eder.
  - Başlıklar KESİLMEZ: listede tam başlık sarar; düğmede iki satır, tam
    başlık erişilebilir adda ve ipucunda.
  - Geçiş gezinme korumasından geçer: editörde kaydedilmemiş metin varsa
    kayıt bitmeden çalışma değişmez (lib/gezinme-korumasi.ts).
  - Liste ilk açılışta bir kez okunur (komutCalismalari: RLS'li salt
    okuma, Ctrl+K ile aynı kaynak). Okunamazsa söylenir, "Tüm çalışmalar"
    bağlantısı yine çalışır.
*/
type Calisma = { id: string; title: string; project_type: string };
const GOSTERILEN = 8;

export function ProjeSecici({ baglam, yol, sorgu }: { baglam: CalismaBaglami; yol: string; sorgu: string }) {
  const t = useCeviri();
  const git = useGuvenliGezinme();
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState<Calisma[] | "hata" | null>(null);
  const [etkin, setEtkin] = useState(0);
  const dugme = useRef<HTMLButtonElement>(null);
  const kok = useRef<HTMLDivElement>(null);
  const pencere = useRef<HTMLDivElement>(null);
  const yuklendi = useRef(false);
  const listeId = useId();
  const ara = useRef({ metin: "", zaman: 0 });

  /*
    Açık çalışma listenin başında: son düzenlenenler sırasında nerede
    durursa dursun "şu an buradayım" ilk satırda okunur.
  */
  const calismalar: Calisma[] = Array.isArray(liste)
    ? [{ id: baglam.id, title: baglam.baslik, project_type: baglam.tur }, ...liste.filter((c) => c.id !== baglam.id)].slice(0, GOSTERILEN)
    : [];

  const ac = (ilk: "acik" | "son" = "acik") => {
    setAcik(true);
    setEtkin(ilk === "son" ? Math.max(0, calismalar.length - 1) : 0);
    if (!yuklendi.current) {
      yuklendi.current = true;
      komutCalismalari()
        .then((l) => setListe(l))
        .catch(() => setListe("hata"));
    }
  };
  const kapat = (odakDugmeye: boolean) => {
    setAcik(false);
    if (odakDugmeye) dugme.current?.focus();
  };
  const sec = (c: Calisma) => {
    kapat(false);
    if (c.id === baglam.id) {
      dugme.current?.focus();
      return;
    }
    void git(calismaDegistirAdresi({ yol, sorgu: new URLSearchParams(sorgu) }, baglam.id, { id: c.id, tur: c.project_type }));
  };

  // Liste açıkken (ve yüklenince) etkin seçeneğe odak.
  useEffect(() => {
    if (!acik) return;
    kok.current?.querySelector<HTMLElement>(`[data-sira="${etkin}"]`)?.focus();
  }, [acik, etkin, liste]);

  useAcilirKonum(acik, dugme, pencere);

  // Dışarı tıklama kapatır.
  useEffect(() => {
    if (!acik) return;
    const disari = (olay: PointerEvent) => {
      if (!kok.current?.contains(olay.target as Node)) setAcik(false);
    };
    document.addEventListener("pointerdown", disari);
    return () => document.removeEventListener("pointerdown", disari);
  }, [acik]);

  const listeTusu = (olay: KeyboardEvent<HTMLUListElement>) => {
    const n = calismalar.length;
    if (olay.key === "Escape") {
      olay.preventDefault();
      kapat(true);
    } else if (olay.key === "Tab") {
      setAcik(false);
    } else if (!n) {
      return;
    } else if (olay.key === "ArrowDown") {
      olay.preventDefault();
      setEtkin((i) => (i + 1) % n);
    } else if (olay.key === "ArrowUp") {
      olay.preventDefault();
      setEtkin((i) => (i - 1 + n) % n);
    } else if (olay.key === "Home") {
      olay.preventDefault();
      setEtkin(0);
    } else if (olay.key === "End") {
      olay.preventDefault();
      setEtkin(n - 1);
    } else if (olay.key === "Enter" || olay.key === " ") {
      olay.preventDefault();
      if (calismalar[etkin]) sec(calismalar[etkin]);
    } else if (olay.key.length === 1 && /\S/.test(olay.key)) {
      // Harfle atlama: yazılan harflerle başlayan sonraki çalışma (Türkçe büyük/küçük harf).
      const simdi = olay.timeStamp;
      ara.current.metin = simdi - ara.current.zaman > 700 ? olay.key : ara.current.metin + olay.key;
      ara.current.zaman = simdi;
      const aranan = ara.current.metin.toLocaleLowerCase("tr");
      const sira = [...calismalar.keys()].map((k) => (etkin + 1 + k) % n).find((k) => calismalar[k].title.toLocaleLowerCase("tr").startsWith(aranan));
      if (sira !== undefined) setEtkin(sira);
    }
  };

  return (
    <div className="proje-secici" ref={kok}>
      <button
        ref={dugme}
        type="button"
        className="proje-secici-dugme"
        aria-haspopup="listbox"
        aria-expanded={acik}
        aria-controls={acik ? listeId : undefined}
        aria-label={t({ tr: `Açık çalışma: ${baglam.baslik}. Çalışma değiştir`, en: `Open work: ${baglam.baslik}. Switch work` })}
        title={baglam.baslik}
        onClick={() => (acik ? kapat(false) : ac())}
        onKeyDown={(olay) => {
          if (olay.key === "ArrowDown" || olay.key === "ArrowUp") {
            olay.preventDefault();
            ac(olay.key === "ArrowUp" ? "son" : "acik");
          }
        }}
      >
        <BookOpen className="proje-secici-simge" size={18} aria-hidden="true" />
        <span className="proje-secici-ad-kisa">{baglam.baslik}</span>
        <ChevronsUpDown className="proje-secici-ok" size={16} aria-hidden="true" />
      </button>

      {/* Pencere hep DOM'da (popover="manual"), açık değilken gizli: üst katmana alma acilir-konum.ts'te. */}
      <div ref={pencere} className="proje-secici-pencere" popover="manual" hidden={!acik} role="presentation">
        {acik ? (
          <>
          {liste === null ? (
            <p className="proje-secici-not" role="status">{t({ tr: "Çalışmalar yükleniyor…", en: "Loading works…" })}</p>
          ) : liste === "hata" ? (
            <p className="proje-secici-not" role="status">{t({ tr: "Çalışmalar okunamadı.", en: "Works couldn't be loaded." })}</p>
          ) : (
            <ul
              id={listeId}
              className="proje-secici-liste"
              role="listbox"
              aria-label={t({ tr: "Son çalışmalar", en: "Recent works" })}
              onKeyDown={listeTusu}
            >
              {calismalar.map((c, sira) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={c.id === baglam.id}
                  data-sira={sira}
                  tabIndex={sira === etkin ? 0 : -1}
                  className="proje-secici-oge"
                  onClick={() => sec(c)}
                  onFocus={() => setEtkin(sira)}
                >
                  <span className="proje-secici-oge-govde">
                    <span className="proje-secici-ad">{c.title}</span>
                    <small>{t(projectTypeLabel(c.project_type))}</small>
                  </span>
                  {c.id === baglam.id ? <Check size={16} aria-hidden="true" /> : null}
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/editor" className="proje-secici-tumu" onClick={() => setAcik(false)}>
            {t({ tr: "Tüm çalışmalar", en: "All works" })}
          </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
