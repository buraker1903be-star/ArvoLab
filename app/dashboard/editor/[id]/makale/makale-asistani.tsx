"use client";

import { useState, useTransition } from "react";
import { makaleBolumDenetle, type MakaleDenetimYaniti } from "@/app/actions/ai-makale";
import AsistanSonuc from "@/app/dashboard/_components/asistan-sonuc";

/*
  Makale bölüm denetimi. Bölüm metni istemciden gitmez; yalnızca sıra
  numarası gönderilir, metin kaydedilmiş müsveddeden okunur
  (app/actions/ai-makale.ts). Liste de aynı müsveddeden sunucuda
  çıkarılıyor, yani ekranda görülen bölüm denetlenen bölümdür.
*/
type Bolum = { sira: number; baslik: string; sozcuk: number; denetim: string[] };

export default function MakaleAsistani({ projectId, bolumler, asistanAcik }: { projectId: string; bolumler: Bolum[]; asistanAcik: boolean }) {
  const [secili, setSecili] = useState(String(bolumler[0]?.sira ?? ""));
  const [sonuc, setSonuc] = useState<MakaleDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();
  const bolum = bolumler.find((b) => String(b.sira) === secili);

  function denetle(zorla: boolean) {
    basla(async () => {
      setSonuc(null);
      setSonuc(await makaleBolumDenetle({ projectId, bolumSirasi: Number(secili), zorla }));
    });
  }

  return (
    /* Pencerenin içinde çiziliyor (makale/page.tsx): başlığı pencerenin
       kendisi taşıyor, kart çerçevesi pencere içinde ikinci bir kutu olurdu. */
    <div className="asistan-kart">
      <div className="asistan-kart-ust">
        <p>
          Asistan seçtiğiniz bölümü makale türü, araştırma sorusu ve yöntemle karşılaştırır; eksikleri ve nedenini
          söyler. <strong>Cümle, başlık, özet ya da kapak mektubu yazmaz</strong>, kaynak önermez ve kabul olasılığı
          hakkında konuşmaz.
        </p>
      </div>

      {bolumler.length === 0 ? (
        <p className="asistan-uyari" data-tone="neutral">
          Müsveddede başlıklı bölüm bulunamadı. Editörde bölüm başlıklarını ekleyip kaydedin.
        </p>
      ) : (
        <>
          <div className="project-form-grid">
            <label className="project-form-full">
              <span>Bölüm</span>
              <select value={secili} onChange={(e) => setSecili(e.target.value)}>
                {bolumler.map((b) => (
                  <option key={b.sira} value={b.sira}>
                    {b.baslik || "Başlıksız giriş metni"} · yaklaşık {b.sozcuk} sözcük
                  </option>
                ))}
              </select>
            </label>
          </div>
          {bolum && (
            <details className="form-details mt-sm">
              <summary>Asistanın bu bölümde baktığı noktalar</summary>
              <ul className="kanit-alanlar">
                {bolum.denetim.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="project-form-actions mt-sm">
            <button type="button" className="projects-primary-button" disabled={!asistanAcik || bekleniyor || !bolum} onClick={() => denetle(false)}>
              {bekleniyor ? "Denetleniyor…" : "Bölümü denetle"}
            </button>
          </div>
        </>
      )}

      {!asistanAcik && (
        <p className="asistan-uyari" data-tone="neutral">
          Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.
        </p>
      )}

      <AsistanSonuc
        sonuc={sonuc}
        yetenek="makale"
        etiketler={{ uyari: "Eksik", oneri: "Öneri", bilgi: "Not" }}
        bulguBasligi="Bölüm bulguları"
        bekleniyor={bekleniyor}
        onYenidenSorgula={() => denetle(true)}
      />
    </div>
  );
}
