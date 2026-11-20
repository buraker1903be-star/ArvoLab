"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { BookOpenCheck, Check, ExternalLink, FileText, Plus, Search, SlidersHorizontal, Undo2, Unlock, X } from "lucide-react";
import { aramaKaydiniEkle, literaturAramasiYap, okumayaAl, type AramaYaniti } from "@/app/actions/literatur-arama";
import { deleteLiteratureSource } from "@/app/actions/literature";
import { kaynakPdfleriniBul, pdfKaynaginiBagla } from "@/app/actions/kaynak-pdf";
import { aramaKunyesi, pdfAramaDurumu, type MakalePdfDurumu } from "@/lib/makale-pdf-durumu";
import { showToast } from "../_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { useOturumDurumu } from "@/app/_components/oturum-durumu";

type Proje = { id: string; title: string };
type Kayit = NonNullable<AramaYaniti["kayitlar"]>[number];

const DIZIN_ADI: Record<string, string> = { openalex: "OpenAlex", crossref: "Crossref" };

/*
  Literatür bulucu: kaynakları GERÇEK dizinlerde arar (OpenAlex + Crossref).

  Asistan kaynak önermiyor — uydurma künye üretmemesi için buna izin yok
  (lib/ai/literatur-taramasi.ts). Ama öğrencinin de dizin dizin gezip elle
  künye kopyalaması gerekmiyordu: asistanın kurduğu arama dizesi burada tek
  tıkla çalışıyor, sonuçlar DOI'siyle geliyor ve "Listeme ekle" ile kayda
  dönüşüyor. Strateji modelin, kaynaklar dizinin.
*/
export default function LiteraturBulucu({
  projeler,
  secilenCalisma = null,
  sorgu,
  onSorguDegis,
  gomulu = false,
  aramaYaninda,
  durumAnahtari = null,
  onPdfOku,
}: {
  projeler: Proje[];
  secilenCalisma?: string | null;
  /** Dışarıdan sürülüyor: asistanın kurduğu dize buraya iniyor. */
  sorgu: string;
  onSorguDegis: (sorgu: string) => void;
  /** Çalışmalarım kartının Literatür penceresinde: başlık çizilmez, çalışma sabit. */
  gomulu?: boolean;
  /** Penceredeki "Dizinlerde ara" düğmesinin yanına ("Manuel kaynak ekle"). */
  aramaYaninda?: ReactNode;
  /**
   * Verilirse süzgeçler ve sonuçlar sekme oturumunda saklanır (19.11.2026,
   * yazım ekranının sol "Makale bul" aracı): araç değiştirip dönen ya da
   * başka bir çalışma sayfasına gidip gelen öğrenci aramasını kaybetmesin.
   */
  durumAnahtari?: string | null;
  /**
   * Verilirse her sonuçta "PDF'yi oku" çıkar (yazım ekranı): PDF bulununca
   * çekmece bu kimlikle açılır. Verilmezse (Kaynaklar sayfası) yalnızca
   * "Tam metin / Kaynağa git" bağlantısı kalır.
   */
  onPdfOku?: (pdfId: string) => void;
}) {
  const t = useCeviri();
  const anahtar = (ek: string) => (durumAnahtari ? `${durumAnahtari}.${ek}` : null);
  const [yilDan, setYilDan] = useOturumDurumu(anahtar("yilDan"), "");
  const [yilaKadar, setYilaKadar] = useOturumDurumu(anahtar("yilaKadar"), "");
  const [acikErisim, setAcikErisim] = useOturumDurumu(anahtar("acikErisim"), false);
  const [projeId, setProjeId] = useState(secilenCalisma ?? "");
  const [yanit, setYanit] = useOturumDurumu<AramaYaniti | null>(anahtar("yanit"), null);
  const [eklenen, setEklenen] = useState<Set<string>>(new Set());
  const [aranıyor, aramayaBasla] = useTransition();
  const [eklenenKimlik, setEklenenKimlik] = useState<string | null>(null);
  /*
    SADE ARAMA (M7, 20.11.2026): tek alan + Ara; yıl, açık erişim ve
    çalışma seçimi "Filtreler"in altında ve varsayılan KAPALI. Etkin
    süzgeçler çip olarak görünür, ×'le kalkar. Eskiden beş alan aynı anda
    açıktı; dar sol panelde arama düğmesi ekranın altına itiliyordu.
  */
  const [filtreAcik, setFiltreAcik] = useState(false);
  /*
    Sonuç başına PDF durumu (lib/makale-pdf-durumu.ts) ve Geri al bilgisi.
    Sonuçlar gibi oturumda saklanır: çekmece açılıp kapanınca sol panel
    yeniden çiziliyor ve yerel durum sıfırlanıyordu — öğrenci az önce
    eklediği kaydın "Geri al"ını kaybediyordu.
  */
  const [pdfDurumu, setPdfDurumu] = useOturumDurumu<Record<string, { durum: MakalePdfDurumu; adres?: string | null; pdfId?: string | null }>>(anahtar("pdfDurumu"), {});
  const [okumaya, setOkumaya] = useOturumDurumu<Record<string, { kaynakId: string; yeni: boolean }>>(anahtar("okumaya"), {});

  const ara = () => {
    aramayaBasla(async () => {
      setYanit(null);
      setYanit(
        await literaturAramasiYap({
          sorgu,
          yilDan: yilDan ? Number(yilDan) : null,
          yilaKadar: yilaKadar ? Number(yilaKadar) : null,
          yalnizcaAcikErisim: acikErisim,
          // Tarama günlüğü seçili çalışmaya bağlanır; danışman da görür.
          projectId: projeId || null,
        })
      );
    });
  };

  /*
    Süzgeç değişince (arama yapılmışsa) yeniden aranır, 600 ms bekletilerek:
    yıl kutusuna "2015" yazarken dört ayrı istek gitmesin. Sorgu metni
    tuş başına aranmaz; onun için Ara/Enter.
  */
  const ilkCizim = useRef(true);
  useEffect(() => {
    if (ilkCizim.current) {
      ilkCizim.current = false;
      return;
    }
    if (!yanit || sorgu.trim().length < 3) return;
    const zamanlayici = setTimeout(ara, 600);
    return () => clearTimeout(zamanlayici);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca süzgeçler tetikler; sorgu Ara ile
  }, [yilDan, yilaKadar, acikErisim]);

  const pdfiOku = async (kayit: Kayit) => {
    if (!onPdfOku) return;
    if (!projeId) {
      showToast("error", t({ tr: "Önce bir çalışma seçin; PDF çalışmanın kaynaklarına eklenir.", en: "Pick a work first; the PDF is added to that work's sources." }));
      return;
    }
    setPdfDurumu((o) => ({ ...o, [kayit.kimlik]: { durum: "araniyor" } }));
    try {
      const alim = await okumayaAl({ baslik: kayit.baslik, yazarlar: kayit.yazarlar, yil: kayit.yil, tur: kayit.tur, dergi: kayit.dergi, doi: kayit.doi, url: kayit.url, projectId: projeId });
      if ("error" in alim) {
        setPdfDurumu((o) => ({ ...o, [kayit.kimlik]: { durum: "servis_hatasi" } }));
        showToast("error", alim.error);
        return;
      }
      setOkumaya((o) => ({ ...o, [kayit.kimlik]: alim }));
      setEklenen((o) => new Set(o).add(kayit.kimlik));
      let pdfId = alim.hazirPdfId;
      let durum: MakalePdfDurumu = pdfId ? "bulundu" : "araniyor";
      let adres: string | null = null;
      if (!pdfId) {
        const sonuc = await kaynakPdfleriniBul(projeId, [{ kunye: aramaKunyesi(kayit), doi: kayit.doi }]).catch(() => null);
        ({ durum, pdfId, adres } = pdfAramaDurumu(sonuc));
        if (pdfId) await pdfKaynaginiBagla({ projectId: projeId, pdfId, kaynakId: alim.kaynakId }).catch(() => undefined);
      }
      setPdfDurumu((o) => ({ ...o, [kayit.kimlik]: { durum, adres, pdfId } }));
      if (pdfId) onPdfOku(pdfId);
    } catch {
      setPdfDurumu((o) => ({ ...o, [kayit.kimlik]: { durum: "servis_hatasi" } }));
    }
  };

  const okumayiGeriAl = async (kayit: Kayit) => {
    const alim = okumaya[kayit.kimlik];
    // Yalnızca bu oturumda YENİ eklenen kayıt silinir; önceden var olana dokunulmaz.
    if (!alim?.yeni) return;
    const sonuc = await deleteLiteratureSource(alim.kaynakId);
    if (sonuc?.error) {
      showToast("error", sonuc.error);
      return;
    }
    setOkumaya((o) => {
      const yeni = { ...o };
      delete yeni[kayit.kimlik];
      return yeni;
    });
    setEklenen((o) => {
      const yeni = new Set(o);
      yeni.delete(kayit.kimlik);
      return yeni;
    });
    showToast("success", t({ tr: "Kaynak çalışmadan kaldırıldı.", en: "Source removed from the work." }));
  };

  const ekle = (kayit: Kayit) => {
    setEklenenKimlik(kayit.kimlik);
    aramayaBasla(async () => {
      const sonuc = await aramaKaydiniEkle({
        baslik: kayit.baslik,
        yazarlar: kayit.yazarlar,
        kunyeYazarlari: kayit.kunyeYazarlari,
        yil: kayit.yil,
        tur: kayit.tur,
        dergi: kayit.dergi,
        doi: kayit.doi,
        url: kayit.url,
        projectId: projeId || null,
      });
      setEklenenKimlik(null);
      if (sonuc?.error) {
        showToast("error", sonuc.error);
        return;
      }
      setEklenen((onceki) => new Set(onceki).add(kayit.kimlik));
      showToast("success", t({ tr: "Kaynak listenize eklendi.", en: "Added to your sources." }));
    });
  };

  const kayitlar = yanit?.kayitlar ?? [];

  /* Şerit için sayımlar; listenin kendisi zaten hesaplanmış durumda. */
  const acikErisimSayisi = kayitlar.filter((kayit) => kayit.acikErisim).length;
  const listedekiSayisi = kayitlar.filter((kayit) => kayit.listede || eklenen.has(kayit.kimlik)).length;

  const secilenProje = projeler.find((p) => p.id === projeId);
  const cipler: { ad: string; kaldir: () => void }[] = [
    ...(yilDan ? [{ ad: t({ tr: `${yilDan} ve sonrası`, en: `${yilDan} or later` }), kaldir: () => setYilDan("") }] : []),
    ...(yilaKadar ? [{ ad: t({ tr: `${yilaKadar} ve öncesi`, en: `${yilaKadar} or earlier` }), kaldir: () => setYilaKadar("") }] : []),
    ...(acikErisim ? [{ ad: t({ tr: "Yalnızca açık erişim", en: "Open access only" }), kaldir: () => setAcikErisim(false) }] : []),
    ...(!gomulu && secilenProje ? [{ ad: secilenProje.title, kaldir: () => setProjeId("") }] : []),
  ];
  const formBlok = (
    <>
      <div className="makale-arama-satiri">
        <label className="makale-arama-alani">
          <span className="sr-only">{t({ tr: "Arama", en: "Search" })}</span>
          <input
            type="search"
            value={sorgu}
            maxLength={300}
            placeholder={t({ tr: "harmanlanmış öğrenme matematik özyeterlik", en: "blended learning mathematics self-efficacy" })}
            onChange={(e) => onSorguDegis(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (sorgu.trim().length >= 3) ara();
              }
            }}
          />
        </label>
        <button type="button" className="projects-primary-button" disabled={aranıyor || sorgu.trim().length < 3} onClick={ara}>
          <Search size={16} aria-hidden="true" />
          {aranıyor ? t({ tr: "Aranıyor…", en: "Searching…" }) : t({ tr: "Ara", en: "Search" })}
        </button>
        <button type="button" className="projects-filter-button" aria-expanded={filtreAcik} aria-controls="makale-filtreler" onClick={() => setFiltreAcik((a) => !a)}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          {t({ tr: "Filtreler", en: "Filters" })}
        </button>
      </div>
      {cipler.length > 0 && (
        <div className="chip-row mt-sm" aria-label={t({ tr: "Etkin filtreler", en: "Active filters" })}>
          {cipler.map((c) => (
            <span className="chip makale-cip" key={c.ad}>
              {c.ad}
              <button type="button" onClick={c.kaldir} aria-label={t({ tr: `${c.ad} filtresini kaldır`, en: `Remove filter ${c.ad}` })}>
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {filtreAcik && (
        <div id="makale-filtreler" className="project-form-grid mt-sm">
          <label>
            <span>{t({ tr: "Yıl (en erken)", en: "Year (earliest)" })}</span>
            <input type="number" inputMode="numeric" value={yilDan} min={1800} max={2100} onChange={(e) => setYilDan(e.target.value)} />
          </label>
          <label>
            <span>{t({ tr: "Yıl (en geç)", en: "Year (latest)" })}</span>
            <input type="number" inputMode="numeric" value={yilaKadar} min={1800} max={2100} onChange={(e) => setYilaKadar(e.target.value)} />
          </label>
          {!gomulu && projeler.length > 0 && (
            <label>
              <span>{t({ tr: "Eklenecek çalışma", en: "Add to work" })}</span>
              <select value={projeId} onChange={(e) => setProjeId(e.target.value)}>
                <option value="">{t({ tr: "Çalışmaya bağlama", en: "Don't link to a work" })}</option>
                {projeler.map((proje) => (
                  <option key={proje.id} value={proje.id}>{proje.title}</option>
                ))}
              </select>
            </label>
          )}
          <label className="secim-satiri">
            <input type="checkbox" checked={acikErisim} onChange={(e) => setAcikErisim(e.target.checked)} />
            <span>{t({ tr: "Yalnızca açık erişim (tam metni okuyabildikleriniz)", en: "Open access only (full text you can read)" })}</span>
          </label>
        </div>
      )}
      {aramaYaninda ? <div className="project-form-actions mt-sm">{aramaYaninda}</div> : null}
    </>
  );
  const sonucBlok = (
    <>
      {yanit?.hata && (
        <p className="asistan-uyari" data-tone="danger" role="alert">
          {yanit.hata}
        </p>
      )}

      {yanit?.ulasilamayan && yanit.ulasilamayan.length > 0 && (
        // Yarım listeyi sessizce göstermek, öğrenciye "literatürde bu kadar var" dedirtir.
        <p className="asistan-uyari" data-tone="neutral">
          {t({
            tr: `${yanit.ulasilamayan.map((dizin) => DIZIN_ADI[dizin] ?? dizin).join(" ve ")} şu anda cevap vermedi; liste eksik olabilir.`,
            en: `${yanit.ulasilamayan.map((dizin) => DIZIN_ADI[dizin] ?? dizin).join(" and ")} didn't respond right now; the list may be incomplete.`,
          })}
        </p>
      )}

      {yanit?.listeOkunamadi && (
        <p className="asistan-uyari" data-tone="neutral">
          {t({
            tr: "Kaynak listeniz şu anda okunamadı; \"listemde\" işaretleri bu aramada gösterilmiyor. Eklemeden önce listenize bakın.",
            en: "Your sources couldn't be loaded right now, so \"in your list\" markers aren't shown for this search. Check your list before adding.",
          })}
        </p>
      )}

      {yanit && !yanit.hata && kayitlar.length === 0 && (
        <p className="asistan-uyari" data-tone="neutral">
          {t({
            tr: "Bu aramada sonuç çıkmadı. Daha genel bir ifade deneyin ya da yıl aralığını genişletin.",
            en: "No results for this search. Try a more general phrase or widen the year range.",
          })}
        </p>
      )}

      {kayitlar.length > 0 && (
        /*
          Özet şeridi, Kaynakça Doğrulama ekranındaki chip-row ile aynı:
          iki ekran aynı işi yapıyor (dizinden kayıt getiriyor) ve aynı
          dili konuşmalı. Sayıyı yazmak ayrıca bir şey söylüyor — liste
          20'de kesiliyor, "20 kayıt" görmek bunun sınır olduğunu sezdirir.
        */
        <div className="chip-row mt-sm">
          <strong className="chip">{t({ tr: `${kayitlar.length} kayıt`, en: `${kayitlar.length} ${kayitlar.length === 1 ? "record" : "records"}` })}</strong>
          {acikErisimSayisi > 0 && (
            <span className="chip" data-tone="success">{t({ tr: `${acikErisimSayisi} açık erişim`, en: `${acikErisimSayisi} open access` })}</span>
          )}
          {listedekiSayisi > 0 && (
            <span className="chip" data-tone="info">{t({ tr: `${listedekiSayisi} listenizde`, en: `${listedekiSayisi} in your list` })}</span>
          )}
        </div>
      )}

      {kayitlar.length > 0 && (
        <ul className="bulgu-listesi">
          {kayitlar.map((kayit) => {
            const listede = kayit.listede || eklenen.has(kayit.kimlik);
            return (
              <li className="bulgu-satiri" key={kayit.kimlik}>
                <div className="bulgu-govde">
                  <strong>{kayit.baslik}</strong>
                  <p className="muted text-sm">
                    {kayit.yazarlar.slice(0, 3).join(", ") || t({ tr: "Yazar bilgisi yok", en: "No author information" })}
                    {kayit.yazarlar.length > 3 ? t({ tr: " vd.", en: " et al." }) : ""}
                    {kayit.yil ? ` · ${kayit.yil}` : ""}
                    {kayit.dergi ? ` · ${kayit.dergi}` : ""}
                    {` · ${DIZIN_ADI[kayit.saglayici] ?? kayit.saglayici}`}
                  </p>
                  {/* Rozet satırı yalnızca gösterecek bir şey varken:
                      boş bir satır da yer kaplıyor. */}
                  {(kayit.acikErisim || typeof kayit.atifSayisi === "number") && (
                  <div className="pill-row">
                    {kayit.acikErisim && (
                      <span className="status-pill" data-tone="success">
                        <Unlock size={12} aria-hidden="true" /> {t({ tr: "Açık erişim", en: "Open access" })}
                      </span>
                    )}
                    {typeof kayit.atifSayisi === "number" && (
                      <span className="status-pill" data-tone="neutral">{t({ tr: `${kayit.atifSayisi} atıf`, en: `${kayit.atifSayisi} ${kayit.atifSayisi === 1 ? "citation" : "citations"}` })}</span>
                    )}
                  </div>
                  )}
                </div>
                <div className="bulgu-eylemler">
                  {onPdfOku ? <PdfOkuDugmesi durum={pdfDurumu[kayit.kimlik]} onOku={() => void pdfiOku(kayit)} onAc={(id) => onPdfOku(id)} /> : null}
                  {okumaya[kayit.kimlik]?.yeni ? (
                    <button type="button" className="projects-filter-button button-compact" onClick={() => void okumayiGeriAl(kayit)}>
                      <Undo2 size={14} aria-hidden="true" /> {t({ tr: "Geri al", en: "Undo" })}
                    </button>
                  ) : null}
                  <a className="projects-filter-button button-compact" href={pdfDurumu[kayit.kimlik]?.adres ?? kayit.acikErisimUrl ?? kayit.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" />
                    {kayit.acikErisimUrl ? t({ tr: "Tam metin", en: "Full text" }) : t({ tr: "Kaynağa git", en: "Go to source" })}
                  </a>
                  {listede ? (
                    <span className="status-pill" data-tone="info">
                      <Check size={12} aria-hidden="true" /> {t({ tr: "Listenizde", en: "In your list" })}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="projects-primary-button button-compact"
                      disabled={aranıyor && eklenenKimlik === kayit.kimlik}
                      onClick={() => ekle(kayit)}
                    >
                      <Plus size={14} aria-hidden="true" /> {t({ tr: "Listeme ekle", en: "Add to my list" })}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  /*
    PENCEREDE İKİ KART YAN YANA (26.10.2026, kurum sahibinin isteği):
    solda arama, sağda sonuçlar. Alt alta dururken sonuçlar formun altında
    kayboluyor, öğrenci her eklemede yukarı aşağı gidiyordu; formun
    kaydet çubuğu da sonuçların üstüne biniyordu.
  */
  if (gomulu) {
    return (
      <div className="pencere-iki-kart" id="kaynak-bul">
        <section className="pencere-kart">
          <h3 className="pencere-kart-baslik">{t({ tr: "Arama", en: "Search" })}</h3>
          <p className="hint">{t({ tr: "Gerçek dizinlerde (OpenAlex, Crossref) aranır; beğendiğinizi tek tıkla bu çalışmaya eklersiniz.", en: "Searches real indexes (OpenAlex, Crossref); add the ones you like to this work with one click." })}</p>
          {formBlok}
        </section>
        <section className="pencere-kart pencere-sonuc" aria-live="polite">
          <h3 className="pencere-kart-baslik">{t({ tr: "Sonuçlar", en: "Results" })}</h3>
          {yanit ? (
            sonucBlok
          ) : (
            <p className="gb-bos">{aranıyor ? t({ tr: "Dizinlerde aranıyor…", en: "Searching the indexes…" }) : t({ tr: "Soldan bir arama yapın; sonuçlar burada listelenir.", en: "Run a search on the left; results will be listed here." })}</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <section className="project-form-card" id="kaynak-bul">
      <div className="asistan-kart-ust">
        <h2>{t({ tr: "Kaynak bul", en: "Find sources" })}</h2>
        <p>
          {t({
            tr: "Araması OpenAlex ve Crossref dizinlerinde yapılır; her sonuç gerçek bir yayına ve mümkün olduğunda DOI'ye dayanır. Beğendiğinizi tek tıkla listenize ekleyin.",
            en: "Searches run on the OpenAlex and Crossref indexes; every result is based on a real publication and, where possible, a DOI. Add the ones you like to your list with one click.",
          })}
        </p>
      </div>
      {formBlok}
      {sonucBlok}
      {!yanit && (
        <p className="muted text-sm mt-sm">
          <BookOpenCheck size={14} aria-hidden="true" /> {t({ tr: "Tarama asistanının kurduğu arama dizelerini de buraya tek tıkla getirebilirsiniz.", en: "You can also bring search strings built by the search assistant here with one click." })}
        </p>
      )}
    </section>
  );
}

/*
  "PDF'yi oku" düğmesi beş durumu ayrı gösterir (lib/makale-pdf-durumu.ts).
  Bulunamadı kalıcıdır (düğme kapanır); servis hatası geçicidir (yeniden
  denenebilir). İndirme yalnızca öğrenci isteyince, yalnızca bu kayıt için.
*/
function PdfOkuDugmesi({ durum, onOku, onAc }: { durum?: { durum: MakalePdfDurumu; pdfId?: string | null }; onOku: () => void; onAc: (pdfId: string) => void }) {
  const t = useCeviri();
  const d = durum?.durum ?? "aranmadi";
  if (d === "bulundu" && durum?.pdfId) {
    const pdfId = durum.pdfId;
    return (
      <button type="button" className="projects-primary-button button-compact" data-pdf-durumu={d} onClick={() => onAc(pdfId)}>
        <FileText size={14} aria-hidden="true" /> {t({ tr: "PDF'yi aç", en: "Open PDF" })}
      </button>
    );
  }
  if (d === "bulunamadi") {
    return (
      <span className="status-pill" data-tone="neutral" data-pdf-durumu={d}>
        {t({ tr: "Açık erişim PDF bulunamadı", en: "No open-access PDF found" })}
      </span>
    );
  }
  return (
    <button type="button" className="projects-primary-button button-compact" data-pdf-durumu={d} disabled={d === "araniyor"} onClick={onOku}>
      <FileText size={14} aria-hidden="true" />
      {d === "araniyor"
        ? t({ tr: "PDF aranıyor…", en: "Finding PDF…" })
        : d === "servis_hatasi"
          ? t({ tr: "PDF'e ulaşılamadı · Tekrar dene", en: "Couldn't reach the PDF · Retry" })
          : t({ tr: "PDF'yi oku", en: "Read PDF" })}
    </button>
  );
}
