import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  _koruyuculariSifirla,
  kaydiTamamla,
  korumaGerekliMi,
  koruyucuDurumu,
  koruyucuKaydet,
  uygulamaIciGecisMi,
  type BaglantiTiklamasi,
} from "@/lib/gezinme-korumasi";

afterEach(() => _koruyuculariSifirla());

describe("kaydiTamamla", () => {
  it("koruyucu yoksa ya da temizse kayıt istemez", async () => {
    assert.equal(await kaydiTamamla(), "temiz");
    koruyucuKaydet({ kirliMi: () => false, kaydet: async () => assert.fail("temizken kaydedilmemeli") });
    assert.equal(await kaydiTamamla(), "temiz");
    assert.equal(korumaGerekliMi(), false);
  });

  it("kirliyse kaydeder ve SONUCU bekler", async () => {
    let kirli = true;
    koruyucuKaydet({
      kirliMi: () => kirli,
      kaydet: async () => {
        await new Promise((r) => setTimeout(r, 20));
        kirli = false;
        return true;
      },
    });
    assert.equal(korumaGerekliMi(), true);
    assert.equal(await kaydiTamamla(), "kaydedildi");
  });

  it("kayıt başarısızsa geçiş güvenli değil", async () => {
    koruyucuKaydet({ kirliMi: () => true, kaydet: async () => false });
    assert.equal(await kaydiTamamla(), "kaydedilemedi");
  });

  it("kayıt fırlatırsa geçiş güvenli değil", async () => {
    koruyucuKaydet({ kirliMi: () => true, kaydet: async () => { throw new Error("ağ"); } });
    assert.equal(await kaydiTamamla(), "kaydedilemedi");
  });

  it("kayıt zaman aşımına uğrarsa geçiş güvenli değil", async () => {
    koruyucuKaydet({ kirliMi: () => true, kaydet: () => new Promise(() => {}) });
    assert.equal(await kaydiTamamla(30), "kaydedilemedi");
  });

  it("kayıt 'başarılı' dese de bu sırada yeni harf yazıldıysa güvenli değil", async () => {
    koruyucuKaydet({ kirliMi: () => true, kaydet: async () => true });
    assert.equal(await kaydiTamamla(), "kaydedilemedi");
  });

  it("kaydı silinen koruyucu artık sayılmaz", async () => {
    const sil = koruyucuKaydet({ kirliMi: () => true, kaydet: async () => false });
    sil();
    assert.equal(await kaydiTamamla(), "temiz");
  });
});

describe("koruyucuDurumu (kayıt hatası penceresinin sözü)", () => {
  it("kirli koruyucunun taslak durumu ve nedeni okunur", () => {
    koruyucuKaydet({ kirliMi: () => true, kaydet: async () => false, durum: () => ({ taslakYazildi: false, neden: "Oturum kapandı" }) });
    assert.deepEqual(koruyucuDurumu(), { taslakYazildi: false, neden: "Oturum kapandı" });
  });
  it("temiz koruyucu sayılmaz", () => {
    koruyucuKaydet({ kirliMi: () => false, kaydet: async () => true, durum: () => ({ taslakYazildi: false, neden: "eski" }) });
    koruyucuKaydet({ kirliMi: () => true, kaydet: async () => false, durum: () => ({ taslakYazildi: true, neden: null }) });
    assert.deepEqual(koruyucuDurumu(), { taslakYazildi: true, neden: null });
  });
  it("durumunu söylemeyen kirli koruyucu için taslak güvencesi VERİLMEZ", () => {
    koruyucuKaydet({ kirliMi: () => true, kaydet: async () => false });
    assert.deepEqual(koruyucuDurumu(), { taslakYazildi: false, neden: null });
  });
});

describe("uygulamaIciGecisMi", () => {
  const konum = { origin: "https://lab.arvo-os.com", pathname: "/dashboard/editor/a/write", search: "" };
  const tik = (ek: Partial<BaglantiTiklamasi>): BaglantiTiklamasi => ({
    href: "/dashboard",
    target: null,
    download: false,
    dugme: 0,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    engellendi: false,
    ...ek,
  });

  it("uygulama içi düz tıklama korunur", () => {
    assert.equal(uygulamaIciGecisMi(tik({}), konum), true);
    assert.equal(uygulamaIciGecisMi(tik({ href: "/dashboard/editor/b/kanit" }), konum), true);
    assert.equal(uygulamaIciGecisMi(tik({ href: "https://lab.arvo-os.com/dashboard/literature?calisma=a" }), konum), true);
  });

  it("yeni sekme, indirme, başka köken ve çapa korunmaz (sayfa yerinde kalır)", () => {
    for (const ek of [{ ctrl: true }, { meta: true }, { shift: true }, { alt: true }, { dugme: 1 }, { target: "_blank" }, { download: true }, { engellendi: true }, { href: null }]) {
      assert.equal(uygulamaIciGecisMi(tik(ek), konum), false, JSON.stringify(ek));
    }
    assert.equal(uygulamaIciGecisMi(tik({ href: "https://example.org/x" }), konum), false);
    assert.equal(uygulamaIciGecisMi(tik({ href: "mailto:destek@arvo-os.com" }), konum), false);
    assert.equal(uygulamaIciGecisMi(tik({ href: "#bolum-2" }), konum), false);
  });

  it("aynı yolda farklı sorgu bir geçiştir (ör. ?asistan=1 sayfayı yeniden çizer)", () => {
    assert.equal(uygulamaIciGecisMi(tik({ href: "/dashboard/editor/a/write?teslim=1" }), konum), true);
  });
});
