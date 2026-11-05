import assert from "node:assert/strict";
import test, { describe } from "node:test";
import fs from "node:fs";
import { makaleBolumleri, baslikSirasi } from "@/lib/makale/bolumler";
import { anahtarKaynagi, makaleSinirMaddeleri, makaleTeslimGirdisi, musveddeOzeti, ozetKaynagi, type SinirProfili } from "@/lib/makale/ozet-ve-sinirlar";
import { gonderimKontrolu, type MakaleProfili } from "@/lib/makale/gonderim-kontrolu";
import { buildSubmissionChecklist, type ChecklistInput } from "@/lib/submission-checklist";
import { makaleProfiliMetni, type MakaleProfilSatiri } from "@/lib/ai/makale-baglami";
import { YAZIM_ISTEMI, yazimDenetle, yazimIstemi, type YazimGirdisi } from "@/lib/ai/yazim-asistani";
import type { MatrisOzeti } from "@/lib/kanit/durum";

/*
  MAKALE AŞAMA 2 (05.11.2026): makale profili → editör ve Arvo AI.
  Senaryo numaraları teslim notundaki listeyle aynı.
*/

const baslik = (metin: string, level = 1) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: metin }] });
const paragraf = (metin: string) => ({ type: "paragraph", content: [{ type: "text", text: metin }] });
const belge = (...content: unknown[]) => ({ type: "doc", content });
const kelimeler = (n: number) => Array.from({ length: n }, (_, i) => `sözcük${i}`).join(" ");

const sinirProfili = (ek: Partial<SinirProfili> = {}): SinirProfili => ({
  dil: "tr",
  kelime_siniri: null,
  ozet_siniri: null,
  anahtar_en_az: null,
  anahtar_en_cok: null,
  ozet: null,
  anahtar_kelimeler: [],
  ...ek,
});

const tamProfil = (ek: Partial<MakaleProfili> = {}): MakaleProfili => ({
  makale_turu: "ozgun",
  arastirma_sorusu: "Soru?",
  arastirma_problemi: null,
  hedef_dergi: "Örnek Dergi",
  dergi_kurallari_adresi: null,
  dergi_kurallari_kontrol: "2026-11-01",
  dil: "tr",
  kelime_siniri: null,
  ozet_siniri: null,
  anahtar_en_az: null,
  anahtar_en_cok: null,
  ozet: null,
  anahtar_kelimeler: [],
  veri_durumu: "analiz_edildi",
  raporlama_standardi: null,
  ...ek,
});
const kanit: MatrisOzeti = { toplam: 0, dogrudan: 0, zayif: 0, celisen: 0, degerlendirilmemis: 0, kunyeSorunlu: 0, incelemeBekleyen: 0 };
const bul = <T extends { anahtar: string }>(liste: T[], anahtar: string) => liste.find((m) => m.anahtar === anahtar);

