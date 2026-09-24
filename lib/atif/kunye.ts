/*
  Tek künye ayrıştırıcı ve denetçi; stilden habersiz.

  Eskiden her stilin kendi yolu vardı ve yalnızca APA'nınki gerçekten
  denetliyordu: Chicago ayrıştırıcısı hiç sorun üretmiyor (issues her
  zaman boş), IEEE ve Vancouver künyeleri hiç okunmuyordu. Öğrenci
  Vancouver seçtiğinde belge kontrolü "sorun yok" diyordu — çünkü
  bakmamıştı. Burada tek motor var, farkı `lib/atif/stiller.ts` taşıyor.

  Saf modül; testi tests/unit/atif-kunye.test.ts.
*/

import { splitAuthors } from "@/lib/citation-format";
import { parseReferenceEntry, type ParsedReference, type ReferenceIssue } from "@/lib/apa7";
import { SOZCUK_BASI, SOZCUK_SONU, sozcuk } from "@/lib/sozcuk-siniri";
import { stilTanimi, type StilTanimi } from "./stiller";

/** Yıl ya da tarihsiz kaynak ("n.d." APA, "t.y." Türkçe). */
const YIL = "\\d{4}[a-z]?|n\\.d\\.|t\\.y\\.";
const PARANTEZ_YIL = new RegExp(`\\((${YIL})\\)`);
/** Chicago: "Yılmaz, Ahmet. 2020. …" — yıl yazardan sonra, parantezsiz. */
const YAZARDAN_SONRA = new RegExp(`^(.+?)\\.\\s+(${YIL})\\.?(?=\\s|$)`, "u");
/** Vancouver/IEEE: yıl künyenin sonlarında, noktalama arasında. */
const SONDA_YIL = /(?:^|[\s,;(])((?:19|20)\d{2})(?=[\s,;.:)]|$)/g;

const sorun = (field: string, message: string, severity: ReferenceIssue["severity"] = "warning"): ReferenceIssue =>
  ({ field, message, severity });

/** Künyedeki yazar alanlarını biçim desenine göre denetler. */
function yazarlariDenetle(yazarlar: string[], stil: StilTanimi, sorunlar: ReferenceIssue[]) {
  if (!stil.yazarBicimi) return;
  for (const [sira, yazar] of yazarlar.entries()) {
    // MLA'da yalnızca ilk yazar ters yazılır; sonrakilerin deseni ayrı.
    const ilkDegil = sira > 0 && stil.yazarBicimi.sonrakiDesen;
    const desen = ilkDegil ? stil.yazarBicimi.sonrakiDesen! : stil.yazarBicimi.desen;
    const ornek = ilkDegil ? stil.yazarBicimi.sonrakiOrnek ?? stil.yazarBicimi.ornek : stil.yazarBicimi.ornek;
    /*
      Kurum adı yazar olabilir ("Türkiye İstatistik Kurumu") ve hiçbir
      stilin yazar desenine uymaz. İçinde baş harf yoksa kurum sayılıp
      geçiliyor: kusursuz bir künyeye hata basmak, kullanıcıya bütün
      uyarıları görmezden gelmeyi öğretir.
    */
    if (!/[\p{Lu}]\./u.test(yazar) && yazar.split(/\s+/).length > 2) continue;
    if (!desen.test(yazar)) {
      sorunlar.push(sorun("author_format", `Yazar biçimi ${stil.ad} kuralına uymuyor olabilir: "${yazar}" (beklenen: "${ornek}")`));
    }
  }
}

