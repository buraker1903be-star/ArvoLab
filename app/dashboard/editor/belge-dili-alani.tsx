"use client";

import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { BELGE_DILLERI } from "@/lib/belge-dili";
import type { Dil } from "@/lib/dil";

/*
  BELGE DİLİ ALANI (19.11.2026, K1-A). Yeni çalışma penceresi ve "Bilgileri
  düzenle" formu aynı alanı çizer; desteklenen diller ve açıklama tek yerde.

  Desteklenen diller açıkça yazılır: yalnızca Türkçe ve İngilizce, çünkü
  belgenin kendi etiketleri (şekil/tablo, içindekiler, kapak, atıf
  biçimindeki "vd./et al.") bu iki dilde var. Metin ÇEVRİLMEZ; alan bunu
  vaat etmemeli.

  Yeni çalışmada arayüz dili ÖNERİLİR (seçili gelir) ve kullanıcı
  değiştirebilir; seçilen değer kaydedilir, sonradan arayüz dili
  değişince belge dili değişmez. Düzenleme formunda eski (seçilmemiş)
  çalışmalar "Seçilmedi" ile açılır: değer kullanıcı seçmeden yazılmaz.
*/
const ADLAR: Record<Dil, string> = { tr: "Türkçe", en: "English" };

export default function BelgeDiliAlani({ varsayilan, yeni = false }: { varsayilan?: string | null; yeni?: boolean }) {
  const t = useCeviri();
  const arayuz = useDil();
  const baslangic = yeni ? arayuz : (varsayilan ?? "");
  return (
    <label>
      <span>{t({ tr: "Belge dili", en: "Document language" })}</span>
      <select name="belgeDili" defaultValue={baslangic}>
        {yeni ? null : (
          <option value="">{t({ tr: "Seçilmedi (arayüz dilini izler)", en: "Not set (follows the interface language)" })}</option>
        )}
        {BELGE_DILLERI.map((dil) => (
          <option key={dil} value={dil}>
            {ADLAR[dil]}
          </option>
        ))}
      </select>
      <small className="muted text-sm">
        {t({
          tr: "Şekil ve tablo etiketleri, içindekiler, kapak ve atıf biçimi bu dilde yazılır. Desteklenen: Türkçe, İngilizce. Metniniz çevrilmez.",
          en: "Figure and table captions, the table of contents, the cover and citation format use this language. Supported: Turkish, English. Your text is not translated.",
        })}
      </small>
    </label>
  );
}
