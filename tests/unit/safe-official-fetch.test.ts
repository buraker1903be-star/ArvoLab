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
import { isPrivateAddress } from "@/lib/safe-official-fetch";

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
