"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, ExternalLink, FileText, Library, Plus, Quote, Search } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { useOturumDurumu } from "@/app/_components/oturum-durumu";
import { getLiteratureSources, type LiteratureSource } from "@/app/actions/literature";
import { goruntuleyiciKaynaklari } from "@/app/actions/kaynak-pdf";
import LiteraturBulucu from "@/app/dashboard/literature/literatur-bulucu";
import type { OutlineHeading, SectionStatus } from "./editor-navigation";

/*
  SOL ARAŞTIRMA ALANI (19.11.2026, bağlamlı çalışma alanı; onaylı 2. tur
  tasarımı). Çalışma gezinmesinden açılan araçlar aynı sol yuvada, göreve
  göre genişleyerek durur (os-gezinme.tsx #sol-alan-yuva; genişlik
  lib/calisma-alani-yerlesimi.ts):
    - Bölümler: belgenin başlıkları; tıklayınca o başlığa gidilir. Kılavuzun
      zorunlu bölümlerinden eksik olanlar da burada.
    - Kaynaklar: bu çalışmanın kaynakları; atıf ekle, PDF'i aç.
    - Makale bul: OpenAlex + Crossref araması (literatur-bulucu.tsx, aynı
      bileşen; yeni bir arama yolu yazılmadı).
  Eskiden bölüm listesi kapalı başlayan 340 px'lik inceleme panelinin içinde,
  kaynaklar ve makale arama ise ayrı sayfalardaydı: yazarken kaynağa bakmak
  editörden çıkmak demekti.

  Durum korunur: araçlar bir kez açıldıktan sonra söküLMEZ (yalnızca gizlenir),
  sorgu, süzgeç, sonuçlar ve liste konumu da sekme oturumunda saklanır
  (oturum-durumu.ts). Araç değiştirmek ya da başka bir çalışma sayfasına
  gidip dönmek aramayı sıfırlamaz.
*/

