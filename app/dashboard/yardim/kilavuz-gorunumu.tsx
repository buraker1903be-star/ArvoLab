"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Info, LifeBuoy, Search, X } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { kilavuzAra } from "@/lib/yardim/kilavuz-arama";

/*
  KULLANIM KILAVUZU GÖRÜNÜMÜ (Signature OS 4.4, 05.11.2026).

  Metinler sunucuda ekrandaki dile çevrilip buraya düz metin olarak gelir
  (page.tsx); içerik ve role göre süzme lib/yardim/kullanim-kilavuzu.ts'te.

  Eskiden bütün bölümler açık, alt alta kartlardı: sayfa bilgisayarda
  6.700, telefonda 11.900 pikseldi, arama yoktu ve telefonda içindekiler
  listesi ilk ekranı kaplıyordu. Şimdi:
  - Arama: yazdıkça yalnızca eşleşen bölümler ve sorular kalır, hepsi
    açılır (lib/yardim/kilavuz-arama.ts).
  - Bölümler <details>: başlık ve tek cümlelik özet görünür, adımlar
    açınca. İlki açık gelir. JavaScript yüklenmeden de açılıp kapanır.
  - İçindekiler bağlantısı ya da adres çapası (#bolum) hedef bölümü açar.
  - Telefonda içindekiler katlanır bir kutu.
*/
export type KilavuzBolumGorunumu = {
  id: string;
  baslik: string;
  ozet: string;
  adimlar: string[];
  notlar: string[];
  baglanti: { href: string; etiket: string } | null;
};
export type KilavuzSoruGorunumu = { id: string; soru: string; cevap: string };

const SSS = "sss";

