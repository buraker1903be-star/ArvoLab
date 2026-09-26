// Ekrandaki sayıların dürüstlük denetimi.
//
//   npm run check:rakamlar
//
// Neden var: bu kalıp ArvoOS'ta beş sayfada dört kez çıktı ve denetim orada
// yazıldı (scripts/check-rakamlar.mjs). 26.09.2026'da ArvoLab'da da İKİ kez
// bulundu, ikisi de AGENTS.md'nin "asıl varlık" dediği ai_assistant_runs
// üzerinde: ince ayar dışa aktarımı ve model karşılaştırması .limit(5000)
// ile okuyordu, üstelik sıralama olmadan. Denetim buraya taşındı.
//
// Hiçbiri derlemede, lint'te ya da testte görünmez: sorgu çalışır, sayı
// ekrana yazılır, yalnızca YANLIŞ olur — ve sınıra ulaşılana kadar hiçbir
// belirti vermez.
//
// KALIP 1 — sınırlı sorgudan toplam ya da SAYIM.
//   .limit(n) ile çekilen satırları .reduce() ile toplamak, bir döngüde
//   += / ++ ile biriktirmek ya da .filter(…).length ile saymak. Sınır
//   aşıldığında sayı sessizce eksilir; listeye hiç girmeyen kayıt varsa
//   ekranda yokmuş gibi görünür.
//
// KALIP 2 — tuzak sütun.
//   Adı doğru gelen ama başka bir şey tutan yerden okumak. ArvoLab'ın
//   bilinen tuzağı extracted_rules: kılavuzun ÇALIŞMA HÂLİNDEKİ kuralları,
//   öğrencinin editörüne inen sürüm değil (o approved_snapshot'ta).
//
// Bu denetim sayının DOĞRU olduğunu kanıtlamaz; yalnızca bu iki kalıbı
// yakalar. Bilerek yapılan bir kullanım varsa satırın kendisine ya da
// hemen üstündeki yorum bloğuna `tuzak-tamam: <sebep>` yazın — sebebi
// yazmak, denetimi susturmanın bedeli. Yeni bir tuzak öğrenildiğinde
// aşağıdaki listeye eklenir.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
  Kök argümandan verilebiliyor: denetimin KENDİSİ sınanabilsin diye
  (tests/unit/check-rakamlar.test.ts sabit bir örnek ağaca karşı koşuyor).
  Denetimin sessizce kör kalması, denetlediği hatadan farksız.
*/
const root = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARANAN = ["app", "lib"];

/*
  Tuzak sütunlar.

  KAPSAM önemli: extracted_rules kılavuz panelinde ve tarama yolunda DOĞRU
  alan — çalışma hâlindeki kurallar orada tutuluyor, yönetici onları
  düzenleyip onaylıyor. Tuzak olduğu yer bunun dışı: öğrencinin editörüne,
  Word çıktısına ya da denetimlere inen sürüm approved_snapshot'taki
  kopyadır (lib/guideline-rules.ts → appliedGuidelineFromRow). Kuralı her
  yere uygulamak altı uyarı üretip denetimi okunmaz yapardı; okunmaz bir
  denetim, olmayan denetimdir.
*/
const KILAVUZ_YUZEYI = (yol) =>
  /^app\/actions\/guideline|^app\/dashboard\/guidelines\/|^app\/api\/cron\/guideline-refresh\/|^lib\/(guideline-|kilavuz-)/.test(yol);
const KILAVUZ_DISI = (yol) => !KILAVUZ_YUZEYI(yol);

const TUZAKLAR = [
  {
    ad: "extracted_rules",
    kapsam: KILAVUZ_DISI,
    sebep:
      "kılavuzun ÇALIŞMA HÂLİNDEKİ kuralları; onaylanmamış olabilir. Öğrencinin editörüne inen sürüm " +
      "approved_snapshot içindedir — appliedGuidelineFromRow (lib/guideline-rules.ts) ikisini tek yerde çözüyor",
  },
];

const KACIS = /tuzak-tamam\s*:/;

