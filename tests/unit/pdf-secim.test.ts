import assert from "node:assert/strict";
import test from "node:test";
import { doiNormallestir, kaynakEslesmesi, secimSayfalari, secimiDogrula, SECIM_EN_UZUN, type KutuphaneKaydi, type PdfSayfasi } from "@/lib/pdf-secim";

/*
  Yazım Stüdyosu (16.11.2026): PDF'te seçilen pasaj sunucunun metnine karşı
  doğrulanır; kaynak eşleşmesi yalnızca DOI ile "kesin" olur, başlık
  benzerliği yalnızca aday gösterir.
*/
const SAYFALAR: PdfSayfasi[] = [
  { num: 1, text: "Remote learning and student wellbeing\nRemote learning increased reported isolation among first-year students.\nThe effect was strongest in programmes without weekly live sessions." },
  { num: 2, text: "Method\nParticipants completed the Synthetic Isolation Scale at two time points." },
  { num: 3, text: "Discussion\nStructured peer contact appears to buffer the isolation of remote study." },
];

test("birebir seçim geçer; dönen metin sunucunun metnidir", () => {
  const s = secimiDogrula("Remote learning increased reported isolation among first-year students.", SAYFALAR, 1);
  assert.equal(s.gecti, true);
  if (s.gecti) {
    assert.equal(s.sayfa, 1);
    assert.equal(s.kanonik, "Remote learning increased reported isolation among first-year students.");
    assert.ok(!s.sonrakiSayfaya);
  }
});

test("iki satıra yayılan seçim: tarayıcının satır sonu/boşluk farkı kapatılır", () => {
  // Metin katmanı satırlar arasına boşluk koymayabilir ya da çift boşluk/satır sonu koyabilir.
  for (const secim of [
    "first-year students.The effect was strongest",
    "first-year  students.\n\nThe effect was strongest",
  ]) {
    const s = secimiDogrula(secim, SAYFALAR, 1);
    assert.equal(s.gecti, true, secim);
    if (s.gecti) assert.equal(s.kanonik, "first-year students. The effect was strongest");
  }
});

test("uydurma ya da değiştirilmiş seçim reddedilir", () => {
  const uydurma = secimiDogrula("Remote learning eliminated isolation for every student in the sample.", SAYFALAR, 1);
  assert.deepEqual(uydurma, { gecti: false, neden: "metinde_yok" });
  // Tek kelime değişikliği (increased → decreased) de düşer: karakter sırası korunmalı.
  const degisik = secimiDogrula("Remote learning decreased reported isolation among first-year students.", SAYFALAR, 1);
  assert.equal(degisik.gecti, false);
});

test("doğru cümle yanlış sayfada reddedilir; sayfa numarası tahmin edilmez", () => {
  const s = secimiDogrula("Remote learning increased reported isolation among first-year students.", SAYFALAR, 3);
  assert.equal(s.gecti, false);
});

test("kısa, aşırı uzun ve var olmayan sayfa", () => {
  assert.deepEqual(secimiDogrula("Remote", SAYFALAR, 1), { gecti: false, neden: "kisa" });
  assert.deepEqual(secimiDogrula("a".repeat(SECIM_EN_UZUN + 1), SAYFALAR, 1), { gecti: false, neden: "uzun" });
  assert.deepEqual(secimiDogrula("Remote learning increased reported isolation", SAYFALAR, 9), { gecti: false, neden: "sayfa_yok" });
  assert.deepEqual(secimiDogrula("Remote learning increased reported isolation", SAYFALAR, Number.NaN), { gecti: false, neden: "sayfa_yok" });
});

test("sayfa sonunu aşan seçim sonraki sayfayla birlikte bulunur ve işaretlenir", () => {
  const s = secimiDogrula("without weekly live sessions. Method Participants completed", SAYFALAR, 1);
  assert.equal(s.gecti, true);
  if (s.gecti) {
    assert.equal(s.sayfa, 1);
    assert.equal(s.sonrakiSayfaya, true);
  }
});

test("asistana giden sayfa penceresi: seçim ±1, sayfa aşıyorsa +2", () => {
  const bes: PdfSayfasi[] = [1, 2, 3, 4, 5].map((num) => ({ num, text: `s${num}` }));
  assert.deepEqual(secimSayfalari(bes, 1, false).map((p) => p.num), [1, 2]);
  assert.deepEqual(secimSayfalari(bes, 3, false).map((p) => p.num), [2, 3, 4]);
  assert.deepEqual(secimSayfalari(bes, 3, true).map((p) => p.num), [2, 3, 4, 5]);
  assert.deepEqual(secimSayfalari(bes, 5, true).map((p) => p.num), [4, 5]);
});

