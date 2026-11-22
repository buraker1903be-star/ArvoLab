/*
  KAYNAKLA SOHBET (03.11.2026, Jenni AI'daki "PDF ile sohbet"in karşılığı).

  Öğrenci kaynağının PDF'ine soru soruyor ("örneklem kaç kişi?", "hangi
  yöntemi kullanmışlar?"). Jenni'den ayrıldığı yer: CEVAP KAYNAKTAN
  KANITLANIR. Model her iddiasını PDF'ten birebir alıntıyla ve alıntının
  geçtiği PDF sayfasıyla vermek zorunda; alıntı o metinde geçmiyorsa
  cevabın tamamı düşer. "Kaynakta şöyle yazıyor" deyip yazmayan bir cevap,
  öğrencinin tezine yanlış bir atıf olarak girer — akademik çalışmada en
  pahalı hatalardan biri.

  Sayfa numarası PDF DOSYASININ sayfasıdır, derginin baskı sayfası değil:
  ikisi çoğu zaman farklıdır ve baskı sayfası tahmin edilmez (AGENTS.md,
  kanıt kuralı). Ekranda da öyle söylenir.

  Kurallar:
    - Alıntı, gönderilen sayfaların birinde (kanıt normalleştirmesiyle,
      lib/kanit/alinti.ts) birebir geçmeli. Model sayfayı yanlış
      söylediyse ve alıntı başka bir gönderilen sayfadaysa sayfa düzeltilir
      (alıntı gerçek, yalnızca konum yanlış).
    - "Bulundu" diyen cevap en az bir alıntı taşımalı.
    - Cevaptaki her sayı kaynakta ya da soruda geçmeli (sayi-denetimi).
    - Cevap, kaynakta geçmeyen bir künye/atıf yazamaz.

  Saf modül; testi tests/unit/kaynak-sohbeti.test.ts.
*/

import type { Dil, Metin } from "@/lib/dil";
import type { Mesaj } from "./saglayici";
import { jsonOku, baglamDisiKunye } from "./bulgu";
import { uydurmaSayilar } from "./sayi-denetimi";
import { alintiDenetle, ALINTI_EN_AZ } from "@/lib/kanit/alinti";

export type Sayfa = { num: number; text: string };
export type KaynakAlintisi = { sayfa: number; metin: string };
export type KaynakCevabi = { bulundu: boolean; cevap: string; alintilar: KaynakAlintisi[] };
export type KaynakMesaji = { rol: "kullanici" | "asistan"; metin: string };

/*
  Bağlam bütçesi: tipik bir makale (20–40 sayfa, 40–90 bin karakter)
  tamamen sığsın. Daha uzun kaynakta (kitap, tez) sayfalar seçilir.
*/
export const BUTCE = 90_000;
export const SORU_EN_UZUN = 1_000;

const sozcukler = (metin: string) =>
  [
    ...new Set(
      metin
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .split(/[^\p{L}\p{N}]+/u)
        .filter((s) => s.length >= 3 || /\d/.test(s)),
    ),
  ];

/**
 * Bütçeye sığan sayfalar, belge sırasıyla. Hepsi sığıyorsa hepsi. Sığmıyorsa
 * ilk iki sayfa (başlık, özet) her zaman; kalanı soruyla ortak sözcük
 * sayısına göre. Ortak sözcük ölçütü dil bilmiyor (Türkçe soru, İngilizce
 * makale): yöntem adları, kısaltmalar, sayılar ve özel adlar yine eşleşir;
 * eşleşme yoksa sıradaki sayfalar alınır. `kirpildi`: kaç sayfa dışarıda.
 */
