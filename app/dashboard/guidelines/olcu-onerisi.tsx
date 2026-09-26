import { Lightbulb } from "lucide-react";
import { eksikOlcuOnerileri, olcuEtiketleri, yoneticiVarsayilanlari } from "@/lib/kilavuz-onerisi";
import ActionForm from "../action-form";

/*
  Kılavuzun SÖYLEMEDİĞİ ölçüler için öneri kutusu.

  Tarayıcı bulamadığı ölçüyü artık yazmıyor: ölçü hangi cümleye aitse onun
  kuralı (lib/kilavuz-olcusu.ts). Doğru davranış ama yöneticinin önüne boş
  alan geliyor ve tek bir satır aralığı için on alanlık "Kuralları düzenle"
  penceresini geçerli hâle getirmesi gerekiyordu — atıf sistemi seçiminde
  yaşanan tıkanmanın aynısı.

  Kutu bir KURAL sunmuyor, başlangıç noktası sunuyor: kutular boş gelir,
  yönetici işaretlemeden hiçbir şey yazılmaz, her önerinin yanında değerin
  nereden geldiği yazar. Yazılanlar da kılavuzdan çıkarılmış gibi
  görünmez; aşağıdaki şerit hangilerinin elle doldurulduğunu söyler.
*/
export default function OlcuOnerisi({
  kurallar,
  kilavuzAdi,
  islem,
  duzenlenebilir,
}: {
  kurallar: Record<string, unknown> | null | undefined;
  kilavuzAdi: string;
  islem: (formData: FormData) => Promise<{ error?: string; success?: boolean; message?: string } | undefined>;
  /** Ortak katalog kaydında yalnızca bilgi gösterilir, form gösterilmez. */
  duzenlenebilir: boolean;
}) {
  const oneriler = eksikOlcuOnerileri(kurallar);
  const elleYazilan = yoneticiVarsayilanlari(kurallar);
  if (!oneriler.length && !elleYazilan.length) return null;

  return (
    <div className="olcu-onerisi">
      {elleYazilan.length ? (
        /*
          Elle doldurulan alan, belgeden çıkarılmış alanla aynı görünmemeli:
          yönetici bir sonraki incelemede neye güvenebileceğini bilsin.
        */
        <p className="olcu-onerisi-iz">
          Kılavuzda bulunmayıp elle doldurulan ölçüler: <strong>{olcuEtiketleri(elleYazilan)}</strong>
        </p>
      ) : null}

      {oneriler.length ? (
        <>
          <p className="olcu-onerisi-baslik">
            <Lightbulb size={14} aria-hidden="true" />
            Bu kılavuz {oneriler.length === 1 ? "bir ölçüyü" : `${oneriler.length} ölçüyü`} yazmıyor.
            Aşağıdakiler Türkiye&apos;de olağan değerler — kılavuzun kuralı değil, başlangıç noktası.
          </p>
          {duzenlenebilir ? (
            <ActionForm action={islem} className="olcu-onerisi-form">
              <fieldset>
                <legend className="sr-only">{kilavuzAdi} için eksik ölçüler</legend>
                {oneriler.map((oneri) => (
                  <label key={oneri.anahtar} className="olcu-onerisi-secim checkbox-label">
                    <input type="checkbox" name="olcu" value={oneri.anahtar} />
                    <span>
                      <strong>{oneri.etiket}: {oneri.gosterim}</strong>
                      <span className="muted text-sm">{oneri.gerekce}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button type="submit" className="projects-filter-button button-compact">
                Seçilenleri yaz
              </button>
            </ActionForm>
          ) : (
            <ul className="olcu-onerisi-liste">
              {oneriler.map((oneri) => (
                <li key={oneri.anahtar}>
                  <strong>{oneri.etiket}:</strong> {oneri.gosterim}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
