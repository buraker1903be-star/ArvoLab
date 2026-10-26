/*
  Çalışmalarım listesinin öğrenci gözüyle iki kararı (26.10.2026).

  Saf modül; testi tests/unit/calisma-karti.test.ts.
*/

/*
  Arama, durum, sorumlu ve sıralama filtreleri: personelde her zaman
  (onlarca çalışmayı yönetiyorlar), öğrencide yalnızca listenin gerçekten
  aranacak kadar uzun olduğunda. Tek tezi olan öğrenciye dört filtre
  kutusu, tek kartın üstünde bir form doldurtuyor gibi duruyordu.
*/
export const FILTRE_ESIGI = 4;

export function filtrelerGorunsun(calismaSayisi: number, personel: boolean): boolean {
  return personel || calismaSayisi >= FILTRE_ESIGI;
}

export type KartIlerlemesi = { yuzde: number; etiket: string; ipucu: string };

/*
  KARTTAKİ YÜZDE GERÇEK YAZIMDAN. Eskiden "ilerleme" alanı elle
  giriliyordu ve kimse güncellemediği için yanıltıyordu: ekranda
  "Revizyonda" yazan çalışmanın yanında %100 duruyordu. Kılavuzun sayfa
  sınırı biliniyorsa yazılan kelimenin hedefe oranı gösteriliyor.

  Hedef yoksa elle girilen değer yalnızca personel bir değer GİRDİYSE
  (sıfırdan büyükse) ve "ilerleme" diye adlandırılarak gösteriliyor;
  hiçbiri yoksa yüzde hiç çizilmiyor — uydurma bir yüzde, yüzdesiz
  karttan kötüdür.
*/
export function kartIlerlemesi(girdi: {
  kelime: number | null;
  hedefKelime: number | null;
  elleIlerleme: number | null;
}): KartIlerlemesi | null {
  if (girdi.hedefKelime && girdi.hedefKelime > 0) {
    const yuzde = Math.min(100, Math.round(((girdi.kelime ?? 0) / girdi.hedefKelime) * 100));
    return {
      yuzde,
      etiket: "yazıldı",
      ipucu: `Kılavuzun sayfa sınırına göre ~${girdi.hedefKelime.toLocaleString("tr-TR")} kelimelik hedefin %${yuzde}'i`,
    };
  }
  if (girdi.elleIlerleme && girdi.elleIlerleme > 0) {
    const yuzde = Math.min(100, Math.max(0, Math.round(girdi.elleIlerleme)));
    return { yuzde, etiket: "ilerleme", ipucu: "Çalışma bilgilerinde girilen ilerleme" };
  }
  return null;
}

/*
  İKİ KART: SOLDA LİSTE, SAĞDA SEÇİLİ ÇALIŞMANIN DURUMU (26.10.2026).

  Öğrencinin Çalışmalarım sayfasına gelme sebebi bir çalışmayı açmak ve
  "nerede kaldım, ne eksik" sorusunun cevabı. Eskiden kart yalnızca
  kelime sayısı ve iki düğme gösteriyordu; eksikleri görmek için Çalışma
  merkezine ayrıca girmek gerekiyordu. Şimdi sağdaki kart seçili
  çalışmanın merkezinin özeti.

  Seçim adres satırında (?sec=…): sayfa sunucuda çiziliyor, yenilenince
  ve paylaşılınca aynı çalışma açık kalıyor. Seçim yoksa ya da listede
  değilse (silinmiş, filtrenin dışında kalmış) EN SON DÜZENLENEN
  çalışma — öğrencinin büyük olasılıkla döneceği yer. Hiç yazılmamışsa
  listenin ilki.
*/
export function seciliCalismaId(
  idler: string[],
  istenen: string | null | undefined,
  sonDuzenleme: (id: string) => string | null | undefined,
): string | null {
  if (istenen && idler.includes(istenen)) return istenen;
  let enYeni: { id: string; zaman: string } | null = null;
  for (const id of idler) {
    const zaman = sonDuzenleme(id);
    if (zaman && (!enYeni || zaman > enYeni.zaman)) enYeni = { id, zaman };
  }
  return enYeni?.id ?? idler[0] ?? null;
}