describe("özet ve anahtar kelime: tek öncelik kuralı", () => {
  const ozetliBelge = belge(
    baslik("Özet"),
    paragraf("Bu çalışma öğretmen adaylarının öz yeterliğini incelemektedir."),
    paragraf("Anahtar kelimeler: öz yeterlik, staj; öğretmen eğitimi"),
    baslik("Giriş"),
    paragraf(kelimeler(30)),
  );
  const bolumler = makaleBolumleri(ozetliBelge);

  test("6) özet yalnızca editörde → 'Özet girilmedi' yok", () => {
    const maddeler = makaleSinirMaddeleri({ profil: sinirProfili(), bolumler });
    assert.notEqual(bul(maddeler, "ozet")?.durum, "eksik");
    assert.match(bul(maddeler, "ozet")!.aciklama, /müsveddeden/);
    // Anahtar kelime satırı özetin sözcük sayısına girmez, ayrı okunur.
    assert.equal(musveddeOzeti(bolumler, "tr")!.metin, "Bu çalışma öğretmen adaylarının öz yeterliğini incelemektedir.");
    assert.deepEqual(anahtarKaynagi(sinirProfili(), bolumler).kelimeler, ["öz yeterlik", "staj", "öğretmen eğitimi"]);
  });

  test("7) özet iki yerde farklı → müsvedde esas, uyarı var, hiçbir girdi değişmiyor", () => {
    const profil = sinirProfili({ ozet: "Eski bir özet metni.", anahtar_kelimeler: ["staj"] });
    const kopya = JSON.parse(JSON.stringify(profil));
    const ozet = ozetKaynagi(profil, bolumler);
    assert.equal(ozet.kaynak, "musvedde");
    assert.equal(ozet.celiski, true);
    const maddeler = makaleSinirMaddeleri({ profil, bolumler });
    assert.equal(bul(maddeler, "ozet-tutarlilik")?.durum, "dikkat");
    assert.equal(bul(maddeler, "anahtar-tutarlilik")?.durum, "dikkat");
    assert.deepEqual(profil, kopya, "profil yerinde değiştirilmemeli");
  });

  test("aynı özet iki yerde (boşluk/büyük harf farkı) → çelişki sayılmaz", () => {
    const profil = sinirProfili({ ozet: "  bu çalışma Öğretmen adaylarının   öz yeterliğini incelemektedir. ", anahtar_kelimeler: ["Staj", "öz yeterlik", "öğretmen eğitimi"] });
    assert.equal(ozetKaynagi(profil, bolumler).celiski, false);
    assert.equal(anahtarKaynagi(profil, bolumler).celiski, false);
  });

  test("müsveddede özet yoksa form kullanılır; ikisi de yoksa eksik", () => {
    const yalnizGiris = makaleBolumleri(belge(baslik("Giriş"), paragraf(kelimeler(10))));
    assert.equal(ozetKaynagi(sinirProfili({ ozet: "Formdaki özet." }), yalnizGiris).kaynak, "profil");
    assert.equal(bul(makaleSinirMaddeleri({ profil: sinirProfili(), bolumler: yalnizGiris }), "ozet")?.durum, "eksik");
  });

  test("İngilizce makalede 'Abstract' bölümü seçilir", () => {
    const iki = makaleBolumleri(belge(baslik("Özet"), paragraf("Türkçe özet."), baslik("Abstract"), paragraf("English abstract."), baslik("Giriş"), paragraf("x")));
    assert.equal(musveddeOzeti(iki, "en")!.metin, "English abstract.");
    assert.equal(musveddeOzeti(iki, "tr")!.metin, "Türkçe özet.");
  });
});

describe("kelime sınırı: Makale sekmesi ve editör aynı kural", () => {
  const icerik = belge(baslik("Özet"), paragraf(kelimeler(40)), baslik("Giriş"), paragraf(kelimeler(120)), baslik("Kaynakça"), paragraf(kelimeler(50)));

  test("5) aynı belge, aynı profil → iki ekranda aynı madde", () => {
    const profil = tamProfil({ kelime_siniri: 100 });
    const makaleSekmesi = bul(gonderimKontrolu({ profil, bolumler: makaleBolumleri(icerik), kanit, bugun: "2026-11-05" }), "kelime")!;
    const editor = bul(makaleTeslimGirdisi(profil, icerik).maddeler, "kelime")!;
    assert.deepEqual(editor, makaleSekmesi);
    assert.equal(editor.durum, "eksik");
    assert.match(editor.aciklama, /Özet ve kaynakça hariç/);
  });

  test("sınır girilmemişse varsayılan sınır uydurulmaz", () => {
    const madde = bul(makaleTeslimGirdisi(null, icerik).maddeler, "kelime")!;
    assert.equal(madde.durum, "bilgi");
    assert.doesNotMatch(madde.aciklama, /sınır \d/);
  });
});

