"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

// Next hata sınırına prop'u "reset" adıyla geçirir; "retry" diye okununca
// undefined oluyor ve tek kurtarma düğmesi tıklanınca TypeError fırlatıyordu.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useCeviri();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="dashboard-page">
      <section className="project-form-card dashboard-state-card" role="alert">
        <h1>{t({ tr: "Bu sayfa yüklenirken bir sorun oluştu", en: "Something went wrong while loading this page" })}</h1>
        <p>
          {t({
            tr: `Geçici bir hata olabilir. Tekrar deneyin; sorun sürerse Destek sayfasından bize bildirin${error.digest ? ` (hata kodu: ${error.digest})` : ""}.`,
            en: `It may be a temporary error. Try again; if it persists, let us know from the Support page${error.digest ? ` (error code: ${error.digest})` : ""}.`,
          })}
        </p>
        <button type="button" className="projects-primary-button" onClick={() => reset()}>
          <RotateCcw size={15} aria-hidden="true" />
          {t({ tr: "Tekrar dene", en: "Try again" })}
        </button>
      </section>
    </main>
  );
}
