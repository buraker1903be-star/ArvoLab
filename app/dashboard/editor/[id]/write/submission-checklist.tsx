"use client";

import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import type { ChecklistAction, SubmissionChecklist } from "@/lib/submission-checklist";

const ICONS = { ok: CheckCircle2, warning: AlertTriangle, todo: Circle } as const;
const STATUS_LABEL = { ok: "Hazır", warning: "Bakılmalı", todo: "Eksik" } as const;

// Teslimden önce bakılacaklar tek pencerede; her eksik tek tıkla düzeltilir.
export default function SubmissionChecklistDialog({
  open,
  onClose,
  checklist,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  checklist: SubmissionChecklist;
  onAction: (action: ChecklistAction) => void;
}) {
  const ready = checklist.done === checklist.total;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker="Teslim kontrolü"
      title={ready ? "Teslime hazır görünüyor" : `${checklist.done}/${checklist.total} madde hazır`}
      description="Kılavuza göre teslimden önce bakılması gerekenler. Otomatik denetimdir; danışman ve jüri kontrolünün yerini tutmaz."
    >
      <ul className="checklist">
        {checklist.items.map((item) => {
          const Icon = ICONS[item.status];
          return (
            <li key={item.id} className="checklist-item" data-status={item.status}>
              <Icon size={18} className="checklist-icon" aria-label={STATUS_LABEL[item.status]} />
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
