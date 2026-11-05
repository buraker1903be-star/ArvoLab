"use client";

import type { TextDiff } from "@/lib/text-diff";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  METİN FARKI — Sürümler penceresi ve yazım asistanının önerisi (Signature
  OS 4.3, 05.11.2026). Eskiden yalnızca Sürümler penceresinde vardı
  (ComparePanel); asistanın "Akademikleştir / Kısalt / Genişlet" önerisi
  ise yalnızca YENİ metni gösteriyordu ve öğrenci neyin değiştiğini
  satır satır kendisi karşılaştırmak zorundaydı. Hesap lib/text-diff.ts'te
  (paragraf ve kelime düzeyi, testli); burası yalnızca çizer.

  Yalnızca ARAYÜZ: fark belgeye, kayda, sürümlere ve çıktılara girmez.

  Ekran okuyucu: <del>/<ins> çoğu okuyucuda sessiz geçiyor; her parçanın
  başında görünmez "silindi:" / "eklendi:" öneki var. Renk tek başına
  anlam taşımaz: silinen üstü çizili, eklenen altı vurgulu.
*/
export default function MetinFarki({ fark, enFazla = 400, kompakt = false }: { fark: TextDiff; enFazla?: number; kompakt?: boolean }) {
  const t = useCeviri();
  const silindi = <span className="sr-only">{t({ tr: "silindi: ", en: "deleted: " })}</span>;
  const eklendi = <span className="sr-only">{t({ tr: "eklendi: ", en: "added: " })}</span>;
  return (
    <>
      <ol className={kompakt ? "diff-list is-kompakt" : "diff-list"} aria-label={t({ tr: "Değişiklikler", en: "Changes" })}>
        {fark.blocks.slice(0, enFazla).map((blok, i) =>
          blok.kind === "same" ? (
            <li key={i} className="diff-same">
              {t({ tr: `… ${blok.count} paragraf aynı …`, en: `… ${blok.count} paragraphs unchanged …` })}
            </li>
          ) : blok.kind === "added" ? (
            <li key={i} className="diff-added">
              <ins>
                {eklendi}
                {blok.text}
              </ins>
            </li>
          ) : blok.kind === "removed" ? (
            <li key={i} className="diff-removed">
              <del>
                {silindi}
                {blok.text}
              </del>
            </li>
          ) : (
            <li key={i} className="diff-changed">
              {blok.parts.map((parca, j) =>
                parca.type === "same" ? (
                  <span key={j}>{parca.text}</span>
                ) : parca.type === "added" ? (
                  <ins key={j}>
                    {eklendi}
                    {parca.text}
                  </ins>
                ) : (
                  <del key={j}>
                    {silindi}
                    {parca.text}
                  </del>
                ),
              )}
            </li>
          ),
        )}
      </ol>
      {fark.blocks.length > enFazla ? (
        <p className="muted text-sm">{t({ tr: `İlk ${enFazla} fark gösteriliyor.`, en: `Showing the first ${enFazla} differences.` })}</p>
      ) : null}
    </>
  );
}
