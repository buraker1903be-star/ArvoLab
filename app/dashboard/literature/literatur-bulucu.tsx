"use client";

import { useState, useTransition } from "react";
import { BookOpenCheck, Check, ExternalLink, Plus, Search, Unlock } from "lucide-react";
import { aramaKaydiniEkle, literaturAramasiYap, type AramaYaniti } from "@/app/actions/literatur-arama";
import { showToast } from "../_components/toast-events";

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
}: {
  projeler: Proje[];
  secilenCalisma?: string | null;
  /** Dışarıdan sürülüyor: asistanın kurduğu dize buraya iniyor. */
  sorgu: string;
  onSorguDegis: (sorgu: string) => void;
}) {
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
      showToast("success", "Kaynak listenize eklendi.");
    });
  };

  const kayitlar = yanit?.kayitlar ?? [];

  return (
    <section className="project-form-card" id="kaynak-bul">
      <div className="asistan-kart-ust">
        <h2>Kaynak bul</h2>
        <p>
          Araması OpenAlex ve Crossref dizinlerinde yapılır; her sonuç gerçek
          bir yayına ve mümkün olduğunda DOI&apos;ye dayanır. Beğendiğinizi tek
          tıkla listenize ekleyin.
        </p>
      </div>

      <div className="project-form-grid">
        <label className="project-form-full">
          <span>Arama</span>
          <input
            type="search"
            value={sorgu}
            maxLength={300}
            placeholder="harmanlanmış öğrenme matematik özyeterlik"
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
          <span>Yıl (en erken)</span>
          <input type="number" inputMode="numeric" value={yilDan} min={1800} max={2100} onChange={(e) => setYilDan(e.target.value)} />
        </label>
        <label>
          <span>Yıl (en geç)</span>
          <input type="number" inputMode="numeric" value={yilaKadar} min={1800} max={2100} onChange={(e) => setYilaKadar(e.target.value)} />
        </label>
        {projeler.length > 0 && (
          <label>
            <span>Eklenecek çalışma</span>
            <select value={projeId} onChange={(e) => setProjeId(e.target.value)}>
              <option value="">Çalışmaya bağlama</option>
              {projeler.map((proje) => (
                <option key={proje.id} value={proje.id}>{proje.title}</option>
              ))}
            </select>
          </label>
        )}
        <label className="secim-satiri">
          <input type="checkbox" checked={acikErisim} onChange={(e) => setAcikErisim(e.target.checked)} />
          <span>Yalnızca açık erişim (tam metni okuyabildikleriniz)</span>
        </label>
      </div>

      <div className="project-form-actions mt-sm">
        <button type="button" className="projects-primary-button" disabled={aranıyor || sorgu.trim().length < 3} onClick={ara}>
          <Search size={16} aria-hidden="true" />
          {aranıyor ? "Aranıyor…" : "Dizinlerde ara"}
        </button>
      </div>

      {yanit?.hata && (
        <p className="asistan-uyari" data-tone="danger" role="alert">
          {yanit.hata}
        </p>
      )}

      {yanit?.ulasilamayan && yanit.ulasilamayan.length > 0 && (
        // Yarım listeyi sessizce göstermek, öğrenciye "literatürde bu kadar var" dedirtir.
        <p className="asistan-uyari" data-tone="neutral">
          {yanit.ulasilamayan.map((dizin) => DIZIN_ADI[dizin] ?? dizin).join(" ve ")} şu anda cevap vermedi; liste eksik olabilir.
        </p>
      )}

      {yanit && !yanit.hata && kayitlar.length === 0 && (
        <p className="asistan-uyari" data-tone="neutral">
          Bu aramada sonuç çıkmadı. Daha genel bir ifade deneyin ya da yıl aralığını genişletin.
        </p>
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
                    {kayit.yazarlar.slice(0, 3).join(", ") || "Yazar bilgisi yok"}
                    {kayit.yazarlar.length > 3 ? " vd." : ""}
                    {kayit.yil ? ` · ${kayit.yil}` : ""}
                    {kayit.dergi ? ` · ${kayit.dergi}` : ""}
                  </p>
                  <div className="pill-row">
                    {kayit.acikErisim && (
                      <span className="status-pill" data-tone="success">
                        <Unlock size={12} aria-hidden="true" /> Açık erişim
                      </span>
                    )}
                    {typeof kayit.atifSayisi === "number" && (
                      <span className="status-pill" data-tone="neutral">{kayit.atifSayisi} atıf</span>
                    )}
                    <span className="status-pill" data-tone="neutral">{DIZIN_ADI[kayit.saglayici] ?? kayit.saglayici}</span>
                  </div>
                </div>
                <div className="bulgu-eylemler">
                  <a className="projects-filter-button button-compact" href={kayit.acikErisimUrl ?? kayit.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" />
                    {kayit.acikErisimUrl ? "Tam metin" : "Kaynağa git"}
                  </a>
                  {listede ? (
                    <span className="status-pill" data-tone="info">
                      <Check size={12} aria-hidden="true" /> Listenizde
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="projects-primary-button button-compact"
                      disabled={aranıyor && eklenenKimlik === kayit.kimlik}
                      onClick={() => ekle(kayit)}
                    >
                      <Plus size={14} aria-hidden="true" /> Listeme ekle
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!yanit && (
        <p className="muted text-sm mt-sm">
          <BookOpenCheck size={14} aria-hidden="true" /> Tarama asistanının kurduğu arama dizelerini de buraya tek tıkla getirebilirsiniz.
        </p>
      )}
    </section>
  );
}