/** Satırın adresi: filtreler (q, durum, sirala…) korunur, yalnızca seçim değişir. */
export function secimAdresi(params: Record<string, string | string[] | undefined>, id: string): string {
  const arama = new URLSearchParams();
  for (const [anahtar, deger] of Object.entries(params)) {
    if (anahtar === "sec" || deger === undefined) continue;
    for (const tek of Array.isArray(deger) ? deger : [deger]) arama.append(anahtar, tek);
  }
  arama.set("sec", id);
  return `/dashboard/editor?${arama.toString()}`;
}

export type EksikTuru = "stil" | "eksik" | "tutarsizlik" | "bakilacak" | "yapilmadi";
export type EksikSatiri = { anahtar: string; tur: EksikTuru; baslik: string; aciklama: string; href: string };

type MaddeGirdisi = { id: string; label: string; detail: string; status: string };
type AdimGirdisi = { anahtar: string; baslik: string; aciklama: string; href: string; tamam: boolean };

/*
  Sağ karttaki "eksikler" listesi. Kaynaklar zaten vardı ve Çalışma
  merkezinde üç ayrı pencereye dağılmıştı (teslim maddeleri,
  tutarsızlıklar, birimler); öğrenci "ne eksik" sorusunun cevabını
  üç pencere açarak topluyordu. Burada tek listede, ağırlık sırasıyla:

  1. Atıf stili kılavuzla çelişiyor — yanlış stille yazmak her gün büyür.
  2. Teslim kontrolünün EKSİK maddeleri (kılavuzun istediği).
  3. Metin ile literatür listesinin tutarsızlıkları.
  4. Teslim kontrolünün BAKILACAK maddeleri.
  5. Yapılmamış birimler (literatür, kaynakça denetimi, belge).

  "Şimdi" satırında gösterilen iş listede TEKRAR edilmiyor (ana
  sayfadaki kuralın aynısı): madde kimliğiyle ya da adımın adresiyle
  çıkarılıyor.
*/
export function eksikSatirlari(girdi: {
  calismaId: string;
  stilUyarisi: string | null;
  maddeler: MaddeGirdisi[];
  tutarsizliklar: { tur: string; baslik: string; aciklama: string }[];
  adimlar: AdimGirdisi[];
  sirada?: { kaynakMadde?: string; href: string; bitti: boolean } | null;
}): EksikSatiri[] {
  const { calismaId, sirada } = girdi;
  const merkez = `/dashboard/editor/${calismaId}`;
  const madde = (m: MaddeGirdisi, tur: EksikTuru): EksikSatiri => ({
    anahtar: `madde-${m.id}`,
    tur,
    baslik: m.label,
    aciklama: m.detail,
    href: `/dashboard/editor/${calismaId}/write?teslim=${m.id}`,
  });
  const kalan = girdi.maddeler.filter((m) => m.status !== "ok" && m.id !== sirada?.kaynakMadde);
  const siradakiAdim = sirada && !sirada.bitti && !sirada.kaynakMadde ? sirada.href : null;

  return [
    ...(girdi.stilUyarisi
      ? [{ anahtar: "stil", tur: "stil" as const, baslik: "Atıf stili kılavuzla çelişiyor", aciklama: girdi.stilUyarisi, href: merkez }]
      : []),
    ...kalan.filter((m) => m.status === "todo").map((m) => madde(m, "eksik")),
    ...girdi.tutarsizliklar.map((t) => ({ anahtar: `tutarsizlik-${t.tur}`, tur: "tutarsizlik" as const, baslik: t.baslik, aciklama: t.aciklama, href: merkez })),
    ...kalan.filter((m) => m.status !== "todo").map((m) => madde(m, "bakilacak")),
    ...girdi.adimlar
      .filter((a) => !a.tamam && a.href !== siradakiAdim)
      .map((a) => ({ anahtar: `adim-${a.anahtar}`, tur: "yapilmadi" as const, baslik: a.baslik, aciklama: a.aciklama, href: a.href })),
  ];
}
