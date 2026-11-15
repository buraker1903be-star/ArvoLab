import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AUTOSAVE_DELAY_MS,
  autosaveDelay,
  kayitKarari,
  kayitSonucuKarari,
  kurtarilabilirTaslaklar,
  onerilecekTaslak,
  sonrakiTeklif,
  sonrakiKayitGecikmesi,
  taslakAnahtari,
  taslakAnahtariMi,
  tekUcusluCalistirici,
  tekrarGecikmesi,
  teklifiYokSay,
  TEKRAR_EN_FAZLA_MS,
  type SunucuSonucu,
} from "@/lib/otomatik-kayit";

/*
  OTOMATİK KAYIT (Signature OS 5 / P52a1). Editör bileşeninin kayıt
  kararları lib/otomatik-kayit.ts'e taşındı; burada sabitleniyor. Senaryo
  adları istenen regresyon listesinden: hayalet kayıt, tekrarlanan istek,
  eşzamanlı sekme, ağ kesintisi, kayıttan sonra yeniden açma.
*/

const ORTA = () => 0.5; // sapmasız
const PROJE = "11111111-1111-4111-8111-111111111111";
const BASKA_PROJE = "22222222-2222-4222-8222-222222222222";
const KULLANICI = "33333333-3333-4333-8333-333333333333";
const BASKA_KULLANICI = "44444444-4444-4444-8444-444444444444";

describe("ağ kesintisi: üstel geri çekilme (eskiden sabit 10 sn, sonsuza kadar)", () => {
  test("10 → 20 → 40 → 80 → 120 sn, sonra 120 sn'de sabit", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 12, 50].map((n) => tekrarGecikmesi(n, ORTA)), [10_000, 20_000, 40_000, 80_000, 120_000, 120_000, 120_000, 120_000]);
  });

  test("sapma ±%20 ama asla 2 dakikayı aşmıyor ve 8 sn'nin altına inmiyor", () => {
    for (let n = 1; n <= 20; n++) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) {
        const g = tekrarGecikmesi(n, () => r);
        assert.ok(g <= TEKRAR_EN_FAZLA_MS, `deneme ${n}, r ${r}: ${g}`);
        assert.ok(g >= 8_000, `deneme ${n}, r ${r}: ${g}`);
      }
    }
    assert.equal(tekrarGecikmesi(1, () => 0), 8_000);
    assert.equal(tekrarGecikmesi(1, () => 0.999999), 12_000);
  });

  test("geçersiz deneme sayısı ilk deneme sayılır", () => {
    assert.equal(tekrarGecikmesi(0, ORTA), 10_000);
    assert.equal(tekrarGecikmesi(-3, ORTA), 10_000);
  });

  test("kullanıcı yazmaya devam ederken de geri çekilme geçerli (her tuş 1,5 sn'lik deneme kurmuyor)", () => {
    assert.equal(sonrakiKayitGecikmesi(1000, 0), AUTOSAVE_DELAY_MS);
    assert.equal(sonrakiKayitGecikmesi(400_000, 0), 4000);
    assert.equal(sonrakiKayitGecikmesi(1000, 3, ORTA), 40_000);
    assert.equal(sonrakiKayitGecikmesi(1000, 9, ORTA), 120_000);
  });

  test("simülasyon: 4 deneme ağ yok, sonra açılıyor — metin kaybolmuyor, sayaç sıfırlanıyor", () => {
    let ardisik = 0;
    const bekleyisler: number[] = [];
    let kaydedilen = 0;
    const revizyon = 7;
    for (let deneme = 0; deneme < 10; deneme++) {
      const ag = deneme >= 4;
      const sonuc = ag
        ? ({ tur: "cevap", cevap: { success: true, updatedAt: "2026-11-15T10:00:00Z" } } as const)
        : ({ tur: "hata", mesaj: "fetch failed" } as const);
      const k = kayitSonucuKarari(sonuc, { ardisikBaglantiHatasi: ardisik, araYazildi: false });
      ardisik = k.ardisikBaglantiHatasi;
      if (k.sonraki === "geri-cekilme") bekleyisler.push(tekrarGecikmesi(ardisik, ORTA));
      if (k.durum === "saved") {
        kaydedilen = revizyon;
        break;
      }
    }
    assert.deepEqual(bekleyisler, [10_000, 20_000, 40_000, 80_000]);
    assert.equal(kaydedilen, revizyon, "ağ açılınca metin kaydedilmeli");
    assert.equal(ardisik, 0);
  });
});

