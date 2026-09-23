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
*/

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
export function numaralandirmaSorunlari(etiket: string, basliklar: string[]): NumaraSorunu[] {
  const sorunlar: NumaraSorunu[] = [];
  if (!basliklar.length) return sorunlar;

  const kayitlar: BaslikKaydi[] = basliklar.map((metin) => ({ metin, numara: baslikNumarasi(etiket, metin) }));
  const kucuk = etiket.toLocaleLowerCase("tr-TR");

  for (const kayit of kayitlar) {
    if (!kayit.numara) {
      sorunlar.push({
        tone: "warning",
        message: `Bir ${kucuk} başlığı numarayla başlamıyor (beklenen: "${etiket} 1. …"): ${kayit.metin.slice(0, 60) || "(boş başlık)"}`,
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
      message: `${etiket} numaralandırması karışık: bir kısmı bölüme göre ("${etiket} 3.1"), bir kısmı sürekli ("${etiket} 7"). Kılavuzlar tek düzen ister.`,
    });
  }

  // Aynı numaranın iki kez kullanılması.
  const sayim = new Map<string, number>();
  for (const kayit of numarali) sayim.set(kayit.numara, (sayim.get(kayit.numara) ?? 0) + 1);
  for (const [numara, adet] of sayim) {
    if (adet > 1) {
      sorunlar.push({ tone: "danger", message: `“${etiket} ${numara}” ${adet} kez kullanılmış; her ${kucuk} tek numara taşımalı.`, target: `${etiket} ${numara}` });
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
      sorunlar.push({ tone: "warning", message: `${etiket} numaraları ${onek}${benzersiz[0]} ile başlıyor; ${onek}1 ile başlamalı.` });
    }
    for (let sira = 1; sira < benzersiz.length; sira += 1) {
      if (benzersiz[sira] !== benzersiz[sira - 1] + 1) {
        sorunlar.push({
          tone: "danger",
          message: `${etiket} numaralandırmasında atlama var: ${onek}${benzersiz[sira - 1]} sonrası ${onek}${benzersiz[sira]} geliyor.`,
        });
        break;
      }
    }
  }

  return sorunlar;
}
