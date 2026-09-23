"use client";

import { useState, useTransition } from "react";
import { literaturTara, type LiteraturDenetimYaniti } from "@/app/actions/ai-literatur";
import AsistanSonuc from "../_components/asistan-sonuc";

type Proje = { id: string; title: string };

export default function LiteraturAsistani({
  projeler,
  asistanAcik,
  secilenCalisma = null,
  onAramaCalistir,
}: {
  projeler: Proje[];
  asistanAcik: boolean;
  secilenCalisma?: string | null;
  /** Arama dizesini sayfadaki bulucuya taşır. */
  onAramaCalistir?: (arama: string) => void;
}) {
  const [soru, setSoru] = useState("");
  // Merkezden gelindiyse çalışma hazır seçili gelir.
  const [projeId, setProjeId] = useState(secilenCalisma ?? "");
  const [sonuc, setSonuc] = useState<LiteraturDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();

  // zorla=true: kayıtlı cevap atlanır, modele yeniden sorulur.
  function tara(zorla: boolean) {
    basla(async () => {
      setSonuc(null);
      setSonuc(await literaturTara({ arastirmaSorusu: soru, projectId: projeId || null, zorla }));
    });
  }

  return (
    <section className="project-form-card asistan-kart">
      <div className="asistan-kart-ust">
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
          onClick={() => tara(false)}
        >
          {bekleniyor ? "Hazırlanıyor…" : "Tarama Stratejisi Kur"}
        </button>
      </div>

      {!asistanAcik && (
        <p className="asistan-uyari" data-tone="neutral">
          Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.
        </p>
      )}

      <AsistanSonuc
        sonuc={sonuc}
        yetenek="literatur"
        etiketler={{ uyari: "Boşluk", oneri: "Öneri", bilgi: "Not" }}
        bulguBasligi="Listedeki boşluklar"
        bekleniyor={bekleniyor}
        onYenidenSorgula={() => tara(true)}
        onAramaCalistir={onAramaCalistir}
      />
    </section>
  );
}
