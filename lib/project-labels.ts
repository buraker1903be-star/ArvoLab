const PROJECT_TYPES: Record<string, string> = {
  thesis: "Tez",
  article: "Makale",
  project: "Proje",
  "associate-professorship": "Doçentlik dosyası",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Yeni",
  planned: "Planlandı",
  writing: "Yazım aşamasında",
  analysis: "Analiz bekliyor",
  review: "İncelemede",
  revision: "Revizyonda",
  turnitin: "Benzerlik kontrolünde",
  ready: "Teslime hazır",
  delivered: "Teslim edildi",
  archived: "Arşivlendi",
};

export function projectTypeLabel(type: string) {
  return PROJECT_TYPES[type] ?? type;
}

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}
