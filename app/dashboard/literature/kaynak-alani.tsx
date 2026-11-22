"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpDown, BookOpen, ChevronRight, ExternalLink, FileText, MoreHorizontal, Paperclip, SlidersHorizontal, Trash2 } from "lucide-react";
import { deleteLiteratureSource, updateLiteratureStatus, type LiteratureSource } from "@/app/actions/literature";
import { eksikAlanlar } from "@/lib/citation-format";
import { htmlVarliklariniCoz } from "@/lib/html-varlik";
import { acilacakPdf, editorPdfAdresi, kaynakDurumlari, pdfEslesmesi, type KaynakPdfi } from "@/lib/kaynak-durumu";
import { yazarBicimiBelirsiz } from "@/lib/kaynak-duzeltme";
import { showToast } from "../_components/toast-events";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL, type Metin } from "@/lib/dil";
import YatayAyirici from "../_components/yatay-ayirici";
import KaynakPaneli, { kaynakBaglantisi } from "./kaynak-paneli";

/*
  KAYNAKLAR — ARAŞTIRMA ALANI (22.11.2026, onaylı mockup).

  Aynı ekranda: solda kaynak listesi, sağda SEÇİLİ kaynağın paneli (PDF,
  künye, notlar). Eskiden liste yalnızca bir listeydi; PDF okumak için
  editöre gidiliyor, künye Literatür penceresinin içinde bir <details>
  altında düzenleniyor, not ise aynı formun en altındaki kutuydu — üç iş,
  üç ayrı yer.

  SEÇİM İSTEMCİDE. Liste ve her kaynağın künyesi/notu zaten sayfayla
  birlikte geldi (getLiteratureSources); kaynak değiştirmek için sunucuya
  gitmek gereksiz bir tur olurdu ve arama/süzgeç/liste konumu kaybolurdu.
  Sunucudan ek olarak YALNIZCA seçilen kaynağın PDF baytları iner, onu da
  görüntüleyicinin kendisi ister (/api/kaynak-pdf/<id>). Listedeki
  PDF'lerin hiçbiri peşinen indirilmez.

  ?kaynak=<id> ile gelen derin bağlantı (atıf kartı, editörün Kaynaklar
  aracı) ilk seçimi belirler; sonrası istemcide kalır.

  Panel kapanınca odak GELDİĞİ satıra döner: klavye kullanıcısı listenin
  başına fırlamaz.
*/

type Durum = "to_review" | "read" | "used";
const ETIKET: Record<Durum, { ad: Metin; ton: string }> = {
  to_review: { ad: { tr: "Okunacak", en: "To read" }, ton: "neutral" },
  read: { ad: { tr: "Okundu", en: "Read" }, ton: "info" },
  used: { ad: { tr: "Metinde", en: "Cited" }, ton: "success" },
};
/* Durumların anlamı DEĞİŞMEDİ: "Metinde" metinde atfı var demek, "Okundu" okundu demek. */
const ILERI: Record<Durum, { durum: Durum; etiket: Metin } | null> = {
  to_review: { durum: "read", etiket: { tr: "Okudum", en: "I've read it" } },
  read: { durum: "used", etiket: { tr: "Metinde kullandım", en: "I cited it" } },
  used: null,
};
const GERI: Record<Durum, Durum | null> = { to_review: null, read: "to_review", used: "read" };

type Suzgec = "hepsi" | Durum | "eksik" | "pdf";
type Sirala = "durum" | "eklenme" | "baslik" | "yil";
const SIRA: Durum[] = ["to_review", "read", "used"];

const SIRALAMA_ADI: Record<Sirala, Metin> = {
  durum: { tr: "Okuma durumu", en: "Reading status" },
  eklenme: { tr: "Son eklenen", en: "Recently added" },
  baslik: { tr: "Başlık (A–Z)", en: "Title (A–Z)" },
  yil: { tr: "Yıl (yeniden eskiye)", en: "Year (newest first)" },
};

