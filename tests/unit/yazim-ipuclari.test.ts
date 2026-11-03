import assert from "node:assert/strict";
import test from "node:test";
import { DIPNOT_IZI, belgeIpuclari, cumleler, paragrafIpuclari } from "@/lib/yazim-ipuclari";

/*
  Yazarken eşlik eden ipuçları (03.11.2026). Yanlış alarm burada
  hatadan pahalı: öğrenci her paragrafta çıkan uyarıyı okumayı bırakır.
  Bu yüzden testlerin yarısı "uyarı ÇIKMAMALI" senaryoları.
*/
const turler = (metin: string) => paragrafIpuclari(metin).map((i) => i.tur);

test("atıfsız iddia: literatüre gönderme, atıf yok", () => {
  assert.deepEqual(turler("Yapılan çalışmalar enflasyonun işsizliği azalttığını göstermektedir. Bu ilişki uzun dönemde zayıflar."), ["atifsiz-iddia"]);
  assert.deepEqual(turler("Studies have shown that inflation reduces unemployment in the short run."), ["atifsiz-iddia"]);
  assert.deepEqual(turler("Literatürde bu konuda farklı görüşler bulunmakta ve tartışma sürmektedir."), ["atifsiz-iddia"]);
});

test("atıfsız iddia: atıf varsa uyarı yok (her stil)", () => {
  for (const metin of [
    "Yapılan çalışmalar enflasyonun işsizliği azalttığını göstermektedir (Yılmaz, 2020).",
    "Yılmaz (2020) ve önceki çalışmalar bu ilişkiyi göstermektedir.",
    "Yapılan çalışmalar enflasyonun işsizliği azalttığını göstermektedir [3, 4].",
    "Yapılan çalışmalar enflasyonun işsizliği azalttığını göstermektedir.¹",
    `Yapılan çalışmalar enflasyonun işsizliği azalttığını göstermektedir.${DIPNOT_IZI}`,
    "Studies have shown that inflation reduces unemployment (Smith 2020, p. 5).",
  ]) {
    assert.deepEqual(turler(metin), [], metin);
  }
});

test("öğrencinin kendi bulgusu ve takvim yılı iddia sayılmaz", () => {
  assert.deepEqual(turler("Bu çalışmada enflasyon ile işsizlik arasında anlamlı bir ilişki bulunmuştur."), []);
  // "2008" parantezsiz yıl atıf değil ama iddia da yok.
  assert.deepEqual(turler("2008 krizinde işsizlik oranı belirgin biçimde yükselmiş ve uzun süre yüksek kalmıştır."), []);
  // Parantezde yıl tek başına atıf izidir: "(2008)" gibi bir dönem belirtimi iddiayı susturur — bilinen bedel.
});

test("aşırı kesin dil ve kişisel görüş", () => {
  assert.deepEqual(turler("Bulgular bu modelin geçerliliğini kesinlikle kanıtlamaktadır ve başka açıklama yoktur."), ["kesin-dil"]);
  assert.deepEqual(turler("Bence bu sonuç para politikasının etkisizliğini açık biçimde ortaya koyuyor."), ["kisisel-gorus"]);
  assert.deepEqual(turler("I think this result reflects the weakness of the monetary policy channel."), ["kisisel-gorus"]);
  // "kanıt" sözcüğü kendisi sorun değil.
  assert.deepEqual(turler("Bu bulgu hipotezi destekleyen önemli bir kanıt sunmaktadır ve tartışılmalıdır."), []);
});

test("uzun cümle ve paragraf", () => {
  const uzun = `${"Enflasyon ile işsizlik arasındaki ilişki ".repeat(10)}incelenmiştir.`;
  assert.ok(turler(uzun).includes("uzun-cumle"));
  const paragraf = Array.from({ length: 40 }, () => "Enflasyon ile işsizlik arasındaki ilişki incelenmiştir.").join(" ");
  assert.deepEqual(turler(paragraf), ["uzun-paragraf"]);
  assert.deepEqual(turler("Kısa."), []);
});

test("cümle bölme kısaltmada ve baş harfte durmaz", () => {
  assert.deepEqual(cumleler("Yılmaz vd. (2020) bunu gösterdi. A. Demir de öyle. Sonuç budur."), [
    "Yılmaz vd. (2020) bunu gösterdi.",
    "A. Demir de öyle.",
    "Sonuç budur.",
  ]);
  assert.deepEqual(cumleler("Smith et al. found this. It holds (p. 5). Done."), ["Smith et al. found this.", "It holds (p. 5).", "Done."]);
});

test("ipucu parçası paragrafta bulunabilir olmalı (editör seçip gösteriyor)", () => {
  const metin = "Giriş cümlesi burada yer alır. Yapılan çalışmalar bunu göstermektedir. Bulgular kesinlikle anlamlıdır.";
  for (const ipucu of paragrafIpuclari(metin)) assert.ok(!ipucu.parca || metin.includes(ipucu.parca), ipucu.parca);
});

test("belge: kaynakça ve dipnotlu paragraf; gövde dışı uyarı yok", () => {
  const p = (...content: unknown[]) => ({ type: "paragraph", content });
  const yazi = (text: string) => ({ type: "text", text });
  const h = (text: string) => ({ type: "heading", attrs: { level: 1 }, content: [yazi(text)] });
  const bloklar = [
    h("Giriş"),
    p(yazi("Yapılan çalışmalar enflasyonun işsizliği azalttığını göstermektedir.")),
    p(yazi("Önceki araştırmalar bu ilişkiyi doğrulamıştır ve tartışma sürmektedir."), { type: "footnoteReference", attrs: { text: "Yılmaz, s. 5." } }),
    h("Kaynakça"),
    p(yazi("Smith, J. (2020). Studies have shown nothing new about inflation. Journal, 1, 1-2.")),
  ];
  const ipuclari = belgeIpuclari(bloklar as never);
  assert.deepEqual(ipuclari.map((i) => [i.tur, i.paragraf]), [["atifsiz-iddia", 1]]);
  assert.match(ipuclari[0].paragrafBasi, /^Yapılan çalışmalar/);
});
