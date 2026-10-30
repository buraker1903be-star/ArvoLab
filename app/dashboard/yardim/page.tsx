import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Info } from "lucide-react";
import { ceviri } from "@/lib/dil-sunucu";
import { getAuthContext } from "@/lib/auth-guards";
import { kilavuzBolumleri, kilavuzSorulari } from "@/lib/yardim/kullanim-kilavuzu";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Kullanım Kılavuzu", en: "User Guide" }) };
}

/*
  KULLANIM KILAVUZU (30.10.2026). İçerik ve role göre süzme
  lib/yardim/kullanim-kilavuzu.ts'te; bu sayfa yalnızca çizer.

  Abonelik kapısı bu sayfayı kapatmaz (lib/abonelik-kapisi.ts): aboneliği
  kapanan kullanıcı ne yapacağını burada okuyabilmeli. Sayfa hiçbir şey
  yazmıyor, dış maliyet de üretmiyor.

  Sunucu bileşeni ve JavaScript'siz: içindekiler düz çapa bağlantıları,
  sık sorulanlar <details>. Kılavuz her cihazda ve yavaş bağlantıda da
  hemen açılmalı.
*/
export default async function KullanimKilavuzu() {
  const t = await ceviri();
  const ctx = await getAuthContext();
  // Oturum yoksa yerleşim zaten girişe yönlendirir; burada rolsüz (öğrenci) içerik yeter.
  const bolumler = kilavuzBolumleri(ctx?.role);
  const sorular = kilavuzSorulari();

  return (
    <main className="dashboard-page gb yardim">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Kullanım Kılavuzu", en: "User Guide" })}</h1>
          <p>
            {t({
              tr: "ArvoLab'a yeni başlıyorsanız buradan başlayın: panelin düzeni, ilk çalışmanızı açmak ve her ekranın ne işe yaradığı adım adım.",
              en: "New to ArvoLab? Start here: the panel layout, creating your first work and what each screen is for, step by step.",
            })}
          </p>
        </div>
      </section>

      <div className="yardim-izgara">
        <nav className="gb-kart yardim-icindekiler" aria-label={t({ tr: "İçindekiler", en: "Contents" })}>
          <h2>
            <BookOpen size={15} aria-hidden="true" /> {t({ tr: "İçindekiler", en: "Contents" })}
          </h2>
          <ol>
            {bolumler.map((b) => (
              <li key={b.id}>
                <a href={`#${b.id}`}>{t(b.baslik)}</a>
              </li>
            ))}
            <li>
              <a href="#sss">{t({ tr: "Sık sorulanlar", en: "Frequently asked questions" })}</a>
            </li>
          </ol>
        </nav>

        <div className="yardim-icerik">
          {bolumler.map((b, sira) => (
            <article key={b.id} id={b.id} className="gb-kart yardim-bolum" aria-labelledby={`${b.id}-baslik`}>
              <header className="gb-kart-bas">
                <div>
                  <h2 id={`${b.id}-baslik`}>
                    <span className="yardim-sira" aria-hidden="true">{sira + 1}</span> {t(b.baslik)}
                  </h2>
                  <p>{t(b.ozet)}</p>
                </div>
              </header>
              {b.adimlar?.length ? (
                <ol className="yardim-adimlar">
                  {b.adimlar.map((a) => (
                    <li key={a.tr.slice(0, 48)}>{t(a)}</li>
                  ))}
                </ol>
              ) : null}
              {b.notlar?.length ? (
                <ul className="yardim-notlar">
                  {b.notlar.map((n) => (
                    <li key={n.tr.slice(0, 48)}>
                      <Info size={14} aria-hidden="true" />
                      <span>{t(n)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {b.baglanti ? (
                <Link href={b.baglanti.href} className="projects-filter-button button-compact yardim-git">
                  {t(b.baglanti.etiket)} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
            </article>
          ))}

          <section id="sss" className="gb-kart yardim-bolum" aria-labelledby="sss-baslik">
            <header className="gb-kart-bas">
              <div>
                <h2 id="sss-baslik">{t({ tr: "Sık sorulanlar", en: "Frequently asked questions" })}</h2>
              </div>
            </header>
            <div className="yardim-sss">
              {sorular.map((s) => (
                <details key={s.soru.tr}>
                  <summary>{t(s.soru)}</summary>
                  <p>{t(s.cevap)}</p>
                </details>
              ))}
            </div>
            <p className="muted text-sm">
              {t({ tr: "Burada cevabını bulamadığınız bir soru için ", en: "For a question not answered here, " })}
              <Link href="/dashboard/expert-requests">{t({ tr: "Destek'e yazın", en: "write to Support" })}</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