/*
  Yorumları ve dizgileri boşluğa çevirir; uzunluk korunur, bu yüzden satır
  numaraları kaymaz. Yorum içinde geçen tablo adları yüzünden uyarı
  üretiliyordu — bu denetimin kendi açıklamasını bile suçluyordu.
*/
function koduAyikla(kaynak) {
  let cikti = "";
  let i = 0;
  const bosalt = (metin) => metin.replace(/[^\n]/g, " ");
  while (i < kaynak.length) {
    const iki = kaynak.slice(i, i + 2);
    if (iki === "//") {
      const son = kaynak.indexOf("\n", i);
      const bitis = son === -1 ? kaynak.length : son;
      cikti += bosalt(kaynak.slice(i, bitis));
      i = bitis;
    } else if (iki === "/*") {
      const son = kaynak.indexOf("*/", i + 2);
      const bitis = son === -1 ? kaynak.length : son + 2;
      cikti += bosalt(kaynak.slice(i, bitis));
      i = bitis;
    } else if (kaynak[i] === '"' || kaynak[i] === "'" || kaynak[i] === "`") {
      // Dizgiler DURUYOR: .from("tablo") ve .select("sütun") burada okunuyor.
      const tirnak = kaynak[i];
      let j = i + 1;
      while (j < kaynak.length && kaynak[j] !== tirnak) {
        if (kaynak[j] === "\\") j += 1;
        j += 1;
      }
      cikti += kaynak.slice(i, Math.min(j + 1, kaynak.length));
      i = j + 1;
    } else {
      cikti += kaynak[i];
      i += 1;
    }
  }
  return cikti;
}

/** Dosyaları topla. */
function dosyalar(dizin, bulunan = []) {
  for (const oge of fs.readdirSync(dizin, { withFileTypes: true })) {
    const tam = path.join(dizin, oge.name);
    if (oge.isDirectory()) {
      if (oge.name === "node_modules" || oge.name === ".next") continue;
      dosyalar(tam, bulunan);
    } else if (/\.(ts|tsx)$/.test(oge.name)) {
      bulunan.push(tam);
    }
  }
  return bulunan;
}

/** Üst seviye virgülden böler: parantez/köşeli/süslü içindekiler bölünmez. */
function ustSeviyeBol(metin) {
  const parcalar = [];
  let derinlik = 0;
  let bas = 0;
  for (let i = 0; i < metin.length; i += 1) {
    const k = metin[i];
    if (k === "(" || k === "[" || k === "{") derinlik += 1;
    else if (k === ")" || k === "]" || k === "}") derinlik -= 1;
    else if (k === "," && derinlik === 0) {
      parcalar.push(metin.slice(bas, i));
      bas = i + 1;
    }
  }
  parcalar.push(metin.slice(bas));
  return parcalar;
}

/**
 * `{ data: x, error }` içinden x'i, `{ data, error }` içinden "data"yı çıkarır.
 *
 * KISAYOL biçimi eskiden tanınmıyordu: yalnızca `data:` arayan kalıp
 * `const { data } = await …limit(300)` yazan kodu hiç görmüyordu. WhatsApp
 * gelen kutusu (26.09.2026) tam bu yazımla yazılmıştı; denetim bu yüzden
 * .reduce() dalıyla bile yakalayamazdı.
 */
const dataAdi = (kalip) => {
  const takma = kalip.match(/\bdata\s*:\s*([A-Za-z_$][\w$]*)/);
  if (takma) return takma[1];
  return /\bdata\b\s*(?![:\w])/.test(kalip) ? "data" : null;
};

/**
 * Sınırlı sorgudan gelen değişken adları.
 *
 * İki yazım var ve ikisi de kullanılıyor:
 *   const { data: x } = await supabase.from(…).limit(50)
 *   const [{ data: a }, { data: b }] = await Promise.all([ …, … ])
 * İkincisinde eşleşme SIRAYA göre: birinci yıkım birinci sorguya denk.
 */
