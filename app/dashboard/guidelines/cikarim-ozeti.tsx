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

export default function CikarimOzeti({
  cikarim,
  kayitliStil,
}: {
  cikarim: GuidelineCikarimi | null;
  /** Kayıtta duran atıf sistemi; çıkarımla karşılaştırılır. */
  kayitliStil?: string;
}) {
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
          /*
            Atıf sistemi algılanmadıysa yönetici elle seçmeli. Kayıtta bir
            değer DURUYOR olabilir (varsayılan ya da eski, hatalı çıkarımdan
            kalma) ve yeniden tarama onu bozmuyor — doğru davranış ama
            sessiz kalırsa yönetici aynı yanlışı tekrar onaylar. Canlıda
            oldu: Başkent "vancouver", Çukurova "chicago" olarak onaylıydı,
            oysa belgeler hiçbir sistemi benimsemiyor.
          */
          <>
            <span className="chip" data-tone="danger">
              Atıf sistemi belgede bulunamadı{kayitliStil ? ` — kayıttaki "${kayitliStil}" DOĞRULANMADI` : ""}
            </span>
            {/*
              Kararı yönetici verecek; verebilmesi için KANITI görmeli.
              Eskiden sayımlar hesaplanıp atılıyordu ve ekranda yalnızca
              "bulunamadı" kalıyordu: "APA iki kez geçiyor, başka ad yok"
              ile "hiçbir ad geçmiyor" aynı görünüyordu. Birincisi bir
              bakışlık karar, ikincisi belgeyi açmayı gerektiriyor.
            */}
            {cikarim.citationMentions?.length ? (
              <span className="chip" data-tone="warning">
                Metinde geçenler:{" "}
                {cikarim.citationMentions.map((g) => `${g.etiket} ×${g.sayim}`).join(" · ")} — net kazanan yok
              </span>
            ) : cikarim.citationMentions ? (
              <span className="chip" data-tone="warning">Belgede hiçbir sistem adı geçmiyor</span>
            ) : null}
          </>
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
