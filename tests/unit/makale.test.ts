import assert from "node:assert/strict";
import test from "node:test";
import { bolumTuru, makaleTuruMu, yontemAilesi, MAKALE_TURLERI } from "@/lib/makale/sablonlar";
import { anaMetinSozcukSayisi, makaleBolumleri, sozcukSayisi } from "@/lib/makale/bolumler";
import { DERGI_KONTROL_GUN, gonderimKontrolu, type MakaleProfili } from "@/lib/makale/gonderim-kontrolu";
import { denetimListesi, makaleIstemi, sistemIstemi } from "@/lib/ai/makale-denetimi";
import type { MatrisOzeti } from "@/lib/kanit/durum";
import { makaleTuruTanimi, standartUyarisi, yontemDenetimi, YONTEM_DENETIMLERI } from "@/lib/makale/sablonlar";

const baslik = (metin: string, level = 1) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: metin }] });
const paragraf = (metin: string) => ({ type: "paragraph", content: [{ type: "text", text: metin }] });

test("bölüm türü: Türkçe, İngilizce, numaralı ve eş anlamlı başlıklar", () => {
  assert.equal(bolumTuru("2. Yöntem"), "yontem");
  assert.equal(bolumTuru("MATERIALS AND METHODS"), "yontem");
  assert.equal(bolumTuru("Gereç ve Yöntem"), "yontem");
  assert.equal(bolumTuru("Results"), "bulgular");
  assert.equal(bolumTuru("Sonuç ve Öneriler"), "sonuc");
  assert.equal(bolumTuru("Bulgular tartışıldı."), null);
});

test("yöntem ailesi: tür önce, sonra çalışmanın yöntemi", () => {
  assert.equal(yontemAilesi("quantitative", "teknik"), "muhendislik");
  assert.equal(yontemAilesi("quantitative", "meta_analiz"), "derleme");
  assert.equal(yontemAilesi("qualitative", "ozgun"), "nitel");
  assert.equal(yontemAilesi(null, "ozgun"), null);
  assert.ok(makaleTuruMu("vaka") && !makaleTuruMu("constructor"));
});

test("bölümler en üst düzey başlıktan ayrılır; alt başlık bölümün içinde kalır", () => {
  const belge = {
    type: "doc",
    content: [
      paragraf("Başlıksız ön metin."),
      baslik("Giriş"),
      paragraf("Problem burada."),
      baslik("Yöntem"),
      baslik("Örneklem", 2),
      paragraf("Katılımcılar 120 öğrenci."),
      baslik("Kaynakça"),
      paragraf("Deci, E. L. (2000). Başlık."),
    ],
  };
  const bolumler = makaleBolumleri(belge);
  assert.deepEqual(bolumler.map((b) => [b.baslik, b.tur]), [["", null], ["Giriş", "giris"], ["Yöntem", "yontem"], ["Kaynakça", "kaynakca"]]);
  assert.match(bolumler[2].metin, /Örneklem\nKatılımcılar/);
  // Kaynakça ana metne sayılmaz.
  assert.equal(anaMetinSozcukSayisi(bolumler), sozcukSayisi("Başlıksız ön metin. Giriş Problem burada. Yöntem Örneklem Katılımcılar 120 öğrenci."));
  assert.deepEqual(makaleBolumleri(null), []);
});

test("sözcük sayımı birleşik sözcükleri tek sayar", () => {
  assert.equal(sozcukSayisi("COVID-19 Türkiye'de öz-yeterlik"), 3);
});

const PROFIL: MakaleProfili = {
  makale_turu: "ozgun",
  arastirma_sorusu: "Harmanlanmış öğrenme öz-yeterliği etkiler mi?",
  arastirma_problemi: null,
  hedef_dergi: "Örnek Dergi",
  dergi_kurallari_adresi: null,
  dergi_kurallari_kontrol: "2026-01-01",
  dil: "tr",
  kelime_siniri: 100,
  ozet_siniri: 5,
  anahtar_en_az: 3,
  anahtar_en_cok: 5,
  ozet: "Bu özet altı sözcükten oluşmaktadır burada.",
  anahtar_kelimeler: ["öz-yeterlik"],
  veri_durumu: "toplaniyor",
  raporlama_standardi: null,
};
const KANIT: MatrisOzeti = { toplam: 3, dogrudan: 1, zayif: 1, celisen: 1, degerlendirilmemis: 0, kunyeSorunlu: 0, incelemeBekleyen: 1 };

test("gönderim kontrolü: sınırlar, eski dergi kontrolü, standart ve kanıt", () => {
  const uzun = makaleBolumleri({ type: "doc", content: [baslik("Giriş"), paragraf("kelime ".repeat(150))] });
  const maddeler = Object.fromEntries(gonderimKontrolu({ profil: PROFIL, bolumler: uzun, kanit: KANIT, bugun: "2026-10-26" }).map((m) => [m.anahtar, m]));
  assert.equal(maddeler.kelime.durum, "eksik");
  assert.match(maddeler.kelime.aciklama, /fazla/);
  assert.equal(maddeler.ozet.durum, "eksik");
  assert.equal(maddeler.anahtar.durum, "eksik");
  assert.equal(maddeler.dergi.durum, "dikkat");
  assert.ok(Date.parse("2026-10-26") - Date.parse("2026-01-01") > DERGI_KONTROL_GUN * 86_400_000);
  assert.equal(maddeler.standart.durum, "dikkat");
  assert.equal(maddeler.veri.durum, "dikkat");
  assert.equal(maddeler.kanit.durum, "eksik");
  assert.equal(maddeler.bolumler.durum, "dikkat");
});

