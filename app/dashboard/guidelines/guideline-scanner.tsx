"use client";

import { useState } from "react";
import { Radar } from "lucide-react";
import { runGuidelineScan } from "@/app/actions/guideline-scan";
import type { GuidelineScanResult } from "@/lib/guideline-scan";

export default function GuidelineScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuidelineScanResult | null>(null);

  async function handleScan() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runGuidelineScan(url);
      if (res.error) {
        setError(res.error);
      } else if (res.result) {
        setResult(res.result);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="project-form-card mb-lg">
      <div className="project-form-heading">
        <h2>Kılavuz Tarama Aracı (Yarı Otomatik)</h2>
        <p>
          Bir üniversitenin resmî tez yazım kılavuzu sayfasının veya PDF&apos;inin
          bağlantısını girin; sistem metni çıkarır ve olası bölüm başlıklarını
          önerir. <strong>Hiçbir şeyi otomatik olarak uygulamaz</strong> —
          önerileri gördükten sonra aşağıdaki &quot;Yeni Kılavuz Ekle&quot;
          formuna kendiniz aktarırsınız.
        </p>
      </div>

      <div className="project-card-main">
        <div>
          {/* Eskiden yalnızca placeholder vardı: ekran okuyucu alanın ne
              istediğini söyleyemiyordu, yazmaya başlayınca ipucu da
              kayboluyordu. */}
          <label className="sr-only" htmlFor="kilavuz-adresi">
            Kılavuz PDF adresi
          </label>
          <input
            id="kilavuz-adresi"
            type="url"
            className="field-control"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://sbe.ornek.edu.tr/tez-yazim-kilavuzu.pdf"
          />
        </div>
        <button
          type="button"
          className="projects-primary-button"
          onClick={handleScan}
          disabled={loading || !url.trim()}
        >
          <Radar size={16} aria-hidden="true" />
          {loading ? "Taranıyor..." : "Tara"}
        </button>
      </div>

      {error && (
        <p className="alert mt-sm" data-tone="danger" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-md text-base">
          <p>
            <strong>{result.fullTextLength.toLocaleString("tr-TR")}</strong> karakter
            metin çıkarıldı.
          </p>

          {result.detectedCitationHint && (
            <p>
              Metinde <strong>{result.detectedCitationHint}</strong> ifadesine
              rastlandı — kaynakça sistemi bu olabilir.
            </p>
          )}

          {result.suggestedSections.length > 0 ? (
            <div className="mt-sm">
              <strong>Tespit edilen olası bölüm başlıkları:</strong>
              <p className="muted">
                {result.suggestedSections.join(", ")}
              </p>
              <p className="hint">
                Bu listeyi kopyalayıp aşağıdaki formdaki &quot;Zorunlu bölümler&quot;
                alanına yapıştırabilirsiniz. Tespit edilemeyen ama kılavuzda
                geçen bölümler olabilir — metin önizlemesini kontrol edin.
              </p>
            </div>
          ) : (
            <p className="tone-text" data-tone="warning">
              Otomatik olarak bölüm başlığı tespit edilemedi. Aşağıdaki metin
              önizlemesinden elle inceleyip formu doldurun.
            </p>
          )}

          <details className="guideline-review-details">
            <summary>
              Çıkarılan metnin ilk kısmını göster
            </summary>
            <pre className="raw-text-box">
              {result.textPreview}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
