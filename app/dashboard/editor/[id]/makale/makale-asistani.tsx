"use client";

import { asistanCagir } from "@/lib/asistan-istemci";
import Link from "next/link";
import { PenLine } from "lucide-react";
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

/** Yazım sekmesinin adresi; başlık varsa editör oraya gider (?baslik=), asistan istenirse panel açık gelir (?asistan=1). */
function yazimAdresi(projectId: string, baslik: string, asistan = false): string {
  const sorgu = new URLSearchParams();
  if (baslik) sorgu.set("baslik", baslik);
  if (asistan) sorgu.set("asistan", "1");
  const q = sorgu.toString();
  return `/dashboard/editor/${encodeURIComponent(projectId)}/write${q ? `?${q}` : ""}`;
}

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
        <>
          <p className="asistan-uyari" data-tone="neutral">
            {t({
              tr: "Müsveddede başlıklı bölüm bulunamadı. Editörde bölüm başlıklarını ekleyip kaydedin.",
              en: "No headed sections were found in the manuscript. Add section headings in the editor and save.",
            })}
          </p>
          {/* Başlık yoksa gidilecek bölüm de yok: Yazım sekmesi olduğu gibi açılır. */}
          <div className="project-form-actions mt-sm">
            <Link className="projects-filter-button" href={yazimAdresi(projectId, "")}>
              <PenLine size={15} aria-hidden="true" />
              {t({ tr: "Yazım'a git", en: "Go to Writing" })}
            </Link>
          </div>
        </>
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
            {/*
              Yazım'a geçiş (Makale Aşama 2, 05.11.2026). Başlık metni adrese
              konur; editör aynı başlığı bulup oraya gider, bulamazsa yalnızca
              açılır (lib/makale/bolumler.ts, baslikSirasi). "Başlıksız giriş
              metni" için başlık yok: düz Yazım sekmesi.
            */}
            {bolum ? (
              <Link className="projects-filter-button" href={yazimAdresi(projectId, bolum.baslik)}>
                <PenLine size={15} aria-hidden="true" />
                {t({ tr: "Bölümü Yazım'da aç", en: "Open section in Writing" })}
              </Link>
            ) : null}
          </div>
          <p className="makale-denetim-ayrim">
            {t({
              tr: "Bölüm denetimi yalnızca eksikleri söyler. Metni yazmak ya da geliştirmek için Yazım sekmesindeki Arvo AI yazım asistanını kullanın; önerdiği metin belgeye ancak siz eklerseniz girer.",
              en: "Section review only points out what is missing. To write or improve the text, use the Arvo AI writing assistant in the Writing tab; its suggestions enter the document only if you add them.",
            })}{" "}
            {bolum ? (
              <Link className="link-accent" href={yazimAdresi(projectId, bolum.baslik, true)}>
                {t({ tr: "Yazım asistanıyla aç", en: "Open with the writing assistant" })}
              </Link>
            ) : null}
          </p>
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
