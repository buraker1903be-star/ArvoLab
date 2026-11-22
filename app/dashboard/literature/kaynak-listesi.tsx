"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import { updateLiteratureStatus, type LiteratureSource } from "@/app/actions/literature";
import { eksikAlanlar } from "@/lib/citation-format";
import { htmlVarliklariniCoz } from "@/lib/html-varlik";
import { showToast } from "../_components/toast-events";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL, type Metin } from "@/lib/dil";
import { acilacakPdf, editorPdfAdresi, kaynakDurumlari, pdfEslesmesi, type KaynakPdfi } from "@/lib/kaynak-durumu";
import { yazarBicimiBelirsiz } from "@/lib/kaynak-duzeltme";
import KaynakDuzeltme from "./kaynak-duzeltme";

/*
  KAYNAKLAR SAYFASINDAKİ LİSTE — İŞLENEBİLİR (27.10.2026, kurum sahibinin
  isteği). Eskiden liste yalnızca gösteriyordu: "Okudum" demek için
  öğrenci Kaynak bul penceresini açıp kaynağı orada arıyordu. Şimdi
  sayfada:
  - arama (başlık, yazar, dergi) ve durum süzgeci, sayılarıyla;
  - satırda TEK düğme: sıradaki adım ("Okudum", "Metinde kullandım"),
    geri almak ikincil (Literatür penceresiyle aynı kural);
  - DOI/adres bağlantısı;
  - EKSİK KÜNYE uyarısı: kaynakçaya girecek bilgisi eksik kaynaklar
    işaretli ve süzülebilir (lib/citation-format eksikAlanlar). Eksiği
    sistem uydurmaz; düzenleme Kaynak bul penceresinde.

  20.11.2026 (M5/M9):
  - Doğrudan kayıt: ?kaynak=<id> ile gelen satır görünür alana kaydırılır,
    vurgulanır ve odak alır (atıf kartındaki "Kaynak kaydı" ve editörün
    Kaynaklar aracı buraya gelir; eskiden öğrenci listede arıyordu).
  - PDF: satır PDF durumunu ortak kuraldan (lib/kaynak-durumu) gösterir ve
    "PDF'i oku" editörün PDF çekmecesini açar. Sayfada PDF açan başka bir
    yol yoktu; Kaynakça penceresindeki "PDF'i aç" de yeni sekme yerine
    aynı çekmeceye gidiyor.
*/
type Durum = "to_review" | "read" | "used";
const ETIKET: Record<Durum, { ad: Metin; ton: string }> = {
  to_review: { ad: { tr: "Okunacak", en: "To read" }, ton: "neutral" },
  read: { ad: { tr: "Okundu", en: "Read" }, ton: "info" },
  used: { ad: { tr: "Metinde", en: "Cited" }, ton: "success" },
};
const ILERI: Record<Durum, { durum: Durum; etiket: Metin } | null> = {
  to_review: { durum: "read", etiket: { tr: "Okudum", en: "I've read it" } },
  read: { durum: "used", etiket: { tr: "Metinde kullandım", en: "I cited it" } },
  used: null,
};
const GERI: Record<Durum, Durum | null> = { to_review: null, read: "to_review", used: "read" };
type Suzgec = "hepsi" | Durum | "eksik";

const baglanti = (deger: string | null) => {
  const temiz = deger?.trim();
  if (!temiz) return null;
  const doi = temiz.match(/10\.\d{4,9}\/\S+/);
  if (doi && !/^https?:/i.test(temiz)) return `https://doi.org/${doi[0]}`;
  return /^https?:\/\//i.test(temiz) ? temiz : null;
};