export function ilgiliSayfalar(sayfalar: Sayfa[], soru: string, butce = BUTCE): { secilen: Sayfa[]; kirpildi: number } {
  const dolu = sayfalar.filter((s) => s.text.trim());
  const toplam = dolu.reduce((n, s) => n + s.text.length, 0);
  if (toplam <= butce) return { secilen: dolu, kirpildi: 0 };
  const aranan = new Set(sozcukler(soru));
  const puan = (s: Sayfa) => sozcukler(s.text).filter((w) => aranan.has(w)).length;
  const sirali = [...dolu.slice(0, 2), ...dolu.slice(2).map((s) => ({ s, p: puan(s) })).sort((a, b) => b.p - a.p || a.s.num - b.s.num).map((x) => x.s)];
  const secilen: Sayfa[] = [];
  let kalan = butce;
  for (const s of sirali) {
    if (s.text.length > kalan) continue;
    secilen.push(s);
    kalan -= s.text.length;
  }
  return { secilen: secilen.sort((a, b) => a.num - b.num), kirpildi: dolu.length - secilen.length };
}

export const KAYNAK_ISTEMI = `Sen ArvoLab'ın kaynak okuma asistanısın. Öğrencinin yüklediği akademik bir kaynağın (makale, kitap bölümü, rapor) metni aşağıda SAYFA SAYFA verilmiş. Öğrencinin sorusunu YALNIZCA bu metne dayanarak cevapla.

YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"bulundu": true|false, "cevap": "<kısa, açık cevap; en çok 6 cümle>", "alintilar": [{"sayfa": <PDF sayfa numarası>, "metin": "<kaynaktan BİREBİR kopyalanmış parça>"}]}

KESİN KURALLAR:
1. Cevaptaki her bilgi kaynakta yazılı olmalı. Kaynakta olmayan bilgiyi genel bilgiden ya da kendi yorumunla tamamlama; kaynakta yoksa "bulundu": false yap ve cevapta kaynakta bulunamadığını söyle.
2. "bulundu": true ise en az bir alıntı ver. Alıntı kaynaktan HARFİ HARFİNE kopyalanmış, en az ${ALINTI_EN_AZ} karakterlik bir parça olmalı: kelime değiştirme, çevirme, kısaltma, "…" ile birleştirme. Kaynak İngilizceyse alıntı İngilizce kalır.
3. "sayfa", alıntının geçtiği "--- SAYFA N ---" başlığındaki N'dir (PDF sayfası); baskı sayfa numarası uydurma.
4. Cevaptaki her sayı (örneklem, yüzde, katsayı, yıl, p değeri) kaynakta birebir geçmeli.
5. Kaynakta geçmeyen bir yazara, çalışmaya ya da künyeye atıf yapma.
6. Cevabı kullanıcının arayüz diliyle yaz (aşağıda belirtilir); alıntılar kaynağın dilinde kalır.
7. Kaynakta AÇIKÇA yazanla kendi çıkarımını ayır ve çıkarımı kaynağın sözü gibi sunma. Sorulan bir unsur (sınırlılık, yöntem, örneklem, sonuç…) verilen sayfalarda yazılı değilse onu kendin üretme; bunun yerine yazılı olmadığını açıkça söyle (örn. "Okunan sayfalarda yazarların belirttiği bir sınırlılık yok."). Yazarların söylemediği bir değerlendirmeyi ("genellenebilirliği sınırlayabilir", "nedensellik tartışılmamış" gibi) cevaba koyma.
8. Sana kaynağın yalnızca bazı sayfaları verildiyse (KAYNAK satırının altında "OKUNAN SAYFALAR" yazar) "kaynakta yok" deme, "okunan sayfalarda yok" de: kalan sayfalarda yazıyor olabilir.
9. YALNIZCA SON SORUYU cevapla. Önceki turlar bağlamdır (zamir ve "bu çalışma" gibi göndermeleri onlarla çöz), cevaplanacak soru değil: önceki cevabını tekrarlama, özetleme ya da yeni cevabın içine katma. "bulundu" ve "alintilar", SON sorunun cevabına aittir; önceki turda verdiğin alıntı, yeni soruyu da birebir cevaplamıyorsa bu cevabın kanıtı değildir. Son sorunun cevabı okunan sayfalarda yazmıyorsa — önceki soruların cevabı yazıyor olsa bile — "bulundu": false yap ve "alintilar" listesini BOŞ bırak.`;

