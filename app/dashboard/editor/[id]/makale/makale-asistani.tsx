"use client";

import { asistanCagir } from "@/lib/asistan-istemci";
import { useState, useTransition } from "react";
import { makaleBolumDenetle, type MakaleDenetimYaniti } from "@/app/actions/ai-makale";
import AsistanSonuc from "@/app/dashboard/_components/asistan-sonuc";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

/*
  Makale bölüm denetimi. Bölüm metni istemciden gitmez; yalnızca sıra
  numarası gönderilir, metin kaydedilmiş müsveddeden okunur
  (app/actions/ai-makale.ts). Liste de aynı müsveddeden sunucuda
  çıkarılıyor, yani ekranda görülen bölüm denetlenen bölümdür.
*/
type Bolum = { sira: number; baslik: string; sozcuk: number; denetim: string[] };

export default function MakaleAsistani({ projectId, bolumler, asistanAcik }: { projectId: string; bolumler: Bolum[]; asistanAcik: boolean }) {
  const t = useCeviri();
  const dil = useDil();
  const [secili, setSecili] = useState(String(bolumler[0]?.sira ?? ""));
  const [sonuc, setSonuc] = useState<MakaleDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();
  const bolum = bolumler.find((b) => String(b.sira) === secili);

  function denetle(zorla: boolean) {
    basla(async () => {
      setSonuc(null);
      setSonuc(await asistanCagir(() => makaleBolumDenetle({ projectId, bolumSirasi: Number(secili), zorla }), dil));
    });
  }

  return (
    /* Pencerenin içinde çiziliyor (makale/page.tsx): başlığı pencerenin
       kendisi taşıyor, kart çerçevesi pencere içinde ikinci bir kutu olurdu. */
    <div className="asistan-kart">
      <div className="asistan-kart-ust">
        <p>
          {t({
            tr: "Asistan seçtiğiniz bölümü makale türü, araştırma sorusu ve yöntemle karşılaştırır; eksikleri ve nedenini söyler.",
            en: "The assistant compares the section you choose with the article type, research question and method, and tells you what is missing and why.",
          })}{" "}
          <strong>{t({ tr: "Cümle, başlık, özet ya da kapak mektubu yazmaz", en: "It does not write sentences, titles, abstracts or cover letters" })}</strong>
          {t({
            tr: ", kaynak önermez ve kabul olasılığı hakkında konuşmaz.",
            en: ", does not suggest sources and does not comment on the chance of acceptance.",
          })}
        </p>
      </div>

      {bolumler.length === 0 ? (
        <p className="asistan-uyari" data-tone="neutral">
          {t({
            tr: "Müsveddede başlıklı bölüm bulunamadı. Editörde bölüm başlıklarını ekleyip kaydedin.",
            en: "No headed sections were found in the manuscript. Add section headings in the editor and save.",
          })}
        </p>
      ) : (
        <>
          <div className="project-form-grid">
            <label className="project-form-full">
              <span>{t({ tr: "Bölüm", en: "Section" })}</span>
              <select value={secili} onChange={(e) => setSecili(e.target.value)}>
                {bolumler.map((b) => (
                  <option key={b.sira} value={b.sira}>
                    {b.baslik || t({ tr: "Başlıksız giriş metni", en: "Untitled opening text" })} ·{" "}
                    {t({ tr: `yaklaşık ${b.sozcuk} sözcük`, en: `about ${b.sozcuk} words` })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {bolum && (
            <details className="form-details mt-sm">
              <summary>{t({ tr: "Asistanın bu bölümde baktığı noktalar", en: "What the assistant checks in this section" })}</summary>
              <ul className="kanit-alanlar">
                {bolum.denetim.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="project-form-actions mt-sm">
            <button type="button" className="projects-primary-button" disabled={!asistanAcik || bekleniyor || !bolum} onClick={() => denetle(false)}>
              {bekleniyor ? t({ tr: "Denetleniyor…", en: "Reviewing…" }) : t({ tr: "Bölümü denetle", en: "Review section" })}
            </button>
          </div>
        </>
      )}

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
        yetenek="makale"
        etiketler={{
          uyari: t({ tr: "Eksik", en: "Missing" }),
          oneri: t({ tr: "Öneri", en: "Suggestion" }),
          bilgi: t({ tr: "Not", en: "Note" }),
        }}
        bulguBasligi={t({ tr: "Bölüm bulguları", en: "Section findings" })}
        bekleniyor={bekleniyor}
        onYenidenSorgula={() => denetle(true)}
      />
    </div>
  );
}
