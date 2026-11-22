import assert from "node:assert/strict";
import test from "node:test";
import { anthropicGovde, openaiGovde, sistemAlani, sohbetTurlari, type Istek, type Mesaj } from "@/lib/ai/saglayici";
import { kaynakIstemi, type Sayfa } from "@/lib/ai/kaynak-sohbeti";
import { yazimIstemi } from "@/lib/ai/yazim-asistani";
import { analizIstemi } from "@/lib/ai/analiz-yorumu";

/*
  İKİ SAĞLAYICININ MESAJ GÖVDESİ (21.11.2026).

  "asistan" rolü ORTAK sağlayıcı katmanına eklendi: sohbet geçmişi artık
  gerçek bir asistan turu. Rol eşlemesi iki biçimde ayrışırsa geçmiş bir
  sağlayıcıda doğru, ötekinde yanlış gider ve bu ancak gerçek (ücretli)
  çağrıda görülür. Bu dosya ikisini de AYNI mesaj dizisiyle, ağa çıkmadan
  sınar. İkinci sağlayıcıya gerçek çağrı YAPILMAZ.

  Ayrıca geçmişi OLMAYAN yetenekler (analiz, kaynakça, literatür, kanıt,
  makale, kılavuz) değişiklikten etkilenmemeli: gövdeleri hâlâ tek sistem
  alanı + tek kullanıcı turu olmalı.
*/

const istek = (mesajlar: Mesaj[], bayrak: Partial<Istek> = {}): Istek => ({
  model: "deneme-model",
  mesajlar,
  secenek: {},
  json: false,
  sicaklik: false,
  ...bayrak,
});

const SOHBET: Mesaj[] = [
  { rol: "sistem", metin: "SİSTEM A" },
  { rol: "sistem", metin: "SİSTEM B" },
  { rol: "kullanici", metin: "ilk soru" },
  { rol: "asistan", metin: "ilk cevap" },
  { rol: "kullanici", metin: "ikinci soru" },
];

test("Anthropic gövdesi: sistem ayrı alanda, geçmiş gerçek assistant turu", () => {
  const g = anthropicGovde(istek(SOHBET)) as { system?: string; messages: { role: string; content: string }[] };
  assert.equal(g.system, "SİSTEM A\n\nSİSTEM B");
  assert.deepEqual(g.messages, [
    { role: "user", content: "ilk soru" },
    { role: "assistant", content: "ilk cevap" },
    { role: "user", content: "ikinci soru" },
  ]);
  // Önceki cevap system alanına SIZMAMALI: kök neden buydu.
  assert.ok(!g.system?.includes("ilk cevap"));
  assert.equal(g.messages.at(-1)?.role, "user", "son tur kullanıcı olmalı");
});

test("OpenAI gövdesi: aynı dizi, aynı sıra, system tek mesaj", () => {
  const g = openaiGovde(istek(SOHBET)) as { messages: { role: string; content: string }[] };
  assert.deepEqual(g.messages, [
    { role: "system", content: "SİSTEM A\n\nSİSTEM B" },
    { role: "user", content: "ilk soru" },
    { role: "assistant", content: "ilk cevap" },
    { role: "user", content: "ikinci soru" },
  ]);
});

test("iki biçim AYNI sohbet turlarını üretir (yalnızca sistemin taşınması farklı)", () => {
  const a = (anthropicGovde(istek(SOHBET)) as { messages: { role: string; content: string }[] }).messages;
  const o = (openaiGovde(istek(SOHBET)) as { messages: { role: string; content: string }[] }).messages.filter((m) => m.role !== "system");
  assert.deepEqual(a, o);
});

test("JSON prefill yalnızca Anthropic'te son asistan turu; OpenAI'da response_format", () => {
  const a = anthropicGovde(istek(SOHBET, { json: true })) as { messages: { role: string; content: string }[] };
  assert.deepEqual(a.messages.at(-1), { role: "assistant", content: "{" });
  assert.equal(a.messages.at(-2)?.role, "user", "prefill'den önceki tur kullanıcı olmalı");
  const o = openaiGovde(istek(SOHBET, { json: true })) as { response_format?: { type: string }; messages: { role: string }[] };
  assert.deepEqual(o.response_format, { type: "json_object" });
  assert.equal(o.messages.at(-1)?.role, "user", "OpenAI'da prefill yok");
});