describe("editörün teslim listesi", () => {
  const ortak: ChecklistInput = {
    isThesis: true,
    hasGuideline: true,
    sections: { total: 0, missing: [] },
    pages: 10,
    minPages: null,
    maxPages: null,
    words: 900,
    wordLimit: { max: 500 },
    issues: { danger: 0, warning: 0 },
    cover: { enabled: true, missingFields: [] },
    includeToc: true,
    headingNumbering: { enabled: true, manualNumbered: 0 },
    pageSetup: [],
    saveState: "saved",
  };

  test("3) tez: kılavuzun kelime sınırı aynen, makale maddesi yok", () => {
    const liste = buildSubmissionChecklist(ortak);
    assert.equal(liste.items.find((i) => i.id === "words")?.status, "warning");
    assert.ok(!liste.items.some((i) => i.id.startsWith("makale-")));
  });

  test("makale: kılavuzun tez sınırı (wordLimit) kullanılmaz, dergi maddeleri gelir", () => {
    const icerik = belge(baslik("Giriş"), paragraf(kelimeler(20)));
    const liste = buildSubmissionChecklist({ ...ortak, isThesis: false, makale: makaleTeslimGirdisi(sinirProfili({ kelime_siniri: 10 }), icerik) });
    assert.ok(!liste.items.some((i) => i.id === "words"));
    const kelime = liste.items.find((i) => i.id === "makale-kelime")!;
    assert.equal(kelime.status, "todo");
    assert.equal(kelime.action?.id, "open-article-details");
  });

  test("makale profili yoksa açık bir 'yapılacak' ve varsayılan sınır yok", () => {
    const liste = buildSubmissionChecklist({ ...ortak, isThesis: false, makale: makaleTeslimGirdisi(null, belge(paragraf("x"))) });
    assert.equal(liste.items.find((i) => i.id === "makale-profil")?.status, "todo");
    assert.equal(liste.items.find((i) => i.id === "makale-kelime")?.status, "warning");
  });

  test("proje/doçentlik: makale girdisi verilmez, eski davranış korunur", () => {
    const liste = buildSubmissionChecklist({ ...ortak, isThesis: false });
    assert.equal(liste.items.find((i) => i.id === "words")?.status, "warning");
  });
});

