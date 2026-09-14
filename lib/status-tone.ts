// Durum değerlerini ortak renk tonlarına bağlar. Kullanım:
//   <span className="status-pill" data-tone={statusTone(project.status)}>…</span>
// Tonların renkleri app/styles/tokens.css'te (açık ve koyu tema).

export type Tone = "success" | "info" | "warning" | "danger" | "neutral" | "accent";

const STATUS_TONES: Record<string, Tone> = {
  // Çalışmalar (academic_projects.status)
  new: "neutral",
  planned: "neutral",
  writing: "info",
  analysis: "info",
  review: "warning",
  revision: "warning",
  turnitin: "info",
  ready: "success",
  delivered: "success",
  archived: "neutral",
  // Uzman ve uygulama destek talepleri
  open: "info",
  accepted: "info",
  in_progress: "info",
  completed: "success",
  resolved: "success",
  cancelled: "neutral",
  // Literatür kaynakları
  to_review: "warning",
  read: "info",
  used: "success",
  // Kılavuz analizi (thesis_guidelines.analysis_status)
  approved: "success",
  needs_review: "warning",
  pending: "neutral",
  // Belge yüklemeleri (document_uploads.status)
  analyzed: "success",
  processing: "info",
  failed: "danger",
};

export function statusTone(status: string | null | undefined): Tone {
  return (status && STATUS_TONES[status]) || "neutral";
}

/** Uyum/başarı puanı (0–100): yüksek iyi. */
export function scoreTone(score: number | null | undefined, good = 80, fair = 50): Tone {
  if (score === null || score === undefined || Number.isNaN(score)) return "neutral";
  if (score >= good) return "success";
  if (score >= fair) return "warning";
  return "danger";
}

/** Benzerlik oranı (%): yüksek kötü (ArvoLab Ön-Kontrol eşikleri). */
export function similarityTone(percent: number): Tone {
  if (percent >= 40) return "danger";
  if (percent >= 15) return "warning";
  return "success";
}
