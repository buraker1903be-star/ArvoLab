import assert from "node:assert/strict";
import test from "node:test";
import { aiAtiflariniEsle } from "@/lib/ai-atif-esleme";

const K = [
  { id: "demir", authors: "Demir, A.", year: "2019", title: "Akran grupları" },
  { id: "yilmaz", authors: "Yılmaz, B., & Kaya, C.", year: 2021, title: "Uyum süreci" },
  { id: "aras1", authors: "Aras, D.", year: "2020", title: "Birinci" },
  { id: "aras2", authors: "Aras, E.", year: "2020", title: "İkinci" },
];

test("B-16: tek adaylı atıflar kaynağa bağlanır, yinelenmez", () => {
  const s = aiAtiflariniEsle("Akran grupları yalnızlığı azaltır (Demir, 2019). Yılmaz ve Kaya (2021) da benzer bulmuştur; bkz. (Demir, 2019).", K);
  assert.deepEqual(s.eslesen, ["demir", "yilmaz"]);
  assert.deepEqual(s.belirsiz, []);
});

test("B-16: iki aday varsa belirsiz kalır, hiçbiri bağlanmaz", () => {
  const s = aiAtiflariniEsle("Bu görüş tartışmalıdır (Aras, 2020).", K);
  assert.deepEqual(s.eslesen, []);
  assert.equal(s.belirsiz.length, 1);
  assert.deepEqual(s.belirsiz[0].adaylar.sort(), ["aras1", "aras2"]);
});

test("B-16: yıl tutmuyorsa eşleşmez; atıfsız metin boş sonuç verir", () => {
  assert.deepEqual(aiAtiflariniEsle("(Demir, 2020) öyle der.", K).eslesen, []);
  assert.deepEqual(aiAtiflariniEsle("Atıfsız bir cümle.", K), { eslesen: [], belirsiz: [], eslesmeyen: [] });
});

test("B-16: aynı eserin kütüphanedeki kopyaları belirsizlik sayılmaz", () => {
  const kopya = [...K, { id: "demir-kopya", authors: "Demir, A.", year: "2019", title: "Akran Grupları" }];
  assert.deepEqual(aiAtiflariniEsle("(Demir, 2019)", kopya).eslesen, ["demir"]);
  const ayri = [...K, { id: "demir-b", authors: "Demir, B.", year: "2019", title: "Başka bir eser" }];
  assert.equal(aiAtiflariniEsle("(Demir, 2019)", ayri).belirsiz.length, 1);
});
