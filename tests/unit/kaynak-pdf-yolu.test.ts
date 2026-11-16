import assert from "node:assert/strict";
import test from "node:test";
import { calismaninKaynakPdfYoluMu, kaynakPdfYoluCoz, yuklemeYolu, yuklemeYoluMu } from "@/lib/kaynak-pdf-yolu";
import { otomatikYol } from "@/lib/kaynak-pdf-yazimi";

/*
  P52b-1: yol yalnızca TAM kalıba uyarsa kabul edilir. Eskiden önek
  (`<çalışma>/kaynak-pdf/`) yetiyordu; aynı çalışmadaki başka künyenin
  dosyası, `..` ya da çift bölü taşıyan yollar da geçiyordu (denetim
  B-PATH-1, senaryo S6c).
*/

const P = "3b281459-8ae2-4a9a-b31f-4530474fea2e";
const P2 = "9c1e0d4a-1111-4222-8333-444455556666";
const U = "b4219800-20a2-492d-ac4c-8fbd295efd70";
const U2 = "0f0e0d0c-0b0a-4908-8706-050403020100";
const Z = "1763200000000";

test("yükleme yolu: kullanıcı kimliği yolda, sunucu oturumla karşılaştırır", () => {
  const yol = yuklemeYolu(P, U, Number(Z));
  assert.equal(yol, `${P}/kaynak-pdf/y-${U}-${Z}.pdf`);
  assert.equal(yuklemeYoluMu(yol, P, U), true);
  assert.equal(yuklemeYoluMu(yol, P, U2), false, "başka kullanıcının yüklemesi");
  assert.equal(yuklemeYoluMu(yol, P2, U), false, "başka çalışma");
  // Büyük harfli kimlik küçültülür; kalıp yalnızca küçük harf kabul ediyor.
  assert.equal(yuklemeYolu(P.toUpperCase(), U.toUpperCase(), Number(Z)), yol);
  assert.equal(yuklemeYoluMu(yol, P.toUpperCase(), U.toUpperCase()), true);
  assert.throws(() => yuklemeYolu("../x", U));
});

test("otomatik yol kalıba uyar ama YÜKLEME sayılmaz: öğrenci otomatik dosyayı 'benim yüklemem' diye bağlayamaz", () => {
  const yol = otomatikYol(P, "yilmaz 2020 baslik", Number(Z));
  assert.match(yol, new RegExp(`^${P}/kaynak-pdf/[0-9a-f]{16}-${Z}\\.pdf$`));
  assert.deepEqual(kaynakPdfYoluCoz(yol), { gecerli: true, tur: "otomatik", projectId: P, yukleyen: null });
  assert.equal(yuklemeYoluMu(yol, P, U), false);
  assert.equal(calismaninKaynakPdfYoluMu(yol, P), true);
});

test("bozuk yollar: .., ters bölü, çift bölü, büyük harf, fazladan bölüm, sondaki ek, eski kısa biçim", () => {
  const bozuk = [
    `${P}/kaynak-pdf/../${P2}/kaynak-pdf/y-${U}-${Z}.pdf`,
    `${P}/kaynak-pdf/y-${U}-${Z}/../../x.pdf`,
    `${P}/kaynak-pdf\\y-${U}-${Z}.pdf`,
    `${P}/kaynak-pdf//y-${U}-${Z}.pdf`,
    `${P.toUpperCase()}/kaynak-pdf/y-${U}-${Z}.pdf`,
    `${P}/kaynak-pdf/alt/y-${U}-${Z}.pdf`,
    `${P}/kaynak-pdf/y-${U}-${Z}.pdf.html`,
    `${P}/kaynak-pdf/y-${U}-${Z}.pdf\n`,
    ` ${P}/kaynak-pdf/y-${U}-${Z}.pdf`,
    `${P}/kaynak-pdf/y-${Z}.pdf`,
    `${P}/kaynak-pdf/y-${U}-123.pdf`,
    `/${P}/kaynak-pdf/y-${U}-${Z}.pdf`,
    `${P}/kilavuz/y-${U}-${Z}.pdf`,
    `${P}/kaynak-pdf/y-${U}-${Z}.PDF`,
    "",
    "x".repeat(500),
  ];
  for (const yol of bozuk) {
    assert.equal(kaynakPdfYoluCoz(yol).gecerli, false, JSON.stringify(yol));
    assert.equal(calismaninKaynakPdfYoluMu(yol, P), false, JSON.stringify(yol));
    assert.equal(yuklemeYoluMu(yol, P, U), false, JSON.stringify(yol));
  }
  for (const deger of [null, undefined, 42, {}, ["a"]]) assert.equal(kaynakPdfYoluCoz(deger).gecerli, false);
});

test("başka çalışmanın geçerli yolu bu çalışmada silinebilecek yol sayılmaz", () => {
  assert.equal(calismaninKaynakPdfYoluMu(`${P2}/kaynak-pdf/y-${U}-${Z}.pdf`, P), false);
  assert.equal(calismaninKaynakPdfYoluMu(otomatikYol(P2, "a"), P), false);
});
