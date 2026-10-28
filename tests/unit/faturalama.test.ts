import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { faturalamaKapsami, faturalamaOku, gunYazisi, odemeAciklamasi, odemeninProformasi, proformaDurumu, tutarYazisi, vergiNoEtiketi } from "@/lib/faturalama";

describe("faturalama", () => {
  test("ArvoOS yanıtı okunur; fatura ve dekont yalnızca https bağlantıyla", () => {
    const f = faturalamaOku({
      toplamOdenen: 84800,
      bekleyenTutar: 0,
      odemeler: [
        { id: "a", tarih: "2026-10-26T10:00:00Z", tutar: 34900, tur: "abonelik", kanal: "kart", durum: "odendi",
          donemBaslangic: "2026-10-26T10:00:00Z", donemBitis: "2026-11-26T10:00:00Z",
          fatura: { no: "ARV2026000001", tarih: "2026-10-27", url: "https://x.supabase.co/sign/1" } },
        { id: "b", tutar: 49900, tur: "kredi", dekontUrl: "javascript:alert(1)", fatura: { no: "", url: "https://x" } },
      ],
    })!;
    assert.equal(f.odemeler.length, 2);
    assert.equal(f.odemeler[0].fatura?.no, "ARV2026000001");
    assert.equal(f.odemeler[1].dekontUrl, null, "https olmayan adres bağlantıya dönüşmez");
    assert.equal(f.odemeler[1].fatura, null, "numarasız fatura gösterilmez");
    assert.equal(f.toplamOdenen, 84800);
  });

  test("tutarı ya da kimliği okunamayan satır atılır; liste yoksa null", () => {
    const f = faturalamaOku({ odemeler: [{ id: "a" }, { tutar: 100 }, { id: "c", tutar: -5 }, { id: "d", tutar: 100 }] })!;
    assert.deepEqual(f.odemeler.map((o) => o.id), ["d"]);
    assert.equal(faturalamaOku({ status: "active" }), null);
    assert.equal(faturalamaOku(null), null);
  });

  test("açıklama ve tutar yazımı", () => {
    const [kredi, abonelik] = faturalamaOku({ odemeler: [
      { id: "k", tutar: 49900, tur: "kredi" },
      { id: "a", tutar: 34900, donemBaslangic: "2026-10-26T10:00:00Z", donemBitis: "2026-11-26T10:00:00Z" },
    ] })!.odemeler;
    assert.equal(odemeAciklamasi(kredi), "AI kredisi");
    assert.equal(odemeAciklamasi(abonelik), "ArvoLab aboneliği · 26.10.2026 – 26.11.2026");
    assert.equal(tutarYazisi(49900), "499,00 TL");
  });

  test("kurumun ödemelerini yalnızca kurum yöneticisi görür", () => {
    assert.deepEqual(faturalamaKapsami("individual", "student", null), { tur: "bireysel" });
    assert.deepEqual(faturalamaKapsami("organization", "academic_manager", "k1"), { tur: "kurum", kurumId: "k1" });
    assert.equal(faturalamaKapsami("organization", "student", "k1"), null);
    assert.equal(faturalamaKapsami("organization", "controller", "k1"), null);
    assert.equal(faturalamaKapsami("organization", "academic_manager", null), null);
    assert.equal(faturalamaKapsami("staff", "founder", null), null);
    // İç ekip seçili (ya da kendi) kurumunun faturalarını görür.
    assert.deepEqual(faturalamaKapsami("staff", "founder", "k1"), { tur: "kurum", kurumId: "k1" });
    assert.deepEqual(faturalamaKapsami("staff", "system_admin", "k2"), { tur: "kurum", kurumId: "k2" });
  });

  /* Proforma (27.10.2026): ödemeden önce gelen belge; tutarsızsa hiç gösterilmez. */
  const PROFORMA = {
    id: "p1", no: "PRF-2026-0001", musteriAdi: "Güzel Kurum",
    kalemler: [{ aciklama: "Kurum lisansı", miktar: 2, birim_fiyat: 50_000 }],
    araToplam: 100_000, kdvOrani: 20, kdv: 20_000, toplam: 120_000,
    duzenlemeTarihi: "2026-10-27", gecerlilikTarihi: "2026-11-11", durum: "odendi", odemeId: "a",
  };

  test("proforma okunur, ödemeyle eşlenir; eski ArvoOS yanıtında liste boş", () => {
    const f = faturalamaOku({
      odemeler: [{ id: "a", tutar: 120_000 }],
      proformalar: [PROFORMA],
      satici: { unvan: "Arvo A.Ş.", hesaplar: [{ banka: "Banka", iban: "TR00" }, { banka: "Eksik" }] },
    })!;
    assert.equal(f.proformalar.length, 1);
    assert.deepEqual(f.proformalar[0].kalemler, [{ aciklama: "Kurum lisansı", miktar: 2, birimFiyat: 50_000 }]);
    assert.equal(odemeninProformasi(f, "a")?.no, "PRF-2026-0001");
    assert.equal(f.satici?.hesaplar.length, 1, "IBAN'sız hesap gösterilmez");
    const eski = faturalamaOku({ odemeler: [] })!;
    assert.deepEqual([eski.proformalar, eski.satici], [[], null]);
  });

  test("kalemleri ya da KDV'si toplamı tutmayan proforma gösterilmez", () => {
    const oku = (p: object) => faturalamaOku({ odemeler: [], proformalar: [p] })!.proformalar.length;
    assert.equal(oku(PROFORMA), 1);
    assert.equal(oku({ ...PROFORMA, araToplam: 90_000, toplam: 110_000 }), 0, "kalem toplamı ara toplamı tutmuyor");
    assert.equal(oku({ ...PROFORMA, toplam: 100_000 }), 0, "ara toplam + KDV toplamı tutmuyor");
    assert.equal(oku({ ...PROFORMA, kalemler: [] }), 0);
  });

  /* Alıcı (28.10.2026): yalnızca gösterim bilgisi; kusurlu alıcı proformayı düşürmez. */
  test("alıcı okunur; eski ArvoOS göndermiyorsa null", () => {
    const oku = (alici: unknown) => faturalamaOku({ odemeler: [], proformalar: [{ ...PROFORMA, alici }] })!.proformalar;
    const [p] = oku({
      adSoyad: " Ayşe Yılmaz ", unvan: "Güzel Kurum Ltd. Şti.", vergiDairesi: "Kadıköy",
      vergiNo: "1234567890", adres: "Moda Cad. 1, İstanbul", eposta: "muhasebe@guzel.com",
    });
    assert.deepEqual(p.alici, {
      adSoyad: "Ayşe Yılmaz", unvan: "Güzel Kurum Ltd. Şti.", vergiDairesi: "Kadıköy",
      vergiNo: "1234567890", adres: "Moda Cad. 1, İstanbul", eposta: "muhasebe@guzel.com",
    });
    assert.equal(p.musteriAdi, "Güzel Kurum", "musteriAdi yedek olarak okunmaya devam eder");
    assert.equal(faturalamaOku({ odemeler: [], proformalar: [PROFORMA] })!.proformalar[0].alici, null, "alan hiç yok");
    assert.equal(oku(undefined)[0].alici, null);
    assert.equal(oku(null)[0].alici, null);
  });

  test("kusurlu alıcı proformayı düşürmez; bozuk alan boş kalır", () => {
    const oku = (alici: unknown) => faturalamaOku({ odemeler: [], proformalar: [{ ...PROFORMA, alici }] })!.proformalar;
    const [p] = oku({ adSoyad: 42, unvan: "  ", vergiNo: "12345678901", adres: ["x"], eposta: {} });
    assert.deepEqual(p.alici, { adSoyad: null, unvan: null, vergiDairesi: null, vergiNo: "12345678901", adres: null, eposta: null });
    for (const bozuk of ["metin", 7, [], { adSoyad: "", unvan: null }]) {
      const liste = oku(bozuk);
      assert.equal(liste.length, 1, "proforma yine gösterilir");
      assert.equal(liste[0].alici, null, "hiçbir alanı dolu olmayan alıcı yok sayılır");
    }
  });

  test("vergi numarasının etiketi hanesinden", () => {
    assert.equal(vergiNoEtiketi("1234567890"), "VKN");
    assert.equal(vergiNoEtiketi("12345678901"), "TCKN");
    assert.equal(vergiNoEtiketi("123 456 7890"), "VKN", "boşluklu yazım");
    assert.equal(vergiNoEtiketi("12345"), "Vergi No");
    assert.equal(vergiNoEtiketi("ABC1234567"), "Vergi No");
    assert.equal(vergiNoEtiketi("1234567890", "en"), "Tax ID");
    assert.equal(vergiNoEtiketi("12345678901", "en"), "National ID");
    assert.equal(vergiNoEtiketi("12345", "en"), "Tax No.");
  });

  test("süresi dolan proforma yalnızca görünümde; gün gösterimi saat dilimine düşmez", () => {
    assert.equal(proformaDurumu({ durum: "bekliyor", gecerlilikTarihi: "2026-10-26" }, "2026-10-27"), "suresi_doldu");
    assert.equal(proformaDurumu({ durum: "bekliyor", gecerlilikTarihi: "2026-10-27" }, "2026-10-27"), "bekliyor");
    assert.equal(proformaDurumu({ durum: "odendi", gecerlilikTarihi: "2026-10-01" }, "2026-10-27"), "odendi");
    assert.equal(gunYazisi("2026-11-01"), "01.11.2026");
  });
});

describe("İngilizce", () => {
  test("tarih, tutar ve ödeme açıklaması", () => {
    assert.equal(gunYazisi("2026-11-15", "en"), "Nov 15, 2026");
    assert.equal(tutarYazisi(49900, "TRY", "en"), "499.00 TRY");
    const odeme = faturalamaOku({ odemeler: [{ id: "o1", tutar: 49900, tur: "kredi" }] })!.odemeler[0];
    assert.equal(odemeAciklamasi(odeme, "en"), "AI credits");
    const abonelik = faturalamaOku({
      odemeler: [{ id: "o2", tutar: 49900, donemBaslangic: "2026-10-26T10:00:00Z", donemBitis: "2026-11-26T10:00:00Z" }],
    })!.odemeler[0];
    assert.equal(odemeAciklamasi(abonelik, "en"), "ArvoLab subscription · Oct 26, 2026 – Nov 26, 2026");
  });
});