describe("hayalet kayıt: metin değişmediyse istek yok", () => {
  test("revizyon aynıysa 'gerek-yok' (bir 'update' olayı belgeyi değiştirmeden gelse bile)", () => {
    assert.equal(kayitKarari({ icerikUyumsuz: false, engelli: false, zorla: false, revizyon: 3, kaydedilenRevizyon: 3 }), "gerek-yok");
    assert.equal(kayitKarari({ icerikUyumsuz: false, engelli: false, zorla: false, revizyon: 4, kaydedilenRevizyon: 3 }), "gonder");
  });

  test("engel yalnızca zorla kayıtla aşılır; uyumsuz içerik zorla da gönderilmez", () => {
    assert.equal(kayitKarari({ icerikUyumsuz: false, engelli: true, zorla: false, revizyon: 4, kaydedilenRevizyon: 3 }), "engelli");
    assert.equal(kayitKarari({ icerikUyumsuz: false, engelli: true, zorla: true, revizyon: 3, kaydedilenRevizyon: 3 }), "gonder");
    assert.equal(kayitKarari({ icerikUyumsuz: true, engelli: false, zorla: true, revizyon: 4, kaydedilenRevizyon: 3 }), "uyumsuz");
  });
});

describe("sonuçtan sonra: gerçek çakışma sessizce üzerine yazılmaz", () => {
  const cevap = (c: SunucuSonucu) => ({ tur: "cevap" as const, cevap: c });
  const d = { ardisikBaglantiHatasi: 2, araYazildi: false };

  test("başarı: kaydedildi, sayaç sıfır; araya yazıldıysa 'dirty' ve yeniden kayıt", () => {
    assert.deepEqual(kayitSonucuKarari(cevap({ success: true, updatedAt: "x" }), d), {
      durum: "saved", engelle: false, oturumBitti: false, abonelikBitti: false, sonraki: "yok", ardisikBaglantiHatasi: 0,
    });
    const ara = kayitSonucuKarari(cevap({ success: true, updatedAt: "x" }), { ...d, araYazildi: true });
    assert.equal(ara.durum, "dirty");
    assert.equal(ara.sonraki, "yeniden");
  });

  test("çakışma: kilitlenir ve YENİDEN DENENMEZ (kullanıcı karar verir)", () => {
    const k = kayitSonucuKarari(cevap({ error: "çakışma", conflict: true }), d);
    assert.equal(k.durum, "conflict");
    assert.equal(k.engelle, true);
    assert.equal(k.sonraki, "yok");
  });

  test("oturum bitti, yetki ya da abonelik reddi: kilit, deneme yok", () => {
    const o = kayitSonucuKarari(cevap({ error: "oturum", sessionExpired: true }), d);
    assert.deepEqual([o.engelle, o.oturumBitti, o.sonraki], [true, true, "yok"]);
    const a = kayitSonucuKarari(cevap({ error: "abonelik", forbidden: true, abonelik: true }), d);
    assert.deepEqual([a.engelle, a.abonelikBitti, a.sonraki], [true, true, "yok"]);
    const y = kayitSonucuKarari(cevap({ error: "yetki", forbidden: true }), d);
    assert.deepEqual([y.engelle, y.abonelikBitti, y.sonraki], [true, false, "yok"]);
  });

  test("yeni sürüm yayınlandı (Failed to find Server Action): kilit, deneme yok", () => {
    const k = kayitSonucuKarari({ tur: "hata", mesaj: 'Failed to find Server Action "abc"' }, d);
    assert.deepEqual([k.engelle, k.sonraki, k.ardisikBaglantiHatasi], [true, "yok", 0]);
  });

  test("bağlantı hatası ve tanınmayan sunucu hatası: geri çekilme, sayaç artar", () => {
    const b = kayitSonucuKarari({ tur: "hata", mesaj: "fetch failed" }, d);
    assert.deepEqual([b.durum, b.engelle, b.sonraki, b.ardisikBaglantiHatasi], ["error", false, "geri-cekilme", 3]);
    const s = kayitSonucuKarari(cevap({ error: "Kaydedilemedi." }), d);
    assert.deepEqual([s.engelle, s.sonraki, s.ardisikBaglantiHatasi], [false, "geri-cekilme", 3]);
  });
});

