/*
  MAKALE PROFİLİ → ASİSTAN BAĞLAMI: saf kısım (Makale Aşama 2,
  05.11.2026). Okuma lib/ai/calisma-baglami.ts'te (Supabase); burada
  yalnızca metne çevirme, böylece birim testi ağsız çalışıyor
  (tests/unit/makale-asama2.test.ts).
*/
import { MAKALE_TURLERI, makaleTuruMu } from "@/lib/makale/sablonlar";

export type MakaleBaglami = { baglam: string; yalnizIstem: string };

/** makale_profili satırının bağlama giren sütunları (şemada gerçekten bulunanlar). */
export type MakaleProfilSatiri = {
  makale_turu: string;
  dil: string | null;
  arastirma_problemi: string | null;
  arastirma_sorusu: string | null;
  arastirma_tasarimi: string | null;
  disiplin: string | null;
  hedef_dergi: string | null;
  dergi_kurallari_adresi: string | null;
  dergi_kurallari_notu: string | null;
  raporlama_standardi: string | null;
  kelime_siniri: number | null;
  ozet_siniri: number | null;
  anahtar_en_az: number | null;
  anahtar_en_cok: number | null;
  veri_durumu: string | null;
};

const MAKALE_DILI: Record<string, string> = { tr: "Türkçe", en: "İngilizce", diger: "Diğer (öğrenci belirtmedi)" };
const VERI_DURUMU: Record<string, string> = {
  yok: "Veri yok",
  toplaniyor: "Veri toplanıyor",
  toplandi: "Veri toplandı, analiz tamamlanmadı",
  analiz_edildi: "Analiz tamamlandı",
  gerekmiyor: "Veri gerekmiyor (derleme vb.)",
};

const satir = (ad: string, deger: string | null | undefined, sinir = 600) => {
  const d = (deger ?? "").replace(/\s+/g, " ").trim();
  return d ? `${ad}: ${d.length > sinir ? `${d.slice(0, sinir)}…` : d}` : "";
};

/*
  MAKALE PROFİLİ → ASİSTAN BAĞLAMI (Makale Aşama 2, 05.11.2026). Saf.

  İki parça döner (gerekçe lib/ai/yazim-asistani.ts, YazimGirdisi.makale):
    baglam      — sayı denetiminin de gördüğü kısım: tür, dil, problem,
                  soru, tasarım, disiplin, hedef dergi, standart, veri durumu.
    yalnizIstem — yalnızca istemde: kelime/özet/anahtar kelime SINIRLARI,
                  kullanıcının dergi notu ve kural adresi.
  Dergi bilgileri DOĞRULANMAMIŞ kullanıcı beyanı olarak işaretlenir;
  adresin içeriği okunmadığı açıkça yazılır. Özet ve anahtar kelimeler
  bağlama girmez: istenmedi ve belgenin kendisinde zaten duruyor.
*/
export function makaleProfiliMetni(p: MakaleProfilSatiri): MakaleBaglami {
  const tur = makaleTuruMu(p.makale_turu) ? MAKALE_TURLERI[p.makale_turu].etiket : p.makale_turu;
  const veri = p.veri_durumu ? (VERI_DURUMU[p.veri_durumu] ?? p.veri_durumu) : "";
  const analizYok = p.veri_durumu !== "analiz_edildi" && p.veri_durumu !== "gerekmiyor";
  const baglam = [
    "MAKALE PROFİLİ (öğrencinin girdiği bilgiler):",
    satir("Makale türü", tur),
    satir("Makalenin dili", p.dil ? (MAKALE_DILI[p.dil] ?? p.dil) : null),
    satir("Araştırma problemi", p.arastirma_problemi),
    satir("Araştırma sorusu", p.arastirma_sorusu),
    satir("Araştırma tasarımı", p.arastirma_tasarimi),
    satir("Hedef disiplin", p.disiplin),
    satir("Hedef dergi (öğrencinin beyanı, doğrulanmadı)", p.hedef_dergi),
    satir("Raporlama standardı", p.raporlama_standardi),
    satir("Veri ve analiz durumu", veri),
    analizYok ? "Not: Gerçek analiz çıktısı yok; bulgu, istatistik ya da sonuç yazma, gerekiyorsa […] yer tutucusu bırak." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sinirlar = [
    p.kelime_siniri ? `Ana metin kelime sınırı: ${p.kelime_siniri}` : "",
    p.ozet_siniri ? `Özet sınırı: ${p.ozet_siniri} sözcük` : "",
    p.anahtar_en_az || p.anahtar_en_cok
      ? `Anahtar kelime sayısı: ${[p.anahtar_en_az ? `en az ${p.anahtar_en_az}` : "", p.anahtar_en_cok ? `en çok ${p.anahtar_en_cok}` : ""].filter(Boolean).join(", ")}`
      : "",
    satir("Yazım kuralları adresi (içeriği okunmadı)", p.dergi_kurallari_adresi, 300),
    satir("Öğrencinin dergi notu", p.dergi_kurallari_notu, 1_500),
  ].filter(Boolean);
  const yalnizIstem = sinirlar.length
    ? [
        "DERGİ SINIRLARI VE NOTLARI (öğrencinin beyanı, DOĞRULANMAMIŞ). Uzunluk ve yapı önerirken dikkate al; bu sayıları metne yazma, derginin güncel resmî kuralı olduğunu söyleme, adresi okuduğunu iddia etme:",
        ...sinirlar,
      ].join("\n")
    : "";
  return { baglam, yalnizIstem };
}