function sinirliAdlar(kaynak) {
  /*
    Bağlanmalar KONUMUYLA tutuluyor, düz bir ad kümesiyle değil.

    "data" bu kod tabanındaki en yaygın değişken adı ve aynı dosyada bir
    eylem onu .limit()'li, bir başkası sınırsız sorgudan bağlıyor. Ad kümesi
    tutmak, sınırsız sorgudan gelen sayımı da suçluyordu — yani denetim en
    sık karşılaşılan yazımda yanlış alarm veriyordu. Okunmaz bir denetim,
    olmayan denetimdir.

    Kural: bir adın o satırdaki durumunu, ONDAN ÖNCEKİ SON bağlanması
    söyler. Yeniden bağlanmak sınırı temizler.
  */
  const baglanmalar = new Map();
  const ekle = (ad, index, sinirli) => {
    if (!ad) return;
    if (!baglanmalar.has(ad)) baglanmalar.set(ad, []);
    baglanmalar.get(ad).push({ index, sinirli });
  };

  for (const m of kaynak.matchAll(/const\s*\{([^{}]*)\}\s*=\s*await\s+[\s\S]*?;/g)) {
    ekle(dataAdi(m[1]), m.index + m[0].length, /\.limit\(/.test(m[0]));
  }

  for (const m of kaynak.matchAll(/const\s*\[([\s\S]*?)\]\s*=\s*await\s+Promise\.all\(\s*\[([\s\S]*?)\]\s*\)\s*;/g)) {
    const hedefler = ustSeviyeBol(m[1]);
    const sorgular = ustSeviyeBol(m[2]);
    hedefler.forEach((hedef, sira) => {
      const sorgu = sorgular[sira];
      if (!sorgu) return;
      ekle(dataAdi(hedef), m.index + m[0].length, /\.limit\(/.test(sorgu));
    });
  }

  const sinirliMi = (ad, konum) => {
    const liste = baglanmalar.get(ad);
    if (!liste) return false;
    let son = null;
    for (const b of liste) {
      if (b.index < konum) son = b;
    }
    return Boolean(son?.sinirli);
  };

  /*
    Türev adlar: `const satirlar = (data ?? []) as T[]` ve ardından
    `const odeyenler = satirlar.filter(…)`. Sınır türevlerde de duruyor;
    üç geçiş zincirin bu derinliğine yetiyor.
  */
  for (let gecis = 0; gecis < 3; gecis += 1) {
    for (const m of kaynak.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g)) {
      const [, hedef, sag] = m;
      const son = m.index + m[0].length;
      if (sinirliMi(hedef, son + 1)) continue;
      const tureyen = [...baglanmalar.keys()].some(
        (ad) => new RegExp(`\\b${ad}\\b`).test(sag) && sinirliMi(ad, m.index),
      );
      if (tureyen && /\?\?\s*\[\]|\.filter\(|\.map\(|\.slice\(|\.\.\./.test(sag)) ekle(hedef, son, true);
    }
  }

  return { adlar: [...baglanmalar.keys()], sinirliMi };
}

/**
 * `for (… of ad)` / `ad.forEach(…)` gövdesi: eşleşen kapanışa kadar.
 *
 * Döngünün KENDİSİ suç değil — sınırlı bir listeyi ekrana dizmek doğru.
 * Suç, o döngüde SAYI BİRİKTİRMEK: sınır aşıldığında liste kısalır,
 * biriken sayı da sessizce eksilir.
 */
function dongununGovdesi(kaynak, baslangic) {
  let i = baslangic;
  while (i < kaynak.length && /\s/.test(kaynak[i])) i += 1;

  /*
    Süslü parantezsiz gövde: `for (const s of liste) toplam += s.x;`

    Eskiden gövde "baştan sonraki ilk {" diye aranıyordu ve tek satırlık
    döngüde bu, BAMBAŞKA bir bloğu (çoğu zaman sonraki fonksiyonun
    gövdesini) denetlemek demekti. Biriktirme orada görünmediği için desen
    sessizce kaçıyordu — üstelik bu yazım, tek satırlık toplamanın en
    doğal hâli.
  */
  if (kaynak[i] !== "{") {
    const son = kaynak.indexOf(";", i);
    return kaynak.slice(i, son === -1 ? Math.min(kaynak.length, i + 200) : son + 1);
  }

  let derinlik = 0;
  for (let j = i; j < kaynak.length; j += 1) {
    if (kaynak[j] === "{") derinlik += 1;
    else if (kaynak[j] === "}") {
      derinlik -= 1;
      if (derinlik === 0) return kaynak.slice(i, j + 1);
    }
  }
  return kaynak.slice(i);
}

/** `.forEach(` sonrası geri çağırmanın gövdesi: ok işaretinden sonrası. */
function geriCagirmaninGovdesi(kaynak, bas) {
  const ok = kaynak.indexOf("=>", bas);
  return ok === -1 || ok - bas > 120 ? "" : dongununGovdesi(kaynak, ok + 2);
}

/** Açılış parantezinin eşleşen kapanışından SONRAKİ konum. */
function kapanistanSonra(kaynak, acilis) {
  let derinlik = 0;
  for (let i = acilis; i < kaynak.length; i += 1) {
    if (kaynak[i] === "(") derinlik += 1;
    else if (kaynak[i] === ")") {
      derinlik -= 1;
      if (derinlik === 0) return i + 1;
    }
  }
  return kaynak.length;
}

/*
  Biriktirme belirtisi yalnızca SAYAÇ artırma.

  `.push(` de denendi ve yanlış alarm verdi: sınırlı bir listeyi ekrana
  dizmek için gruplamak (app/panel/hr/activity groupByDay) doğru bir
  kullanım — yalnızca çekileni gösteriyor, bir sayı iddia etmiyor. Suç,
  o döngüde SAYI biriktirip onu bir ölçü gibi sunmak.
*/
const BIRIKTIRME = /\+=|\+\+/;

const sorunlar = [];

for (const dizin of TARANAN) {
  const tam = path.join(root, dizin);
  if (!fs.existsSync(tam)) continue;

  for (const dosya of dosyalar(tam)) {
    const ham = fs.readFileSync(dosya, "utf8");
    const kaynak = koduAyikla(ham);
    const goreli = path.relative(root, dosya).split(path.sep).join("/");
    const satirNo = (indeks) => kaynak.slice(0, indeks).split("\n").length;
    const satirlar = ham.split("\n");
    /*
      Kaçış: satırın kendisinde ya da HEMEN ÜSTÜNDEKİ yorum bloğunun
      herhangi bir satırında. Sabit "bir üst satır" kuralı, açıklaması iki
      satır süren bir kaçışı görmüyordu; kaçışın başına yazmak da sonuna
      yazmak kadar doğal.
    */
    /*
      Yorum satırı, AYIKLANMIŞ kaynakla karşılaştırılarak bulunuyor:
      koduAyikla yorumları boşluğa çevirip uzunluğu koruyor, yani ham satırda
      içerik varken ayıklanmış satır boşsa o satır yorumdur.

      Eskiden ölçüt "satır //, * ya da /* ile başlıyor mu" idi ve bu deponun
      blok yorum üslubuyla (ara satırlar yıldızsız) çalışmıyordu: iki satırdan
      uzun bir açıklamanın içine yazılan `tuzak-tamam:` hiç görünmüyordu.
      Belgelenen kaçış yolunun kendisi işlemiyordu.
    */
    const ayiklanmisSatirlar = kaynak.split("\n");
    const yorumMu = (no) =>
      (satirlar[no] ?? "").trim().length > 0 && (ayiklanmisSatirlar[no] ?? "").trim().length === 0;
    const kacisVar = (no) => {
      if (KACIS.test(satirlar[no - 1] ?? "")) return true;
      for (let i = no - 2; i >= 0 && yorumMu(i); i -= 1) {
        if (KACIS.test(satirlar[i])) return true;
      }
      return false;
    };

    // --- KALIP 1
    const { adlar, sinirliMi } = sinirliAdlar(kaynak);
    if (adlar.length) {
      for (const m of kaynak.matchAll(/\.reduce\(/g)) {
        const no = satirNo(m.index);
        if (kacisVar(no)) continue;
        // Toplamanın alıcısı bu ifadenin solunda; zincir satıra yayılabiliyor.
        const onceki = kaynak.slice(Math.max(0, m.index - 400), m.index);
        const suclu = adlar.find(
          (ad) => new RegExp(`\\b${ad}\\b[^;]*$`).test(onceki) && sinirliMi(ad, m.index),
        );
        if (!suclu) continue;
        sorunlar.push(
          `${goreli}:${no}  "${suclu}" .limit() ile sınırlı bir sorgudan geliyor ama .reduce() ile toplanıyor.\n` +
          "      Toplam, sınıra ulaşıldığı anda sessizce eksilmeye başlar. Toplamı ayrı ve sınırsız bir\n" +
          "      sorgudan hesaplayın; liste kısa kalabilir, toplam kısalmamalı.",
        );
      }

      // --- KALIP 1b: sınırlı liste üzerinde döngü kurup sayı biriktirmek
      for (const ad of adlar) {
        const desenler = [
          new RegExp(`for\\s*\\([^)]*\\bof\\s+[^)]*\\b${ad}\\b[^)]*\\)`, "g"),
          new RegExp(`\\b${ad}\\b[^;=]{0,40}?\\.forEach\\(`, "g"),
        ];
        for (const desen of desenler) {
          for (const m of kaynak.matchAll(desen)) {
            const no = satirNo(m.index);
            if (kacisVar(no)) continue;
            if (!sinirliMi(ad, m.index)) continue;
            const govde = m[0].includes(".forEach(")
              ? geriCagirmaninGovdesi(kaynak, m.index + m[0].length)
              : dongununGovdesi(kaynak, m.index + m[0].length);
            if (!BIRIKTIRME.test(govde)) continue;
            sorunlar.push(
              `${goreli}:${no}  "${ad}" .limit() ile sınırlı ama bir döngüde sayı biriktiriliyor (+= ya da ++).\n` +
              "      Sınır aşıldığında liste kısalır, biriken sayı da sessizce eksilir — üstelik listeye hiç\n" +
              "      girmeyen kayıt varsa ekranda yokmuş gibi görünür. Sayımı veritabanına taşıyın\n" +
              "      (count veya gruplayan bir fonksiyon) ya da sınırı sayılan şeye değil GÖSTERİLEN\n" +
              "      şeye uygulayın.",
            );
          }
        }
      }

      /*
        KALIP 1c: sınırlı liste üzerinde .filter(…).length ile saymak.

        Ad ile .filter( arasındaki sarmalayıcılar atlanıyor. Desen eskiden
        `ad.filter(` biçimini arıyordu ve Supabase'in EN YAYGIN yazımını
        hiç görmüyordu: `(data ?? []).filter(…).length`. Aradaki `?? []`,
        parantez ve `as T[]` yüzünden ad doğrudan .filter'a komşu olmuyor.

        .length denetimi 600 karakterlik pencereyle değil, filter çağrısının
        KENDİ kapanışıyla yapılıyor: pencere, ilgisiz bir .length'i eşleştirip
        yanlış alarm üretebiliyordu.
      */
      for (const m of kaynak.matchAll(/\.filter\(/g)) {
        const sonra = kaynak.slice(kapanistanSonra(kaynak, m.index + ".filter".length));
        if (!/^\s*\.length\b/.test(sonra)) continue;
        const no = satirNo(m.index);
        if (kacisVar(no)) continue;
        const onceki = kaynak.slice(Math.max(0, m.index - 80), m.index);
        const suclu = adlar.find(
          (ad) => new RegExp(`\\b${ad}\\b[^;]*$`).test(onceki) && sinirliMi(ad, m.index),
        );
        if (!suclu) continue;
        sorunlar.push(
          `${goreli}:${no}  "${suclu}" .limit() ile sınırlı ama .filter(…).length ile SAYILIYOR.\n` +
          "      Sayı, sınıra ulaşıldığı anda sessizce eksilmeye başlar. Sayımı veritabanına taşıyın.",
        );
      }
    }

    // --- KALIP 2
    for (const tuzak of TUZAKLAR) {
      if (!tuzak.kapsam(goreli)) continue;
      for (const m of kaynak.matchAll(new RegExp(`\\b${tuzak.ad}\\b`, "g"))) {
        const no = satirNo(m.index);
        if (kacisVar(no)) continue;
        sorunlar.push(
          `${goreli}:${no}  "${tuzak.ad}" tuzak: ${tuzak.sebep}.\n` +
          "      Bilerek kullanıyorsanız satıra `tuzak-tamam: <sebep>` yazın.",
        );
      }
    }
  }
}

if (sorunlar.length) {
  console.error(`✗ Rakam denetimi: ${sorunlar.length} sorun\n${sorunlar.map((s) => `  ${s}`).join("\n")}`);
  process.exit(1);
}
console.log(
  `✓ Rakam denetimi: sınırlı sorgudan toplam/sayım yok (reduce, döngüde biriktirme, filter().length), ` +
  `${TUZAKLAR.length} tuzak tablo/sütun gözetiliyor`,
);
