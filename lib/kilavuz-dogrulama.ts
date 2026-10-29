import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import type { Dil, Metin } from "@/lib/dil";

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

export const DOGRULAMA_MESAJI_METIN: Record<DogrulamaHatasi, Metin> = {
  "atif-stili-yok": {
    tr: "Kaynakça sistemini seçin; kılavuzunuzda hangisinin istendiği yazıyor olmalı.",
    en: "Select the citation style; your guideline should state which one is required.",
  },
  "atif-stili-taninmiyor": { tr: "Seçilen kaynakça sistemi tanınmıyor.", en: "The selected citation style is not recognized." },
  "bolum-yok": {
    tr: "En az bir zorunlu bölüm girin (örn. Giriş, Yöntem, Bulgular).",
    en: "Enter at least one required section (e.g., Introduction, Methods, Results).",
  },
  "sayfa-gecersiz": {
    tr: `Sayfa sayısı 1 ile ${EN_COK_SAYFA} arasında bir tam sayı olmalı.`,
    en: `The page count must be a whole number between 1 and ${EN_COK_SAYFA}.`,
  },
  "sayfa-ters": { tr: "En az sayfa, en çok sayfadan büyük olamaz.", en: "The minimum page count cannot exceed the maximum." },
};

export const DOGRULAMA_MESAJI: Record<DogrulamaHatasi, string> = {
  "atif-stili-yok": DOGRULAMA_MESAJI_METIN["atif-stili-yok"].tr,
  "atif-stili-taninmiyor": DOGRULAMA_MESAJI_METIN["atif-stili-taninmiyor"].tr,
  "bolum-yok": DOGRULAMA_MESAJI_METIN["bolum-yok"].tr,
  "sayfa-gecersiz": DOGRULAMA_MESAJI_METIN["sayfa-gecersiz"].tr,
  "sayfa-ters": DOGRULAMA_MESAJI_METIN["sayfa-ters"].tr,
};

/** Doğrulama hatasının metni, istenen dilde. */
export const dogrulamaMesaji = (hata: DogrulamaHatasi, dil: Dil = "tr"): string => DOGRULAMA_MESAJI_METIN[hata][dil];

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

