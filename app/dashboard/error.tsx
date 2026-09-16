"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

// Next hata sınırına prop'u "reset" adıyla geçirir; "retry" diye okununca
// undefined oluyor ve tek kurtarma düğmesi tıklanınca TypeError fırlatıyordu.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
        <button type="button" className="projects-primary-button" onClick={() => reset()}>
          <RotateCcw size={15} aria-hidden="true" />
          Tekrar dene
        </button>
      </section>
    </main>
  );
}