/*
  SEÇİLİ PASAJ İÇİN HAZIR SORU (17.11.2026, RC06i). Eskiden "…ana iddiasını,
  dayandığı kanıtı ve sınırlılığını açıkla" idi: soru sınırlılığı VAR
  sayıyordu. Seçim kipinde model yalnızca seçimin çevresindeki sayfaları
  okuyor; gerçek model kabulünde yazarların asıl sınırlılıkları okunmayan
  3. sayfadaydı ve model kendi çıkarımını ("genellenebilirliği sınırlayabilir")
  sınırlılık diye yazdı. Alıntı/sayı/atıf denetimleri cümle düzeyinde
  dayanağı yakalayamıyor; bu yüzden soru, olmayanı üretmeye davet etmemeli.
*/
export const SECIM_ANALIZ_SORUSU: Metin = {
  tr: "Bu pasajın ana iddiasını ve dayandığı kanıtı açıkla. Okunan sayfalarda yazarların belirttiği bir sınırlılık varsa alıntıyla göster; yoksa yazılı olmadığını söyle, kendin sınırlılık üretme.",
  en: "Explain this passage's main claim and the evidence it rests on. If the pages read state a limitation, quote it; if not, say that none is stated and don't infer one.",
};

/*
  SEÇİLİ PASAJ (16.11.2026, Yazım Stüdyosu). Öğrenci PDF görüntüleyicide bir
  pasaj seçip "analiz et" dediğinde pasaj ayrıca verilir. Pasaj sunucuda
  sayfa metniyle doğrulanmış ve sunucunun KENDİ metninden kesilmiştir
  (lib/pdf-secim.ts); istemcinin yazdığı metin asistana gitmez. Cevap yine
  aynı kurallarla denetlenir: alıntı kaynakta birebir, sayı kaynakta.
*/
export type SeciliPasaj = { sayfa: number; metin: string };

export function kaynakIstemi(g: {
  kunye: string;
  sayfalar: Sayfa[];
  soru: string;
  gecmis: KaynakMesaji[];
  dil: Dil;
  secim?: SeciliPasaj | null;
  /** Kaynağın toplam sayfa sayısı; verilen sayfalar daha azsa modele söylenir (kural 8). */
  toplamSayfa?: number;
}): { mesajlar: Mesaj[]; kaynakMetni: string; kayitBaglami: string } {
  const kaynakMetni = g.sayfalar.map((s) => `--- SAYFA ${s.num} ---\n${s.text.trim()}`).join("\n\n");
  const secimMesaji: Mesaj[] = g.secim
    ? [
        {
          rol: "sistem",
          metin: `ÖĞRENCİNİN SEÇTİĞİ PASAJ (SAYFA ${g.secim.sayfa}; kaynaktan doğrulanmış):\n«${g.secim.metin}»\nSoru bu pasajla ilgilidir. Cevabı pasaja ve yukarıdaki kaynak metnine dayandır; alıntıları yine kaynaktan birebir ver.`,
        },
      ]
    : [];
  const kismi = g.toplamSayfa && g.sayfalar.length < g.toplamSayfa;
  const okunan = kismi ? `\nOKUNAN SAYFALAR: ${g.sayfalar.map((s) => s.num).join(", ")} (kaynak ${g.toplamSayfa} sayfa; kalanı sana verilmedi)` : "";
  const ust = `KAYNAK: ${g.kunye.slice(0, 600)}${okunan}\nCEVAP DİLİ: ${g.dil === "en" ? "İngilizce" : "Türkçe"}`;
  /*
    GEÇMİŞ GERÇEK SOHBET TURU OLARAK (21.11.2026, gerçek AI kabulü bulgusu).
    Eskiden önceki cevap `rol: "sistem"` ile veriliyordu; Anthropic gövdesinde
    bütün sistem mesajları tek `system` alanında birleştiği için önceki cevap
    kaynak metninin arkasına talimat gibi yapışıyor, messages dizisinde de
    arka arkaya iki kullanıcı turu kalıyordu. Kabulde model ikisini birden
    cevapladı: cevabı PDF'te OLMAYAN soruya, önceki cevabı tekrarlayıp
    "bulundu": true ve önceki turun alıntılarıyla karşılık verdi. Geçmiş
    SİLİNMEDİ — takip sorusunun ("peki ya ikinci yıl?") bağlamı buna bağlı;
    yalnızca doğru role taşındı ve bağlam olduğu açıkça söylendi.
  */
  const gecmis: Mesaj[] = g.gecmis.slice(-6).map((m) => ({
    rol: m.rol === "kullanici" ? "kullanici" : "asistan",
    metin: m.rol === "kullanici" ? m.metin.slice(0, SORU_EN_UZUN) : m.metin.slice(0, 1_500),
  }));
  const gecmisUyarisi: Mesaj[] = gecmis.length
    ? [{ rol: "sistem", metin: "Aşağıdaki turlar BAĞLAMDIR: göndermeleri çözmek içindir, yeniden cevaplanacak sorular değil. Cevabın, 'bulundu' bayrağın ve alıntıların yalnızca SON kullanıcı mesajına aittir." }]
    : [];
  const soru = g.soru.slice(0, SORU_EN_UZUN);
  return {
    mesajlar: [
      { rol: "sistem", metin: KAYNAK_ISTEMI },
      { rol: "sistem", metin: `${ust}\n\nKAYNAK METNİ:\n${kaynakMetni}` },
      ...secimMesaji,
      ...gecmisUyarisi,
      ...gecmis,
      { rol: "kullanici", metin: soru },
    ],
    kaynakMetni,
    // Kayda kaynağın tamamı değil, soru ve hangi sayfaların okunduğu girer (metin zaten depoda).
    kayitBaglami: `${ust}\nSAYFALAR: ${g.sayfalar.map((s) => s.num).join(", ")}${g.secim ? `\nSEÇİM (s. ${g.secim.sayfa}): ${g.secim.metin.slice(0, 400)}` : ""}\n\nSORU: ${soru}`,
  };
}