test("gönderim kontrolü kabul olasılığı ya da yüzde üretmez", () => {
  const metin = gonderimKontrolu({ profil: PROFIL, bolumler: [], kanit: KANIT, bugun: "2026-10-26" }).map((m) => m.aciklama).join(" ");
  assert.doesNotMatch(metin, /%|olasılı|kabul edil/i);
});

test("bölüm denetimi istemi: yöntem bölümünde aile maddeleri, yasaklar ve tür bağlamı", () => {
  assert.ok(denetimListesi("yontem", "nitel").includes("Araştırmacı konumu ve refleksivite"));
  assert.ok(!denetimListesi("tartisma", "nitel").includes("Araştırmacı konumu ve refleksivite"));
  const istem = sistemIstemi("teknik", "model", "muhendislik");
  assert.match(istem, /Sınır koşulları/);
  assert.match(istem, /kabul olasılığı/);
  assert.match(istem, /hazır cümle/);
  const { kaynak } = makaleIstemi({ tur: "vaka", bolumTuru: "vaka", aile: null, bolumBasligi: "Olgu", bolumMetni: "Metin" });
  assert.match(kaynak, new RegExp(MAKALE_TURLERI.vaka.etiket));
});

test("tezin adı bölüm sayılmaz: tanınmayan, alt başlıklı üst başlığın yerine çocukları listelenir", () => {
  const belge = {
    type: "doc",
    content: [
      baslik("TÜRKİYE'DE ENFLASYON VE İŞSİZLİK İLİŞKİSİNİN EKONOMETRİK ANALİZİ"),
      baslik("Giriş", 2),
      paragraf("Problem ve amaç burada anlatılıyor."),
      baslik("Kuramsal Çerçeve", 2),
      paragraf("Phillips eğrisi literatürü."),
      baslik("Bulgular"),
      baslik("BİRİNCİ BÖLÜM: GİRİŞ"),
      baslik("Alt başlık", 2),
      paragraf("Tanınan bölüm alt başlığıyla birlikte kalır."),
    ],
  };
  const bolumler = makaleBolumleri(belge);
  assert.deepEqual(bolumler.map((b) => b.baslik), ["Giriş", "Kuramsal Çerçeve", "Bulgular", "BİRİNCİ BÖLÜM: GİRİŞ"]);
  assert.equal(bolumler[0].sozcuk, sozcukSayisi("Problem ve amaç burada anlatılıyor."));
  assert.match(bolumler[3].metin, /Alt başlık\nTanınan bölüm/);
});

test("İngilizce arayüz: tür tanımı, denetim listesi ve gönderim kontrolü (Türkçe kayıtlar aynı kalır)", () => {
  const tanim = makaleTuruTanimi("sistematik_derleme", "en");
  assert.equal(tanim.etiket, "Systematic review");
  assert.deepEqual(tanim.bolumler, MAKALE_TURLERI.sistematik_derleme.bolumler);
  assert.deepEqual(tanim.standartlar, [{ ad: "PRISMA 2020", kapsam: "Reporting of systematic reviews" }]);
  assert.equal(makaleTuruTanimi("ozgun"), MAKALE_TURLERI.ozgun);
  // Ekrandaki liste ile asistanın istemine giden liste aynı maddeler, aynı sıra.
  assert.equal(yontemDenetimi("muhendislik", "en").maddeler.length, YONTEM_DENETIMLERI.muhendislik.maddeler.length);
  assert.equal(yontemDenetimi("nitel"), YONTEM_DENETIMLERI.nitel);
  assert.match(standartUyarisi("en"), /^A completed checklist/);

  const profil = {
    makale_turu: "ozgun", arastirma_sorusu: null, arastirma_problemi: null, hedef_dergi: "J", dergi_kurallari_adresi: null,
    dergi_kurallari_kontrol: "2026-01-01", dil: "tr", kelime_siniri: 10, ozet_siniri: null, anahtar_en_az: 3, anahtar_en_cok: null,
    ozet: "bir iki", anahtar_kelimeler: ["a"], veri_durumu: "yok", raporlama_standardi: null,
  } as MakaleProfili;
  const bolumler = makaleBolumleri({ content: [baslik("Giriş"), paragraf("bir iki üç dört beş altı yedi sekiz dokuz on on bir on iki")] });
  const kanit: MatrisOzeti = { toplam: 2, dogrudan: 0, zayif: 0, celisen: 1, degerlendirilmemis: 0, kunyeSorunlu: 0, incelemeBekleyen: 1 };
  const maddeler = gonderimKontrolu({ profil, bolumler, kanit, bugun: "2026-10-28" }, "en");
  const bul = (anahtar: string) => maddeler.find((m) => m.anahtar === anahtar)!;
  assert.equal(bul("soru").baslik, "Research question");
  // Bölüm adı MÜSVEDDENİN dilinde (profil.dil = tr), cümle arayüzün dilinde.
  assert.match(bul("bolumler").aciklama, /^Sections in the template .*: Yöntem, Bulgular/);
  assert.match(bul("kelime").aciklama, /words over\. Abstract and references were excluded/);
  assert.equal(bul("anahtar").aciklama, "1 keyword; the journal requires at least 3.");
  assert.match(bul("dergi").aciklama, /^You checked the guidelines 300 days ago/);
  assert.equal(bul("kanit").aciklama, "Of 2 claims: 1 with contradicting evidence, 1 record awaiting human review.");
  assert.ok(maddeler.every((m) => !/[ğışçöü]/i.test(m.baslik)));
});