describe("Arvo AI: makale profili bağlamı", () => {
  const satir: MakaleProfilSatiri = {
    makale_turu: "ozgun",
    dil: "en",
    arastirma_problemi: "Öğretmen adaylarında öz yeterlik düşük.",
    arastirma_sorusu: "Staj öz yeterliği artırıyor mu?",
    arastirma_tasarimi: "Ön test–son test",
    disiplin: "Eğitim bilimleri",
    hedef_dergi: "Örnek Eğitim Dergisi",
    dergi_kurallari_adresi: "https://ornek.example/kurallar",
    dergi_kurallari_notu: "Özet en fazla 250 sözcük.",
    raporlama_standardi: "STROBE",
    kelime_siniri: 8000,
    ozet_siniri: 250,
    anahtar_en_az: 3,
    anahtar_en_cok: 5,
    veri_durumu: "toplandi",
  };

  test("1) profil dolu → alanlar bağlamda; sınırlar ve dergi notu yalnızca istemde", () => {
    const { baglam, yalnizIstem } = makaleProfiliMetni(satir);
    for (const parca of ["Özgün araştırma makalesi", "İngilizce", "Staj öz yeterliği artırıyor mu?", "Ön test–son test", "Eğitim bilimleri", "Örnek Eğitim Dergisi", "doğrulanmadı", "STROBE", "analiz tamamlanmadı"])
      assert.ok(baglam.includes(parca), parca);
    assert.match(baglam, /Gerçek analiz çıktısı yok/);
    for (const sayi of ["8000", "250", "en az 3", "en çok 5"]) assert.ok(!baglam.includes(sayi), `bağlamda olmamalı: ${sayi}`);
    for (const parca of ["8000", "250 sözcük", "en az 3, en çok 5", "içeriği okunmadı", "DOĞRULANMAMIŞ", "resmî kuralı olduğunu söyleme"])
      assert.ok(yalnizIstem.includes(parca), parca);
  });

  const girdi = (makale: YazimGirdisi["makale"]): YazimGirdisi => ({
    calisma: "Başlık: Örnek",
    makale,
    belgeDili: "tr",
    atifStili: "APA 7",
    kutuphane: [],
    gecmis: [],
    istek: "Giriş bölümünü geliştir",
    gorev: "serbest",
  });

  test("istemde profil var; denetim kaynağında sınır sayıları YOK", () => {
    const { mesajlar, kaynak } = yazimIstemi(girdi(makaleProfiliMetni(satir)));
    const istem = mesajlar.map((m) => m.metin).join("\n");
    assert.ok(istem.includes("Staj öz yeterliği artırıyor mu?"));
    assert.ok(istem.includes("Ana metin kelime sınırı: 8000"));
    assert.ok(kaynak.includes("Staj öz yeterliği artırıyor mu?"));
    assert.ok(!kaynak.includes("8000") && !kaynak.includes("250"));
  });

  test("9) sınır sayısı uydurma veri olarak geçemez (250 katılımcı düşer)", () => {
    const { kaynak } = yazimIstemi(girdi(makaleProfiliMetni(satir)));
    const denetim = yazimDenetle("Çalışmaya 250 öğretmen adayı katılmıştır.", [], [kaynak, "Giriş bölümünü geliştir"]);
    assert.equal(denetim.gecti, false);
    assert.equal(denetim.gecti === false && denetim.neden, "uydurma_sayi");
  });

  test("2) profil yok → istem eskisiyle aynı yapı (makale bloğu yok)", () => {
    const { mesajlar, kaynak } = yazimIstemi(girdi(null));
    assert.equal(mesajlar.length, 3);
    assert.ok(!kaynak.includes("MAKALE PROFİLİ"));
  });

  test("asistan PDF okuduğunu ve dergi uygunluğunu iddia etmez (istem kuralı)", () => {
    assert.match(YAZIM_ISTEMI, /PDF'lerin içeriği sana verilmiyor/);
    assert.match(YAZIM_ISTEMI, /doğrulanmamıştır/);
    assert.match(YAZIM_ISTEMI, /kabul edileceğini söyleme/);
  });

  test("4) profil yalnızca istenen çalışmanın kimliğiyle ve yalnızca yazım asistanında okunur", () => {
    const kod = fs.readFileSync("lib/ai/calisma-baglami.ts", "utf8");
    assert.match(kod, /from\("makale_profili"\)\.select\(MAKALE_SUTUNLARI\)\.eq\("project_id", data\.id\)/);
    assert.match(kod, /secenek\.makale && data\.project_type === "article"/);
    const yazim = fs.readFileSync("app/actions/ai-yazim.ts", "utf8");
    assert.match(yazim, /calismaBaglami\(girdi\.projectId, \{ makale: true \}\)/);
    // Sayı denetimli öteki yetenekler profili istemez.
    for (const dosya of ["ai-analiz", "ai-kaynakca", "ai-kanit", "ai-makale", "ai-literatur"])
      assert.doesNotMatch(fs.readFileSync(`app/actions/${dosya}.ts`, "utf8"), /makale: true/, dosya);
  });
});

describe("8) bölüm denetimi → Yazım'da başlığa gitme", () => {
  const basliklar = [{ text: "1. Giriş" }, { text: "2. Yöntem" }, { text: "Bulgular" }];
  test("birebir, numarasız ve büyük-küçük harf farkıyla bulunur", () => {
    assert.equal(baslikSirasi(basliklar, "Bulgular"), 2);
    assert.equal(baslikSirasi(basliklar, "Yöntem"), 1);
    assert.equal(baslikSirasi(basliklar, "GİRİŞ"), 0);
  });
  test("bulunamazsa -1 (tahmin yok)", () => {
    assert.equal(baslikSirasi(basliklar, "Tartışma"), -1);
    assert.equal(baslikSirasi(basliklar, "  "), -1);
  });
  test("bağlantı başlığı adrese koyar; asistan isteğe bağlı", () => {
    const kod = fs.readFileSync("app/dashboard/editor/[id]/makale/makale-asistani.tsx", "utf8");
    assert.match(kod, /sorgu\.set\("baslik", baslik\)/);
    assert.match(kod, /sorgu\.set\("asistan", "1"\)/);
  });
});
