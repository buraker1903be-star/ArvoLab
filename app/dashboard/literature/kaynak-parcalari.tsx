"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";

/*
  Kaynak formunun alanları ve etiketler. İki yerde kullanılıyor: Literatür
  sayfası ve Çalışmalarım'daki durum kartından açılan Literatür penceresi
  (literatur-penceresi.tsx). Alanlar iki yerde ayrı yazılsaydı biri yeni
  bir alan alır, öteki eksik kalırdı.
*/

/*
  İstemci bileşeni (28.10.2026, İngilizce): etiketler kullanıcının dilinde
  ve dil istemcide useCeviri ile okunuyor. Sunucu bileşeni (Literatür
  penceresi) bu bileşenleri çizebiliyor; yalnızca haritaları doğrudan
  okuyamaz — okuyan da yok.
*/
export const SOURCE_TYPE_LABELS: Record<string, Metin> = {
  article: { tr: "Makale", en: "Journal article" },
  book: { tr: "Kitap", en: "Book" },
  chapter: { tr: "Kitap bölümü", en: "Book chapter" },
  thesis: { tr: "Tez", en: "Thesis" },
  report: { tr: "Rapor", en: "Report" },
  website: { tr: "İnternet kaynağı", en: "Website" },
  other: { tr: "Diğer", en: "Other" },
};

export const STATUS_LABELS: Record<string, Metin> = {
  to_review: { tr: "İncelenecek", en: "To review" },
  read: { tr: "Okundu", en: "Read" },
  used: { tr: "Kullanıldı", en: "Used" },
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
  const t = useCeviri();
  const yeni = !kaynak;
  const temel = (
    <>
      <label className="project-form-full">
        <span>{t({ tr: "Başlık", en: "Title" })}</span>
        <input name="title" type="text" placeholder={yeni ? t({ tr: "Kaynağın başlığı", en: "Title of the source" }) : undefined} defaultValue={kaynak?.title ?? undefined} required />
      </label>
      <label>
        <span>{t({ tr: "Yazar(lar)", en: "Author(s)" })}</span>
        <input name="authors" type="text" placeholder={yeni ? t({ tr: "Yılmaz, A. ve Demir, B.", en: "Smith, A., & Jones, B." }) : undefined} defaultValue={kaynak?.authors ?? undefined} />
      </label>
      <label>
        <span>{t({ tr: "Yıl", en: "Year" })}</span>
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
        <span>{t({ tr: "Kaynak türü", en: "Source type" })}</span>
        <select name="sourceType" defaultValue={kaynak?.source_type ?? "article"}>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
      </label>
      {/* Yayın bilgileri: kaynakça girdisi eksiksiz olsun (editörde DOI ile otomatik de dolar) */}
      <label className="project-form-full">
        <span>{t({ tr: "Dergi / kitap adı", en: "Journal / book title" })}{yeni ? t({ tr: " (opsiyonel)", en: " (optional)" }) : ""}</span>
        <input name="containerTitle" type="text" placeholder={yeni ? t({ tr: "Makale için dergi, bölüm için kitap adı", en: "Journal for an article, book title for a chapter" }) : undefined} defaultValue={kaynak?.container_title ?? undefined} />
      </label>
      <label>
        <span>{t({ tr: "Cilt", en: "Volume" })}</span>
        <input name="volume" type="text" defaultValue={kaynak?.volume ?? undefined} />
      </label>
      <label>
        <span>{t({ tr: "Sayı", en: "Issue" })}</span>
        <input name="issue" type="text" defaultValue={kaynak?.issue ?? undefined} />
      </label>
      <label>
        <span>{t({ tr: "Sayfalar", en: "Pages" })}</span>
        <input name="pages" type="text" placeholder={yeni ? "45–67" : undefined} defaultValue={kaynak?.pages ?? undefined} />
      </label>
      <label>
        <span>{t({ tr: "Yayınevi", en: "Publisher" })}</span>
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
        <summary>{t({ tr: "Yayın bilgileri (isteğe bağlı)", en: "Publication details (optional)" })}</summary>
        <div className="project-form-grid mt-sm">{ayrinti}</div>
      </details>
    </>
  );
}

export function NotAlani({ kaynak }: { kaynak?: KaynakDegerleri }) {
  const t = useCeviri();
  return (
    <label className="project-form-full">
      <span>{t({ tr: "Notlar", en: "Notes" })}</span>
      <textarea name="notes" rows={3} placeholder={kaynak ? undefined : t({ tr: "Kaynakla ilgili kendi notlarınız", en: "Your own notes about the source" })} defaultValue={kaynak?.notes ?? undefined} />
    </label>
  );
}