test("DOI normalleştirme: adres, büyük harf, sondaki noktalama", () => {
  assert.equal(doiNormallestir("https://doi.org/10.5555/SYNTH.2021.001"), "10.5555/synth.2021.001");
  assert.equal(doiNormallestir("doi:10.5555/abc.1."), "10.5555/abc.1");
  assert.equal(doiNormallestir("https://doi.org/10.1000/a%28b%29"), "10.1000/a(b)");
  assert.equal(doiNormallestir("(bkz. https://doi.org/10.1000/xyz)."), "10.1000/xyz");
  assert.equal(doiNormallestir("https://doi.org/10.1016/S0140-6736(20)30183-5"), "10.1016/s0140-6736(20)30183-5");
  assert.equal(doiNormallestir("10.1000/bozuk%zz"), "10.1000/bozuk%zz");
  assert.equal(doiNormallestir("https://example.com/makale"), null);
  assert.equal(doiNormallestir(null), null);
});

const KAYIT = (id: string, title: string, doi: string | null, project_id: string | null = "p1"): KutuphaneKaydi => ({ id, title, doi_or_url: doi, project_id });

test("DOI tek kayıtla eşleşirse kesin; büyük harf/https farkı önemsiz", () => {
  const e = kaynakEslesmesi({ doi: "10.5555/synth.2021.001", baslik: "Remote learning" }, [KAYIT("a", "Remote learning and student wellbeing", "https://doi.org/10.5555/SYNTH.2021.001"), KAYIT("b", "Başka", null)], "p1");
  assert.deepEqual(e, { tur: "kesin", kaynakId: "a", neden: "doi" });
});

test("aynı DOI iki kayıtta: belirsiz, kendiliğinden seçilmez", () => {
  const e = kaynakEslesmesi({ doi: "10.5555/x", baslik: "X" }, [KAYIT("a", "X", "10.5555/x"), KAYIT("b", "X (kopya)", "https://doi.org/10.5555/X")], "p1");
  assert.equal(e.tur, "belirsiz");
  if (e.tur === "belirsiz") {
    assert.equal(e.neden, "doi_coklu");
    assert.deepEqual([...e.adaylar].sort(), ["a", "b"]);
  }
});

test("çalışmanın kendi kaydı başka çalışmadaki aynı DOI'li kayda tercih edilir", () => {
  const e = kaynakEslesmesi({ doi: "10.5555/x", baslik: "X" }, [KAYIT("baska", "X", "10.5555/x", "p2"), KAYIT("bu", "X", "10.5555/x", "p1")], "p1");
  assert.deepEqual(e, { tur: "kesin", kaynakId: "bu", neden: "doi" });
});

test("DOI yok: başlığı benzeyenler yalnızca ADAY (sessiz başlık eşleşmesi yok)", () => {
  const e = kaynakEslesmesi(
    { doi: null, baslik: "Peer study groups in higher education" },
    [KAYIT("a", "Peer study groups in higher education", null), KAYIT("b", "Peer study groups in higher education: a replication", null), KAYIT("c", "Coastal erosion", null)],
    "p1",
  );
  assert.equal(e.tur, "belirsiz");
  if (e.tur === "belirsiz") {
    assert.equal(e.neden, "doi_yok");
    assert.ok(e.adaylar.includes("a") && e.adaylar.includes("b"));
    assert.ok(!e.adaylar.includes("c"));
  }
  // Tek benzer başlık bile kesin sayılmaz.
  const tek = kaynakEslesmesi({ doi: null, baslik: "Peer study groups in higher education" }, [KAYIT("a", "Peer study groups in higher education", null)], "p1");
  assert.equal(tek.tur, "belirsiz");
});

test("DOI var ama kütüphanede yok: başlık adayı gösterilir, kesin değil; hiçbiri yoksa 'yok'", () => {
  const e = kaynakEslesmesi({ doi: "10.5555/yok", baslik: "Remote learning and student wellbeing" }, [KAYIT("a", "Remote learning and student wellbeing", "10.5555/baska")], "p1");
  assert.equal(e.tur, "belirsiz");
  if (e.tur === "belirsiz") assert.equal(e.neden, "doi_eslesmedi");
  const yok = kaynakEslesmesi({ doi: null, baslik: "An unrelated report on coastal erosion" }, [KAYIT("a", "Remote learning", null)], "p1");
  assert.equal(yok.tur, "yok");
});

test("çok kısa başlık aday üretmez (her şeyi içeren 'Giriş' gibi)", () => {
  const e = kaynakEslesmesi({ doi: null, baslik: "Data" }, [KAYIT("a", "Data analysis in practice", null)], "p1");
  assert.equal(e.tur, "yok");
});
