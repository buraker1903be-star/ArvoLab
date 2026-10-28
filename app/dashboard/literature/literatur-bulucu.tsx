"use client";

import { useState, useTransition, type ReactNode } from "react";
import { BookOpenCheck, Check, ExternalLink, Plus, Search, Unlock } from "lucide-react";
import { aramaKaydiniEkle, literaturAramasiYap, type AramaYaniti } from "@/app/actions/literatur-arama";
import { showToast } from "../_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

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
}) {
  const t = useCeviri();
  const [yilDan, setYilDan] = useState("");
  const [yilaKadar, setYilaKadar] = useState("");
  const [acikErisim, setAcikErisim] = useState(false);
  const [projeId, setProjeId] = useState(secilenCalisma ?? "");
  const [yanit, setYanit] = useState<AramaYaniti | null>(null);
  const [eklenen, setEklenen] = useState<Set<string>>(new Set());
  const [aranıyor, aramayaBasla] = useTransition();
  const [eklenenKimlik, setEklenenKimlik] = useState<string | null>(null);

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

  const ekle = (kayit: Kayit) => {
    setEklenenKimlik(kayit.kimlik);
    aramayaBasla(async () => {
      const sonuc = await aramaKaydiniEkle({
        baslik: kayit.baslik,
        yazarlar: kayit.yazarlar,
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

  const formBlok = (
    <>
      <div className="project-form-grid">
        <label className="project-form-full">
          <span>{t({ tr: "Arama", en: "Search" })}</span>
          <input
            type="search"
            value={sorgu}
            maxLength={300}
            placeholder={t({ tr: "harmanlanmış öğrenme matematik özyeterlik", en: "blended learning mathematics self-efficacy" })}
            onChange={(e) => onSorguDegis(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                ara();
              }
            }}
          />
        </label>
        <label>
          <span>{t({ tr: "Yıl (en erken)", en: "Year (earliest)" })}</span>
          <input type="number" inputMode="numeric" value={yilDan} min={1800} max={2100} onChange={(e) => setYilDan(e.target.value)} />
        </label>
        <label>
          <span>{t({ tr: "Yıl (en geç)", en: "Year (latest)" })}</span>
          <input type="number" inputMode="numeric" value={yilaKadar} min={1800} max={2100} onChange={(e) => setYilaKadar(e.target.value)} />
        </label>
        {projeler.length > 0 && (
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

      <div className="project-form-actions mt-sm">
        <button type="button" className="projects-primary-button" disabled={aranıyor || sorgu.trim().length < 3} onClick={ara}>
          <Search size={16} aria-hidden="true" />
          {aranıyor ? t({ tr: "Aranıyor…", en: "Searching…" }) : t({ tr: "Dizinlerde ara", en: "Search the indexes" })}
        </button>
        {aramaYaninda}
      </div>
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
                  <a className="projects-filter-button button-compact" href={kayit.acikErisimUrl ?? kayit.url} target="_blank" rel="noreferrer">
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