/** Liste kaydırma konumu: aracın kendi kabı kayar; konum oturumda saklanır. */
function useKaydirmaKonumu(anahtar: string, gorunur: boolean) {
  const kapRef = useRef<HTMLDivElement>(null);
  const [konum, setKonum, yuklendi] = useOturumDurumu<number>(anahtar, 0);
  useEffect(() => {
    if (!gorunur || !yuklendi) return;
    const kap = kapRef.current;
    if (kap && konum) kap.scrollTop = konum;
    // Yalnızca görünür olunca ve depo okununca bir kez: kaydırma sırasında geri yazılmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gorunur, yuklendi]);
  const kaydir = () => {
    const kap = kapRef.current;
    if (kap) setKonum(Math.round(kap.scrollTop));
  };
  return { kapRef, kaydir };
}

export function SolBolumler({
  projectId,
  gorunur,
  basliklar,
  bolumler,
  onJump,
  onInsert,
}: {
  projectId: string;
  gorunur: boolean;
  basliklar: OutlineHeading[];
  bolumler: SectionStatus[];
  onJump: (baslik: OutlineHeading) => void;
  onInsert: (bolumler: string[]) => void;
}) {
  const t = useCeviri();
  const { kapRef, kaydir } = useKaydirmaKonumu(`arvolab.sol.${projectId}.bolumler.konum`, gorunur);
  const eksik = bolumler.filter((b) => !b.heading).map((b) => b.section);
  return (
    <div className="sol-arac-govde" ref={kapRef} onScroll={kaydir}>
      {basliklar.length === 0 ? (
        <p className="sol-arac-bos">
          {t({
            tr: "Belgede henüz başlık yok. Araç çubuğundaki H1/H2/H3 ile başlık ekleyin; burada listelenir.",
            en: "The document has no headings yet. Add headings with H1/H2/H3 on the toolbar; they are listed here.",
          })}
        </p>
      ) : (
        <ol className="sol-bolum-listesi">
          {basliklar.map((b) => (
            <li key={b.pos} data-duzey={b.level}>
              <button type="button" onClick={() => onJump(b)} title={b.text}>
                {b.text || t({ tr: "(boş başlık)", en: "(empty heading)" })}
              </button>
            </li>
          ))}
        </ol>
      )}
      {bolumler.length > 0 ? (
        <section className="sol-arac-bolum" aria-label={t({ tr: "Kılavuzun zorunlu bölümleri", en: "Guideline's required sections" })}>
          <h3>{t({ tr: "Kılavuzun zorunlu bölümleri", en: "Required by the guideline" })}</h3>
          <ul className="sol-zorunlu">
            {bolumler.map((b) => (
              <li key={b.section} data-tamam={b.heading ? "" : undefined}>
                {b.heading ? <CheckCircle2 size={14} aria-hidden="true" /> : <CircleDashed size={14} aria-hidden="true" />}
                <span>{b.section}</span>
                <span className="sr-only">{b.heading ? t({ tr: "var", en: "present" }) : t({ tr: "eksik", en: "missing" })}</span>
              </li>
            ))}
          </ul>
          {eksik.length ? (
            <button type="button" className="projects-filter-button button-compact" onClick={() => onInsert(eksik)}>
              <Plus size={14} aria-hidden="true" />
              {t({ tr: `Eksik ${eksik.length} bölümü ekle`, en: `Add ${eksik.length} missing sections` })}
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/*
  Kaynak satırının PDF'i: bu turda (3/5) yalnızca DOI eşleşmesi kesin
  sayılır. Kaynak kaydı ile PDF arasındaki açık bağ (kaynak_pdfleri.kaynak_id)
  4/5'te geliyor; o gelince bağlı PDF önce gelir.
*/
export type KaynakPdfi = { id: string; doi: string | null; kaynakId?: string | null };

const doiAnahtari = (deger: string | null | undefined) =>
  (deger ?? "")
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .trim();

export function kaynaginPdfi(kaynak: Pick<LiteratureSource, "id" | "doi_or_url">, pdfler: KaynakPdfi[]): KaynakPdfi | null {
  const bagli = pdfler.find((p) => p.kaynakId === kaynak.id);
  if (bagli) return bagli;
  const doi = doiAnahtari(kaynak.doi_or_url);
  if (!doi.startsWith("10.")) return null;
  const adaylar = pdfler.filter((p) => !p.kaynakId && doiAnahtari(p.doi) === doi);
  // Aynı DOI'li iki PDF varsa hangisi olduğu belli değil: kesin sayılmaz.
  return adaylar.length === 1 ? adaylar[0] : null;
}

export function SolKaynaklar({
  projectId,
  gorunur,
  onCite,
  onPdfAc,
}: {
  projectId: string;
  gorunur: boolean;
  onCite: (kaynak: LiteratureSource) => void;
  onPdfAc: (pdfId: string) => void;
}) {
  const t = useCeviri();
  const [kaynaklar, setKaynaklar] = useState<LiteratureSource[] | null>(null);
  const [pdfler, setPdfler] = useState<KaynakPdfi[] | null>(null);
  const [hata, setHata] = useState(false);
  const [suzgec, setSuzgec] = useOturumDurumu<string>(`arvolab.sol.${projectId}.kaynaklar.suzgec`, "");
  const { kapRef, kaydir } = useKaydirmaKonumu(`arvolab.sol.${projectId}.kaynaklar.konum`, gorunur && kaynaklar !== null);

  useEffect(() => {
    if (!gorunur || kaynaklar) return;
    let iptal = false;
    void Promise.all([getLiteratureSources(), goruntuleyiciKaynaklari(projectId)]).then(([sonuc, pdfSonuc]) => {
      if (iptal) return;
      /* PDF listesi okunamazsa kaynaklar yine gösterilir; "PDF açılabilir" yalnızca okunabildiyse yazılır. */
      setPdfler("hata" in pdfSonuc ? [] : pdfSonuc.satirlar.map((p) => ({ id: p.id, doi: p.doi, kaynakId: p.kaynak_id ?? null })));
      if (sonuc.okunamadi) setHata(true);
      else setKaynaklar(sonuc.satirlar.filter((k) => k.project_id === projectId));
    });
    return () => {
      iptal = true;
    };
  }, [gorunur, kaynaklar, projectId]);

  const gorunenler = useMemo(() => {
    const q = suzgec.trim().toLocaleLowerCase("tr");
    if (!kaynaklar || !q) return kaynaklar ?? [];
    return kaynaklar.filter((k) => `${k.title} ${k.authors ?? ""} ${k.year ?? ""}`.toLocaleLowerCase("tr").includes(q));
  }, [kaynaklar, suzgec]);

  return (
    <>
      <div className="sol-arac-ust">
        <label className="sol-arama">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{t({ tr: "Kaynaklarda ara", en: "Search sources" })}</span>
          <input type="search" value={suzgec} onChange={(e) => setSuzgec(e.target.value.slice(0, 200))} placeholder={t({ tr: "Yazar, başlık ya da yıl", en: "Author, title or year" })} />
        </label>
      </div>
      <div className="sol-arac-govde" ref={kapRef} onScroll={kaydir}>
        {hata ? (
          <p className="sol-arac-bos" role="alert">
            {t({ tr: "Kaynaklarınız okunamadı; sayfayı yenileyin. Kayıtlarınız yerinde.", en: "Your sources couldn't be read; refresh the page. Your records are safe." })}
          </p>
        ) : kaynaklar === null ? (
          <p className="sol-arac-bos" role="status">{t({ tr: "Kaynaklar yükleniyor…", en: "Loading sources…" })}</p>
        ) : kaynaklar.length === 0 ? (
          <p className="sol-arac-bos">
            {t({
              tr: "Bu çalışmaya bağlı kaynak yok. \"Makale bul\" ile dizinlerde arayıp ekleyin ya da kütüphaneden bağlayın.",
              en: "No sources are linked to this work. Search the indexes with \"Find papers\" and add them, or link them from the library.",
            })}
          </p>
        ) : gorunenler.length === 0 ? (
          <p className="sol-arac-bos">{t({ tr: "Aramanıza uyan kaynak yok.", en: "No sources match your search." })}</p>
        ) : (
          <ul className="sol-kaynak-listesi">
            {gorunenler.map((k) => {
              const pdf = pdfler ? kaynaginPdfi(k, pdfler) : null;
              return (
                <li key={k.id} className="sol-kaynak">
                  <p className="sol-kaynak-kunye">
                    <b>{[k.authors, k.year ? `(${k.year})` : null].filter(Boolean).join(" ") || t({ tr: "Yazar yok", en: "No author" })}</b>
                    <span>{k.title}</span>
                  </p>
                  <div className="sol-kaynak-durum">
                    {pdf ? (
                      <span className="guven-cip" data-tur="erisim">
                        <FileText size={12} aria-hidden="true" /> {t({ tr: "PDF açılabilir", en: "PDF available" })}
                      </span>
                    ) : (
                      <span className="guven-cip" data-tur="notr">{t({ tr: "PDF yok", en: "No PDF" })}</span>
                    )}
                  </div>
                  <div className="sol-kaynak-eylem">
                    <button type="button" className="projects-filter-button button-compact" onClick={() => onCite(k)}>
                      <Quote size={14} aria-hidden="true" /> {t({ tr: "Atıf ekle", en: "Cite" })}
                    </button>
                    {pdf ? (
                      <button type="button" className="projects-filter-button button-compact" onClick={() => onPdfAc(pdf.id)}>
                        <FileText size={14} aria-hidden="true" /> {t({ tr: "PDF'i aç", en: "Open PDF" })}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="sol-arac-alt">
        <Link href={`/dashboard/literature?calisma=${encodeURIComponent(projectId)}`} className="link-button">
          <Library size={14} aria-hidden="true" /> {t({ tr: "Kütüphanede aç", en: "Open in library" })} <ExternalLink size={12} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

export function SolArama({ projectId, projeAdi, gorunur }: { projectId: string; projeAdi: string; gorunur: boolean }) {
  const [sorgu, setSorgu] = useOturumDurumu<string>(`arvolab.sol.${projectId}.arama.sorgu`, "");
  const { kapRef, kaydir } = useKaydirmaKonumu(`arvolab.sol.${projectId}.arama.konum`, gorunur);
  return (
    <div className="sol-arac-govde sol-arama-govde" ref={kapRef} onScroll={kaydir}>
      <LiteraturBulucu
        projeler={[{ id: projectId, title: projeAdi }]}
        secilenCalisma={projectId}
        sorgu={sorgu}
        onSorguDegis={setSorgu}
        gomulu
        durumAnahtari={`arvolab.sol.${projectId}.arama`}
      />
    </div>
  );
}