/*
  UYGULANACAK BİÇİM KURALLARININ ÖZETİ.

  Doğrulama ekranı üç şeyi onaylatıyor (atıf stili, zorunlu bölümler,
  sayfa aralığı) ama çıkarım bundan fazlasını buluyor: kenar
  boşlukları, yazı tipi, punto, satır aralığı, başlık numaralandırma.
  Bunlar belgenin GÖRÜNÜMÜNÜ değiştiriyor ve sessizce uygulanırsa
  öğrenci metninin neden birden başkalaştığını anlamaz.

  Hepsini ayrı ayrı onaylatmak doğru çözüm değil: on alanlık bir form
  okunmadan "tamam"lanır ve doğrulama tiyatroya döner. Bu yüzden
  düzenlenmiyor, SÖYLENİYOR — "şunları uygulayacağım" cümlesi.

  Hiçbir biçim kuralı bulunamadıysa dizi boş döner; çağıran o zaman
  "biçim kuralı bulamadım" demeli. Boş bir liste göstermek, bulunmuş
  gibi durur.
*/
export function bicimOzeti(ayarlar: {
  margins?: { top?: number; right?: number; bottom?: number; left?: number } | null;
  fontFamily?: string;
  fontSizePt?: number;
  lineSpacing?: number;
  headingNumbering?: boolean;
  chapterNewPage?: boolean;
  thesisWords?: { min?: number; max?: number };
}, dil: Dil = "tr"): string[] {
  const en = dil === "en";
  const satirlar: string[] = [];
  const m = ayarlar.margins;
  /* Türkçe ondalık virgülle; "3.5 cm" yazmak kılavuzun kendi
     yazımına yabancı duruyor. İngilizcede nokta. */
  const yaz = (d: number) => (en ? String(d) : String(d).replace(".", ","));
  /*
    İngilizce kılavuzlar boşluğu inçle yazıyor (29.10.2026, lib/kilavuz-
    ingilizce.ts) ve öğrenci onay formunda kendi kılavuzunun "1 inch"ini
    tanımalı; "2.54 cm" ona yabancı. Dört değer de çeyrek inçe tam
    oturuyorsa inç önde, cm parantezde; oturmuyorsa yalnızca cm (yuvarlayıp
    "1 in" yazmak, ölçüyü değiştirmek olurdu).
  */
  const inchMargins = (k: { top?: number; right?: number; bottom?: number; left?: number }) => {
    const cm = `top ${yaz(k.top!)} · right ${yaz(k.right!)} · bottom ${yaz(k.bottom!)} · left ${yaz(k.left!)} cm`;
    const inc = [k.top!, k.right!, k.bottom!, k.left!].map((d) => {
      const i = Math.round((d / 2.54) * 4) / 4;
      return Math.abs(i * 2.54 - d) < 0.02 ? i : null;
    });
    if (inc.some((i) => i === null)) return `Margins: ${cm}`;
    return `Margins: top ${inc[0]} · right ${inc[1]} · bottom ${inc[2]} · left ${inc[3]} in (${cm})`;
  };
  if (m && [m.top, m.right, m.bottom, m.left].every((d) => typeof d === "number")) {
    satirlar.push(
      en
        ? inchMargins(m)
        : `Kenar boşlukları: üst ${yaz(m.top!)} · sağ ${yaz(m.right!)} · alt ${yaz(m.bottom!)} · sol ${yaz(m.left!)} cm`,
    );
  }
  const yazi = [ayarlar.fontFamily, ayarlar.fontSizePt ? `${yaz(ayarlar.fontSizePt)} ${en ? "pt" : "punto"}` : null]
    .filter(Boolean)
    .join(" · ");
  if (yazi) satirlar.push(en ? `Text: ${yazi}` : `Yazı: ${yazi}`);
  if (ayarlar.lineSpacing) satirlar.push(en ? `Line spacing: ${yaz(ayarlar.lineSpacing)}` : `Satır aralığı: ${yaz(ayarlar.lineSpacing)}`);
  if (ayarlar.headingNumbering) satirlar.push(en ? "Headings are numbered decimally (1., 1.1.)" : "Başlıklar ondalık numaralanır (1., 1.1.)");
  if (ayarlar.chapterNewPage) satirlar.push(en ? "Each main chapter starts on a new page" : "Her ana bölüm yeni sayfadan başlar");
  /* Kelime sınırı teslim kontrolüne giriyor; öğrenci onaylamadan önce görmeli. */
  const kelime = ayarlar.thesisWords;
  if (kelime?.min || kelime?.max) {
    const sayi = (n: number) => n.toLocaleString(en ? "en-US" : "tr-TR");
    const aralik =
      kelime.min && kelime.max
        ? `${sayi(kelime.min)}–${sayi(kelime.max)}`
        : kelime.max
          ? en ? `at most ${sayi(kelime.max)}` : `en fazla ${sayi(kelime.max)}`
          : en ? `at least ${sayi(kelime.min!)}` : `en az ${sayi(kelime.min!)}`;
    satirlar.push(en ? `Thesis length: ${aralik} words` : `Tez uzunluğu: ${aralik} kelime`);
  }
  return satirlar;
}

/*
  KILAVUZUN ADI (29.10.2026). Eskiden öğrencinin yüklediği kılavuzun adı
  tarayıcının SÜRÜM etiketinden dolduruluyordu (surumEtiketiCikar: "Sürüm 3",
  "Şubat 2024", ya da kapaktaki ilk yıl). Editörün "Uygulanan kılavuz"
  kartı, çalışma özeti ve Belge Kontrol kılavuzu "2019" diye adlandırıyordu;
  "Sürüm …" İngilizce arayüzde de Türkçe kalıyordu. Ad artık öğrencinin
  verdiği kaynaktan: dosyanın adı ya da adresin son parçası.
*/
export function kilavuzAdi(kaynak: { depoYolu?: string | null; adres?: string | null }): string | null {
  const temizle = (ham: string) =>
    ham
      .replace(/\.(pdf|docx?|html?)$/i, "")
      .replace(/[_+]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || null;
  if (kaynak.depoYolu) {
    // "<kullanıcı>/kilavuz/<zaman>-<dosya adı>" (kilavuz-yukle.tsx)
    const son = kaynak.depoYolu.split("/").pop() ?? "";
    return temizle(son.replace(/^\d{10,}-/, ""));
  }
  if (kaynak.adres) {
    try {
      const url = new URL(kaynak.adres.trim());
      const parca = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
      return temizle(parca) ?? url.hostname;
    } catch {
      return null;
    }
  }
  return null;
}

/** Hatalı dönemde ad yerine yazılmış sürüm etiketi mi ("2019", "Sürüm 3", "Şubat 2024")? */
export function surumEtiketiMi(ad: string | null | undefined): boolean {
  const s = (ad ?? "").trim();
  return /^(?:(?:19|20)\d{2}|Sürüm \d+(?:\.\d+)*|(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) (?:19|20)\d{2})$/u.test(s);
}
