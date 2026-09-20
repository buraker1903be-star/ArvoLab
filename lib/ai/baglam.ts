/*
  Asistana gönderilecek bağlamı kurar. Saf modül; testi
  tests/unit/ai-baglam.test.ts.

  Neden: bir tez bölümü modelin sınırından da, makul maliyetten de büyük.
  lib/ai-feedback.ts metni baştan 12.000 karaktere kesiyor — araştırma sorusu
  metnin sonundaysa asistan onu hiç görmüyor. Burada parçalar önceliklendirilir:
  önce soru ve yöntem, sonra ham metin; bütçe dolduğunda en az önemli parça
  kırpılır ve kırpıldığı kullanıcıya bildirilir.

  Bütçe karakter cinsindendir, jeton değil. Kabaca 1 jeton ≈ 3 karakter
  (Türkçe'de daha da az); jeton saymak için ayrı bir kütüphane taşımaya
  değmez, önemli olan üst sınırın öngörülebilir olması.
*/

export type BaglamParca = {
  baslik: string;
  metin: string;
  /** 1 = vazgeçilmez. Bütçe dolunca büyük sayılar önce kırpılır. */
  oncelik: number;
};

export type Baglam = {
  /** Modele gönderilecek metin. */
  metin: string;
  /** Kırpılan ya da hiç sığmayan parçaların başlıkları. */
  kirpilanlar: string[];
};

/** Bir parçadan geriye bundan azı kalıyorsa parça hiç konulmaz. */
const EN_AZ_PARCA = 300;

const KIRPMA_NOTU = "\n…(bu bölüm uzunluk sınırı nedeniyle kısaltıldı)";

function temizle(metin: string) {
  return metin.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

/**
 * Parçaları önceliğe göre sıralayıp bütçeye sığdırır. Aynı öncelikli
 * parçaların sırası korunur (çağıranın verdiği sıra anlamlıdır).
 */
export function baglamKur(parcalar: BaglamParca[], butceKarakter: number): Baglam {
  const siralı = parcalar
    .map((parca, sira) => ({ ...parca, metin: temizle(parca.metin), sira }))
    .filter((parca) => parca.metin.length > 0)
    .sort((a, b) => a.oncelik - b.oncelik || a.sira - b.sira);

  const kirpilanlar: string[] = [];
  const bolumler: { sira: number; metin: string }[] = [];
  let kalan = Math.max(0, butceKarakter);

  for (const parca of siralı) {
    const basliklı = `### ${parca.baslik}\n`;
    const maliyet = basliklı.length + parca.metin.length + 2;
    if (maliyet <= kalan) {
      bolumler.push({ sira: parca.sira, metin: basliklı + parca.metin });
      kalan -= maliyet;
      continue;
    }

    const yer = kalan - basliklı.length - KIRPMA_NOTU.length - 2;
    if (yer >= EN_AZ_PARCA) {
      bolumler.push({ sira: parca.sira, metin: basliklı + parca.metin.slice(0, yer) + KIRPMA_NOTU });
      kalan = 0;
    }
    kirpilanlar.push(parca.baslik);
  }

  // Modele çağıranın verdiği sırayla sunulur: öncelik neyin korunacağını
  // belirler, okuma sırasını değil.
  const metin = bolumler.sort((a, b) => a.sira - b.sira).map((b) => b.metin).join("\n\n");
  return { metin, kirpilanlar };
}
