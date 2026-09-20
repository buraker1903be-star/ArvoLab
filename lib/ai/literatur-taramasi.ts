/*
  Asistanın üçüncü yeteneği: literatür taraması.

  En kritik güvenlik kararı burada: asistan KAYNAK ÖNERMEZ. Dil modellerinin
  en bilinen ve en zararlı hatası uydurma künye üretmek — gerçekçi görünen
  yazar, başlık, dergi ve DOI. Akademik bir çalışmada bu, kariyer bitiren bir
  hatadır ve kullanıcı uydurmayı ancak tek tek arayarak anlayabilir.

  Bu yüzden asistan iki iş yapar:
    1. ARAMA STRATEJİSİ üretir: anahtar kelimeler, Türkçe/İngilizce
       karşılıklar, Boole birleşimleri, dahil etme/hariç tutma ölçütleri.
       Kaynakları kullanıcı gerçek dizinlerden kendi bulur.
    2. MEVCUT LİSTEYİ denetler: yıl dağılımı, tek dergiye/yazara yığılma,
       yöntem çeşitliliği, konuyla ilgisiz görünen kayıtlar.

  Sayı denetimi yalnızca bulgulara uygulanır, arama satırlarına değil: arama
  dizesindeki "2015..2025" gibi yıl aralıkları meşru filtrelerdir, bağlamda
  geçmezler ve kullanıcı çalıştırmadan önce zaten görür. Bulgular ise iddia
  taşır; oradaki uydurma sayı doğrudan yanıltır.

  Saf modül; testi tests/unit/ai-literatur-taramasi.test.ts.
*/

import { baglamKur, type BaglamParca } from "./baglam";
import { bulgulariCozumle, type Bulgu } from "./bulgu";
import type { Mesaj } from "./saglayici";

export type KayitOzeti = {
  baslik: string;
  yazarlar?: string | null;
  yil?: string | null;
  tur?: string | null;
  yayin?: string | null;
};

export type LiteraturGirdisi = {
  arastirmaSorusu: string;
  calismaBasligi?: string;
  kayitlar?: KayitOzeti[];
};

export type LiteraturSonucu = { bulgular: Bulgu[]; aramalar: string[] };

export const BAGLAM_BUTCESI = 9000;
const EN_FAZLA_ARAMA = 8;
const EN_UZUN_ARAMA = 200;

export const SISTEM_ISTEMI = `Sen akademik bir literatür tarama danışmanısın. Sana bir araştırma sorusu ve (varsa) araştırmacının şu ana kadar topladığı kaynakların listesi verilecek.

GÖREVİN İKİ PARÇA:
1. ARAMA STRATEJİSİ: Araştırmacının veri tabanlarına (Web of Science, Scopus, ERIC, Google Scholar, TR Dizin, YÖK Tez) yapıştırabileceği arama dizeleri üret. Türkçe ve İngilizce anahtar kelimeleri, eş anlamlıları ve alternatif terimleri Boole operatörleriyle (AND, OR, tırnak, yıldız) birleştir. Geniş taramadan dar taramaya doğru sırala.
2. LİSTE DENETİMİ: Verilen kaynak listesinde boşlukları göster — yıl dağılımı (yalnızca eski ya da yalnızca çok yeni kaynaklar), tek bir dergiye/yazara yığılma, yöntem çeşitliliğinin eksikliği, araştırma sorusuyla ilgisi zayıf görünen kayıtlar, ölçek/kuram kaynağının eksikliği. Liste verilmediyse bu bölümde tarama planını nasıl kuracağını anlat.

KESİNLİKLE YAPMAYACAKLARIN (en önemlisi budur):
1. KAYNAK ÖNERME. Hiçbir yazar adı, makale başlığı, dergi adı, yıl ya da DOI uydurma. "Şu çalışmaya bakın" deme. Var olduğunu bildiğini düşündüğün kaynakları bile yazma — kaynakları araştırmacı dizinden bulacak.
2. Araştırmacının metnine yapıştırabileceği paragraf yazma. Denetlersin, yazmazsın.
3. Sana verilmeyen hiçbir sayıyı bulgu metninde kullanma. Kaç kaynağın eski olduğunu sayıyla değil sözle ifade et ("kaynakların çoğu", "birkaç kayıt").
4. Kaynakların bilimsel kalitesi ya da dergi itibarı hakkında yargı verme.

YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"aramalar":["arama dizesi"],"bulgular":[{"tur":"uyari","baslik":"kısa başlık","aciklama":"tek paragraf açıklama"}]}
- "aramalar": en fazla 6 arama dizesi, her biri tek satır, veri tabanına doğrudan yapıştırılabilir.
- "tur": ciddi bir boşluk için "uyari", iyileştirme için "oneri", yalnızca dikkat çekmek için "bilgi".
- "baslik": en fazla 60 karakter. "aciklama": en fazla 400 karakter, Türkçe.
- En fazla 8 bulgu.`;