describe("tekrarlanan istek: aynı anda tek kayıt", () => {
  /* Bileşendeki saveNow'un çekirdeği: karar, uçuş sırasında DEĞİL sıra gelince veriliyor. */
  function editorBenzeri() {
    const kuyruk = tekUcusluCalistirici<boolean>();
    const durum = { revizyon: 0, kaydedilen: 0, istek: 0, esZamanli: 0, enCokEsZamanli: 0 };
    const kaydet = () =>
      kuyruk.calistir(async () => {
        if (kayitKarari({ icerikUyumsuz: false, engelli: false, zorla: false, revizyon: durum.revizyon, kaydedilenRevizyon: durum.kaydedilen }) !== "gonder") return true;
        const gonderilen = durum.revizyon;
        durum.istek += 1;
        durum.esZamanli += 1;
        durum.enCokEsZamanli = Math.max(durum.enCokEsZamanli, durum.esZamanli);
        await new Promise((z) => setTimeout(z, 5));
        durum.esZamanli -= 1;
        durum.kaydedilen = gonderilen;
        return true;
      });
    return { durum, kaydet, kuyruk };
  }

  test("art arda 5 kayıt çağrısı (Ctrl+S yağmuru, görünürlük + zamanlayıcı): tek istek, eşzamanlı istek yok", async () => {
    const e = editorBenzeri();
    e.durum.revizyon = 1;
    await Promise.all([e.kaydet(), e.kaydet(), e.kaydet(), e.kaydet(), e.kaydet()]);
    assert.equal(e.durum.istek, 1);
    assert.equal(e.durum.enCokEsZamanli, 1);
    assert.equal(e.durum.kaydedilen, 1);
  });

  test("kayıt sürerken yazılan metin kaybolmuyor: ikinci istek yalnızca bir kez, en güncel revizyonla", async () => {
    const e = editorBenzeri();
    e.durum.revizyon = 1;
    const ilk = e.kaydet();
    e.durum.revizyon = 2; // uçuş sırasında yazıldı
    await Promise.all([ilk, e.kaydet(), e.kaydet()]);
    assert.equal(e.durum.istek, 2);
    assert.equal(e.durum.enCokEsZamanli, 1);
    assert.equal(e.durum.kaydedilen, 2);
  });

  test("bir kaydın hatası sonrakini kilitlemiyor ve meşgul bayrağı temizleniyor", async () => {
    const kuyruk = tekUcusluCalistirici<number>();
    const hatali = kuyruk.calistir(async () => {
      throw new Error("ağ");
    });
    const sonraki = kuyruk.calistir(async () => 42);
    await assert.rejects(hatali);
    assert.equal(await sonraki, 42);
    assert.equal(kuyruk.mesgul, false);
  });

  test("metin hiç değişmediyse (hayalet) kuyruktan istek çıkmıyor", async () => {
    const e = editorBenzeri();
    await Promise.all([e.kaydet(), e.kaydet()]);
    assert.equal(e.durum.istek, 0);
  });
});