test("baştaki asistan turu iki biçimde de atılır (sağlayıcılar ilk turu kullanıcıdan bekler)", () => {
  const kirpik: Mesaj[] = [
    { rol: "sistem", metin: "S" },
    { rol: "asistan", metin: "pencereden taşan cevap" },
    { rol: "kullanici", metin: "soru" },
  ];
  for (const g of [anthropicGovde(istek(kirpik)), openaiGovde(istek(kirpik))] as { messages: { role: string; content: string }[] }[]) {
    const turlar = g.messages.filter((m) => m.role !== "system");
    assert.equal(turlar[0].role, "user");
    assert.ok(!turlar.some((m) => m.content === "pencereden taşan cevap"));
  }
  // Yardımcı tek başına da aynı kuralı uygular.
  assert.deepEqual(sohbetTurlari(kirpik).map((m) => m.rol), ["kullanici"]);
  assert.equal(sistemAlani(kirpik), "S");
});

test("sıcaklık bayrağı iki biçimde de aynı kapıdan geçer", () => {
  assert.ok(!("temperature" in (anthropicGovde(istek(SOHBET)) as object)));
  assert.ok(!("temperature" in (openaiGovde(istek(SOHBET)) as object)));
  assert.equal((anthropicGovde(istek(SOHBET, { sicaklik: true, secenek: { sicaklik: 0 } })) as { temperature?: number }).temperature, 0);
  assert.equal((openaiGovde(istek(SOHBET, { sicaklik: true, secenek: { sicaklik: 0 } })) as { temperature?: number }).temperature, 0);
});

/* --- Gerçek sohbet yolları: istem kurucularının çıktısı iki gövdeye verilir. --- */

const SAYFALAR: Sayfa[] = [{ num: 1, text: "The sample consisted of 412 first-year students from three campuses." }];

test("kaynak sohbeti yolu: geçmiş iki gövdede de assistant turu olur", () => {
  const { mesajlar } = kaynakIstemi({
    kunye: "Kaya (2024)",
    sayfalar: SAYFALAR,
    soru: "Etik kurul onay numarası nedir?",
    gecmis: [
      { rol: "kullanici", metin: "Örneklem kaç kişi?" },
      { rol: "asistan", metin: "412 öğrenci." },
    ],
    dil: "tr",
  });
  for (const g of [anthropicGovde(istek(mesajlar)), openaiGovde(istek(mesajlar))] as { messages: { role: string; content: string }[] }[]) {
    const turlar = g.messages.filter((m) => m.role !== "system");
    assert.deepEqual(turlar.map((m) => m.role), ["user", "assistant", "user"]);
    assert.equal(turlar.at(-1)?.content, "Etik kurul onay numarası nedir?");
  }
  assert.ok(!sistemAlani(mesajlar).includes("412 öğrenci."), "önceki cevap sistem alanına girmemeli");
});

test("yazım asistanı yolu: geçmiş iki gövdede de assistant turu olur", () => {
  const { mesajlar } = yazimIstemi({
    belgeDili: "tr",
    atifStili: "APA 7",
    kutuphane: [],
    gecmis: [
      { rol: "kullanici", metin: "Giriş için paragraf yaz." },
      { rol: "asistan", metin: "İşte paragraf." },
    ],
    istek: "Seçili metni kısalt.",
    gorev: "kisalt",
    secim: "Uzun bir cümle.",
  });
  for (const g of [anthropicGovde(istek(mesajlar)), openaiGovde(istek(mesajlar))] as { messages: { role: string; content: string }[] }[]) {
    const turlar = g.messages.filter((m) => m.role !== "system");
    assert.deepEqual(turlar.map((m) => m.role), ["user", "assistant", "user"]);
    assert.equal(turlar.at(-1)?.content, "Seçili metni kısalt.");
  }
  assert.ok(!sistemAlani(mesajlar).includes("İşte paragraf."));
});

test("geçmişi OLMAYAN yetenek (analiz) etkilenmedi: tek sistem + tek kullanıcı turu", () => {
  const { mesajlar } = analizIstemi({ istatistikMetni: "t(40) = 2.1, p = .04", dil: "tr" });
  for (const g of [anthropicGovde(istek(mesajlar)), openaiGovde(istek(mesajlar))] as { messages: { role: string }[] }[]) {
    const turlar = g.messages.filter((m) => m.role !== "system");
    assert.deepEqual(turlar.map((m) => m.role), ["user"], "asistan turu beklenmiyor");
  }
});
