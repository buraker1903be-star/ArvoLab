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
  for (const yazar of yazarlar) {
    /*
      Kurum adı yazar olabilir ("Türkiye İstatistik Kurumu") ve hiçbir
      stilin yazar desenine uymaz. İçinde baş harf yoksa kurum sayılıp
      geçiliyor: kusursuz bir künyeye hata basmak, kullanıcıya bütün
      uyarıları görmezden gelmeyi öğretir.
    */
    if (!/[\p{Lu}]\./u.test(yazar) && yazar.split(/\s+/).length > 2) continue;
    if (!stil.yazarBicimi.desen.test(yazar)) {
      sorunlar.push(sorun("author_format", `Yazar biçimi ${stil.ad} kuralına uymuyor olabilir: "${yazar}" (beklenen: "${stil.yazarBicimi.ornek}")`));
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

  /* Yazar bölümü ilk noktaya kadar; Vancouver'da yazarlar virgülle,
     IEEE'de "and" ile ayrılır. */
  const yazarBolumu = govde.split(/\.\s/)[0] ?? "";
  const yazarlar = yazarBolumu
    .split(/,\s*|\s+(?:ve|and)\s+/u)
    .map((parca) => parca.trim().replace(/\bve\s+diğerleri\b|\bvd\.\b|\bet al\.?\b/giu, "").trim())
    .filter(Boolean);
  if (!yazarlar.length) sorunlar.push(sorun("author", "Yazar adı ayrıştırılamadı.", "error"));
  else yazarlariDenetle(yazarlar, stil, sorunlar);

  const baslik = govde.split(/\.\s/)[1]?.trim() ?? null;
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
export function kunyeAyristir(ham: string, stilDegeri: string | null | undefined, sira = 1): ParsedReference {
  const stil = stilTanimi(stilDegeri);
  if (stil.id === "apa7") return parseReferenceEntry(ham);
  if (stil.tur === "numara") return numaraAyristir(ham, stil, sira);
  return yazarTarihAyristir(ham, stil);
}

/** Kaynakçanın tamamı; numara stillerinde sıra numarası künyeye geçer. */
export function kunyeleriAyristir(kunyeler: string[], stilDegeri: string | null | undefined): ParsedReference[] {
  return kunyeler.map((ham, indeks) => kunyeAyristir(ham, stilDegeri, indeks + 1));
}
