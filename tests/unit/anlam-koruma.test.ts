import assert from "node:assert/strict";
import test from "node:test";
import { anlamKaybi, korunduIddiasi } from "@/lib/ai/anlam-koruma";
import { yazimCozumle } from "@/lib/ai/yazim-asistani";

/*
  KISALTMADA ANLAM KORUMA (21.11.2026, gerçek AI kabulünün FAIL'inden).

  Kabulde seçili cümle kısaltıldı; sayı (412, %87), atıf (Demir, 2019) ve
  olumsuzluk korundu, bütün denetimlerden geçti — ama "istatistiksel
  olarak" ve "bu nedenle sonuçlar dikkatle yorumlanmalıdır" düştü ve
  asistan kullanıcıya "sayılar, atıf ve anlam korundu" yazdı.
  Aşağıdaki ham cevap o koşudan KAYITLI gerçek yanıttır.
*/

const KAYNAK =
  "Akran mentorluğu programına katılan 412 öğrencinin birinci yıl sonundaki devam oranı %87 olarak bulunmuştur (Demir, 2019); " +
  "ancak bu fark ikinci yılda istatistiksel olarak anlamlı değildir ve programın uzun vadeli etkisi henüz kanıtlanmamıştır, " +
  "bu nedenle sonuçlar dikkatle yorumlanmalıdır.";

const KAYITLI_KISALTMA = JSON.stringify({
  yanit: "Seçili metni tekrar ve dolgu ifadelerinden arındırarak kısalttım; sayılar, atıf ve anlam korundu.",
  metin:
    "Akran mentorluğu programına katılan 412 öğrencinin birinci yıl devam oranı %87 bulunmuştur (Demir, 2019); " +
    "ikinci yılda bu fark anlamlı değildir ve programın uzun vadeli etkisi kanıtlanmamıştır.",
});

const siniflar = (kaynak: string, uretilen: string) => anlamKaybi(kaynak, uretilen).map((k) => k.sinif).sort();

test("kabul FAIL'i: istatistiksel niteleme ve zaman bilgisi düşen kısaltma yakalanır", () => {
  const cevap = yazimCozumle(KAYITLI_KISALTMA);
  assert.ok(cevap);
  const kayiplar = anlamKaybi(KAYNAK, cevap.metin);
  const bulunan = kayiplar.map((k) => k.sinif);

  assert.ok(bulunan.includes("istatistik"), "'istatistiksel olarak' düştüğü hâlde yakalanmadı");
  assert.ok(bulunan.includes("zaman"), "'birinci yıl SONUNDAKİ' düştüğü hâlde yakalanmadı");
  assert.ok(bulunan.includes("belirsizlik"), "'henüz' ve 'dikkatle' düştüğü hâlde yakalanmadı");
  assert.ok(bulunan.includes("sinirlilik"), "'ancak' düştüğü hâlde yakalanmadı");

  // Korunanlar kayıp sayılmamalı: olumsuzluk ("değildir", "kanıtlanmamıştır") ve örneklem (412 öğrenci) yerinde.
  assert.ok(!bulunan.includes("olumsuzluk"));
  assert.ok(!bulunan.includes("orneklem"));

  const istatistik = kayiplar.find((k) => k.sinif === "istatistik");
  assert.deepEqual(istatistik?.dusenler, ["istatistiksel"], "düşen niteleme kullanıcıya adıyla söylenmeli");
});

test("modelin 'anlam korundu' iddiası kayıp varken tanınır", () => {
  const cevap = yazimCozumle(KAYITLI_KISALTMA);
  assert.ok(cevap);
  assert.equal(korunduIddiasi(cevap.yanit), true);
  assert.equal(korunduIddiasi("Kısalttım; 'istatistiksel olarak' nitelemesi düştü, kontrol edin."), false);
  assert.equal(korunduIddiasi("Shortened the text; the meaning is preserved."), true);
  assert.equal(korunduIddiasi(""), false);
});

test("gerçekten koruyan kısaltma uyarı üretmez (yanlış alarm, kaçırılan kayıptan sinsidir)", () => {
  const guvenli =
    "Akran mentorluğu programına katılan 412 öğrencinin birinci yıl sonundaki devam oranı %87'dir (Demir, 2019); " +
    "ancak bu fark ikinci yılda istatistiksel olarak anlamlı değildir ve uzun vadeli etki henüz kanıtlanmamıştır, sonuçlar dikkatle yorumlanmalıdır.";
  assert.deepEqual(anlamKaybi(KAYNAK, guvenli), []);
});

test("eşanlamlı yeniden yazım olumsuzluğu düşürmüş sayılmaz; tamamen silinmesi sayılır", () => {
  const kaynak = "Gruplar arasındaki fark anlamlı değildir.";
  assert.ok(!siniflar(kaynak, "Gruplar arasındaki fark anlamsızdır.").includes("olumsuzluk"), "başka sözcükle kurulan olumsuzluk kayıp değil");
  assert.ok(siniflar(kaynak, "Gruplar arasında bir fark gözlenmiştir.").includes("olumsuzluk"), "olumsuzluk tamamen silinince yakalanmalı");
});

test("örneklem büyüklüğünün düşmesi yakalanır; yalnızca sözcüğün değişmesi yakalanmaz", () => {
  const kaynak = "Çalışmaya 412 öğrenci katılmıştır ve veriler 2023 yılında toplanmıştır.";
  assert.ok(siniflar(kaynak, "Çalışmaya öğrenciler katılmıştır ve veriler 2023 yılında toplanmıştır.").includes("orneklem"));
  assert.ok(!siniflar(kaynak, "412 katılımcıdan 2023 yılında veri toplanmıştır.").includes("orneklem"));
});

test("yıl ve dönem bilgisinin düşmesi yakalanır", () => {
  const kaynak = "Veriler Mart ve Mayıs 2023 arasında toplanmıştır.";
  const kayip = anlamKaybi(kaynak, "Veriler bir anketle toplanmıştır.").find((k) => k.sinif === "zaman");
  assert.ok(kayip, "yıl ve 'arasında' düştüğü hâlde yakalanmadı");
  assert.ok(kayip.dusenler.includes("2023"));
  assert.deepEqual(anlamKaybi(kaynak, "Veriler 2023'te, Mart ile Mayıs arasında toplanmıştır."), []);
});

test("İngilizce belgede de çalışır", () => {
  const kaynak = "The difference was not statistically significant in the second year (n = 412), and the long-term effect remains unproven.";
  const bulunan = siniflar(kaynak, "The difference was smaller in the second year.");
  assert.ok(bulunan.includes("istatistik"));
  assert.ok(bulunan.includes("orneklem"));
  assert.ok(bulunan.includes("olumsuzluk"));
  assert.deepEqual(anlamKaybi(kaynak, "In the second year the difference was not statistically significant (n = 412); the long-term effect is still unproven."), []);
});

test("boş kaynak ya da boş çıktı ölçülmez (soru sorulmuş, metin üretilmemiş olabilir)", () => {
  assert.deepEqual(anlamKaybi("", "bir şey"), []);
  assert.deepEqual(anlamKaybi(KAYNAK, ""), []);
});
