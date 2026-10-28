"use client";

import { asistanCagir } from "@/lib/asistan-istemci";
import { useState, useTransition } from "react";
import { literaturTara, type LiteraturDenetimYaniti } from "@/app/actions/ai-literatur";
import AsistanSonuc from "../_components/asistan-sonuc";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

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
  const t = useCeviri();
  const dil = useDil();
  const [soru, setSoru] = useState("");
  // Merkezden gelindiyse çalışma hazır seçili gelir.
  const [projeId, setProjeId] = useState(secilenCalisma ?? "");
  const [sonuc, setSonuc] = useState<LiteraturDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();

  // zorla=true: kayıtlı cevap atlanır, modele yeniden sorulur.
  function tara(zorla: boolean) {
    basla(async () => {
      setSonuc(null);
      setSonuc(await asistanCagir(() => literaturTara({ arastirmaSorusu: soru, projectId: projeId || null, zorla }), dil));
    });
  }

  return (
    <section className="project-form-card asistan-kart">
      <div className="asistan-kart-ust">
        <h2>{t({ tr: "Tarama asistanı", en: "Search assistant" })}</h2>
        {dil === "en" ? (
          <p>
            The assistant <strong>doesn&apos;t recommend sources</strong> — this isn&apos;t allowed, so that it
            can&apos;t produce fabricated references. It builds search strings from your research question that you
            can paste into databases, and shows gaps in the list you&apos;ve collected: year distribution, clustering
            in a single journal, variety of methods. You find the sources in the index yourself.
          </p>
        ) : (
          <p>
            Asistan <strong>kaynak önermez</strong> — uydurma künye üretmemesi
            için buna izin verilmiyor. Araştırma sorunuzdan veri tabanlarına
            yapıştırabileceğiniz arama dizeleri kurar ve topladığınız listedeki
            boşlukları gösterir: yıl dağılımı, tek dergiye yığılma, yöntem
            çeşitliliği. Kaynakları dizinden siz bulursunuz.
          </p>
        )}
      </div>

      <div className="project-form-grid">
        <label className="project-form-full">
          <span>{t({ tr: "Araştırma sorusu", en: "Research question" })}</span>
          <textarea
            rows={3}
            maxLength={1000}
            placeholder={t({
              tr: "Harmanlanmış öğrenme ortamlarının lise öğrencilerinin matematik özyeterliğine etkisi nedir?",
              en: "What is the effect of blended learning environments on high school students' mathematics self-efficacy?",
            })}
            value={soru}
            onChange={(e) => setSoru(e.target.value)}
          />
        </label>
        {projeler.length > 0 && (
          <label>
            <span>{t({ tr: "Çalışma (isteğe bağlı)", en: "Work (optional)" })}</span>
            <select value={projeId} onChange={(e) => setProjeId(e.target.value)}>
              <option value="">{t({ tr: "Tüm kaynaklarım", en: "All my sources" })}</option>
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
          {bekleniyor ? t({ tr: "Hazırlanıyor…", en: "Preparing…" }) : t({ tr: "Tarama Stratejisi Kur", en: "Build Search Strategy" })}
        </button>
      </div>

      {!asistanAcik && (
        <p className="asistan-uyari" data-tone="neutral">
          {t({
            tr: "Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.",
            en: "The assistant is turned off in this installation; your administrator needs to set up the AI key.",
          })}
        </p>
      )}

      <AsistanSonuc
        sonuc={sonuc}
        yetenek="literatur"
        etiketler={{ uyari: t({ tr: "Boşluk", en: "Gap" }), oneri: t({ tr: "Öneri", en: "Suggestion" }), bilgi: t({ tr: "Not", en: "Note" }) }}
        bulguBasligi={t({ tr: "Listedeki boşluklar", en: "Gaps in your list" })}
        bekleniyor={bekleniyor}
        onYenidenSorgula={() => tara(true)}
        onAramaCalistir={onAramaCalistir}
      />
    </section>
  );
}
