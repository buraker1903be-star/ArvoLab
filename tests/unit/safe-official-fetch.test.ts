/*
  SSRF süzgeci — dış kaynak indirmenin güvenlik sınırı.

  Kılavuz tarayıcı .edu.tr adreslerinden dosya indiriyor. Bir alan adı iç
  ağa çözümlenirse istek ArvoLab'ın ağından çıkar: bulut metadata servisi,
  iç yönetim arayüzleri, veritabanı. Sınır vardı ama testi yoktu ve iki
  yerden açıktı (ölçüldü, 24.09.2026):

    100.64.0.1        → GEÇİYORDU  (RFC 6598, bulut iç ağı)
    ::ffff:127.0.0.1  → GEÇİYORDU  (IPv4 eşlemeli loopback)

  İkincisi daha ağır: IPv6 dalı metin önekine bakıyordu ve eşlemeli biçim
  hiçbir özel önekle başlamadığı için denetimden tümden geçiyordu.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isPrivateAddress, resmiAdresBicimi } from "@/lib/safe-official-fetch";

const engellenmeli = (adres: string, not: string) =>
  assert.equal(isPrivateAddress(adres), true, `Engellenmeliydi (${not}): ${adres}`);
const gecmeli = (adres: string, not: string) =>
  assert.equal(isPrivateAddress(adres), false, `Geçmeliydi (${not}): ${adres}`);

describe("SSRF adres süzgeci · IPv4", () => {
  test("klasik özel ve yerel bloklar", () => {
    engellenmeli("10.0.0.1", "10/8");
    engellenmeli("127.0.0.1", "loopback");
    engellenmeli("0.0.0.0", "bu ağ");
    engellenmeli("172.16.0.1", "172.16/12 alt sınır");
    engellenmeli("172.31.255.255", "172.16/12 üst sınır");
    engellenmeli("192.168.1.1", "192.168/16");
    engellenmeli("224.0.0.1", "çoklu yayın");
  });

  test("bulut metadata adresi", () => {
    // En bilinen SSRF hedefi; kimlik bilgisi sızdırır.
    engellenmeli("169.254.169.254", "link-local metadata");
  });

  test("CGNAT bloğu (eskiden geçiyordu)", () => {
    engellenmeli("100.64.0.1", "RFC 6598 alt sınır");
    engellenmeli("100.127.255.255", "RFC 6598 üst sınır");
  });

  test("ayrılmış bloklar", () => {
    engellenmeli("192.0.0.1", "IETF ayrılmış");
    engellenmeli("198.18.0.1", "kıyaslama");
    engellenmeli("198.19.255.255", "kıyaslama üst sınır");
  });

  test("CGNAT komşuları ENGELLENMEMELİ", () => {
    // Süzgeç fazla geniş olursa gerçek üniversite sunucusu taranamaz.
    gecmeli("100.63.255.255", "CGNAT'ın hemen altı");
    gecmeli("100.128.0.1", "CGNAT'ın hemen üstü");
    gecmeli("172.15.0.1", "172.16/12'nin altı");
    gecmeli("172.32.0.1", "172.16/12'nin üstü");
    gecmeli("192.169.0.1", "192.168/16'nın üstü");
    gecmeli("193.140.1.1", "gerçek bir Türkiye akademik bloğu");
  });
});

describe("SSRF adres süzgeci · IPv6", () => {
  test("özel ve yerel bloklar", () => {
    engellenmeli("::1", "loopback");
    engellenmeli("::", "belirsiz");
    engellenmeli("fd00::1", "benzersiz yerel");
    engellenmeli("fe80::1", "link-local");
    engellenmeli("ff02::1", "çoklu yayın");
  });

  test("IPv4 eşlemeli adresler çözülüp denetleniyor (eskiden geçiyordu)", () => {
    engellenmeli("::ffff:127.0.0.1", "eşlemeli loopback");
    engellenmeli("::ffff:10.0.0.1", "eşlemeli özel");
    engellenmeli("::ffff:169.254.169.254", "eşlemeli metadata");
    engellenmeli("::ffff:7f00:1", "eşlemeli loopback, onaltılık biçim");
    engellenmeli("0:0:0:0:0:ffff:10.0.0.1", "açık yazılmış eşleme");
  });

  test("eşlemeli genel adres ENGELLENMEMELİ", () => {
    gecmeli("::ffff:8.8.8.8", "eşlemeli genel adres");
  });

  test("içinde ffff geçen gerçek IPv6 eşlemeli sayılmaz", () => {
    // "2001:ffff::1" eşlemeli DEĞİL; ffff'ten önce sıfır olmayan grup var.
    gecmeli("2001:ffff::1", "genel IPv6");
    gecmeli("2a00:1450:4001:80e::200e", "genel IPv6");
  });
});

/*
  Süzgecin İLK hattı: adresin biçimi. Ad çözümlemesinden önce çalışıyor ve
  testsizdi — oysa kapattığı yollar klasik SSRF/oltalama biçimleri.
*/
describe("resmî adres biçimi", () => {
  const gecerli = (adres: string, not: string) =>
    assert.doesNotThrow(() => resmiAdresBicimi(adres), `Geçmeliydi (${not}): ${adres}`);
  const reddedilmeli = (adres: string, desen: RegExp, not: string) =>
    assert.throws(() => resmiAdresBicimi(adres), desen, `Reddedilmeliydi (${not}): ${adres}`);

  test("resmî .edu.tr adresleri geçiyor", () => {
    gecerli("https://fbe.erciyes.edu.tr/Dosya/kilavuz.pdf", "alt alan adı");
    gecerli("https://edu.tr/x.pdf", "kök alan adı");
    gecerli("https://FBE.ERCIYES.EDU.TR/x.pdf", "büyük harf");
    gecerli("https://x.edu.tr:443/a.pdf", "açık 443");
    gecerli("https://x.edu.tr/a%20b.pdf?v=1#k", "kaçışlı yol, sorgu, çapa");
  });

  test("sondaki nokta süzgeci atlatmıyor", () => {
    // "x.edu.tr." geçerli bir FQDN ve aynı adı çözer; kırpılmazsa
    // endsWith(".edu.tr") eşleşmez ve denetim boşa çıkardı.
    gecerli("https://x.edu.tr./a.pdf", "FQDN biçimi");
    reddedilmeli("https://baskasi.com./a.pdf", /\.edu\.tr/, "nokta kırpılınca da .edu.tr değil");
  });

  test("kimlik bilgisiyle gizlenen makine adı reddediliyor", () => {
    /*
      Klasik oltalama biçimi: ham metinde ".edu.tr" GEÇİYOR ama gerçek
      makine adı başkası. url.hostname doğruyu söylüyor, ayrıca kimlik
      bilgisi zaten reddediliyor — iki kat kapalı.
    */
    reddedilmeli("https://x.edu.tr@baskasi.com/a.pdf", /HTTPS/, "kullanıcı adı olarak .edu.tr");
    reddedilmeli("https://kullanici:sifre@x.edu.tr/a.pdf", /HTTPS/, "kimlik bilgisi");
    reddedilmeli("https://x.edu.tr:sifre@baskasi.com/a.pdf", /HTTPS/, "kullanıcı+şifre");
  });

  test("şema ve port kısıtı", () => {
    reddedilmeli("http://x.edu.tr/a.pdf", /HTTPS/, "şifrelenmemiş");
    reddedilmeli("file:///etc/passwd", /HTTPS/, "yerel dosya");
    reddedilmeli("ftp://x.edu.tr/a.pdf", /HTTPS/, "ftp");
    reddedilmeli("https://x.edu.tr:8080/a.pdf", /HTTPS/, "standart olmayan port");
    // İç servisler sık sık yüksek portlarda duruyor; 443 dışı kapalı.
    reddedilmeli("https://x.edu.tr:9200/a.pdf", /HTTPS/, "Elasticsearch portu");
  });

  test("benzeyen alan adları reddediliyor", () => {
    reddedilmeli("https://baskasi.com/a.pdf", /\.edu\.tr/, "ilgisiz");
    reddedilmeli("https://x.edu.tr.baskasi.com/a.pdf", /\.edu\.tr/, "sonek gibi görünen ön ek");
    reddedilmeli("https://xedu.tr/a.pdf", /\.edu\.tr/, "nokta yok");
    reddedilmeli("https://edu.tr.com/a.pdf", /\.edu\.tr/, "başka TLD");
    reddedilmeli("https://notedu.tr/a.pdf", /\.edu\.tr/, "bitişik ad");
  });

  test("IP ile doğrudan erişim reddediliyor", () => {
    // Ad çözümlemesine hiç gelmeden düşer: makine adı .edu.tr değil.
    reddedilmeli("https://127.0.0.1/a.pdf", /\.edu\.tr/, "loopback");
    reddedilmeli("https://169.254.169.254/latest/meta-data/", /\.edu\.tr/, "bulut metadata");
    reddedilmeli("https://[::1]/a.pdf", /\.edu\.tr/, "IPv6 loopback");
  });
});
