import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ARAC_ADI, robotsCozumle, robotsIzinVeriyor } from "@/lib/robots";

const izinli = (metin: string, yol: string) => robotsIzinVeriyor(robotsCozumle(metin), yol);

describe("robots.txt çözümleme", () => {
  test("yıldız grubundaki yasak uygulanır", () => {
    const metin = "User-agent: *\nDisallow: /admin/";
    assert.equal(izinli(metin, "/admin/liste"), false);
    assert.equal(izinli(metin, "/dosyalar/tez.pdf"), true);
  });

  test("bizi adıyla anan grup, yıldız grubunun yerine geçer", () => {
    /*
      Standart böyle: aracı adıyla anan bir grup varsa yalnızca o geçerli.
      Kurum bize özel izin vermişse genel yasak bizi bağlamaz.
    */
    const metin = `User-agent: *\nDisallow: /\n\nUser-agent: ${ARAC_ADI}\nDisallow: /gizli/`;
    assert.equal(izinli(metin, "/dosyalar/tez.pdf"), true);
    assert.equal(izinli(metin, "/gizli/belge.pdf"), false);
  });

  test("boş Disallow her şeye izin verir", () => {
    assert.equal(izinli("User-agent: *\nDisallow:", "/herhangi"), true);
  });

  test("Allow, daha özel olduğunda yasağı yener", () => {
    const metin = "User-agent: *\nDisallow: /dosyalar/\nAllow: /dosyalar/tez-yazim-kilavuzu.pdf";
    assert.equal(izinli(metin, "/dosyalar/gizli.pdf"), false);
    assert.equal(izinli(metin, "/dosyalar/tez-yazim-kilavuzu.pdf"), true);
  });

  test("joker karakter desteklenir", () => {
    const metin = "User-agent: *\nDisallow: /*.docx";
    assert.equal(izinli(metin, "/dosyalar/sablon.docx"), false);
    assert.equal(izinli(metin, "/dosyalar/kilavuz.pdf"), true);
  });

  test("$ yol sonunu işaretler", () => {
    const metin = "User-agent: *\nDisallow: /arama$";
    assert.equal(izinli(metin, "/arama"), false);
    // Önek değil, tam eşleşme istendi.
    assert.equal(izinli(metin, "/arama/sonuclar"), true);
  });

  test("arka arkaya User-agent satırları tek grubu tanımlar", () => {
    const metin = `User-agent: Googlebot\nUser-agent: ${ARAC_ADI}\nDisallow: /kapali/`;
    assert.equal(izinli(metin, "/kapali/x"), false);
    assert.equal(izinli(metin, "/acik/x"), true);
  });

  test("bizi ilgilendirmeyen grubun yasağı uygulanmaz", () => {
    const metin = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin/";
    assert.equal(izinli(metin, "/dosyalar/tez.pdf"), true);
  });

  test("yorumlar ve boş dosya sorun çıkarmaz", () => {
    assert.equal(izinli("# yalnızca yorum", "/x"), true);
    assert.equal(izinli("", "/x"), true);
  });

  test("crawl-delay okunur", () => {
    assert.equal(robotsCozumle("User-agent: *\nCrawl-delay: 2").gecikmeSn, 2);
    assert.equal(robotsCozumle("User-agent: *\nDisallow: /").gecikmeSn, null);
  });
});
