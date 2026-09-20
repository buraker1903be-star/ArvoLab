import { TriangleAlert } from "lucide-react";
import type { GuidelineCikarimi } from "@/app/actions/guidelines";
import { trTarihSaat } from "@/lib/tr-time";

/*
  Otomatik çıkarımın özeti: yönetici neye dayanarak onayladığını görsün.

  Eskiden bu bilgi hiç gösterilmiyordu. Kılavuz gece indiriliyor, kuralları
  kural tabanlı çıkarımla dolduruluyor (lib/guideline-scan.ts), sonra
  yöneticinin önüne yalnızca "Onayla ve uygula" düğmesi konuyordu. Yönetici
  güven puanını, çıkarımın uyarılarını ve belgenin gerçekten o kılavuz olup
  olmadığını göremediği için düğme körlemesine tıklanıyordu — ya da hiç
  tıklanmıyordu: canlıda 18 kılavuzun tamamı aylarca onaysız bekledi.

  Güven puanı renkle DEĞİL, eşiğin adıyla da söylenir.
*/

const GUVEN_ETIKETI = (oran: number) =>
  oran >= 0.9 ? "yüksek" : oran >= 0.6 ? "orta" : "düşük";

const GUVEN_TONU = (oran: number) => (oran >= 0.9 ? "success" : oran >= 0.6 ? "warning" : "danger");

export default function CikarimOzeti({ cikarim }: { cikarim: GuidelineCikarimi | null }) {
  // Hiç taranmamış kayıtta boş bir kutu göstermek yer kaplamaktan ibaret olurdu.
  if (!cikarim || typeof cikarim.confidence !== "number") return null;

  const guven = cikarim.confidence;
  const uyarilar = cikarim.warnings ?? [];

  return (
    <div className="cikarim-ozeti">
      <div className="cikarim-satir">
        <span className="chip" data-tone={GUVEN_TONU(guven)}>
          Çıkarım güveni: %{Math.round(guven * 100)} ({GUVEN_ETIKETI(guven)})
        </span>
        {cikarim.detectedCitationHint ? (
          <span className="chip">Algılanan sistem: {cikarim.detectedCitationHint}</span>
        ) : (
          /* Atıf sistemi algılanmadıysa yönetici elle seçmeli; bu bir eksiktir,
             sessizce geçilmemeli. */
          <span className="chip" data-tone="warning">Atıf sistemi algılanamadı</span>
        )}
        {typeof cikarim.fullTextLength === "number" ? (
          <span className="chip">{cikarim.fullTextLength.toLocaleString("tr-TR")} karakter okundu</span>
        ) : null}
        {cikarim.detectedAt ? (
          <span className="muted text-sm">Son tarama: {trTarihSaat(cikarim.detectedAt)}</span>
        ) : null}
      </div>

      {uyarilar.length ? (
        <ul className="cikarim-uyarilar">
          {uyarilar.map((uyari) => (
            <li key={uyari}>
              <TriangleAlert size={14} aria-hidden="true" />
              {uyari}
            </li>
          ))}
        </ul>
      ) : null}

      {cikarim.textPreview ? (
        <details className="sayfa-detay">
          <summary>Belgeden okunan metin</summary>
          {/* Doğru belge mi? Onaylamadan önce bakılacak tek şey bu. */}
          <p className="cikarim-onizleme">{cikarim.textPreview}</p>
        </details>
      ) : null}
    </div>
  );
}
