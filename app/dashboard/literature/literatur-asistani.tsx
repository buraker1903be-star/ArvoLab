"use client";

import { useState, useTransition } from "react";
import { literaturTara, type LiteraturDenetimYaniti } from "@/app/actions/ai-literatur";
import AsistanPuan from "../_components/asistan-puan";

const BULGU_TONU = { uyari: "danger", oneri: "warning", bilgi: "info" } as const;
const BULGU_ETIKETI = { uyari: "Boşluk", oneri: "Öneri", bilgi: "Not" } as const;

type Proje = { id: string; title: string };

export default function LiteraturAsistani({ projeler, asistanAcik }: { projeler: Proje[]; asistanAcik: boolean }) {
  const [soru, setSoru] = useState("");
  const [projeId, setProjeId] = useState("");
  const [sonuc, setSonuc] = useState<LiteraturDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();

  return (
    <section className="project-form-card ai-denetim">
      <div className="project-form-heading">
        <h2>Tarama asistanı</h2>
        <p>
          Asistan <strong>kaynak önermez</strong> — uydurma künye üretmemesi
          için buna izin verilmiyor. Araştırma sorunuzdan veri tabanlarına
          yapıştırabileceğiniz arama dizeleri kurar ve topladığınız listedeki
          boşlukları gösterir: yıl dağılımı, tek dergiye yığılma, yöntem
          çeşitliliği. Kaynakları dizinden siz bulursunuz.
        </p>
      </div>

      <div className="project-form-grid">
        <label className="project-form-full">
          <span>Araştırma sorusu</span>
          <textarea
            rows={3}
            maxLength={1000}
            placeholder="Harmanlanmış öğrenme ortamlarının lise öğrencilerinin matematik özyeterliğine etkisi nedir?"
            value={soru}
            onChange={(e) => setSoru(e.target.value)}
          />
        </label>
        {projeler.length > 0 && (
          <label>
            <span>Çalışma (isteğe bağlı)</span>
            <select value={projeId} onChange={(e) => setProjeId(e.target.value)}>
              <option value="">Tüm kaynaklarım</option>
              {projeler.map((proje) => (
                <option key={proje.id} value={proje.id}>{proje.title}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="project-form-actions mt-sm">
        <button
          type="button"
          className="projects-primary-button"
          disabled={!asistanAcik || bekleniyor || soru.trim().length < 10}
          onClick={() =>
            basla(async () => {
              setSonuc(null);
              setSonuc(await literaturTara({ arastirmaSorusu: soru, projectId: projeId || null }));
            })
          }
        >
          {bekleniyor ? "Hazırlanıyor…" : "Tarama Stratejisi Kur"}
        </button>
      </div>

      {!asistanAcik && (
        <p className="muted text-base mt-sm">
          Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.
        </p>
      )}

      {sonuc?.hata && (
        <p className="tone-text mt-sm text-base" data-tone="danger" role="alert">{sonuc.hata}</p>
      )}

      {sonuc?.kirpilanlar && sonuc.kirpilanlar.length > 0 && (
        <p className="muted text-base mt-sm">
          Uzunluk sınırı nedeniyle asistana gönderilemeyen bölümler: {sonuc.kirpilanlar.join(", ")}.
        </p>
      )}

      {sonuc?.aramalar && sonuc.aramalar.length > 0 && (
        <div className="mt-md">
          <h3 className="result-heading">Arama dizeleri</h3>
          <ul className="ai-arama-listesi">
            {sonuc.aramalar.map((arama, index) => (
              <li key={index}><code>{arama}</code></li>
            ))}
          </ul>
        </div>
      )}

      {sonuc?.bulgular && sonuc.bulgular.length > 0 && (
        <div className="mt-md">
          <h3 className="result-heading">Listedeki boşluklar</h3>
          <ul className="ai-bulgu-listesi mt-sm">
            {sonuc.bulgular.map((bulgu, index) => (
              <li className="attention-item" data-tone={BULGU_TONU[bulgu.tur]} key={index}>
                <strong>{BULGU_ETIKETI[bulgu.tur]}</strong>
                <span>
                  <b>{bulgu.baslik}</b>
                  <br />
                  {bulgu.aciklama}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(sonuc?.bulgular?.length || sonuc?.aramalar?.length) ? <AsistanPuan kayitId={sonuc?.kayitId} /> : null}
    </section>
  );
}
