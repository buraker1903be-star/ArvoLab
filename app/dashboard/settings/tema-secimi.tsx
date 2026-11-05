"use client";

import { useSyncExternalStore } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { SECENEK } from "@/app/_components/theme-toggle";
import { temaAbone, temaDurumu, temaTercihiniUygula } from "@/app/_components/tema";
import { TEMA_TERCIHLERI, tercihOku, type TemaTercihi } from "@/lib/tema";

/*
  GÖRÜNÜM SEÇİMİ (Signature OS 4.4, 05.11.2026).

  Tema tercihi bugüne kadar yalnızca üst çubuktaki küçük düğmenin
  menüsündeydi; Ayarlar'a "koyu tema nerede" diye gelen kullanıcı orada
  hiçbir şey bulamıyordu. Burası AYNI yolu kullanır
  (temaTercihiniUygula, lib/tema.ts): iki seçici aynı anda açıksa biri
  değişince öteki de güncellenir (useSyncExternalStore, <html>
  özniteliklerini dinler). Yeni bir depolama ya da sunucu kaydı yok.

  Radyo grubu: üç seçenekten tam biri seçili. Ok tuşları seçenekler
  arasında gezer ve seçer (WAI-ARIA radio deseni).
*/
const sunucuDurumu = () => "system";
const istemciDurumu = () => temaDurumu().tercih;

export default function TemaSecimi() {
  const t = useCeviri();
  const tercih = tercihOku(useSyncExternalStore(temaAbone, istemciDurumu, sunucuDurumu));

  const tus = (olay: React.KeyboardEvent<HTMLDivElement>) => {
    const yon = olay.key === "ArrowRight" || olay.key === "ArrowDown" ? 1 : olay.key === "ArrowLeft" || olay.key === "ArrowUp" ? -1 : 0;
    if (!yon) return;
    olay.preventDefault();
    const i = TEMA_TERCIHLERI.indexOf(tercih);
    const yeni = TEMA_TERCIHLERI[(i + yon + TEMA_TERCIHLERI.length) % TEMA_TERCIHLERI.length];
    temaTercihiniUygula(yeni);
    olay.currentTarget.querySelector<HTMLButtonElement>(`[data-tercih="${yeni}"]`)?.focus();
  };

  return (
    <div className="segmented ayar-tema" role="radiogroup" aria-label={t({ tr: "Görünüm", en: "Appearance" })} onKeyDown={tus}>
      {TEMA_TERCIHLERI.map((secenek: TemaTercihi) => {
        const { ad, ipucu, simge: Simge } = SECENEK[secenek];
        const secili = secenek === tercih;
        return (
          <button
            key={secenek}
            type="button"
            role="radio"
            aria-checked={secili}
            tabIndex={secili ? 0 : -1}
            data-tercih={secenek}
            title={ipucu ? t(ipucu) : undefined}
            onClick={() => temaTercihiniUygula(secenek)}
          >
            <Simge size={15} aria-hidden="true" />
            {t(ad)}
          </button>
        );
      })}
    </div>
  );
}