export default function KaynakListesi({
  kaynaklar,
  projectId,
  pdfler = null,
  odak = null,
}: {
  kaynaklar: LiteratureSource[];
  projectId: string;
  pdfler?: KaynakPdfi[] | null;
  odak?: string | null;
}) {
  const router = useRouter();
  const t = useCeviri();
  const dil = useDil();
  const [arama, setArama] = useState("");
  const [suzgec, setSuzgec] = useState<Suzgec>("hepsi");
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [, basla] = useTransition();
  const odakRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!odak || !odakRef.current) return;
    odakRef.current.scrollIntoView({ block: "center" });
    odakRef.current.focus({ preventScroll: true });
  }, [odak]);

  /* Eksik alan adları arayüzde gösteriliyor: burada `dil` arayüzün dili (lib/citation-format). */
  const eksikler = useMemo(() => new Map(kaynaklar.map((k) => [k.id, eksikAlanlar(k, dil)])), [kaynaklar, dil]);
  const sayilar = {
    hepsi: kaynaklar.length,
    to_review: kaynaklar.filter((k) => k.status === "to_review").length,
    read: kaynaklar.filter((k) => k.status === "read").length,
    used: kaynaklar.filter((k) => k.status === "used").length,
    eksik: kaynaklar.filter((k) => (eksikler.get(k.id) ?? []).length).length,
  };
  const terim = arama.trim().toLocaleLowerCase(YEREL[dil]);
  const gorunen = kaynaklar.filter((k) => {
    if (suzgec === "eksik" ? !(eksikler.get(k.id) ?? []).length : suzgec !== "hepsi" && k.status !== suzgec) return false;
    if (!terim) return true;
    return [k.title, k.authors, k.container_title, k.publisher, k.year, k.doi_or_url].some((x) => x?.toLocaleLowerCase(YEREL[dil]).includes(terim));
  });

  const durumDegistir = (k: LiteratureSource, yeni: Durum) => {
    setBekleyen(k.id);
    basla(async () => {
      const sonuc = await updateLiteratureStatus(k.id, yeni);
      setBekleyen(null);
      if (sonuc.error) return showToast("error", sonuc.error);
      router.refresh();
    });
  };

  const SUZGECLER: { kod: Suzgec; ad: string }[] = [
    { kod: "hepsi", ad: t({ tr: "Hepsi", en: "All" }) },
    { kod: "to_review", ad: t(ETIKET.to_review.ad) },
    { kod: "read", ad: t(ETIKET.read.ad) },
    { kod: "used", ad: t(ETIKET.used.ad) },
    { kod: "eksik", ad: t({ tr: "Eksik künye", en: "Incomplete reference" }) },
  ];

  return (
    <>
      <div className="kaynak-suzgec">
        <label className="kaynak-arama">
          <Search size={14} aria-hidden="true" />
          {/*
            Yer tutucu kısa (18.11.2026): "Search by title, author, journal, publisher or DOI"
            390 px'te, Türkçesi de 320 px'te (iPhone SE) kesiliyordu. Arama yayınevi ve
            yılda da eşleşir (yukarıda); yer tutucu yalnızca örnek. "Ara" anlamını kutunun
            adı (aria-label) ve büyüteç taşıyor.
          */}
          <input type="search" placeholder={t({ tr: "Başlık, yazar, dergi ya da DOI", en: "Title, author, journal or DOI" })} value={arama} onChange={(e) => setArama(e.target.value)} aria-label={t({ tr: "Kaynaklarda ara", en: "Search sources" })} />
        </label>
        <div className="cluster" role="group" aria-label={t({ tr: "Duruma göre süz", en: "Filter by status" })}>
          {SUZGECLER.filter((s) => s.kod !== "eksik" || sayilar.eksik).map((s) => (
            <button
              key={s.kod}
              type="button"
              className="projects-filter-button button-compact"
              aria-pressed={suzgec === s.kod}
              onClick={() => setSuzgec(s.kod)}
            >
              {s.ad} <small>{sayilar[s.kod]}</small>
            </button>
          ))}
        </div>
      </div>
      {gorunen.length ? (
        <ul className="gb-liste">
          {gorunen.map((k) => {
            const durum = (k.status in ETIKET ? k.status : "to_review") as Durum;
            const ileri = ILERI[durum];
            const geri = GERI[durum];
            const eksik = eksikler.get(k.id) ?? [];
            const adres = baglanti(k.doi_or_url);
            const eslesme = pdfler ? pdfEslesmesi(k, pdfler) : null;
            const pdf = eslesme ? acilacakPdf(eslesme) : null;
            const pdfDurumu = eslesme ? kaynakDurumlari({ kunye: null, pdf: eslesme })[1] : null;
            const odakta = odak === k.id;
            return (
              <li
                key={k.id}
                id={`kaynak-${k.id}`}
                ref={odakta ? odakRef : undefined}
                tabIndex={odakta ? -1 : undefined}
                data-odak={odakta ? "true" : undefined}
                className="gb-satir kaynak-satiri"
              >
                <span className="gb-satir-govde">
                  <b>{htmlVarliklariniCoz(k.title)}</b>
                  <small>
                    {/* Eski kayıtlarda "&amp;" kalmış olabilir; ekranda çözülür (lib/html-varlik.ts). */}
                    {[htmlVarliklariniCoz(k.authors) || t({ tr: "Yazar belirtilmedi", en: "No author given" }), k.year, htmlVarliklariniCoz(k.container_title)].filter(Boolean).join(" · ")}
                    {adres ? (
                      <>
                        {" · "}
                        <a href={adres} target="_blank" rel="noreferrer noopener">
                          {/10\.\d{4,9}\//.test(k.doi_or_url ?? "") ? "DOI" : t({ tr: "Bağlantı", en: "Link" })} <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </>
                    ) : null}
                  </small>
                  {pdfDurumu ? (
                    <small className="kaynak-pdf-durumu" data-ton={pdfDurumu.ton} title={t(pdfDurumu.aciklama)}>
                      {t(pdfDurumu.kisa)}
                    </small>
                  ) : null}
                  {eksik.length ? <small className="kaynak-eksik">{t({ tr: "Kaynakça için eksik:", en: "Missing for the reference list:" })} {eksik.join(", ")}</small> : null}
                  {yazarBicimiBelirsiz(k.authors) ? (
                    <small className="kaynak-eksik">{t({ tr: "Yazar biçimi belirsiz (ad önce ya da “and/et al.” ile yazılmış).", en: "Author format is ambiguous (given name first, or “and/et al.”)." })}</small>
                  ) : null}
                  {/10\.\d{4,9}\//.test(k.doi_or_url ?? "") && (eksik.length || yazarBicimiBelirsiz(k.authors)) ? <KaynakDuzeltme kaynakId={k.id} baslik={k.title} /> : null}
                </span>
                <span className="kaynak-satiri-eylem">
                  <span className="status-pill" data-tone={ETIKET[durum].ton}>
                    {t(ETIKET[durum].ad)}
                  </span>
                  {pdf ? (
                    <Link href={editorPdfAdresi(projectId, pdf.id)} className="projects-filter-button button-compact" aria-label={t({ tr: `${k.title}: PDF'i oku`, en: `${k.title}: read PDF` })}>
                      <BookOpen size={14} aria-hidden="true" /> {t({ tr: "PDF'i oku", en: "Read PDF" })}
                    </Link>
                  ) : null}
                  {ileri ? (
                    <button type="button" className="projects-filter-button button-compact" disabled={bekleyen === k.id} onClick={() => durumDegistir(k, ileri.durum)}>
                      {t(ileri.etiket)}
                    </button>
                  ) : null}
                  {geri ? (
                    <button
                      type="button"
                      className="projects-filter-button button-compact"
                      disabled={bekleyen === k.id}
                      aria-label={t({ tr: `${k.title}: ${ETIKET[geri].ad.tr} durumuna geri al`, en: `${k.title}: move back to “${ETIKET[geri].ad.en}”` })}
                      title={t({ tr: `${ETIKET[geri].ad.tr} durumuna geri al`, en: `Move back to “${ETIKET[geri].ad.en}”` })}
                      onClick={() => durumDegistir(k, geri)}
                    >
                      ↶
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="gb-bos">{terim || suzgec !== "hepsi" ? t({ tr: "Bu aramaya ya da süzgece uyan kaynak yok.", en: "No sources match this search or filter." }) : t({ tr: "Bu çalışmaya bağlı kaynak yok.", en: "No sources linked to this work." })}</p>
      )}
    </>
  );
}
