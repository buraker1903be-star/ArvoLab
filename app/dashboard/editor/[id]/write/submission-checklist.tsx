"use client";

import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import type { ChecklistAction, SubmissionChecklist } from "@/lib/submission-checklist";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";

const ICONS = { ok: CheckCircle2, warning: AlertTriangle, todo: Circle } as const;
const STATUS_LABEL: Record<keyof typeof ICONS, Metin> = {
  ok: { tr: "Hazır", en: "Ready" },
  warning: { tr: "Bakılmalı", en: "Needs review" },
  todo: { tr: "Eksik", en: "Missing" },
};

// Teslimden önce bakılacaklar tek pencerede; her eksik tek tıkla düzeltilir.
export default function SubmissionChecklistDialog({
  open,
  onClose,
  checklist,
  onAction,
  vurgu,
  dogrulanmamis,
}: {
  open: boolean;
  onClose: () => void;
  checklist: SubmissionChecklist;
  onAction: (action: ChecklistAction) => void;
  /*
    Ana sayfadan gelindiğinde hangi maddeye bakılacağı. Liste sekiz
    maddeli; "Eksik: Bulgular, Sonuç" yazısına tıklayıp açılan pencerede
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
}) {
  const t = useCeviri();
  const ready = checklist.done === checklist.total;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={t({ tr: "Teslim kontrolü", en: "Submission checklist" })}
      title={
        ready
          ? t({ tr: "Teslime hazır görünüyor", en: "Looks ready to submit" })
          : t({ tr: `${checklist.done}/${checklist.total} madde hazır`, en: `${checklist.done}/${checklist.total} items ready` })
      }
      description={
        dogrulanmamis
          ? t({
              tr: "Kendi yüklediğiniz kılavuzdan çıkarılan ve sizin onayladığınız kurallara göre denetlenir — kurumunuzun onayından GEÇMEMİŞTİR. Otomatik denetimdir; danışman ve jüri kontrolünün yerini tutmaz.",
              en: "Checked against rules extracted from the guideline you uploaded and approved yourself — they have NOT been approved by your institution. This is an automated check; it does not replace review by your advisor or committee.",
            })
          : t({
              tr: "Kılavuza göre teslimden önce bakılması gerekenler. Otomatik denetimdir; danışman ve jüri kontrolünün yerini tutmaz.",
              en: "What to check before submission according to the guideline. This is an automated check; it does not replace review by your advisor or committee.",
            })
      }
    >
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
    </Dialog>
  );
}