describe("eşzamanlı sekme: yerel taslak sekme başına", () => {
  test("iki sekmenin anahtarı farklı; ikisi de bu kullanıcının bu çalışmasına ait", () => {
    const a = taslakAnahtari(PROJE, KULLANICI, "sekme-a");
    const b = taslakAnahtari(PROJE, KULLANICI, "sekme-b");
    assert.notEqual(a, b, "eskiden iki sekme aynı anahtara yazıyordu");
    assert.ok(taslakAnahtariMi(a, PROJE, KULLANICI));
    assert.ok(taslakAnahtariMi(b, PROJE, KULLANICI));
  });

  test("başka çalışmanın ya da başka kullanıcının taslağı ASLA eşleşmez", () => {
    assert.equal(taslakAnahtariMi(taslakAnahtari(BASKA_PROJE, KULLANICI, "s"), PROJE, KULLANICI), false);
    assert.equal(taslakAnahtariMi(taslakAnahtari(PROJE, BASKA_KULLANICI, "s"), PROJE, KULLANICI), false);
    assert.equal(taslakAnahtariMi(taslakAnahtari(PROJE, BASKA_KULLANICI, null), PROJE, KULLANICI), false);
    assert.equal(taslakAnahtariMi(`arvolab:manuscript-draft:${PROJE}:${KULLANICI}:../x`, PROJE, KULLANICI), false);
    assert.equal(taslakAnahtariMi(`arvolab:manuscript-draft:${PROJE}x`, PROJE, KULLANICI), false);
  });

  test("eski biçimler (kullanıcısız, sekmesiz) okunur: içlerindeki metin kaybolmaz", () => {
    assert.ok(taslakAnahtariMi(`arvolab:manuscript-draft:${PROJE}`, PROJE, KULLANICI));
    assert.ok(taslakAnahtariMi(`arvolab:manuscript-draft:${PROJE}:${KULLANICI}`, PROJE, KULLANICI));
  });

  test("oturum çözülemediyse (kullanıcı yok) yalnızca ortak eski anahtar", () => {
    assert.equal(taslakAnahtari(PROJE, null, "s"), `arvolab:manuscript-draft:${PROJE}`);
    assert.equal(taslakAnahtariMi(taslakAnahtari(PROJE, KULLANICI, "s"), PROJE, null), false);
  });

  const taslak = (metin: string, zaman: string) => JSON.stringify({ content: { type: "doc", metin }, baseUpdatedAt: null, writtenAt: zaman });

  test("açılışta en yeni taslak önerilir; öteki sekmenin taslağı silinmeden durur", () => {
    const kayitlar = [
      { anahtar: taslakAnahtari(PROJE, KULLANICI, "a"), ham: taslak("A sekmesi", "2026-11-15T10:00:00Z") },
      { anahtar: taslakAnahtari(PROJE, KULLANICI, "b"), ham: taslak("B sekmesi", "2026-11-15T10:05:00Z") },
      { anahtar: taslakAnahtari(PROJE, BASKA_KULLANICI, "c"), ham: taslak("başkası", "2026-11-15T11:00:00Z") },
      { anahtar: taslakAnahtari(BASKA_PROJE, KULLANICI, "d"), ham: taslak("başka çalışma", "2026-11-15T12:00:00Z") },
    ];
    const secilen = onerilecekTaslak<{ metin: string }>(kayitlar, PROJE, KULLANICI);
    assert.equal(secilen?.anahtar, taslakAnahtari(PROJE, KULLANICI, "b"));
    assert.equal(secilen?.taslak.content.metin, "B sekmesi");
    // B önerildi ve çözüldü (silindi): A hâlâ bulunur.
    const kalan = onerilecekTaslak<{ metin: string }>(kayitlar.filter((k) => k.anahtar !== secilen?.anahtar), PROJE, KULLANICI);
    assert.equal(kalan?.taslak.content.metin, "A sekmesi");
  });

  test("bozuk, içeriksiz ya da tarihsiz kayıt önerilmez; eşit tarihte sonuç kararlı", () => {
    const k = (s: string) => taslakAnahtari(PROJE, KULLANICI, s);
    assert.equal(onerilecekTaslak([{ anahtar: k("a"), ham: "{bozuk" }], PROJE, KULLANICI), null);
    assert.equal(onerilecekTaslak([{ anahtar: k("a"), ham: JSON.stringify({ writtenAt: "2026-11-15T10:00:00Z" }) }], PROJE, KULLANICI), null);
    assert.equal(onerilecekTaslak([{ anahtar: k("a"), ham: JSON.stringify({ content: {}, writtenAt: "dün" }) }], PROJE, KULLANICI), null);
    const esit = [
      { anahtar: k("b"), ham: taslak("b", "2026-11-15T10:00:00Z") },
      { anahtar: k("a"), ham: taslak("a", "2026-11-15T10:00:00Z") },
    ];
    assert.equal(onerilecekTaslak(esit, PROJE, KULLANICI)?.anahtar, onerilecekTaslak([...esit].reverse(), PROJE, KULLANICI)?.anahtar);
  });
});

