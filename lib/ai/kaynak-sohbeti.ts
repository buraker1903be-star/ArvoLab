/*
  KAYNAKLA SOHBET (03.11.2026, Jenni AI'daki "PDF ile sohbet"in karşılığı).

  Öğrenci kaynağının PDF'ine soru soruyor ("örneklem kaç kişi?", "hangi
  yöntemi kullanmışlar?"). Jenni'den ayrıldığı yer: CEVAP KAYNAKTAN
  KANITLANIR. Model her iddiasını PDF'ten birebir alıntıyla ve alıntının
  geçtiği PDF sayfasıyla vermek zorunda; alıntı o metinde geçmiyorsa
  cevabın tamamı düşer. "Kaynakta şöyle yazıyor" deyip yazmayan bir cevap,
  öğrencinin tezine yanlış bir atıf olarak girer — akademik çalışmada en
  pahalı hatalardan biri.

  Sayfa numarası PDF DOSYASININ sayfasıdır, derginin baskı sayfası değil:
  ikisi çoğu zaman farklıdır ve baskı sayfası tahmin edilmez (AGENTS.md,
  kanıt kuralı). Ekranda da öyle söylenir.

  Kurallar:
    - Alıntı, gönderilen sayfaların birinde (kanıt normalleştirmesiyle,
      lib/kanit/alinti.ts) birebir geçmeli. Model sayfayı yanlış
      söylediyse ve alıntı başka bir gönderilen sayfadaysa sayfa düzeltilir
      (alıntı gerçek, yalnızca konum yanlış).
    - "Bulundu" diyen cevap en az bir alıntı taşımalı.
    - Cevaptaki her sayı kaynakta ya da soruda geçmeli (sayi-denetimi).
    - Cevap, kaynakta geçmeyen bir künye/atıf yazamaz.

  Saf modül; testi tests/unit/kaynak-sohbeti.test.ts.
*/

import type { Dil } from "@/lib/dil";
import type { Mesaj } from "./saglayici";
import { jsonOku, baglamDisiKunye } from "./bulgu";
import { uydurmaSayilar } from "./sayi-denetimi";
import { alintiDenetle, ALINTI_EN_AZ } from "@/lib/kanit/alinti";

export type Sayfa = { num: number; text: string };
export type KaynakAlintisi = { sayfa: number; metin: string };
export type KaynakCevabi = { bulundu: boolean; cevap: string; alintilar: KaynakAlintisi[] };
export type KaynakMesaji = { rol: "kullanici" | "asistan"; metin: string };

/*
  Bağlam bütçesi: tipik bir makale (20–40 sayfa, 40–90 bin karakter)
  tamamen sığsın. Daha uzun kaynakta (kitap, tez) sayfalar seçilir.
*/
export const BUTCE = 90_000;
export const SORU_EN_UZUN = 1_000;

const sozcukler = (metin: string) =>
  [
    ...new Set(
      metin
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .split(/[^\p{L}\p{N}]+/u)
        .filter((s) => s.length >= 3 || /\d/.test(s)),
    ),
  ];

/**
 * Bütçeye sığan sayfalar, belge sırasıyla. Hepsi sığıyorsa hepsi. Sığmıyorsa
 * ilk iki sayfa (başlık, özet) her zaman; kalanı soruyla ortak sözcük
 * sayısına göre. Ortak sözcük ölçütü dil bilmiyor (Türkçe soru, İngilizce
 * makale): yöntem adları, kısaltmalar, sayılar ve özel adlar yine eşleşir;
 * eşleşme yoksa sıradaki sayfalar alınır. `kirpildi`: kaç sayfa dışarıda.
 */
export function ilgiliSayfalar(sayfalar: Sayfa[], soru: string, butce = BUTCE): { secilen: Sayfa[]; kirpildi: number } {
  const dolu = sayfalar.filter((s) => s.text.trim());
  const toplam = dolu.reduce((n, s) => n + s.text.length, 0);
  if (toplam <= butce) return { secilen: dolu, kirpildi: 0 };
  const aranan = new Set(sozcukler(soru));
  const puan = (s: Sayfa) => sozcukler(s.text).filter((w) => aranan.has(w)).length;
  const sirali = [...dolu.slice(0, 2), ...dolu.slice(2).map((s) => ({ s, p: puan(s) })).sort((a, b) => b.p - a.p || a.s.num - b.s.num).map((x) => x.s)];
  const secilen: Sayfa[] = [];
  let kalan = butce;
  for (const s of sirali) {
    if (s.text.length > kalan) continue;
    secilen.push(s);
    kalan -= s.text.length;
  }
  return { secilen: secilen.sort((a, b) => a.num - b.num), kirpildi: dolu.length - secilen.length };
}