/** Liste ve panelin kullanılabilir en az genişlikleri; altına inilmez (panel tam alana geçer). */
export const LISTE_EN_AZ = 360;
export const PANEL_EN_AZ = 420;
const PANEL_VARSAYILAN = 560;

export default function KaynakAlani({
  kaynaklar,
  projectId,
  pdfler,
  ilkSecim,
  bagsizSayisi,
  bagsizAdresi,
  kapsamBagsiz,
}: {
  kaynaklar: LiteratureSource[];
  /** Seçili çalışma; "çalışmaya bağlı olmayanlar" kapsamında null. */
  projectId: string | null;
  pdfler: KaynakPdfi[] | null;
  ilkSecim: string | null;
  bagsizSayisi: number;
  bagsizAdresi: string;
  kapsamBagsiz: boolean;
}) {
  const t = useCeviri();
  const dil = useDil();
  const router = useRouter();
  const [seciliId, setSeciliId] = useState<string | null>(ilkSecim);
  const [sekme, setSekme] = useState<"pdf" | "kunye" | "notlar">("pdf");
  const [arama, setArama] = useState("");
  const [suzgec, setSuzgec] = useState<Suzgec>("hepsi");
  const [sirala, setSirala] = useState<Sirala>("durum");
  const [panelGenislik, setPanelGenislik] = useState(PANEL_VARSAYILAN);
  const [genis, setGenis] = useState(false);
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [, basla] = useTransition();
  const kapRef = useRef<HTMLDivElement>(null);
  /* Ayırıcının üst sınırı kabın genişliğine bağlı; render sırasında ref
     okumak yerine ölçülüp durumda tutuluyor. */
  const [kapGenislik, setKapGenislik] = useState(1200);
  const listeRef = useRef<HTMLDivElement>(null);
  /* Panel kapanınca odağın döneceği satır ve dar ekranda korunacak liste konumu. */
  const sonSatirRef = useRef<HTMLButtonElement | null>(null);
  const listeKonumu = useRef(0);

  /*
    Derin bağlantı (?kaynak=) yalnızca İLK seçimi belirler; sonrası
    istemcide kalır. Adres sonradan başka bir kaydı gösterirse bileşen
    çağıran tarafta `key` ile yeniden kuruluyor (page.tsx) — bu yüzden
    burada `ilkSecim`'i izleyen bir etki yok.
  */
  useEffect(() => {
    const kap = kapRef.current;
    if (!kap || typeof ResizeObserver === "undefined") return;
    const gozcu = new ResizeObserver(([giris]) => setKapGenislik(giris.contentRect.width));
    gozcu.observe(kap);
    return () => gozcu.disconnect();
  }, []);

  const eksikler = useMemo(() => new Map(kaynaklar.map((k) => [k.id, eksikAlanlar(k, dil)])), [kaynaklar, dil]);
  const eslesmeler = useMemo(
    () => new Map(kaynaklar.map((k) => [k.id, pdfler ? pdfEslesmesi(k, pdfler) : null])),
    [kaynaklar, pdfler],
  );

  const sayilar = {
    hepsi: kaynaklar.length,
    to_review: kaynaklar.filter((k) => k.status === "to_review").length,
    read: kaynaklar.filter((k) => k.status === "read").length,
    used: kaynaklar.filter((k) => k.status === "used").length,
    eksik: kaynaklar.filter((k) => (eksikler.get(k.id) ?? []).length).length,
    pdf: kaynaklar.filter((k) => acilacakPdf(eslesmeler.get(k.id) ?? { tur: "yok" })).length,
  };

  const terim = arama.trim().toLocaleLowerCase(YEREL[dil]);
  const gorunen = useMemo(() => {
    const suzulen = kaynaklar.filter((k) => {
      if (suzgec === "eksik" && !(eksikler.get(k.id) ?? []).length) return false;
      if (suzgec === "pdf" && !acilacakPdf(eslesmeler.get(k.id) ?? { tur: "yok" })) return false;
      if (suzgec !== "hepsi" && suzgec !== "eksik" && suzgec !== "pdf" && k.status !== suzgec) return false;
      if (!terim) return true;
      return [k.title, k.authors, k.container_title, k.publisher, k.year, k.doi_or_url].some((x) =>
        x?.toLocaleLowerCase(YEREL[dil]).includes(terim),
      );
    });
    const karsilastir: Record<Sirala, (a: LiteratureSource, b: LiteratureSource) => number> = {
      durum: (a, b) => SIRA.indexOf(a.status as Durum) - SIRA.indexOf(b.status as Durum),
      eklenme: (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      baslik: (a, b) => htmlVarliklariniCoz(a.title).localeCompare(htmlVarliklariniCoz(b.title), YEREL[dil]),
      yil: (a, b) => (b.year ?? "").localeCompare(a.year ?? "", YEREL[dil], { numeric: true }),
    };
    return [...suzulen].sort(karsilastir[sirala]);
  }, [kaynaklar, suzgec, terim, dil, eksikler, eslesmeler, sirala]);

  const secili = seciliId ? kaynaklar.find((k) => k.id === seciliId) ?? null : null;

  /*
    DAR EKRANDA TAM ALAN. Panel açıkken telefonda sayfa başlığı ve sekme
    şeridi gizlenir: yoksa panel ~290 px aşağıdan başlıyor, sayfa uzuyor
    ve panelin alt kenarı (PDF araçları, "Notu kaydet") sabit alt gezinme
    çubuğunun altında kalıyordu. İşaret gövdede, çünkü gizlenecek öğeler
    bu bileşenin KARDEŞLERİ; kuralın kendisi CSS'te ve yalnızca 760 px
    altında geçerli.
  */
  useEffect(() => {
    if (!seciliId) return;
    document.body.dataset.kaynakPanel = "acik";
    return () => {
      delete document.body.dataset.kaynakPanel;
    };
  }, [seciliId]);

  /* Dar ekranda panel listenin yerini alıyor: kapanınca liste konumu geri yüklenir. */
  useEffect(() => {
    if (secili) return;
    const alan = listeRef.current;
    if (alan && listeKonumu.current) alan.scrollTop = listeKonumu.current;
    sonSatirRef.current?.focus();
  }, [secili]);

  const sec = (k: LiteratureSource, dugme: HTMLButtonElement | null, hedefSekme?: "pdf" | "kunye" | "notlar") => {
    listeKonumu.current = listeRef.current?.scrollTop ?? 0;
    sonSatirRef.current = dugme;
    setSeciliId(k.id);
    if (hedefSekme) setSekme(hedefSekme);
  };

  const durumDegistir = (k: LiteratureSource, yeni: Durum) => {
    setBekleyen(k.id);
    basla(async () => {
      const sonuc = await updateLiteratureStatus(k.id, yeni);
      setBekleyen(null);
      if (sonuc.error) return showToast("error", sonuc.error);
      router.refresh();
    });
  };

  const sil = (k: LiteratureSource) => {
    if (!window.confirm(t({ tr: `"${k.title}" kaynağını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`, en: `Delete "${k.title}"? This cannot be undone.` }))) return;
    setBekleyen(k.id);
    basla(async () => {
      const sonuc = await deleteLiteratureSource(k.id);
      setBekleyen(null);
      if (sonuc.error) return showToast("error", sonuc.error);
      if (seciliId === k.id) setSeciliId(null);
      showToast("success", t({ tr: "Kaynak silindi.", en: "Source deleted." }));
      router.refresh();
    });
  };

  const tazele = useCallback(() => router.refresh(), [router]);

  const SUZGECLER: { kod: Suzgec; ad: string }[] = [
    { kod: "hepsi", ad: t({ tr: "Hepsi", en: "All" }) },
    { kod: "to_review", ad: t(ETIKET.to_review.ad) },
    { kod: "read", ad: t(ETIKET.read.ad) },
    { kod: "used", ad: t(ETIKET.used.ad) },
    { kod: "pdf", ad: t({ tr: "PDF'i olanlar", en: "With a PDF" }) },
    { kod: "eksik", ad: t({ tr: "Eksik künye", en: "Incomplete reference" }) },
  ];
  const suzgecAdi = SUZGECLER.find((s) => s.kod === suzgec)?.ad ?? "";

  return (
    <div
      className="kaynak-alani"
      ref={kapRef}
      data-panel={secili ? "acik" : "kapali"}
      data-genis={secili && genis ? "true" : undefined}
      style={{ ["--kaynak-panel-genislik" as string]: `${panelGenislik}px` }}
    >
      <section className="kaynak-sutun" aria-label={t({ tr: "Kaynak listesi", en: "Source list" })}>
        {/* Arama, süzgeç ve sıralama TEK araç satırında (mockup). */}
        <div className="kaynak-arac-satiri">
          <label className="kaynak-arama">
            <input
              type="search"
              placeholder={t({ tr: "Kaynaklarda ara", en: "Search sources" })}
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              aria-label={t({ tr: "Kaynaklarda ara (başlık, yazar, dergi, DOI)", en: "Search sources (title, author, journal, DOI)" })}
            />
          </label>
          <details className="kaynak-arac-menu">
            <summary className="yazim-ikon" aria-label={t({ tr: `Süz: ${suzgecAdi}`, en: `Filter: ${suzgecAdi}` })} title={t({ tr: `Süz: ${suzgecAdi}`, en: `Filter: ${suzgecAdi}` })}>
              <SlidersHorizontal size={16} aria-hidden="true" />
              {suzgec !== "hepsi" ? <i className="kaynak-arac-nokta" aria-hidden="true" /> : null}
            </summary>
            <div className="kaynak-arac-liste" role="group" aria-label={t({ tr: "Duruma göre süz", en: "Filter by status" })}>
              {SUZGECLER.filter((s) => s.kod !== "eksik" || sayilar.eksik).map((s) => (
                <button key={s.kod} type="button" aria-pressed={suzgec === s.kod} onClick={() => setSuzgec(s.kod)}>
                  {s.ad} <small>{sayilar[s.kod as keyof typeof sayilar]}</small>
                </button>
              ))}
            </div>
          </details>
          <details className="kaynak-arac-menu">
            <summary className="yazim-ikon" aria-label={t({ tr: `Sırala: ${t(SIRALAMA_ADI[sirala])}`, en: `Sort: ${t(SIRALAMA_ADI[sirala])}` })} title={t({ tr: `Sırala: ${t(SIRALAMA_ADI[sirala])}`, en: `Sort: ${t(SIRALAMA_ADI[sirala])}` })}>
              <ArrowUpDown size={16} aria-hidden="true" />
            </summary>
            <div className="kaynak-arac-liste" role="group" aria-label={t({ tr: "Sıralama", en: "Sort" })}>
              {(Object.keys(SIRALAMA_ADI) as Sirala[]).map((kod) => (
                <button key={kod} type="button" aria-pressed={sirala === kod} onClick={() => setSirala(kod)}>
                  {t(SIRALAMA_ADI[kod])}
                </button>
              ))}
            </div>
          </details>
        </div>

        <p className="kaynak-sayim" role="status">
          {terim || suzgec !== "hepsi"
            ? t({ tr: `${gorunen.length} / ${kaynaklar.length} kaynak`, en: `${gorunen.length} of ${kaynaklar.length} sources` })
            : t({ tr: `${kaynaklar.length} kaynak`, en: `${kaynaklar.length} ${kaynaklar.length === 1 ? "source" : "sources"}` })}
        </p>

        <div className="kaynak-liste-kap" ref={listeRef}>
          {gorunen.length ? (
            <ul className="kaynak-liste">
              {gorunen.map((k) => {
                const durum = (k.status in ETIKET ? k.status : "to_review") as Durum;
                const ileri = ILERI[durum];
                const geri = GERI[durum];
                const eksik = eksikler.get(k.id) ?? [];
                const eslesme = eslesmeler.get(k.id) ?? null;
                const pdf = eslesme ? acilacakPdf(eslesme) : null;
                const pdfDurumu = eslesme ? kaynakDurumlari({ kunye: null, pdf: eslesme })[1] : null;
                const adres = kaynakBaglantisi(k.doi_or_url);
                const secildi = seciliId === k.id;
                const baslik = htmlVarliklariniCoz(k.title);
                return (
                  <li key={k.id} id={`kaynak-${k.id}`} className="kaynak-satiri" data-secili={secildi ? "true" : undefined} aria-current={secildi ? "true" : undefined}>
                    {/*
                      Satırın tamamı bir düğme: seçim panelde açılır. Bağlantı
                      değil, çünkü sayfa değişmiyor; ekran okuyucu da "düğme"
                      diye okumalı.
                    */}
                    <button
                      type="button"
                      className="kaynak-satir-sec"
                      aria-pressed={secildi}
                      onClick={(e) => sec(k, e.currentTarget)}
                    >
                      <span className="kaynak-satir-simge" aria-hidden="true">
                        <FileText size={17} />
                      </span>
                      <span className="kaynak-satir-govde">
                        {/* Uzun başlık en çok iki satır; tamamı title ile okunur. */}
                        <b title={baslik}>{baslik}</b>
                        <small>
                          {[htmlVarliklariniCoz(k.authors) || t({ tr: "Yazar belirtilmedi", en: "No author given" }), k.year].filter(Boolean).join(" · ")}
                        </small>
                        {k.container_title ? <small className="kaynak-satir-dergi">{htmlVarliklariniCoz(k.container_title)}</small> : null}
                        <span className="kaynak-satir-rozetler">
                          {pdfDurumu ? (
                            <span className="kaynak-rozet" data-ton={pdfDurumu.ton} title={t(pdfDurumu.aciklama)}>
                              <Paperclip size={12} aria-hidden="true" /> {t(pdfDurumu.kisa)}
                            </span>
                          ) : null}
                          <span className="status-pill" data-tone={ETIKET[durum].ton}>
                            {t(ETIKET[durum].ad)}
                          </span>
                        </span>
                      </span>
                    </button>

                    {/* Eksik künye uyarısı: küçük, satır içi; düzeltme akışı aynı panelde. */}
                    {eksik.length || yazarBicimiBelirsiz(k.authors) ? (
                      <p className="kaynak-satir-uyari">
                        {eksik.length
                          ? t({ tr: `Künye eksik: ${eksik.join(", ")}`, en: `Reference incomplete: ${eksik.join(", ")}` })
                          : t({ tr: "Yazar biçimi belirsiz", en: "Author format is ambiguous" })}
                        {" · "}
                        <button type="button" className="link-button" onClick={(e) => sec(k, e.currentTarget.closest("li")?.querySelector(".kaynak-satir-sec") ?? null, "kunye")}>
                          {t({ tr: "Tamamla", en: "Complete" })} <ChevronRight size={12} aria-hidden="true" />
                        </button>
                      </p>
                    ) : null}

                    {/* Diğer işlemler satırın ⋯ menüsünde (mockup). */}
                    <details className="kart-menu kaynak-satir-menu">
                      <summary aria-label={t({ tr: `${baslik}: diğer işlemler`, en: `${baslik}: more actions` })}>
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </summary>
                      <div className="kart-menu-liste">
                        {ileri ? (
                          <button type="button" disabled={bekleyen === k.id} onClick={() => durumDegistir(k, ileri.durum)}>
                            {t(ileri.etiket)}
                          </button>
                        ) : null}
                        {geri ? (
                          <button type="button" disabled={bekleyen === k.id} onClick={() => durumDegistir(k, geri)}>
                            {t({ tr: `“${t(ETIKET[geri].ad)}” durumuna geri al`, en: `Move back to “${t(ETIKET[geri].ad)}”` })}
                          </button>
                        ) : null}
                        {pdf && projectId ? (
                          <Link href={editorPdfAdresi(projectId, pdf.id)}>
                            <BookOpen size={15} aria-hidden="true" /> {t({ tr: "Editörde aç", en: "Open in the editor" })}
                          </Link>
                        ) : null}
                        {adres ? (
                          <a href={adres} target="_blank" rel="noreferrer noopener">
                            <ExternalLink size={15} aria-hidden="true" /> {t({ tr: "Yayını aç", en: "Open publication" })}
                          </a>
                        ) : null}
                        <hr className="kart-menu-ayirici" />
                        <button type="button" className="button-danger" disabled={bekleyen === k.id} onClick={() => sil(k)}>
                          <Trash2 size={15} aria-hidden="true" /> {t({ tr: "Kaynağı sil", en: "Delete source" })}
                        </button>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="kaynak-liste-bos">
              {terim || suzgec !== "hepsi"
                ? t({ tr: "Bu aramaya ya da süzgece uyan kaynak yok.", en: "No sources match this search or filter." })
                : kapsamBagsiz
                  ? t({ tr: "Bir çalışmaya bağlı olmayan kaynağınız yok.", en: "You have no sources outside a work." })
                  : t({ tr: "Bu çalışmaya bağlı kaynak yok.", en: "No sources linked to this work." })}
            </p>
          )}
        </div>

        {/* Çalışmaya bağlı olmayan kaynaklara görünür erişim. */}
        {kapsamBagsiz || bagsizSayisi ? (
          <Link href={bagsizAdresi} className="kaynak-liste-alt" scroll={false}>
            {kapsamBagsiz
              ? t({ tr: "Çalışmanın kaynaklarına dön", en: "Back to the work's sources" })
              : t({ tr: `Çalışmaya bağlı olmayanlar · ${bagsizSayisi}`, en: `Not linked to a work · ${bagsizSayisi}` })}
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      {secili && !genis ? (
        <YatayAyirici
          genislik={panelGenislik}
          enAz={PANEL_EN_AZ}
          enCok={Math.max(PANEL_EN_AZ, kapGenislik - LISTE_EN_AZ)}
          onDegis={(g) => setPanelGenislik(g)}
          yerlesim={() => kapRef.current}
          etiket={t({ tr: "Liste ile kaynak paneli arasındaki genişliği ayarla", en: "Resize between the list and the source panel" })}
          className="kaynak-ayirici"
        />
      ) : null}

      {secili ? (
        <aside className="kaynak-paneli" aria-label={t({ tr: "Seçili kaynak", en: "Selected source" })}>
          {/* Dar ekranda panel listenin yerini alır; dönüş belirgin. */}
          <button type="button" className="kaynak-panel-geri" onClick={() => setSeciliId(null)}>
            <ArrowLeft size={15} aria-hidden="true" /> {t({ tr: "Kaynaklara dön", en: "Back to sources" })}
          </button>
          {/*
            key={secili.id}: kaynak değişince PDF, künye ve not sıfırdan
            kurulur. Anahtarsız bırakılsa görüntüleyici yeni baytları
            indirene kadar ÖNCEKİ kaynağın sayfası yeni başlığın altında
            durur ve öğrenci yanlış makaleye bakar.
          */}
          <KaynakPaneli
            key={secili.id}
            kaynak={secili}
            projectId={projectId}
            eslesme={eslesmeler.get(secili.id) ?? null}
            sekme={sekme}
            onSekme={setSekme}
            onKapat={() => setSeciliId(null)}
            genis={genis}
            onGenis={setGenis}
            onDegisti={tazele}
          />
        </aside>
      ) : null}
    </div>
  );
}
