/*
  Veritabanının yazdığı bildirimlerin İngilizce gösterimi (29.10.2026).

  Bildirimleri tetikleyiciler yazıyor (20260918090000, 20260924100035,
  20260924100007) ve metin TÜRKÇE saklanıyor; zil olduğu gibi gösteriyordu.
  İngilizce arayüzdeki öğrenci "Yeni yorum: …", "Çalışmanızın durumu:
  İncelemede" görüyordu. Çeviri yazıldığı yerde (tetikleyici) yapılmadı:
  kullanıcı dilini değiştirebiliyor ve eski satırlar da çevrilmeli.
  Gösterim anında bilinen kalıplar çevrilir; tanınmayan metin olduğu gibi
  kalır (uydurma çeviri yerine özgün metin).

  Kalıplar tetikleyicilerdeki metinlerle birebir; bir tetikleyici metni
  değişirse burada da değişmeli — tests/unit/bildirim-metni.test.ts
  kalıpları sabitliyor.

  Saf modül.
*/
import type { Dil } from "@/lib/dil";
import { PROJECT_STATUSES, statusLabel } from "@/lib/project-labels";

const SABIT_BASLIKLAR: Record<string, string> = {
  "Size bir çalışma atandı": "A work was assigned to you",
  "Çalışmanıza uzman atandı": "An expert was assigned to your work",
  "Çalışmanız kontrolör onayı aldı": "Your work was approved by the controller",
  "Çalışmanıza tez yazım kılavuzu bağlandı": "A thesis writing guideline was linked to your work",
  "Çalışmanıza uygulanan tez yazım kılavuzu kaldırıldı": "The thesis writing guideline applied to your work was removed",
  "Kılavuzunuzun atıf sistemi değişti": "Your guideline's citation style changed",
  "Tez yazım kılavuzunuzun yeni sürümü onaylandı": "A new version of your thesis writing guideline was approved",
  "Tez yazım kılavuzu onay bekliyor": "A thesis writing guideline is awaiting approval",
};

function durumIngilizce(etiket: string): string {
  const kod = PROJECT_STATUSES.find((s) => statusLabel(s).tr === etiket);
  return kod ? statusLabel(kod).en : etiket;
}

export function bildirimBasligi(baslik: string, dil: Dil): string {
  if (dil !== "en") return baslik;
  if (SABIT_BASLIKLAR[baslik]) return SABIT_BASLIKLAR[baslik];
  if (baslik.startsWith("Yeni yorum: ")) return `New comment: ${baslik.slice("Yeni yorum: ".length)}`;
  if (baslik.startsWith("Çalışmanızın durumu: ")) return `Your work's status: ${durumIngilizce(baslik.slice("Çalışmanızın durumu: ".length))}`;
  return baslik;
}

const KILAVUZ_KALKTI = " — zorunlu bölümler, sayfa sınırı ve sayfa ayarları artık uygulanmıyor.";
const STIL_DEGISTI = /^([\s\S]*) — Atıf sisteminiz (.+) → (.+) olarak güncellendi; kaynakça denetimi artık bu sisteme göre çalışır\.$/;
const KILAVUZ_BEKLIYOR = /^(.+) kılavuzunun kuralları otomatik çıkarıldı; tek adım onayınızı bekliyor\.$/;

export function bildirimGovdesi(govde: string, dil: Dil): string {
  if (dil !== "en") return govde;
  if (govde.startsWith("Bir ekip üyesi: ")) return `A team member: ${govde.slice("Bir ekip üyesi: ".length)}`;
  if (govde.endsWith(KILAVUZ_KALKTI)) {
    return `${govde.slice(0, -KILAVUZ_KALKTI.length)} — required sections, page limits and page settings no longer apply.`;
  }
  const stil = STIL_DEGISTI.exec(govde);
  if (stil) return `${stil[1]} — Your citation style changed from ${stil[2]} to ${stil[3]}; the reference check now follows this style.`;
  const bekliyor = KILAVUZ_BEKLIYOR.exec(govde);
  if (bekliyor) return `The rules of the ${bekliyor[1]} guideline were extracted automatically; it awaits your one-step approval.`;
  return govde;
}
