"use client";

import { teslimTarihiKaydet } from "@/app/actions/tez-takvimi";
import ActionForm from "../action-form";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  TESLİM TARİHİ YERİNDE (28.10.2026). Eskiden ana sayfa ve Çalışmalarım
  kartı "Teslim tarihi girilmedi — çalışma ayarlarından ekleyin" diyor ve
  öğrenciyi ayrı bir forma gönderiyordu; çoğu girmiyordu ve teslime kalan
  gün, yazım temposu ve takvim hiç hesaplanmıyordu. Şimdi tarih orada
  seçilip kaydediliyor.
*/
export default function TeslimTarihiFormu({ projectId, bugun }: { projectId: string; bugun: string }) {
  const t = useCeviri();
  return (
    <ActionForm
      action={teslimTarihiKaydet.bind(null, projectId)}
      className="teslim-tarihi-formu"
      successMessage={t({ tr: "Teslim tarihi kaydedildi.", en: "Due date saved." })}
    >
      <input type="date" name="teslimTarihi" min={bugun} required aria-label={t({ tr: "Teslim tarihi", en: "Due date" })} />
      <button type="submit" className="projects-filter-button button-compact">
        {t({ tr: "Kaydet", en: "Save" })}
      </button>
    </ActionForm>
  );
}
