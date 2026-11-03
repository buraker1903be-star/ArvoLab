/*
  Şekil ve tablo başlıklarının numaralandırması.

  Eskiden başlıklar SIRAYA göre numaralanmış sayılıyordu: belgedeki
  üçüncü tablo başlığı "Tablo 3" kabul ediliyor, başlığın içinde ne
  yazdığına hiç bakılmıyordu. İki sonucu vardı:

  1. Yanlış numaralandırma HİÇ yakalanmıyordu. Öğrenci "Tablo 1",
     "Tablo 3", "Tablo 3" yazsa denetim sessiz kalıyordu — oysa jüriye
     giden belgede iki tane "Tablo 3" var.
  2. Mevcut uyarı yanıltıcı olabiliyordu. Başlıklar 1, 3, 4 diye
     numaralanmışsa denetim "Şekil 2 metinde anılmıyor" diyordu; oysa
     belgede Şekil 2 diye bir şey yok. Var olmayan bir şeyi aramaya
     gönderilen kullanıcı, uyarılara güvenmeyi bırakır.

  Kılavuzlar iki düzen kullanır: sürekli ("Tablo 7") ve bölüme göre
  ("Tablo 3.1"). İkisi de kabul edilir, ama KARIŞIK kullanım hatadır.

  Saf modül; testi tests/unit/sekil-tablo-numaralari.test.ts.

  `etiket` BELGENİN etiketidir ("Tablo", "Table", "Ek", "Appendix"),
  `dil` ise mesajın dili; ikisi ayrı, çünkü Türkçe arayüzde İngilizce
  tez yazılabiliyor.
*/

import type { Dil } from "@/lib/dil";

export type BaslikKaydi = {
  /** Başlığın tam metni ("Tablo 3.1. Katılımcıların dağılımı"). */
  metin: string;
  /** Başlıkta yazan numara ("3.1"); bulunamazsa null. */
  numara: string | null;
};

export type NumaraSorunu = {
  tone: "danger" | "warning";
  message: string;
  target?: string;
};

/** "Tablo 3.1. Başlık" → "3.1"; "Şekil 7 – Başlık" → "7" */
export function baslikNumarasi(etiket: string, metin: string): string | null {
  const desen = new RegExp(`^\\s*${etiket}\\s*([\\d]+(?:\\.[\\d]+)*)`, "iu");
  return desen.exec(metin)?.[1] ?? null;
}

/** Bölüme göre numaralandırma ("3.1") mı, sürekli ("7") mü. */
const bolumlu = (numara: string) => numara.includes(".");

/**
 * Başlıkları okuyup numaralandırma sorunlarını döndürür.
 *
 * Numarası okunamayan başlık için de uyarı verilir: kılavuzların
 * tamamı başlığın "Tablo 1." gibi numarayla başlamasını ister ve
 * numarasız başlık metinden anılamaz.
 */
export function numaralandirmaSorunlari(etiket: string, basliklar: string[], dil: Dil = "tr"): NumaraSorunu[] {
  const sorunlar: NumaraSorunu[] = [];
  if (!basliklar.length) return sorunlar;
  const en = dil === "en";

  const kayitlar: BaslikKaydi[] = basliklar.map((metin) => ({ metin, numara: baslikNumarasi(etiket, metin) }));
  const kucuk = en ? etiket.toLowerCase() : etiket.toLocaleLowerCase("tr-TR");

  for (const kayit of kayitlar) {
    if (!kayit.numara) {
      sorunlar.push({
        tone: "warning",
        message: en
          ? `A ${kucuk} caption does not start with a number (expected: "${etiket} 1. …"): ${kayit.metin.slice(0, 60) || "(empty caption)"}`
          : `Bir ${kucuk} başlığı numarayla başlamıyor (beklenen: "${etiket} 1. …"): ${kayit.metin.slice(0, 60) || "(boş başlık)"}`,
        target: kayit.metin || undefined,
      });
    }
  }

  const numarali = kayitlar.filter((kayit): kayit is BaslikKaydi & { numara: string } => Boolean(kayit.numara));
  if (!numarali.length) return sorunlar;

  // Karışık düzen: bir kısmı "3.1", bir kısmı "7".
  const bolumluSayisi = numarali.filter((kayit) => bolumlu(kayit.numara)).length;
  if (bolumluSayisi > 0 && bolumluSayisi < numarali.length) {
    sorunlar.push({
      tone: "danger",
      message: en
        ? `${etiket} numbering is mixed: some by chapter ("${etiket} 3.1"), some continuous ("${etiket} 7"). Guidelines require a single scheme.`
        : `${etiket} numaralandırması karışık: bir kısmı bölüme göre ("${etiket} 3.1"), bir kısmı sürekli ("${etiket} 7"). Kılavuzlar tek düzen ister.`,
    });
  }

  // Aynı numaranın iki kez kullanılması.
  const sayim = new Map<string, number>();
  for (const kayit of numarali) sayim.set(kayit.numara, (sayim.get(kayit.numara) ?? 0) + 1);
  for (const [numara, adet] of sayim) {
    if (adet > 1) {
      sorunlar.push({
        tone: "danger",
        message: en
          ? `“${etiket} ${numara}” is used ${adet} times; each ${kucuk} must have a unique number.`
          : `“${etiket} ${numara}” ${adet} kez kullanılmış; her ${kucuk} tek numara taşımalı.`,
        target: `${etiket} ${numara}`,
      });
    }
  }

  /*
    Sıra denetimi. Bölüme göre numaralandırmada her bölüm kendi içinde
    1'den başlar; sürekli düzende belge boyunca 1'den devam eder.
    Atlanan numara ("1, 2, 4") sessiz bir hatadır: metindeki gönderme
    başka bir tabloya denk gelir.
  */
  const gruplar = new Map<string, number[]>();
  for (const kayit of numarali) {
    const parcalar = kayit.numara.split(".");
    const grup = parcalar.length > 1 ? parcalar.slice(0, -1).join(".") : "";
    const son = Number(parcalar.at(-1));
    if (!Number.isFinite(son)) continue;
    gruplar.set(grup, [...(gruplar.get(grup) ?? []), son]);
  }
  for (const [grup, numaralar] of gruplar) {
    const benzersiz = [...new Set(numaralar)].sort((a, b) => a - b);
    const onek = grup ? `${grup}.` : "";
    if (benzersiz[0] !== 1) {
      sorunlar.push({
        tone: "warning",
        message: en
          ? `${etiket} numbers start at ${onek}${benzersiz[0]}; they should start at ${onek}1.`
          : `${etiket} numaraları ${onek}${benzersiz[0]} ile başlıyor; ${onek}1 ile başlamalı.`,
      });
    }
    for (let sira = 1; sira < benzersiz.length; sira += 1) {
      if (benzersiz[sira] !== benzersiz[sira - 1] + 1) {
        sorunlar.push({
          tone: "danger",
          message: en
            ? `${etiket} numbering skips: ${onek}${benzersiz[sira - 1]} is followed by ${onek}${benzersiz[sira]}.`
            : `${etiket} numaralandırmasında atlama var: ${onek}${benzersiz[sira - 1]} sonrası ${onek}${benzersiz[sira]} geliyor.`,
        });
        break;
      }
    }
  }

  return sorunlar;
}

