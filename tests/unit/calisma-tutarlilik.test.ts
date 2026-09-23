import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { metinListeTutarsizliklari, type KaynakSatiri } from "@/lib/calisma-tutarlilik";

const kaynak = (parca: Partial<KaynakSatiri> & { title: string }): KaynakSatiri => ({
  id: parca.title,
  authors: null,
  year: null,
  status: "used",
  ...parca,
});

/** Denetim kısa metinlerde çalışmaz; gerçekçi uzunlukta bir gövde. */
const govde = (ek: string) =>
  `${"Bu bölümde harmanlanmış öğrenme ortamlarının matematik özyeterliğine etkisi ele alınmaktadır. ".repeat(3)}${ek}`;

describe("metin ile literatür listesi", () => {
  test("kullanıldı işaretli ama metinde atfı olmayan kaynak bildirilir", () => {
    const sonuc = metinListeTutarsizliklari(
      govde("Özyeterlik kavramı Bandura (1977) tarafından ortaya konmuştur."),
      [
        kaynak({ title: "Self-efficacy", authors: "Bandura, A.", year: "1977" }),
        kaynak({ title: "Sınıf yönetimi", authors: "Demir, B.", year: "2021" }),
      ],
    );
    const atifsiz = sonuc.find((t) => t.tur === "atifsiz_kaynak");
    assert.ok(atifsiz, "atıfsız kaynak bulunmalı");
    assert.match(atifsiz.baslik, /1 kaynak/);
    assert.match(atifsiz.aciklama, /Sınıf yönetimi/);
  });

  test("okundu/incelenecek kaynakların metinde geçmemesi normaldir", () => {
    // Henüz kullanılmamış kaynağı "atıfsız" diye bildirmek yanlış alarmdır.
    const sonuc = metinListeTutarsizliklari(govde("Giriş bölümü."), [
      kaynak({ title: "Okunacak kitap", status: "to_review" }),
      kaynak({ title: "Okunan makale", status: "read" }),
    ]);
    assert.equal(sonuc.filter((t) => t.tur === "atifsiz_kaynak").length, 0);
  });

  test("metinde olup listede olmayan atıf bildirilir", () => {
    const sonuc = metinListeTutarsizliklari(
      govde("Motivasyonun başarıyla ilişkili olduğu bilinmektedir (Şahin, 2022)."),
      [kaynak({ title: "Self-efficacy", authors: "Bandura, A.", year: "1977" })],
    );
    const eksik = sonuc.find((t) => t.tur === "kaynaksiz_atif");
    assert.ok(eksik, "kaynaksız atıf bulunmalı");
    assert.match(eksik.aciklama, /Şahin, 2022/);
  });

  test("literatür listesi boşken atıflar kaynaksız sayılmaz", () => {
    // Henüz kaynak girilmemiş olması bir tutarsızlık değildir.
    const sonuc = metinListeTutarsizliklari(govde("Bir çalışmaya göre (Şahin, 2022) durum böyledir."), []);
    assert.deepEqual(sonuc, []);
  });

  test("boş ya da çok kısa müsveddede denetim yapılmaz", () => {
    // Yazmaya başlamamış kullanıcıya bütün kaynaklarını "atıfsız" diye
    // göstermek, aracı ilk günden gürültüye boğardı.
    assert.deepEqual(metinListeTutarsizliklari(null, [kaynak({ title: "A" })]), []);
    assert.deepEqual(metinListeTutarsizliklari("Kısa bir not.", [kaynak({ title: "A" })]), []);
  });

  test("atfı olan kaynak temiz geçer", () => {
    const sonuc = metinListeTutarsizliklari(
      govde("Özyeterlik kavramı Bandura (1977) tarafından ortaya konmuştur."),
      [kaynak({ title: "Self-efficacy", authors: "Bandura, A.", year: "1977" })],
    );
    assert.deepEqual(sonuc, []);
  });
});

/*
  ATIF STİLİ eskiden hiç geçirilmiyordu; çıkarıcı APA'ya düşüyordu.
  IEEE/Vancouver yazan öğrencinin "[3]" biçimli atıfları hiç görülmüyor,
  "kullanıldı" işaretli her kaynak panoda "metinde atfı yok" diye
  listeleniyordu. MLA'da da atıfta yıl olmadığı için hiçbir eşleşme
  tutmuyordu.
*/
describe("atıf stili", () => {
  const kaynak = {
    id: "1",
    title: "Örgütsel bağlılık",
    authors: "Yılmaz, A.",
    year: "2020",
    // "used": yalnızca bu durumdaki kaynak "atıfsız" diye bildirilir.
    status: "used",
  };
  const uzunMetin = (govde: string) => govde + " ".padEnd(220, "x");

  test("numara stilinde susulur: eşleşme adla değil sırayla kurulur", () => {
    const vancouver = metinListeTutarsizliklari(uzunMetin("Bu çalışmada (1) numaralı kaynak kullanıldı."), [kaynak], "vancouver");
    assert.deepEqual(vancouver, []);
    const ieee = metinListeTutarsizliklari(uzunMetin("Bu çalışmada [1] numaralı kaynak kullanıldı."), [kaynak], "ieee");
    assert.deepEqual(ieee, []);
  });

  test("MLA'da yıl aranmaz: doğru yazılmış atıf 'atıfsız' sayılmaz", () => {
    const sonuc = metinListeTutarsizliklari(uzunMetin("Bu konuda (Yılmaz 45) açıklaması yapılmıştır."), [kaynak], "mla");
    assert.ok(!sonuc.some((t) => t.tur === "atifsiz_kaynak"));
  });

  test("APA eskisi gibi çalışır", () => {
    const sonuc = metinListeTutarsizliklari(uzunMetin("Bu konuda (Yılmaz, 2020) belirtilmiştir."), [kaynak], "apa7");
    assert.ok(!sonuc.some((t) => t.tur === "atifsiz_kaynak"));
  });

  test("gerçekten atfı olmayan kaynak yine bildirilir", () => {
    const sonuc = metinListeTutarsizliklari(uzunMetin("Metinde hiçbir atıf yok."), [kaynak], "apa7");
    assert.ok(sonuc.some((t) => t.tur === "atifsiz_kaynak"));
  });
});