export default function KilavuzGorunumu({ bolumler, sorular }: { bolumler: KilavuzBolumGorunumu[]; sorular: KilavuzSoruGorunumu[] }) {
  const t = useCeviri();
  const [sorgu, setSorgu] = useState("");
  const [acik, setAcik] = useState<Set<string>>(() => new Set(bolumler[0] ? [bolumler[0].id] : []));

  const bolumEslesme = useMemo(
    () => kilavuzAra(bolumler.map((b) => ({ id: b.id, metinler: [b.baslik, b.ozet, ...b.adimlar, ...b.notlar] })), sorgu),
    [bolumler, sorgu],
  );
  const soruEslesme = useMemo(() => kilavuzAra(sorular.map((s) => ({ id: s.id, metinler: [s.soru, s.cevap] })), sorgu), [sorular, sorgu]);
  const aramada = bolumEslesme !== null;
  const gorunenBolumler = aramada ? bolumler.filter((b) => bolumEslesme.includes(b.id)) : bolumler;
  const gorunenSorular = aramada && soruEslesme ? sorular.filter((s) => soruEslesme.includes(s.id)) : sorular;
  const sonucSayisi = gorunenBolumler.length + (aramada ? gorunenSorular.length : 0);

  // Adres çapası (#bolum) ya da içindekiler bağlantısı: hedef bölümü aç.
  useEffect(() => {
    const ac = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && bolumler.some((b) => b.id === id)) setAcik((onceki) => new Set(onceki).add(id));
    };
    ac();
    window.addEventListener("hashchange", ac);
    return () => window.removeEventListener("hashchange", ac);
  }, [bolumler]);

  const degistir = (id: string, durum: boolean) =>
    setAcik((onceki) => {
      if (onceki.has(id) === durum) return onceki;
      const yeni = new Set(onceki);
      if (durum) yeni.add(id);
      else yeni.delete(id);
      return yeni;
    });

  const icindekiler = (
    <ol>
      {bolumler.map((b, i) => (
        <li key={b.id}>
          <a href={`#${b.id}`} onClick={() => degistir(b.id, true)}>
            <span className="kk-sira" aria-hidden="true">{i + 1}</span>
            {b.baslik}
          </a>
        </li>
      ))}
      <li>
        <a href={`#${SSS}`}>
          <span className="kk-sira" aria-hidden="true">?</span>
          {t({ tr: "Sık sorulanlar", en: "Frequently asked questions" })}
        </a>
      </li>
    </ol>
  );

  return (
    <div className="kk">
      <div className="kk-arama" role="search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          className="field-control"
          value={sorgu}
          onChange={(e) => setSorgu(e.target.value)}
          placeholder={t({ tr: "Kılavuzda arayın: şifre, DOI, Word'e aktarma…", en: "Search the guide: password, DOI, export to Word…" })}
          aria-label={t({ tr: "Kılavuzda ara", en: "Search the guide" })}
        />
        {sorgu ? (
          <button type="button" className="kk-arama-temizle" onClick={() => setSorgu("")} aria-label={t({ tr: "Aramayı temizle", en: "Clear search" })}>
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {/* Sonuç sayısı ekran okuyucuya da söylenir; yazdıkça liste değişiyor. */}
      <p className="kk-sonuc" aria-live="polite">
        {aramada
          ? sonucSayisi
            ? t({ tr: `${sonucSayisi} sonuç`, en: `${sonucSayisi} result${sonucSayisi === 1 ? "" : "s"}` })
            : t({ tr: "Sonuç bulunamadı.", en: "No results found." })
          : null}
      </p>

      <div className="kk-izgara">
        <nav className="kk-icindekiler" aria-label={t({ tr: "İçindekiler", en: "Contents" })}>
          <h2>{t({ tr: "İçindekiler", en: "Contents" })}</h2>
          {icindekiler}
        </nav>
        <details className="kk-icindekiler-dar">
          <summary>
            {t({ tr: `İçindekiler · ${bolumler.length} bölüm`, en: `Contents · ${bolumler.length} sections` })}
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <nav aria-label={t({ tr: "İçindekiler", en: "Contents" })}>{icindekiler}</nav>
        </details>

        <div className="kk-icerik">
          {gorunenBolumler.length ? (
            <div className="kk-bolumler">
              {gorunenBolumler.map((b) => {
                const sira = bolumler.findIndex((x) => x.id === b.id) + 1;
                return (
                  <details
                    key={b.id}
                    id={b.id}
                    className="kk-bolum"
                    open={aramada || acik.has(b.id)}
                    onToggle={(e) => {
                      if (!aramada) degistir(b.id, e.currentTarget.open);
                    }}
                  >
                    <summary>
                      <span className="kk-sira" aria-hidden="true">{sira}</span>
                      <span className="kk-bolum-bas">
                        <b>{b.baslik}</b>
                        <small>{b.ozet}</small>
                      </span>
                      <ChevronDown className="kk-ok" size={18} aria-hidden="true" />
                    </summary>
                    <div className="kk-bolum-govde">
                      {b.adimlar.length ? (
                        <ol className="kk-adimlar">
                          {b.adimlar.map((a) => (
                            <li key={a.slice(0, 48)}>{a}</li>
                          ))}
                        </ol>
                      ) : null}
                      {b.notlar.length ? (
                        <ul className="kk-notlar">
                          {b.notlar.map((n) => (
                            <li key={n.slice(0, 48)}>
                              <Info size={15} aria-hidden="true" />
                              <span>{n}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {b.baglanti ? (
                        <Link href={b.baglanti.href} className="projects-filter-button button-compact kk-git">
                          {b.baglanti.etiket} <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : null}

          {gorunenSorular.length ? (
            <section id={SSS} className="kk-sss" aria-labelledby="kilavuz-sss-baslik">
              <h2 id="kilavuz-sss-baslik">{t({ tr: "Sık sorulanlar", en: "Frequently asked questions" })}</h2>
              <div className="kk-sss-liste">
                {gorunenSorular.map((s) => (
                  <details key={s.id} open={aramada || undefined}>
                    <summary>
                      {s.soru}
                      <ChevronDown className="kk-ok" size={16} aria-hidden="true" />
                    </summary>
                    <p>{s.cevap}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          <aside className="kk-destek">
            <span className="destek-kanal-ikon" aria-hidden="true">
              <LifeBuoy size={18} />
            </span>
            <div>
              <h2>{t({ tr: "Cevabını bulamadınız mı?", en: "Didn't find your answer?" })}</h2>
              <p>{t({ tr: "Destek ekibine yazın; yanıtımız Destek sayfanızda görünür.", en: "Write to the support team; our reply appears on your Support page." })}</p>
            </div>
            <Link href="/dashboard/expert-requests" className="projects-filter-button button-compact">
              {t({ tr: "Destek'e yaz", en: "Write to Support" })}
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