/*
  METİNDE ANILAN NUMARALAR (03.11.2026). Türkçe atıf ekleri ve
  aralıklarla: "Şekil 1'de", "Şekil 1’deki", "Tablo 3'te", "Tablo 8'den",
  "Tablo 4 ve 5", "Tablo 4–6", "Tablolar 4, 5 ve 6", "(bkz. Tablo 2)".
  Eskiden yalnızca ilk numara alınıyordu: "Tablo 4 ve 5" yazan öğrenci
  Tablo 5 için "metinde anılmıyor" uyarısı alıyordu. Apostrof (' ya da ’)
  numaradan sonra geldiği için ek ayrıca ele alınmıyor; numaranın hemen
  ardından harf ya da rakam gelmemesi yeterli ("Tablo 12" ≠ "Tablo 1").
*/
/*
  Virgüllü liste yalnızca "ve/ile/and/&" ile bitiyorsa liste sayılır
  ("Tablo 4, 5 ve 6"); yoksa "Tablo 2, 2020 yılında…" cümlesindeki yıl
  tablo numarası sanılırdı.
*/
export function anilanNumaralar(metin: string, etiket: string): Set<string> {
  const N = String.raw`\d+(?:\.\d+)*`;
  const BAG = String.raw`\s*(?:ve|ile|and|&)\s*`;
  const liste = String.raw`${N}(?:\s*,\s*${N})*${BAG}${N}`;
  const aralik = String.raw`\d+\s*[–—-]\s*\d+`;
  const desen = new RegExp(
    String.raw`(?<![\p{L}\p{N}])${etiket}(?:lar|ler|s)?\s*[-–.]?\s*(${liste}|${aralik}|${N})(?![\p{N}]|\.\d)`,
    "giu",
  );
  const sonuc = new Set<string>();
  for (const eslesme of metin.matchAll(desen)) {
    const grup = eslesme[1];
    const uclar = /^(\d+)\s*[–—-]\s*(\d+)$/u.exec(grup);
    if (uclar) {
      const [a, b] = [Number(uclar[1]), Number(uclar[2])];
      sonuc.add(uclar[1]);
      if (b > a && b - a < 50) for (let n = a + 1; n <= b; n++) sonuc.add(String(n));
      else sonuc.add(uclar[2]);
      continue;
    }
    for (const parca of grup.split(/\s*(?:,|ve|ile|and|&)\s*/u)) if (parca) sonuc.add(parca);
  }
  return sonuc;
}

/*
  ADLANDIRICI OLMAYAN BAŞLIK. "Şekil 1. Kaynak: TÜİK verilerinden…"
  yalnızca kaynağı söyler, şeklin NE gösterdiğini söylemez (örnek tezde
  böyleydi). "'de enflasyondaki…" ise bir metin içi atfın ("Şekil 1'de …")
  başlık olarak işaretlenmiş hâlidir: numara silinince geriye ek kalır.
*/
export function baslikAdlandirmaSorunu(baslikMetni: string): "kaynak-yalniz" | "atif-cumlesi" | null {
  const metin = baslikMetni.trim();
  if (/^(?:kaynak|kaynakça|source|not|note)\s*:/iu.test(metin)) return "kaynak-yalniz";
  if (/^['’]\s*\p{Ll}/u.test(metin)) return "atif-cumlesi";
  return null;
}
