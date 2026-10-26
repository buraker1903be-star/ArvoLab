/*
  Kaynak formunun alanları ve etiketler. İki yerde kullanılıyor: Literatür
  sayfası ve Çalışmalarım'daki durum kartından açılan Literatür penceresi
  (literatur-penceresi.tsx). Alanlar iki yerde ayrı yazılsaydı biri yeni
  bir alan alır, öteki eksik kalırdı.
*/

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  article: "Makale",
  book: "Kitap",
  chapter: "Kitap bölümü",
  thesis: "Tez",
  report: "Rapor",
  website: "İnternet kaynağı",
  other: "Diğer",
};

export const STATUS_LABELS: Record<string, string> = {
  to_review: "İncelenecek",
  read: "Okundu",
  used: "Kullanıldı",
};

export type KaynakDegerleri = {
  title?: string | null;
  authors?: string | null;
  year?: string | number | null;
  source_type?: string | null;
  doi_or_url?: string | null;
  container_title?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
  notes?: string | null;
};

/**
 * Künye alanları (başlıktan yayınevine). Notlar ayrı: formun sonunda durur.
 *
 * `kisa`: öğrencinin bildiği dört alan (başlık, yazar, yıl, DOI/adres)
 * açıkta, gerisi "Yayın bilgileri" altında. On alanlık form "elimdeki
 * kaynağı ekleyeyim" diyen öğrenciyi korkutuyordu; DOI varsa editör eksik
 * bilgileri zaten kendisi dolduruyor.
 */
export function KunyeAlanlari({ kaynak, kisa = false }: { kaynak?: KaynakDegerleri; kisa?: boolean }) {
  const yeni = !kaynak;
  const temel = (
    <>
      <label className="project-form-full">
        <span>Başlık</span>
        <input name="title" type="text" placeholder={yeni ? "Kaynağın başlığı" : undefined} defaultValue={kaynak?.title ?? undefined} required />
      </label>
      <label>
        <span>Yazar(lar)</span>
        <input name="authors" type="text" placeholder={yeni ? "Yılmaz, A. ve Demir, B." : undefined} defaultValue={kaynak?.authors ?? undefined} />
      </label>
      <label>
        <span>Yıl</span>
        <input name="year" type="text" inputMode="numeric" placeholder={yeni ? "2023" : undefined} defaultValue={kaynak?.year ?? undefined} />
      </label>
      <label>
        <span>DOI / URL</span>
        <input name="doiOrUrl" type="text" placeholder={yeni ? "https://doi.org/..." : undefined} defaultValue={kaynak?.doi_or_url ?? undefined} />
      </label>
    </>
  );
  const ayrinti = (
    <>
      <label>
        <span>Kaynak türü</span>
        <select name="sourceType" defaultValue={kaynak?.source_type ?? "article"}>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {/* Yayın bilgileri: kaynakça girdisi eksiksiz olsun (editörde DOI ile otomatik de dolar) */}
      <label className="project-form-full">
        <span>Dergi / kitap adı{yeni ? " (opsiyonel)" : ""}</span>
        <input name="containerTitle" type="text" placeholder={yeni ? "Makale için dergi, bölüm için kitap adı" : undefined} defaultValue={kaynak?.container_title ?? undefined} />
      </label>
      <label>
        <span>Cilt</span>
        <input name="volume" type="text" defaultValue={kaynak?.volume ?? undefined} />
      </label>
      <label>
        <span>Sayı</span>
        <input name="issue" type="text" defaultValue={kaynak?.issue ?? undefined} />
      </label>
      <label>
        <span>Sayfalar</span>
        <input name="pages" type="text" placeholder={yeni ? "45–67" : undefined} defaultValue={kaynak?.pages ?? undefined} />
      </label>
      <label>
        <span>Yayınevi</span>
        <input name="publisher" type="text" defaultValue={kaynak?.publisher ?? undefined} />
      </label>
    </>
  );
  if (!kisa) return (
    <>
      {temel}
      {ayrinti}
    </>
  );
  return (
    <>
      {temel}
      <details className="form-details project-form-full">
        <summary>Yayın bilgileri (isteğe bağlı)</summary>
        <div className="project-form-grid mt-sm">{ayrinti}</div>
      </details>
    </>
  );
}

export function NotAlani({ kaynak }: { kaynak?: KaynakDegerleri }) {
  return (
    <label className="project-form-full">
      <span>Notlar</span>
      <textarea name="notes" rows={3} placeholder={kaynak ? undefined : "Kaynakla ilgili kendi notlarınız"} defaultValue={kaynak?.notes ?? undefined} />
    </label>
  );
}