describe("kayıttan sonra yeniden açma", () => {
  test("başarılı kayıt bu sekmenin taslağını kaldırınca yeniden açılışta öneri yok; öteki sekmeninki kalır", () => {
    const depo = new Map<string, string>();
    const a = taslakAnahtari(PROJE, KULLANICI, "a");
    const b = taslakAnahtari(PROJE, KULLANICI, "b");
    const yaz = (anahtar: string, metin: string) =>
      depo.set(anahtar, JSON.stringify({ content: { metin }, baseUpdatedAt: null, writtenAt: new Date().toISOString() }));
    const oneri = () => onerilecekTaslak<{ metin: string }>([...depo].map(([anahtar, ham]) => ({ anahtar, ham })), PROJE, KULLANICI);

    yaz(a, "A'nın kaydedilmemiş metni");
    yaz(b, "B'nin kaydedilmemiş metni");
    // A kaydetti: yalnızca KENDİ anahtarını (ve sekmesiz eski anahtarları) siler — bileşendeki kendiTaslaginiSil.
    for (const k of [a, taslakAnahtari(PROJE, KULLANICI, null), taslakAnahtari(PROJE, null, null)]) depo.delete(k);
    assert.equal(oneri()?.taslak.content.metin, "B'nin kaydedilmemiş metni", "B'nin taslağı A'nın kaydıyla silinmemeli");
    // B de kaydetti: yeniden açılışta öneri yok.
    depo.delete(b);
    assert.equal(oneri(), null);
  });

  test("zamanlama sabitleri bileşenden taşındı, değerler aynı", () => {
    assert.equal(autosaveDelay(10), 1500);
    assert.equal(autosaveDelay(300_001), 4000);
  });
});

describe("birden çok kurtarılabilir taslak", () => {
  const k = (s: string) => taslakAnahtari(PROJE, KULLANICI, s);
  const ham = (metin: string, zaman: string) => JSON.stringify({ content: { metin }, baseUpdatedAt: null, writtenAt: zaman });
  const kayitlar = [
    { anahtar: k("eski"), ham: ham("ESKİ", "2026-11-15T10:00:00Z") },
    { anahtar: k("yeni"), ham: ham("YENİ", "2026-11-15T10:10:00Z") },
    { anahtar: k("orta"), ham: ham("ORTA", "2026-11-15T10:05:00Z") },
    { anahtar: taslakAnahtari(PROJE, BASKA_KULLANICI, "x"), ham: ham("BAŞKASI", "2026-11-15T11:00:00Z") },
    { anahtar: taslakAnahtari(BASKA_PROJE, KULLANICI, "y"), ham: ham("BAŞKA ÇALIŞMA", "2026-11-15T11:00:00Z") },
    { anahtar: k("bozuk"), ham: "{" },
  ];

  test("hepsi en yeniden eskiye sıralanır; başka kullanıcı ve çalışma ASLA listeye girmez", () => {
    const liste = kurtarilabilirTaslaklar<{ metin: string }>(kayitlar, PROJE, KULLANICI);
    assert.deepEqual(liste.map((x) => x.taslak.content.metin), ["YENİ", "ORTA", "ESKİ"]);
    assert.equal(onerilecekTaslak<{ metin: string }>(kayitlar, PROJE, KULLANICI)?.taslak.content.metin, "YENİ");
  });

  test("'Öncekini göster' döner, hiçbir taslak düşmez", () => {
    const sira = ["YENİ", "ORTA", "ESKİ"];
    assert.deepEqual(sonrakiTeklif(sira), ["ORTA", "ESKİ", "YENİ"]);
    assert.deepEqual(sonrakiTeklif(sonrakiTeklif(sonrakiTeklif(sira))), sira);
    assert.deepEqual(sonrakiTeklif(["TEK"]), ["TEK"]);
  });

  test("'Yok say' yalnızca gösterileni çıkarır; sıradaki önerilir; liste biterse teklif kapanır", () => {
    assert.deepEqual(teklifiYokSay(["ORTA", "ESKİ", "YENİ"]), ["ESKİ", "YENİ"]);
    assert.deepEqual(teklifiYokSay(["TEK"]), []);
    assert.deepEqual(teklifiYokSay([]), []);
  });
});
