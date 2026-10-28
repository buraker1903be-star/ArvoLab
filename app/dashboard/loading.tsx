// Sayfa verisi gelirken içerik iskeleti (hızlı açılan sayfada bir anlık
// yanıp sönmesin diye kısa gecikmeyle belirir; bkz. .skeleton-wrap).
import { ceviri } from "@/lib/dil-sunucu";

export default async function DashboardLoading() {
  const t = await ceviri();
  return (
    <main className="dashboard-page" aria-busy="true">
      <div className="skeleton-wrap" role="status">
        <span className="sr-only">{t({ tr: "Yükleniyor…", en: "Loading…" })}</span>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton-grid">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="skeleton skeleton-card" />
          ))}
        </div>
      </div>
    </main>
  );
}
