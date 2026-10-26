import assert from "node:assert/strict";
import test from "node:test";
import { kalibaGoreAtif, kalibaUymayanlar, kalipOzeti, ornekKalibi, yilsizAtiflar } from "@/lib/atif/tyk";

test("örnekten kalıp: virgül, iki nokta, önek, bağlaç", () => {
  const k = ornekKalibi("Örnek: (Yılmaz ve Demir, 2020: 14)")!;
  assert.deepEqual(
    { a: k.yazarYilAyraci, s: k.sayfaAyraci, o: k.sayfaOneki, v: k.ikiYazar },
    { a: ",", s: ":", o: "", v: "ve" },
  );
  const apa = ornekKalibi("(Yılmaz vd., 2020, s. 14)")!;
  assert.deepEqual([apa.sayfaAyraci, apa.sayfaOneki, apa.cokYazar], [",", "s.", "vd."]);
  const sade = ornekKalibi("(Yılmaz 2020)")!;
  assert.deepEqual([sade.yazarYilAyraci, sade.sayfaAyraci, sade.sayfaOneki], [" ", null, null]);
  assert.equal(ornekKalibi("Yılmaz 2020"), null);
  assert.equal(ornekKalibi(""), null);
  assert.ok(kalipOzeti(k).some((s) => s.includes(":")));
});

test("kalıba uymayan atıflar nedeniyle; örnekte olmayan kural denetlenmez", () => {
  const k = ornekKalibi("(Yılmaz, 2020: 14)")!;
  const govde = "… (Demir 2019) ve (Kaya, 2018, s. 5) ile (Aksoy, 2021: 7) uyumlu; (Şen, 2017) doğru.";
  const b = kalibaUymayanlar(govde, k);
  assert.deepEqual(
    b.map((x) => x.atif),
    ["(Demir 2019)", "(Kaya, 2018, s. 5)"],
  );
  assert.match(b[0].aciklama, /virgül olmalı/);
  assert.match(b[1].aciklama, /":" olmalı/);
  assert.match(b[1].aciklama, /"s\." olmamalı/);
  // Örnekte sayfa yoksa sayfa biçimine karışılmaz.
  assert.deepEqual(kalibaUymayanlar("(Kaya, 2018, s. 5)", ornekKalibi("(Yılmaz, 2020)")!), []);
});

test("yılı olmayan atıflar; tablo, ay ve uzun ifadeler atıf sayılmaz", () => {
  const govde =
    "Bulgular (Yılmaz) ile (Demir ve Kaya) ve (Aksoy vd.) çalışmalarını destekler. (Tablo 3), (Haziran), (Türkiye İstatistik Kurumu verileri), (bkz. Ek A), (Yılmaz, 2020).";
  assert.deepEqual(yilsizAtiflar(govde).map((b) => b.atif), ["(Yılmaz)", "(Demir ve Kaya)", "(Aksoy vd.)"]);
});

test("atıf kalıba göre yazılır", () => {
  const k = ornekKalibi("(Yılmaz ve Demir, 2020: 14)")!;
  assert.equal(kalibaGoreAtif("Yılmaz & Demir", "2020", "14", k), "(Yılmaz ve Demir, 2020: 14)");
  assert.equal(kalibaGoreAtif("Yılmaz", "2020", null, k), "(Yılmaz, 2020)");
  const apa = ornekKalibi("(Yılmaz, 2020, s. 14)")!;
  assert.equal(kalibaGoreAtif("Yılmaz", "2020", "14-16", apa), "(Yılmaz, 2020, ss. 14-16)");
  assert.equal(kalibaGoreAtif("Yılmaz", "2020", "s. 14", k), "(Yılmaz, 2020: 14)");
});

test("yıl uyuşmazlığı tek sorun olarak bulunur", async () => {
  const { crossCheck, extractInTextCitations, parseReferenceList, yilUyusmazliklari } = await import("@/lib/apa7");
  const kunyeler = parseReferenceList("Yılmaz, A. (2021). Enflasyon. İktisat Dergisi, 3(1), 1-10.\nDemir, B. (2019). Kur. Ankara: X.");
  const atiflar = extractInTextCitations("Bulgular (Yılmaz, 2020) ve (Demir, 2019) ile uyumlu.");
  const capraz = crossCheck(atiflar, kunyeler);
  const u = yilUyusmazliklari(capraz.citationsWithoutReference, kunyeler);
  assert.equal(u.length, 1);
  assert.deepEqual([u[0].atifYili, u[0].kunyeYili], ["2020", "2021"]);
});
