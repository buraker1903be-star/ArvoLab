/*
  DENEME SÜRESİNDE ASİSTAN HAKKI (02.11.2026, kurum sahibinin kararı:
  "deneme süresinde 2 adet deneme yapabilecek şekilde kredi verilsin,
  2 denemeden sonra kilitlensin, ödeme ekranına yönlendirilsin").

  Yalnızca ASİSTAN kilitlenir (kurum sahibinin seçimi): editör, kaynaklar
  ve analiz deneme boyunca açık kalır, kullanıcı ürünü tanımaya devam
  eder; dış maliyet üreten tek şey asistan. Deneme süresi bitince bütün
  panel zaten abonelik kapısıyla kapanıyor (lib/access.ts).

  Hak SAYIYLA ölçülür, kredi (karakter) ile değil: kullanıcıya "2 deneme"
  dendi; uzun bir kaynakça denetimi ile kısa bir analiz yorumu aynı
  hakkı yer. Sayılan yalnızca tamamlanmış çalışmalar: sayı denetiminin
  düşürdüğü (rejected) ya da hata veren (failed) çalışma kullanıcıya
  hiçbir şey göstermedi, hakkını yakmamalı.

  Kurum üyesi ve iç ekip bu kuralın dışında: onların kredisi kurumdan.

  Saf modül; testi tests/unit/deneme-hakki.test.ts.
*/
import type { Dil } from "@/lib/dil";

export const DENEME_ASISTAN_HAKKI = 2;

export type DenemeHakkiGirdisi = {
  /** lib/access.ts AccessState.kind */
  tur: string;
  /** ArvoOS'un abonelik durumu */
  durum: string;
  /** Kullanıcının tamamlanmış asistan çalışması sayısı; okunamadıysa null. */
  kullanilan: number | null;
};

export type DenemeHakki =
  | { denemede: false }
  | { denemede: true; kalan: number; engel: string | null };

export function denemeHakki(girdi: DenemeHakkiGirdisi, dil: Dil = "tr"): DenemeHakki {
  if (girdi.tur !== "individual" || girdi.durum !== "trialing") return { denemede: false };
  /* Sayı okunamazsa engel YOK (AGENTS.md: kapıyı yalnızca net bir "hayır"
     kapatır). Bedeli en kötü ihtimalle bir çalışma fazladan. */
  if (girdi.kullanilan === null) return { denemede: true, kalan: DENEME_ASISTAN_HAKKI, engel: null };
  const kalan = Math.max(0, DENEME_ASISTAN_HAKKI - girdi.kullanilan);
  return {
    denemede: true,
    kalan,
    engel: kalan > 0
      ? null
      : dil === "en"
        ? `You've used your ${DENEME_ASISTAN_HAKKI} free assistant runs for the trial. Start your subscription to keep using the assistant.`
        : `Deneme süresindeki ${DENEME_ASISTAN_HAKKI} ücretsiz asistan hakkınızı kullandınız. Asistanı kullanmaya devam etmek için aboneliğinizi başlatın.`,
  };
}