export function kaynakCevabiCozumle(ham: string): KaynakCevabi | null {
  const veri = jsonOku(ham) as { bulundu?: unknown; cevap?: unknown; alintilar?: unknown } | null;
  if (!veri || typeof veri !== "object") return null;
  const cevap = typeof veri.cevap === "string" ? veri.cevap.trim().slice(0, 2_000) : "";
  if (!cevap) return null;
  const alintilar: KaynakAlintisi[] = Array.isArray(veri.alintilar)
    ? veri.alintilar
        .map((a) => a as { sayfa?: unknown; metin?: unknown })
        .filter((a) => typeof a?.metin === "string" && a.metin.trim())
        .slice(0, 6)
        .map((a) => ({ sayfa: Number(a.sayfa) || 0, metin: String(a.metin).trim() }))
    : [];
  return { bulundu: veri.bulundu === true, cevap, alintilar };
}

export type KaynakDenetimi =
  /** sunucuMetni: model metni atıldı, cevap sunucunun sabit ret metni (sorudaki atıf kaynakta yok). */
  | { gecti: true; cevap: KaynakCevabi; sunucuMetni?: { neden: "soru_atfi"; atiflar: string[] } }
  | { gecti: false; neden: "alinti" | "uydurma_sayi" | "kunye"; ayrinti: string[] };

