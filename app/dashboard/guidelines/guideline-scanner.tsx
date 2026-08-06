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
    <section className="project-form-card" style={{ marginBottom: 24 }}>
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

      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://sbe.ornek.edu.tr/tez-yazim-kilavuzu.pdf"
          style={{
            flex: 1,
            height: 46,
            padding: "0 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            fontSize: 13,
          }}
        />
        <button
          type="button"
          className="projects-primary-button"
          onClick={handleScan}
          disabled={loading || !url.trim()}
        >
          <Radar size={16} />
          {loading ? "Taranıyor..." : "Tara"}
        </button>
      </div>

      {error && (
        <p className="login-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 16, fontSize: 13 }}>
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
            <div style={{ marginTop: 8 }}>
              <strong>Tespit edilen olası bölüm başlıkları:</strong>
              <p style={{ marginTop: 4, color: "var(--muted-foreground)" }}>
                {result.suggestedSections.join(", ")}
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Bu listeyi kopyalayıp aşağıdaki formdaki &quot;Zorunlu bölümler&quot;
                alanına yapıştırabilirsiniz. Tespit edilemeyen ama kılavuzda
                geçen bölümler olabilir — metin önizlemesini kontrol edin.
              </p>
            </div>
          ) : (
            <p style={{ color: "var(--warning)" }}>
              Otomatik olarak bölüm başlığı tespit edilemedi. Aşağıdaki metin
              önizlemesinden elle inceleyip formu doldurun.
            </p>
          )}

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              Çıkarılan metnin ilk kısmını göster
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: "var(--surface-muted)",
                borderRadius: 10,
                fontSize: 11,
                whiteSpace: "pre-wrap",
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {result.textPreview}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