/** Yazar-tarih stillerinde yılı parantezden ya da yazardan sonradan okur. */
function yazarTarihAyristir(ham: string, stil: StilTanimi): ParsedReference {
  const metin = ham.trim();
  const sorunlar: ReferenceIssue[] = [];

  const eslesme = stil.yilYeri === "parantez" ? PARANTEZ_YIL.exec(metin) : YAZARDAN_SONRA.exec(metin);
  if (!eslesme) {
    sorunlar.push(sorun("year", stil.yilYeri === "parantez"
      ? "Yıl parantez içinde bulunamadı, örn: (2023)."
      : `Yıl yazardan sonra bulunamadı, örn: "Yılmaz, Ahmet. 2023.".`, "error"));
    return { raw: metin, authors: null, year: null, title: null, issues: sorunlar };
  }

  const yil = stil.yilYeri === "parantez" ? eslesme[1] : eslesme[2];
  const yazarBolumu = stil.yilYeri === "parantez" ? metin.slice(0, eslesme.index).trim() : eslesme[1].trim();
  const yazarlar = splitAuthors(yazarBolumu);

  if (!yazarlar.length) sorunlar.push(sorun("author", "Yazar adı ayrıştırılamadı.", "error"));
  else yazarlariDenetle(yazarlar, stil, sorunlar);

  // Başlık: yıldan sonraki ilk cümle.
  const yildanSonra = metin.slice((eslesme.index ?? 0) + eslesme[0].length).trim();
  const baslik = yildanSonra.match(/^[.\s"“]*([^.]+)\./)?.[1]?.trim() ?? null;
  if (!baslik) sorunlar.push(sorun("title", "Başlık bulunamadı ya da noktalama hatalı."));

  return { raw: metin, authors: yazarlar.length ? yazarlar : null, year: yil, title: baslik, issues: sorunlar };
}

/**
 * Numara stilleri (IEEE, Vancouver).
 *
 * `sira` beklenen numaradır: künyeler kaynakçadaki sırayla gelir ve
 * numaralandırma atlamamalıdır. Atlanan numara sessiz bir hatadır —
 * metindeki [7] başka bir kaynağa denk gelir ve kimse fark etmez.
 */
const parcalaraAyir = (metin: string) =>
  metin
    .split(/,\s*|\s+(?:ve|and)\s+/u)
    .map((parca) => parca.trim().replace(VE_DIGERLERI, "").trim());

/** Vancouver: "Yılmaz A, Demir B. Başlık." — yazarlar ilk noktaya kadar. */
function noktayaKadarYazarlar(govde: string) {
  return {
    yazarlar: parcalaraAyir(govde.split(/\.\s/)[0] ?? "").filter(Boolean),
    baslikAdayi: govde.split(/\.\s/)[1]?.trim() ?? null,
  };
}

/**
 * IEEE: "[1] A. Yılmaz, B. Demir, “Başlık,” Dergi, 2020."
 *
 * Ad baş harfle başladığı için ilk nokta yazarın İÇİNDE; noktaya göre
 * kesmek her künyede yazarı "A" diye okuyordu, yani IEEE'yi doğru yazan
 * öğrenci kusursuz kaynakçasında "yazar biçimi hatalı" uyarısı alıyordu.
 * Liste, yazar biçimine uymayan ilk parçada biter.
 */
function virgulluYazarlar(govde: string, stil: StilTanimi) {
  const parcalar = parcalaraAyir(govde);
  const yazarlar: string[] = [];
  let kalanDan = parcalar.length;
  for (const [sira, parca] of parcalar.entries()) {
    // "vd." gibi işaretler ayıklanınca boşalır; listeyi BİTİRMEZLER.
    if (!parca) continue;
    if (!stil.yazarBicimi?.desen.test(parca)) {
      kalanDan = sira;
      break;
    }
    yazarlar.push(parca);
  }
  const kalan = parcalar.slice(kalanDan).filter(Boolean);
  /*
    Başlık tırnak içindeyse onu al: kalan ilk parça "“Başlık" gibi yarım
    kalıyor, çünkü başlığın kendi virgülü de ayırıcı sayılıyor.
  */
  // IEEE'de başlığı izleyen virgül TIRNAĞIN İÇİNDE durur; başlığın parçası değil.
  const tirnakli = /[“"]([^”"]+)[”"]/u.exec(govde);
  const baslikAdayi = tirnakli?.[1]?.replace(/,\s*$/, "").trim() || kalan[0] || null;
  /*
    Hiçbir parça yazar biçimine uymadıysa (kurum adı: "Türkiye İstatistik
    Kurumu") liste boş dönerdi ve kullanıcı "yazar ayrıştırılamadı" görürdü.
    İlk parçayı yazar saymak denetimin ona bakmasını sağlar; asıl bilgi
    biçim uyarısında.
  */
  return { yazarlar: yazarlar.length ? yazarlar : parcalar.filter(Boolean).slice(0, 1), baslikAdayi };
}

function numaraAyristir(ham: string, stil: StilTanimi, sira: number): ParsedReference {
  const metin = ham.trim();
  const sorunlar: ReferenceIssue[] = [];
  const numara = stil.numara!;

  const numaraEslesme = numara.kunyeKalibi.exec(metin);
  if (!numaraEslesme) {
    sorunlar.push(sorun("number", `Künye numarayla başlamıyor; ${stil.ad} kaynakçasında her kaynak ${numara.etiket(sira)} ile başlar.`, "error"));
  } else if (Number(numaraEslesme[1]) !== sira) {
    sorunlar.push(sorun("number", `Kaynak ${numara.etiket(Number(numaraEslesme[1]))} numarasıyla yazılmış ama kaynakçada ${sira}. sırada; numaralandırma atlanmış olabilir.`, "error"));
  }

  const govde = numaraEslesme ? metin.slice(numaraEslesme[0].length) : metin;

  /* Yıl künyenin sonlarında; birden çok dört haneli sayı olabilir
     (cilt, sayfa aralığı), sonuncusu yıl sayılıyor. */
  const yillar = [...govde.matchAll(SONDA_YIL)].map((e) => e[1]);
  const yil = yillar.at(-1) ?? null;
  if (!yil) sorunlar.push(sorun("year", "Künyede yayın yılı bulunamadı.", "error"));

  /* Yazar bölümü: Vancouver'da ilk noktaya kadar, IEEE'de yazar biçimine
     uyan parçalar bitene kadar (bkz. StilTanimi.yazarlarVirgulle). */
  const { yazarlar, baslikAdayi } = stil.yazarlarVirgulle
    ? virgulluYazarlar(govde, stil)
    : noktayaKadarYazarlar(govde);
  if (!yazarlar.length) sorunlar.push(sorun("author", "Yazar adı ayrıştırılamadı.", "error"));
  else yazarlariDenetle(yazarlar, stil, sorunlar);

  const baslik = baslikAdayi;
  if (!baslik) sorunlar.push(sorun("title", "Başlık bulunamadı; künyede yazarlardan sonra eser adı gelmeli."));

  return { raw: metin, authors: yazarlar.length ? yazarlar : null, year: yil, title: baslik, issues: sorunlar };
}

/**
 * Yazar-sayfa stili (MLA).
 *
 * Künye yazar-tarih stillerine benzer ama yıl SONDA durur:
 *   "Yılmaz, Ahmet. Tezin Adı. Yayınevi, 2020."
 * Yıl orada olmadığı için yazar-tarih ayrıştırıcısı bu künyeleri hiç
 * okuyamazdı; numara ayrıştırıcısı da yazarları virgülden bölerek
 * "Yılmaz" ile "Ahmet"i iki ayrı yazar sanırdı.
 */
function yazarSayfaAyristir(ham: string, stil: StilTanimi): ParsedReference {
  const metin = ham.trim();
  const sorunlar: ReferenceIssue[] = [];

  const yazarBolumu = metin.split(/\.\s/)[0] ?? "";
  const yazarlar = splitAuthors(yazarBolumu);
  if (!yazarlar.length) sorunlar.push(sorun("author", "Yazar adı ayrıştırılamadı.", "error"));
  else yazarlariDenetle(yazarlar, stil, sorunlar);

  /* Yıl künyenin sonlarında; cilt/sayı/sayfa da dört haneli olabildiği
     için sonuncusu yıl sayılıyor (numara stilleriyle aynı ölçüt). */
  const yillar = [...metin.matchAll(SONDA_YIL)].map((e) => e[1]);
  const yil = yillar.at(-1) ?? null;
  if (!yil) sorunlar.push(sorun("year", `Künyede yayın yılı bulunamadı; ${stil.ad} künyesinde yıl sonda yer alır.`, "error"));

  // Başlık: yazarlardan sonraki ilk cümle. Tırnak içinde de olabilir.
  const baslik = metin.split(/\.\s/)[1]?.trim().replace(/^[“"']|[”"']$/g, "") ?? null;
  if (!baslik) sorunlar.push(sorun("title", "Başlık bulunamadı; künyede yazarlardan sonra eser adı gelmeli."));

  return { raw: metin, authors: yazarlar.length ? yazarlar : null, year: yil, title: baslik, issues: sorunlar };
}

/**
 * Bir künyeyi stiline göre ayrıştırır ve denetler.
 *
 * APA yolu bilerek eski motora bırakıldı (`lib/apa7.ts`): orada yıllar
 * içinde biriken ayrıntılar var (Türkçe "ve" ayırıcısı, üç baş harf,
 * DOI beklentisi) ve hepsi testlerle sabitlenmiş. Yeniden yazmak
 * kazanılmış davranışı kaybetme riskiydi.
 */
/*
  "ve diğerleri" / "vd." / "et al." ayıklaması.

  "vd." Türkçedeki en yaygın biçim ve eskiden HİÇ ayıklanmıyordu: desen
  `\\bvd\\.\\b` idi, sondaki \\b noktadan SONRA bir sözcük karakteri istiyor,
  oysa "vd." her zaman boşluk ya da parantezle devam ediyor. Sonuç:
  "Yılmaz, A., vd. (2020)" künyesinde "vd." bir YAZAR sayılıyor ve yazar
  biçimi denetimi olmayan bir hata bildiriyordu.
*/
const VE_DIGERLERI = new RegExp(
  [
    sozcuk("ve\\s+diğerleri"),
    // Nokta İSTEĞE BAĞLI: yazar bölümü ilk ". " ile kesildiği için token
    // çoğu künyede noktasız ("vd") geliyor; zorunlu tutulsa hiç eşleşmezdi.
    `${SOZCUK_BASI}vd\\.?${SOZCUK_SONU}`,
    `${SOZCUK_BASI}et\\s+al\\.?${SOZCUK_SONU}`,
    // "ve diğerleri" ayırıcıda bölününce geriye yalnız bu sözcük kalıyor.
    sozcuk("diğerleri"),
  ].join("|"),
  "giu",
);

export function kunyeAyristir(ham: string, stilDegeri: string | null | undefined, sira = 1): ParsedReference {
  const stil = stilTanimi(stilDegeri);
  if (stil.id === "apa7") return parseReferenceEntry(ham);
  if (stil.tur === "numara") return numaraAyristir(ham, stil, sira);
  if (stil.tur === "yazar-sayfa") return yazarSayfaAyristir(ham, stil);
  return yazarTarihAyristir(ham, stil);
}

/** Kaynakçanın tamamı; numara stillerinde sıra numarası künyeye geçer. */
export function kunyeleriAyristir(kunyeler: string[], stilDegeri: string | null | undefined): ParsedReference[] {
  return kunyeler.map((ham, indeks) => kunyeAyristir(ham, stilDegeri, indeks + 1));
}

/**
 * Kaynakça metnini künyelere böler (apa7.parseReferenceList ile aynı ölçüt:
 * bir-iki satır sonu ayırır, 10 karakterden kısa satır künye sayılmaz).
 *
 * Burada duruyor çünkü iki ekran birden kullanıyor: Atıf Kontrolü ve
 * editördeki "Kontrol Et". Eylem dosyasında ("use server") kalsaydı
 * dışarıdan çağrılabilen bir uç noktaya dönüşürdü.
 */
export function kunyeleriBol(ham: string): string[] {
  return ham
    .split(/\n{1,2}/)
    .map((satir) => satir.trim())
    .filter((satir) => satir.length > 10);
}
