// Sayfa verisi gelirken içerik iskeleti (hızlı açılan sayfada bir anlık
// yanıp sönmesin diye kısa gecikmeyle belirir; bkz. .skeleton-wrap).
export default function DashboardLoading() {
  return (
    <main className="dashboard-page" aria-busy="true">
      <div className="skeleton-wrap" role="status">
        <span className="sr-only">Yükleniyor…</span>
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