export const KAYNAK_ISTEMI = `Sen ArvoLab'ın kaynak okuma asistanısın. Öğrencinin yüklediği akademik bir kaynağın (makale, kitap bölümü, rapor) metni aşağıda SAYFA SAYFA verilmiş. Öğrencinin sorusunu YALNIZCA bu metne dayanarak cevapla.

YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"bulundu": true|false, "cevap": "<kısa, açık cevap; en çok 6 cümle>", "alintilar": [{"sayfa": <PDF sayfa numarası>, "metin": "<kaynaktan BİREBİR kopyalanmış parça>"}]}

KESİN KURALLAR:
1. Cevaptaki her bilgi kaynakta yazılı olmalı. Kaynakta olmayan bilgiyi genel bilgiden tamamlama; kaynakta yoksa "bulundu": false yap ve cevapta kaynakta bulunamadığını söyle.
2. "bulundu": true ise en az bir alıntı ver. Alıntı kaynaktan HARFİ HARFİNE kopyalanmış, en az ${ALINTI_EN_AZ} karakterlik bir parça olmalı: kelime değiştirme, çevirme, kısaltma, "…" ile birleştirme. Kaynak İngilizceyse alıntı İngilizce kalır.
3. "sayfa", alıntının geçtiği "--- SAYFA N ---" başlığındaki N'dir (PDF sayfası); baskı sayfa numarası uydurma.
4. Cevaptaki her sayı (örneklem, yüzde, katsayı, yıl, p değeri) kaynakta birebir geçmeli.
5. Kaynakta geçmeyen bir yazara, çalışmaya ya da künyeye atıf yapma.
6. Cevabı kullanıcının arayüz diliyle yaz (aşağıda belirtilir); alıntılar kaynağın dilinde kalır.`;

export function kaynakIstemi(g: {
  kunye: string;
  sayfalar: Sayfa[];
  soru: string;
  gecmis: KaynakMesaji[];
  dil: Dil;
}): { mesajlar: Mesaj[]; kaynakMetni: string; kayitBaglami: string } {
  const kaynakMetni = g.sayfalar.map((s) => `--- SAYFA ${s.num} ---\n${s.text.trim()}`).join("\n\n");
  const ust = `KAYNAK: ${g.kunye.slice(0, 600)}\nCEVAP DİLİ: ${g.dil === "en" ? "İngilizce" : "Türkçe"}`;
  const gecmis: Mesaj[] = g.gecmis.slice(-6).map((m) => ({
    rol: m.rol === "kullanici" ? "kullanici" : "sistem",
    metin: m.rol === "kullanici" ? m.metin.slice(0, SORU_EN_UZUN) : `ÖNCEKİ CEVABIN: ${m.metin.slice(0, 1_500)}`,
  }));
  const soru = g.soru.slice(0, SORU_EN_UZUN);
  return {
    mesajlar: [
      { rol: "sistem", metin: KAYNAK_ISTEMI },
      { rol: "sistem", metin: `${ust}\n\nKAYNAK METNİ:\n${kaynakMetni}` },
      ...gecmis,
      { rol: "kullanici", metin: soru },
    ],
    kaynakMetni,
    // Kayda kaynağın tamamı değil, soru ve hangi sayfaların okunduğu girer (metin zaten depoda).
    kayitBaglami: `${ust}\nSAYFALAR: ${g.sayfalar.map((s) => s.num).join(", ")}\n\nSORU: ${soru}`,
  };
}

export function kaynakCevabiCozumle(ham: string): KaynakCevabi | null {
  const veri = jsonOku(ham) as { bulundu?: unknown; cevap?: unknown; alintilar?: unknown } | null;
  if (!veri || typeof veri !== "object") return null;
  const cevap = typeof veri.cevap === "string" ? veri.cevap.trim().slice(0, 2_000) : "";
  if (!cevap) return null;
  const alintilar: KaynakAlintisi[] = Array.isArray(veri.alintilar)
    ? veri.alintilar
        .map((a) => a as { sayfa?: unknown; metin?: unknown })
        .filter((a) => typeof a?.metin === "string" && a.metin.trim())
        .slice(0, 6)
        .map((a) => ({ sayfa: Number(a.sayfa) || 0, metin: String(a.metin).trim() }))
    : [];
  return { bulundu: veri.bulundu === true, cevap, alintilar };
}

export type KaynakDenetimi =
  | { gecti: true; cevap: KaynakCevabi }
  | { gecti: false; neden: "alinti" | "uydurma_sayi" | "kunye"; ayrinti: string[] };

/**
 * Alıntılar gönderilen sayfalarda geçiyor mu (sayfa gerekirse düzeltilir),
 * "bulundu" cevap alıntılı mı, sayılar ve atıflar kaynakta mı.
 */
export function kaynakCevabiDenetle(cevap: KaynakCevabi, sayfalar: Sayfa[], soru: string): KaynakDenetimi {
  const duzeltilmis: KaynakAlintisi[] = [];
  for (const alinti of cevap.alintilar) {
    const belirtilen = sayfalar.find((s) => s.num === alinti.sayfa);
    if (belirtilen && alintiDenetle(alinti.metin, belirtilen.text).gecti) {
      duzeltilmis.push(alinti);
      continue;
    }
    const baska = sayfalar.find((s) => alintiDenetle(alinti.metin, s.text).gecti);
    if (!baska) return { gecti: false, neden: "alinti", ayrinti: [alinti.metin.slice(0, 80)] };
    duzeltilmis.push({ sayfa: baska.num, metin: alinti.metin });
  }
  if (cevap.bulundu && duzeltilmis.length === 0) return { gecti: false, neden: "alinti", ayrinti: [] };

  const kaynakMetni = sayfalar.map((s) => s.text).join("\n");
  // Künye önce: uydurma bir atfın yılı sayı denetimine de takılır, ama öğrenciye doğru sebep "kaynakta olmayan atıf".
  const kunye = baglamDisiKunye(cevap.cevap, kaynakMetni);
  if (kunye.length) return { gecti: false, neden: "kunye", ayrinti: kunye };
  const uydurma = uydurmaSayilar(cevap.cevap, kaynakMetni, soru);
  if (uydurma.length) return { gecti: false, neden: "uydurma_sayi", ayrinti: uydurma };
  return { gecti: true, cevap: { ...cevap, alintilar: duzeltilmis } };
}
