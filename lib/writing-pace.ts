// Yazım temposu: kılavuzun sayfa hedefine kaç kelime kaldığı ve teslim tarihine göre günde
// kaç kelime yazılması gerektiği. Sayfa başına kelime, sayfa tahminiyle aynı formülden gelir.
import { dueInfo } from "@/lib/due-date";
import { wordsPerPage, type PageEstimateSettings } from "@/lib/page-estimate";
import type { Tone } from "@/lib/status-tone";
import { YEREL, type Dil } from "@/lib/dil";

export interface WritingPace {
  targetWords: number;
  remainingWords: number;
  /** Teslim gününe kalan gün (geçmişse negatif); tarih yoksa ya da iş kapandıysa null */
  daysLeft: number | null;
  perDay: number | null;
  detail: string;
  tone: Tone;
}

export interface WritingPaceInput {
  words: number;
  minPages: number | null;
  maxPages: number | null;
  dueDate?: string | null;
  status?: string | null;
  settings?: PageEstimateSettings;
  now?: Date;
}

// "~18.400 kelime": binin üstü yüzlüğe, altı onluğa yuvarlanır (tahmin olduğu belli olsun)
const roundWords = (n: number) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.max(10, Math.round(n / 10) * 10));
const format = (n: number, dil: Dil) => n.toLocaleString(YEREL[dil]);

export function writingPace(input: WritingPaceInput, dil: Dil = "tr"): WritingPace | null {
  const en = dil === "en";
  // Hedef alt sınırdır (yazım ilerlemesiyle aynı): en az sayfa sayısına ulaşan metin uzunluk bakımından tamamdır.
  const targetPages = input.minPages ?? input.maxPages;
  if (!targetPages || targetPages <= 0) return null;
  const targetWords = Math.round(targetPages * wordsPerPage(input.settings));
  const remainingWords = Math.max(0, targetWords - Math.max(0, input.words));
  const due = dueInfo(input.dueDate, input.status, input.now);
  const daysLeft = due ? due.days : null;
  const base = { targetWords, remainingWords, daysLeft };

  if (remainingWords === 0) return { ...base, perDay: null, detail: en ? "Page target reached." : "Sayfa hedefine ulaşıldı.", tone: "success" };
  const yuvarlak = format(roundWords(remainingWords), dil);
  // İngilizcede "kaldı" cümlenin başına geliyor: "~18,400 words to go".
  const remaining = en ? `~${yuvarlak} words to go` : `Hedefe ~${yuvarlak} kelime`;
  if (daysLeft === null) return { ...base, perDay: null, detail: en ? `${remaining}.` : `${remaining} kaldı.`, tone: "neutral" };
  if (daysLeft < 0) {
    const gecen = -daysLeft;
    return {
      ...base,
      perDay: null,
      detail: en ? `${remaining}; the deadline passed ${gecen} ${gecen === 1 ? "day" : "days"} ago.` : `${remaining} kaldı; teslim tarihi ${gecen} gün önce geçti.`,
      tone: "danger",
    };
  }

  // Bugün teslimse kalanın tamamı bugüne düşer; günlük hedef 50 kelimeye yukarı yuvarlanır.
  const perDay = Math.ceil(remainingWords / Math.max(1, daysLeft) / 50) * 50;
  const when = en
    ? daysLeft === 0 ? "due today" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} until the deadline`
    : daysLeft === 0 ? "teslim bugün" : `teslime ${daysLeft} gün`;
  const tone: Tone = perDay > 2000 ? "danger" : perDay > 1000 ? "warning" : "info";
  return {
    ...base,
    perDay,
    detail: en ? `${remaining} · ${when} · ~${format(perDay, dil)} words a day.` : `${remaining} · ${when} · günde ~${format(perDay, dil)} kelime.`,
    tone,
  };
}
