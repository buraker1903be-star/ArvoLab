"use client";

import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import type { ChecklistAction, SubmissionChecklist } from "@/lib/submission-checklist";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";

const ICONS = { ok: CheckCircle2, warning: AlertTriangle, todo: Circle } as const;
const STATUS_LABEL: Record<keyof typeof ICONS, Metin> = {
  ok: { tr: "Hazır", en: "Ready" },
  warning: { tr: "Bakılmalı", en: "Needs review" },
  todo: { tr: "Eksik", en: "Missing" },
};

/*
  TESLİM LİSTESİ (Signature OS Phase 2): yazım panelinin "Teslim"
  görünümünde, belgenin yanında. Eskiden başlıktaki "Teslim kontrolü"
  düğmesi bir pencere açıyordu; pencere belgeyi örttüğü için "Ekle" ya
  da "Göster" diyen madde önce pencereyi kapatmak zorundaydı ve öğrenci
  listeye dönmek için düğmeyi yeniden buluyordu. Liste ve maddelerin
  eylemleri aynı (lib/submission-checklist.ts).
*/
export default function TeslimListesi({
  checklist,
  onAction,
  vurgu,
  dogrulanmamis,
  makale = false,
}: {
  checklist: SubmissionChecklist;
  onAction: (action: ChecklistAction) => void;
  /*
    Ana sayfadan gelindiğinde hangi maddeye bakılacağı. Liste sekiz
    maddeli; "Eksik: Bulgular, Sonuç" yazısına tıklayıp açılan panelde
    o maddeyi yeniden aramak, tıklamanın kazandırdığı kolaylığı geri
    alırdı.
  */
  vurgu?: string | null;
  /*
    Kurallar insan onayından geçti mi. Geçmediyse SÖYLENİYOR: liste
    "teslime hazır görünüyor" derken hangi kurala dayandığını
    söylemek zorunda. Öğrencinin kendi yüklediği PDF'ten çıkarılan ve
    yine kendisinin onayladığı kurallar, kurumun onayladığı kurallarla
    aynı güveni taşımaz.
  */
  dogrulanmamis?: boolean;
  /*
    Makale (Makale Aşama 2, 05.11.2026): sınırlar dergi profilinden;
    açıklama "kılavuza göre" demez, dergi bilgilerinin doğrulanmadığını
    söyler. Eskiden makalede de tez kılavuzu cümlesi yazıyordu.
  */
  makale?: boolean;
}) {
  const t = useCeviri();
  const ready = checklist.done === checklist.total;
  return (
    <section className="yan-bolum" aria-labelledby="teslim-listesi-baslik">
      <header className="yan-bolum-bas">
        <h3 id="teslim-listesi-baslik">{t({ tr: "Teslim kontrolü", en: "Submission checklist" })}</h3>
        <span className="status-pill" data-tone={ready ? "success" : "neutral"}>
          {ready
            ? t({ tr: "Hazır görünüyor", en: "Looks ready" })
            : t({ tr: `${checklist.done}/${checklist.total} hazır`, en: `${checklist.done}/${checklist.total} ready` })}
        </span>
      </header>
      <p className="yan-not">
        {makale
          ? t({
              tr: "Gönderimden önce bakılması gerekenler. Kelime, özet ve anahtar kelime sınırları Makale bilgilerindeki dergi beyanınızdan gelir; ArvoLab dergi kurallarını doğrulamaz ve uygunluk hükmü vermez.",
              en: "What to check before submission. Word, abstract and keyword limits come from the journal details you entered under Article details; ArvoLab does not verify journal rules or judge suitability.",
            })
          : dogrulanmamis
          ? t({
              tr: "Kendi yüklediğiniz kılavuzdan çıkarılan ve sizin onayladığınız kurallara göre denetlenir — kurumunuzun onayından GEÇMEMİŞTİR. Otomatik denetimdir; danışman ve jüri kontrolünün yerini tutmaz.",
              en: "Checked against rules extracted from the guideline you uploaded and approved yourself — they have NOT been approved by your institution. This is an automated check; it does not replace review by your advisor or committee.",
            })
          : t({
              tr: "Kılavuza göre teslimden önce bakılması gerekenler. Otomatik denetimdir; danışman ve jüri kontrolünün yerini tutmaz.",
              en: "What to check before submission according to the guideline. This is an automated check; it does not replace review by your advisor or committee.",
            })}
      </p>
      <ul className="checklist">
        {checklist.items.map((item) => {
          const Icon = ICONS[item.status];
          return (
            <li
              key={item.id}
              className="checklist-item"
              data-status={item.status}
              data-vurgulu={item.id === vurgu ? "true" : undefined}
            >
              <Icon size={18} className="checklist-icon" aria-label={t(STATUS_LABEL[item.status])} />
              <span className="checklist-text">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              {item.action ? (
                <button type="button" className="projects-filter-button button-compact" onClick={() => onAction(item.action!.id)}>
                  {item.action.label}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