/** Kayıt listesini modele kısa, okunur bir listeye çevirir. */
export function kayitOzeti(kayitlar: KayitOzeti[]): string {
  return kayitlar
    .map((kayit, sira) => {
      const kuyruk = [kayit.yazarlar, kayit.yil, kayit.yayin, kayit.tur].filter(Boolean).join(" · ");
      return `[${sira + 1}] ${kayit.baslik}${kuyruk ? ` (${kuyruk})` : ""}`;
    })
    .join("\n");
}

/** Modele gönderilecek mesajlar ve doğrulamada kaynak sayılacak metin. */
export function literaturIstemi(girdi: LiteraturGirdisi, butce = BAGLAM_BUTCESI) {
  const parcalar: BaglamParca[] = [
    { baslik: "Araştırma sorusu", metin: girdi.arastirmaSorusu, oncelik: 1 },
    { baslik: "Çalışma başlığı", metin: girdi.calismaBasligi ?? "", oncelik: 2 },
    { baslik: "Toplanan kaynaklar", metin: kayitOzeti(girdi.kayitlar ?? []), oncelik: 3 },
  ];
  const baglam = baglamKur(parcalar, butce);
  const mesajlar: Mesaj[] = [
    { rol: "sistem", metin: SISTEM_ISTEMI },
    { rol: "kullanici", metin: baglam.metin },
  ];
  return { mesajlar, kaynak: baglam.metin, kirpilanlar: baglam.kirpilanlar };
}

/** Yanıttaki arama dizeleri ve bulgular. */
export function taramaCozumle(ham: string): LiteraturSonucu {
  const bulgular = bulgulariCozumle(ham);

  const bas = ham.indexOf("{");
  const son = ham.lastIndexOf("}");
  let aramalar: string[] = [];
  if (bas !== -1 && son > bas) {
    try {
      const veri = JSON.parse(ham.slice(bas, son + 1)) as { aramalar?: unknown };
      if (Array.isArray(veri.aramalar))
        aramalar = veri.aramalar
          .map((satir) => String(satir ?? "").replace(/\s+/g, " ").trim().slice(0, EN_UZUN_ARAMA))
          .filter(Boolean)
          .slice(0, EN_FAZLA_ARAMA);
    } catch {
      aramalar = [];
    }
  }

  return { bulgular, aramalar };
}

/**
 * Modelin kaynak uydurup uydurmadığına dair kaba bir işaret: künye biçimi
 * (Yazar, A. (2020). ya da "…" başlık) bulguda geçmemeli. Sayı denetimi
 * uydurma yılı yakalar ama uydurma yazar adını yakalayamaz; bu kontrol
 * istemin en kritik kuralını kodda da tutar.
 */
export function kunyeIzi(bulgular: Bulgu[]): boolean {
  return bulgular.some((bulgu) => /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]+,\s*[A-ZÇĞİÖŞÜ]\.\s*\(\d{4}\)/.test(bulgu.aciklama));
}
