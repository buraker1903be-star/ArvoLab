export default function DashboardLoading() {
  return (
    <main className="dashboard-page" aria-busy="true">
      <div className="dashboard-loading" role="status">
        <span className="dashboard-loading-spinner" aria-hidden="true" />
        Yükleniyor…
      </div>
    </main>
  );
}