/*
  KAYNAKTA BULUNMAYAN ATFI REDDETMEK UYDURMA ATIF DEĞİLDİR (17.11.2026, RC06i).
  Gerçek modelle kabulde öğrenci "Smith (2019)'a göre etki büyüklüğü ne?" diye
  sordu; model doğru cevap verdi ("Kaya (2021) kaynağında Smith (2019)'a atıf
  yok") ama künye denetimi cevabı İKİ yanlış alarmla düşürdü ve öğrenci
  "asistan kaynakta olmayan bir atıf yazdı" mesajını gördü:
    1) "Kaya (2021)": incelenen kaynağın KENDİSİ. Künye satırı ("Kaya, A.
       (2021). …") modele veriliyor ama denetim yalnızca sayfa metnine
       bakıyordu; anlatı biçimi "Kaya (2021)" künyenin alt dizesi değil.
    2) "Smith (2019)": öğrencinin SORUDA yazdığı atıf; model onu yalnızca
       kaynakta bulunmadığını söylemek için tekrarladı.
  İkisi ayrı ayrı ve dar tutuldu; uydurma atfın sunulması yine düşer:
    - Kaynağın kendisi: atıftaki HER soyadı künyede (sözcük sınırıyla) ve yıl
      künyede geçmeli. "Kaya (2020)" ya da "Kayalar (2021)" geçmez.
    - Sorudaki atıf: "bulundu": true cevapta kaynakta olmayan bir atıf
      kaynağa dayanıyormuş gibi sunulmuş olur ve düşer. "bulundu": false
      cevapta da MODELİN METNİNE güvenilmez (PR #104 incelemesi): bayrak,
      metnin atfı gerçekten reddettiğini kanıtlamıyor; model bayrağı false
      verip "Smith (2019) … göstermiştir" diye olumlu iddia yükleyebilir.
      Serbest metinde ret ile iddiayı güvenilir biçimde ayıran bir kural
      yok, bu yüzden ayırmaya çalışılmıyor: model metni ATILIR ve kullanıcıya
      sunucunun sabit ret metni gösterilir (soruAtfiRetMetni). Model
      cevabı kayda olduğu gibi girer (eğitim verisi), ekrana girmez.
  Alıntı ve sayı denetimi değişmedi ve sunucu metninden ÖNCE, model metni
  üzerinde çalışır: uydurma sayı ya da birebir olmayan alıntı taşıyan cevap,
  metni atılacak olsa bile düşer.
*/
const SOYAD_ATIFTA = /\p{Lu}[\p{L}'’-]*\p{Ll}/gu;
const kacir = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bosluksuz = (s: string) => s.replace(/\s+/g, " ").trim();

/*
  Sorudaki atıf için gösterilen sabit metin; modelin serbest metni yerine.
  Yalnızca OKUNAN sayfalar hakkında konuşur: seçim kipinde ve uzun kaynakta
  sayfaların bir kısmı okunuyor, bu yüzden "kaynak bu atıf hakkında bilgi
  vermiyor" gibi bütün kaynak üzerine bir yokluk iddiası kurulmaz. Eskiden
  (b8085fd) metin "kaynak bu atıf hakkında bilgi vermiyor" diyordu.
*/
export function soruAtfiRetMetni(atiflar: string[], dil: Dil = "tr"): string {
  const liste = atiflar.join(", ");
  return dil === "en"
    ? `No verifiable information about this citation (${liste}) was found in the pages read.`
    : `Bu atıf (${liste}) hakkında okunan sayfalarda doğrulanabilir bilgi bulunamadı.`;
}

/** Atıf, incelenen kaynağın kendi künyesine mi işaret ediyor (soyadları ve yıl künyede)? */
export function kaynaginKendiAtfi(atif: string, kunye: string): boolean {
  if (!kunye.trim()) return false;
  if (/^10\./.test(atif)) return kunye.includes(atif);
  const yil = atif.match(/\d{4}[a-z]?/)?.[0];
  const soyadlar = atif.match(SOYAD_ATIFTA) ?? [];
  if (!yil || soyadlar.length === 0) return false;
  const sinirli = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${kacir(s)}(?![\\p{L}\\p{N}])`, "u").test(kunye);
  return sinirli(yil) && soyadlar.every(sinirli);
}

/**
 * Alıntılar gönderilen sayfalarda geçiyor mu (sayfa gerekirse düzeltilir),
 * "bulundu" cevap alıntılı mı, sayılar ve atıflar kaynakta mı. Kaynağın kendi
 * künyesi serbest; "bulunamadı" cevabında sorudaki atıf varsa model metni
 * atılır ve sunucunun sabit ret metni döner (sunucuMetni).
 */
export function kaynakCevabiDenetle(cevap: KaynakCevabi, sayfalar: Sayfa[], soru: string, kunye = "", dil: Dil = "tr"): KaynakDenetimi {
  const duzeltilmis: KaynakAlintisi[] = [];
  for (const alinti of cevap.alintilar) {
    const belirtilen = sayfalar.find((s) => s.num === alinti.sayfa);
    if (belirtilen && alintiDenetle(alinti.metin, belirtilen.text).gecti) {
      duzeltilmis.push(alinti);
      continue;
    }
    const baska = sayfalar.find((s) => alintiDenetle(alinti.metin, s.text).gecti);
    if (!baska) return { gecti: false, neden: "alinti", ayrinti: [alinti.metin.slice(0, 80)] };
    duzeltilmis.push({ sayfa: baska.num, metin: alinti.metin });
  }
  if (cevap.bulundu && duzeltilmis.length === 0) return { gecti: false, neden: "alinti", ayrinti: [] };

  const kaynakMetni = sayfalar.map((s) => s.text).join("\n");
  // Künye önce: uydurma bir atfın yılı sayı denetimine de takılır, ama öğrenciye doğru sebep "kaynakta olmayan atıf".
  const soruDuz = bosluksuz(soru);
  const atiflar = baglamDisiKunye(cevap.cevap, kaynakMetni);
  const kendiAtiflari = atiflar.filter((atif) => kaynaginKendiAtfi(atif, kunye));
  const soruAtiflari = cevap.bulundu === false ? atiflar.filter((atif) => !kendiAtiflari.includes(atif) && soruDuz.includes(bosluksuz(atif))) : [];
  const izinsiz = atiflar.filter((atif) => !kendiAtiflari.includes(atif) && !soruAtiflari.includes(atif));
  if (izinsiz.length) return { gecti: false, neden: "kunye", ayrinti: izinsiz };
  /*
    Kaynağın kendi atfındaki yıl ("Kaya (2021)") sayfa metninde geçmeyebilir:
    yıl künye satırında. Künyenin bütün sayılarını serbest bırakmak cilt ve
    sayfa numarasını ("12", "201") veri değeri gibi yazmaya kapı açardı; bu
    yüzden yalnızca kaynağın kendisi olarak tanınan atıf DİZESİ sayı
    denetiminden önce çıkarılır, cevabın geri kalanı aynen denetlenir.
  */
  const sayiMetni = kendiAtiflari.reduce((m, atif) => m.split(atif).join(" "), cevap.cevap);
  const uydurma = uydurmaSayilar(sayiMetni, kaynakMetni, soru);
  if (uydurma.length) return { gecti: false, neden: "uydurma_sayi", ayrinti: uydurma };
  if (soruAtiflari.length) {
    const tekil = [...new Set(soruAtiflari.map(bosluksuz))];
    return {
      gecti: true,
      cevap: { bulundu: false, cevap: soruAtfiRetMetni(tekil, dil), alintilar: [] },
      sunucuMetni: { neden: "soru_atfi", atiflar: tekil },
    };
  }
  /*
    "BULUNAMADI" CEVABI KANIT TAŞIMAZ (21.11.2026, gerçek AI kabulü bulgusu).
    Alıntı, cevabın DAYANAĞI olarak gösteriliyor: ekranda cevabın altında
    "PDF s. 2" düğmesiyle duruyor ve tıklayınca o sayfaya götürüyor. Model
    "okunan sayfalarda yok" derken alıntı verirse öğrenci, olmadığı söylenen
    bilginin dayanağı varmış gibi bir sayfaya yönlendirilir. Kabulde tam bu
    görüldü: etik kurul onay numarası sorusunun cevabının altında, bir
    önceki sorunun örnekleme ait iki alıntısı duruyordu.
    Cevap DÜŞÜRÜLMEZ, alıntı listesi boşaltılır: alıntıların kendisi
    kaynakta birebir geçiyordu (yukarıdaki denetim onları doğruladı), hatalı
    olan onları bu cevabın kanıtı diye sunmak. Düşürmek, dürüst bir
    "bulunamadı" cevabını da yok ederdi — yanlış alarm, kaçırılan
    uydurmadan sinsidir.
  */
  if (!cevap.bulundu) return { gecti: true, cevap: { ...cevap, alintilar: [] } };
  return { gecti: true, cevap: { ...cevap, alintilar: duzeltilmis } };
}
