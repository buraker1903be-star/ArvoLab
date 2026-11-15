import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { INDIRME_KULLANICI_AJANI, IndirmeHatasi, guvenliIndir, indirmeHatasiTuru } from "@/lib/guvenli-indir";

/*
  OTOMATİK PDF İNDİRMESİNİN İSTEK BAŞLIKLARI (P52-0, 15.11.2026).

  Eskiden User-Agent "doğrulama" kelimesini taşıyordu. HTTP başlıkları
  ByteString (Latin-1) olmak zorunda; Node'un fetch'i başlıkları
  `new Headers(...)` ile kurarken "ğ"de (287) TypeError fırlatıyor ve istek
  AĞA HİÇ ÇIKMIYOR. Çağıran hatayı yakalayıp yalnızca log'a yazdığı için
  açık erişimli her PDF sessizce "indirilemedi" görünüyordu — hiçbir PDF
  otomatik inmiyordu.

  Gerçek ağ kullanılmıyor: fetch, Node'un yaptığı gibi başlıkları
  `new Headers(...)`'tan geçiren bir taklitle değiştiriliyor. Adres genel
  bir IP: ad çözümlemesi yok, SSRF süzgeci yine çalışıyor.
*/

const GENEL_ADRES = "https://93.184.216.34/makale.pdf";
const gercekFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = gercekFetch;
});

function fetchTaklidi(yanit: () => Response) {
  const istekler: Headers[] = [];
  globalThis.fetch = (async (_adres: string | URL | Request, init?: RequestInit) => {
    // Node'un fetch'i başlıkları böyle kuruyor; ByteString olmayan değer burada düşer.
    istekler.push(new Headers(init?.headers));
    return yanit();
  }) as typeof fetch;
  return istekler;
}

test("istek başlıkları Headers'tan geçer ve istek ağa çıkar (eskiden 'ğ' yüzünden TypeError)", async () => {
  const istekler = fetchTaklidi(() => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), { status: 200, headers: { "content-type": "application/pdf" } }));
  const sonuc = await guvenliIndir(GENEL_ADRES, 1000);
  assert.equal(istekler.length, 1, "istek gönderilmedi");
  assert.equal(new TextDecoder().decode(sonuc.bayt), "%PDF-");
  const ua = istekler[0].get("user-agent") ?? "";
  assert.match(ua, /^ArvoLab\//);
  assert.match(ua, /^[\x20-\x7e]+$/, "User-Agent yalnızca yazdırılabilir ASCII olmalı");
});

/*
  HATANIN TÜRÜ: karşı tarafın sonucu ("erisim" → öğrenci kendisi yükler)
  ile bizim hatamız ("beklenmeyen" → hata bildirimi) ayrılır. Eskiden ikisi
  de aynı "indirilemedi"ye düşüyordu; başlık hatası bu yüzden görünmedi.
*/
const turu = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return "basarili";
  } catch (hata) {
    return indirmeHatasiTuru(hata);
  }
};

test("sunucu reddi (HTTP 403), ağ hatası, zaman aşımı ve boyut sınırı karşı tarafın sonucudur", async () => {
  fetchTaklidi(() => new Response("erişim yok", { status: 403 }));
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "erisim");

  globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "erisim");

  globalThis.fetch = (async () => { throw new DOMException("zaman aşımı", "TimeoutError"); }) as typeof fetch;
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "erisim");

  fetchTaklidi(() => new Response(new Uint8Array(5000), { status: 200, headers: { "content-length": "5000" } }));
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "erisim");
});

test("SSRF reddi de 'erisim' sayılır ve istek ağa çıkmaz (süzgeç değişmedi)", async () => {
  const istekler = fetchTaklidi(() => new Response("x"));
  for (const adres of ["http://169.254.169.254/latest/meta-data", "https://10.0.0.5/x.pdf", "http://localhost/"]) {
    assert.equal(await turu(() => guvenliIndir(adres, 1000)), "erisim", adres);
  }
  assert.equal(istekler.length, 0, "iç ağ adresine istek gönderildi");
});

test("kodun kendi hatası (başlık kurulamadı vb.) 'beklenmeyen' sayılır, 'erişim yok' diye örtülmez", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("Cannot convert argument to a ByteString because the character at index 31 has a value of 287 which is greater than 255.");
  }) as typeof fetch;
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "beklenmeyen");
  assert.ok(new IndirmeHatasi("x") instanceof Error);
});

test("başlık sabiti yalnızca yazdırılabilir ASCII", () => {
  assert.match(INDIRME_KULLANICI_AJANI, /^[\x20-\x7e]+$/);
  assert.doesNotThrow(() => new Headers({ "User-Agent": INDIRME_KULLANICI_AJANI }));
});

/*
  GÖVDE OKUMA HATALARI. 80ce935'te kaynagiOku'dan gelen HER hata "erisim"e
  çevriliyordu; okuma kodundaki bir programlama hatası da "kaynağa
  erişilemedi" görünürdü. Artık yalnızca bilinen nedenler karşı tarafın.
*/
const akis = (parcalar: (Uint8Array | Error)[]) =>
  new ReadableStream<Uint8Array>({
    pull(denetleyici) {
      const sonraki = parcalar.shift();
      if (!sonraki) denetleyici.close();
      else if (sonraki instanceof Error) denetleyici.error(sonraki);
      else denetleyici.enqueue(sonraki);
    },
  });

test("gövde okunurken: akışla aşılan boyut sınırı, kopan bağlantı ve zaman aşımı 'erisim'", async () => {
  // Content-Length yok: sınır akış sayılarak aşılıyor (BoyutSiniriHatasi).
  fetchTaklidi(() => new Response(akis([new Uint8Array(800), new Uint8Array(800)]), { status: 200 }));
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "erisim");

  fetchTaklidi(() => new Response(akis([new Uint8Array(10), new TypeError("terminated")]), { status: 200 }));
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "erisim");

  fetchTaklidi(() => new Response(akis([new DOMException("süre doldu", "TimeoutError")]), { status: 200 }));
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "erisim");
});

test("gövde okunurken programlama hatası (TypeError, RangeError) 'beklenmeyen' kalır, 'erisim' diye örtülmez", async () => {
  fetchTaklidi(() => new Response(akis([new TypeError("parca.byteLength is not a function")]), { status: 200 }));
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "beklenmeyen");

  fetchTaklidi(() => new Response(akis([new RangeError("Invalid typed array length")]), { status: 200 }));
  assert.equal(await turu(() => guvenliIndir(GENEL_ADRES, 1000)), "beklenmeyen");
});
