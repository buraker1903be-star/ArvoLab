import { STIL_SECENEKLERI } from "@/lib/atif/stiller";

/* Tanınan atıf stilleri TEK listeden (lib/atif/stiller.ts): ikinci bir
   dizi yazmak, yeni bir stil eklendiğinde burayı unutmak demekti. */
const TANINAN_STILLER: string[] = STIL_SECENEKLERI.map((secenek) => secenek.deger);

/*
  ÖĞRENCİNİN YÜKLEDİĞİ KILAVUZUN DOĞRULAMA EKRANI (26.10.2026).

  Kurum sahibinin kararı: katalogda onaylı kılavuzu olmayan öğrenci
  kendi PDF'ini yükleyebilsin, kurallar çıkarımla doldurulsun. Ama
  çıkarım DOĞRULANMAMIŞ bir şeydir ve yanlış bir kural sessizdir:
  "en az 60 sayfa"yı "en az 6" diye okursak program 6 sayfalık teze
  "teslime hazır görünüyor" der ve bunu yakalayacak ikinci bir sinyal
  yoktur. Öğrenci kuralları bilmiyor — zaten o yüzden programı
  kullanıyor.

  Bu yüzden araya otuz saniyelik bir doğrulama konuyor: çıkarımın
  bulduğu BİRKAÇ sayı öğrenciye gösterilip onaylatılıyor. Soru sayısı
  bilerek az; uzun bir form doldurulmadan "tamam"a basılır ve doğrulama
  bir tiyatroya dönüşür.

  Modül saf: Next/React/Supabase'e dokunmuyor, testi
  tests/unit/kilavuz-dogrulama.test.ts.
*/

export type DogrulamaAlani =
  | { ad: "atifStili"; deger: string | null }
  | { ad: "zorunluBolumler"; deger: string[] }
  | { ad: "sayfaAraligi"; enAz: number | null; enCok: number | null };

export interface DogrulamaFormu {
  atifStili: string;
  /** Satır başına bir bölüm adı; öğrenci silip ekleyebiliyor. */
  zorunluBolumler: string[];
  enAzSayfa: number | null;
  enCokSayfa: number | null;
}

export interface KilavuzKurallari {
  citation_style: string;
  required_sections: string[];
  min_pages: number | null;
  max_pages: number | null;
  /** Çıkarımın ham sonucu; onay kuyruğuna düşerken yöneticiye lazım. */
  extracted_rules?: unknown;
  document_title?: string | null;
  source_url?: string | null;
}

/** Kaç sayfalık bir tez için ÜST sınır makul sayılır. */
export const EN_COK_SAYFA = 2000;

/*
  Çıkarımdan gelen değerler doğrudan kurala dönüşmüyor; önce
  "gösterilebilir mi" diye süzülüyor. Tanınmayan atıf stili ya da
  saçma sayfa sayısı, öğrenciye onaylatılacak bir şey DEĞİL —
  boş gösterilip ondan isteniyor.
*/
export function formaDoldur(tarama: {
  citationStyle?: string | null;
  requiredSections?: string[] | null;
  minPages?: number | null;
  maxPages?: number | null;
}): DogrulamaFormu {
  const stil = tarama.citationStyle ?? "";
  return {
    atifStili: TANINAN_STILLER.includes(stil) ? stil : "",
    zorunluBolumler: (tarama.requiredSections ?? []).map((b) => b.trim()).filter(Boolean),
    enAzSayfa: sayfaMi(tarama.minPages) ? tarama.minPages! : null,
    enCokSayfa: sayfaMi(tarama.maxPages) ? tarama.maxPages! : null,
  };
}

function sayfaMi(deger: number | null | undefined): boolean {
  return typeof deger === "number" && Number.isInteger(deger) && deger > 0 && deger <= EN_COK_SAYFA;
}

export type DogrulamaHatasi =
  | "atif-stili-yok"
  | "atif-stili-taninmiyor"
  | "bolum-yok"
  | "sayfa-gecersiz"
  | "sayfa-ters";

/*
  Boş bırakılan sayfa aralığı HATA DEĞİL: her kılavuz sayfa sınırı
  söylemiyor ve uydurma bir sınır, öğrenciye olmayan bir kuralı
  dayatmak olurdu. Ama girilen değer saçmaysa (0, eksi, 5000, min>max)
  kaydedilmiyor.
*/
export function formuDogrula(form: DogrulamaFormu): DogrulamaHatasi[] {
  const hatalar: DogrulamaHatasi[] = [];
  if (!form.atifStili.trim()) hatalar.push("atif-stili-yok");
  else if (!TANINAN_STILLER.includes(form.atifStili)) hatalar.push("atif-stili-taninmiyor");

  if (form.zorunluBolumler.filter((b) => b.trim()).length === 0) hatalar.push("bolum-yok");

  for (const sayfa of [form.enAzSayfa, form.enCokSayfa]) {
    if (sayfa !== null && !sayfaMi(sayfa)) {
      hatalar.push("sayfa-gecersiz");
      break;
    }
  }
  if (
    form.enAzSayfa !== null &&
    form.enCokSayfa !== null &&
    sayfaMi(form.enAzSayfa) &&
    sayfaMi(form.enCokSayfa) &&
    form.enAzSayfa > form.enCokSayfa
  ) {
    hatalar.push("sayfa-ters");
  }
  return hatalar;
}

export const DOGRULAMA_MESAJI: Record<DogrulamaHatasi, string> = {
  "atif-stili-yok": "Kaynakça sistemini seçin; kılavuzunuzda hangisinin istendiği yazıyor olmalı.",
  "atif-stili-taninmiyor": "Seçilen kaynakça sistemi tanınmıyor.",
  "bolum-yok": "En az bir zorunlu bölüm girin (örn. Giriş, Yöntem, Bulgular).",
  "sayfa-gecersiz": `Sayfa sayısı 1 ile ${EN_COK_SAYFA} arasında bir tam sayı olmalı.`,
  "sayfa-ters": "En az sayfa, en çok sayfadan büyük olamaz.",
};

/** Doğrulanmış formdan, katalogdakiyle AYNI biçimde kural nesnesi. */
export function kurallariKur(
  form: DogrulamaFormu,
  ek: { belgeBasligi?: string | null; kaynakAdres?: string | null; hamCikarim?: unknown } = {},
): KilavuzKurallari {
  return {
    citation_style: form.atifStili,
    required_sections: form.zorunluBolumler.map((b) => b.trim()).filter(Boolean),
    min_pages: form.enAzSayfa,
    max_pages: form.enCokSayfa,
    extracted_rules: ek.hamCikarim,
    document_title: ek.belgeBasligi ?? null,
    source_url: ek.kaynakAdres ?? null,
  };
}
