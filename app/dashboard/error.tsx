"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="dashboard-page">
      <section className="project-form-card dashboard-state-card" role="alert">
        <h1>Bu sayfa yüklenirken bir sorun oluştu</h1>
        <p>
          Geçici bir hata olabilir. Tekrar deneyin; sorun sürerse &quot;Uygulama Destek Talep&quot; sayfasından bize
          bildirin{error.digest ? ` (hata kodu: ${error.digest})` : ""}.
        </p>
        <button type="button" className="projects-primary-button" onClick={() => retry()}>
          <RotateCcw size={15} />
          Tekrar dene
        </button>
      </section>
    </main>
  );
}
