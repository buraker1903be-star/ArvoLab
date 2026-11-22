"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateLiteratureNotes } from "@/app/actions/literature";
import { showToast } from "../_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  KAYNAK NOTU (22.11.2026).

  Not SAHTE DEĞİL: `literature_sources.notes` sütununda, kaynağın kendi
  kaydında duruyor ve Literatür penceresindeki düzenleme formunda yıllardır
  aynı alanı yazıyor. Yeni tablo ya da politika eklenmedi; erişim kuralı da
  aynı — RLS yalnızca kaydın sahibine yazdırıyor, sunucu eylemi ayrıca
  owner_id süzüyor (app/actions/literature.ts).

  Kaydetme AÇIK bir eylem: kendiliğinden kaydeden bir kutu, öğrencinin
  yarım bıraktığı cümleyi de kaydeder ve "kaydedildi mi" sorusunu
  cevapsız bırakır. Kaydedilmemiş değişiklik varken durum satırı bunu
  söylüyor ve Ctrl/Cmd+S de kaydediyor.
*/
export default function KaynakNotlari({
  kaynakId,
  baslangic,
  onKaydedildi,
}: {
  kaynakId: string;
  baslangic: string;
  onKaydedildi: () => void;
}) {
  const t = useCeviri();
  const [deger, setDeger] = useState(baslangic);
  const [kayitli, setKayitli] = useState(baslangic);
  const [bekliyor, basla] = useTransition();
  const alanRef = useRef<HTMLTextAreaElement>(null);

  /*
    Kaynak değişince bileşen `key` ile yeniden kuruluyor (kaynak-paneli.tsx
    → kaynak-alani.tsx), bu yüzden `baslangic`'i izleyen bir etki YOK:
    etkiyle senkronlamak, kullanıcı yazarken gelen bir tazelemede yazdığını
    silebilirdi.
  */
  const degisti = deger !== kayitli;

  const kaydet = () => {
    if (!degisti || bekliyor) return;
    const gonderilen = deger;
    basla(async () => {
      const sonuc = await updateLiteratureNotes(kaynakId, gonderilen);
      if (sonuc.error) return showToast("error", sonuc.error);
      setKayitli(gonderilen);
      showToast("success", t({ tr: "Not kaydedildi.", en: "Note saved." }));
      onKaydedildi();
    });
  };

  return (
    <div className="kaynak-panel-notlar">
      <label className="sr-only" htmlFor={`kaynak-not-${kaynakId}`}>
        {t({ tr: "Bu kaynakla ilgili notlarınız", en: "Your notes about this source" })}
      </label>
      <textarea
        id={`kaynak-not-${kaynakId}`}
        ref={alanRef}
        value={deger}
        maxLength={20000}
        onChange={(e) => setDeger(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            kaydet();
          }
        }}
        placeholder={t({
          tr: "Bu kaynakla ilgili kendi notlarınız: hangi bölümde işinize yarayacak, hangi bulgusu tartışmalı, nereye not düştünüz…",
          en: "Your own notes about this source: which section it serves, which finding is contested, where you flagged it…",
        })}
      />
      <div className="kaynak-not-alt">
        <span role="status" aria-live="polite">
          {bekliyor
            ? t({ tr: "Kaydediliyor…", en: "Saving…" })
            : degisti
              ? t({ tr: "Kaydedilmemiş değişiklik var.", en: "You have unsaved changes." })
              : kayitli
                ? t({ tr: "Kaydedildi.", en: "Saved." })
                : t({ tr: "Bu kaynak için henüz not yok.", en: "No notes for this source yet." })}
        </span>
        <button type="button" className="projects-primary-button button-compact" disabled={!degisti || bekliyor} onClick={kaydet}>
          {bekliyor ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
          {t({ tr: "Notu kaydet", en: "Save note" })}
        </button>
      </div>
    </div>
  );
}
