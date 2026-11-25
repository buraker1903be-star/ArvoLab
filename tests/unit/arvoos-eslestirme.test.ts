import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { UserRole } from "@/lib/project-labels";
import {
  atamaOnerileri,
  bagOzeti,
  bagRaporu,
  csv,
  csvAlani,
  epostaAnahtari,
  kapsananKurumlar,
  kurumBagiHukmu,
  rolOnerileri,
  type ArvolabProfili,
  type ArvoosKaydi,
} from "@/lib/arvoos-eslestirme";

const KURUM_A = "11111111-1111-1111-1111-111111111111";
const KURUM_B = "22222222-2222-2222-2222-222222222222";

const profil = (p: Partial<ArvolabProfili> = {}): ArvolabProfili => ({
  id: "p1",
  kurum: KURUM_A,
  eposta: "uzman@kurum-a.test",
  epostaOnayli: true,
  rol: "employee" as UserRole,
  ...p,
});

const kayit = (k: Partial<ArvoosKaydi> = {}): ArvoosKaydi => ({
  arvoosUserId: "a1",
  eposta: "uzman@kurum-a.test",
  kurum: KURUM_A,
  ...k,
});

/** Çağıranın yaptığı işin aynısı: kapsam, bildirilen satırlardan çıkar. */
const hukum = (p: ArvolabProfili, kayitlar: ArvoosKaydi[]) => kurumBagiHukmu(p, kayitlar, kapsananKurumlar(kayitlar));

describe("kurumBagiHukmu", () => {
  test("kurumdaki tek etkin üyelikle e-posta eşleşirse doğrulanabilir", () => {
    const s = hukum(profil(), [kayit()]);
    assert.equal(s.hukum, "dogrulanabilir");
    assert.equal(s.sebep, "eslesti");
    assert.equal(s.arvoosUserId, "a1");
    assert.equal(s.baskaKurumdaDa, false);
  });

  test("e-posta yazımı büyük/küçük harf ve boşluktan etkilenmez", () => {
    const s = hukum(profil({ eposta: "  Uzman@Kurum-A.test " }), [kayit({ eposta: "UZMAN@kurum-a.TEST" })]);
    assert.equal(s.hukum, "dogrulanabilir");
  });

  /*
    EN ÖNEMLİ KURAL. Kurum lisansı kapanınca ArvoOS üye listesi SİLİNİYOR;
    boş liste "bu kişi üye değil" demez. Burası "doğrulanamadı" derse rapor,
    onaylayan kişiye var olan bağları kaldırtır.
  */
  test("ArvoOS tarafı o kurum için hiç satır bildirmediyse ölçülemedi, doğrulanamadı DEĞİL", () => {
    const s = hukum(profil(), []);
    assert.equal(s.hukum, "olculemedi");
    assert.equal(s.sebep, "arvoos_verisi_yok");
  });

  test("başka kurumun listesi gelmiş olması kişinin kurumunu kapsamaz", () => {
    const s = hukum(profil({ kurum: KURUM_B }), [kayit({ kurum: KURUM_A })]);
    assert.equal(s.hukum, "olculemedi");
    assert.equal(s.sebep, "arvoos_verisi_yok");
  });

  test("kurum kapsamdayken e-posta listede yoksa doğrulanamadı", () => {
    const s = hukum(profil({ eposta: "baska@kurum-a.test" }), [kayit()]);
    assert.equal(s.hukum, "dogrulanamadi");
    assert.equal(s.sebep, "arvoos_listesinde_yok");
  });

  test("e-posta ArvoOS'ta başka kurumda ise kurum uyuşmuyor", () => {
    const kayitlar = [kayit({ kurum: KURUM_B, arvoosUserId: "a9" }), kayit({ eposta: "digeri@kurum-a.test" })];
    const s = hukum(profil(), kayitlar);
    assert.equal(s.hukum, "dogrulanamadi");
    assert.equal(s.sebep, "kurum_uyusmuyor");
    assert.equal(s.baskaKurumdaDa, true);
    assert.equal(s.arvoosUserId, null);
  });

  test("kendi kurumunda eşleşen kişi başka kurumda da etkinse hüküm olumsuza dönmez, bayrak kalkar", () => {
    const s = hukum(profil(), [kayit(), kayit({ kurum: KURUM_B, arvoosUserId: "a2" })]);
    assert.equal(s.hukum, "dogrulanabilir");
    assert.equal(s.arvoosUserId, "a1");
    assert.equal(s.baskaKurumdaDa, true);
  });

  test("aynı kurumda aynı e-postayla iki kimlik varsa birden çok aday", () => {
    const s = hukum(profil(), [kayit({ arvoosUserId: "a1" }), kayit({ arvoosUserId: "a2" })]);
    assert.equal(s.hukum, "dogrulanamadi");
    assert.equal(s.sebep, "birden_cok_aday");
    assert.equal(s.arvoosUserId, null);
  });

  test("yansıma listesinde kimlik yoktur; eşleşme yine doğrulanabilir, kimlik null", () => {
    const s = hukum(profil(), [kayit({ arvoosUserId: null }), kayit({ arvoosUserId: null })]);
    assert.equal(s.hukum, "dogrulanabilir");
    assert.equal(s.arvoosUserId, null);
  });

  test("onaysız e-posta eşleşme sayılmaz", () => {
    const s = hukum(profil({ epostaOnayli: false }), [kayit()]);
    assert.equal(s.hukum, "dogrulanamadi");
    assert.equal(s.sebep, "eposta_onaysiz");
  });

  test("e-postası olmayan hesap", () => {
    const s = hukum(profil({ eposta: null }), [kayit()]);
    assert.equal(s.hukum, "dogrulanamadi");
    assert.equal(s.sebep, "eposta_yok");
  });

  test("bağsız profil kapsam dışı", () => {
    const s = hukum(profil({ kurum: null }), [kayit()]);
    assert.equal(s.hukum, "kapsamda_degil");
    assert.equal(s.sebep, "bag_yok");
  });

  /* İç ekibin bağı ArvoOS üyeliğinden gelmiyor; listede aranırsa hepsi
     "listede yok" çıkar ve rapor kaldırılmaması gerekeni kaldırtır. */
  for (const rol of ["system_admin", "founder"] as UserRole[]) {
    test(`${rol} kapsam dışı, listede aranmaz`, () => {
      const s = hukum(profil({ rol, eposta: "ic@arvo.test" }), [kayit()]);
      assert.equal(s.hukum, "kapsamda_degil");
      assert.equal(s.sebep, "ic_ekip");
    });
  }

  test("kapsam dışı ve ölçülemedi kararları e-posta onayından ÖNCE verilir", () => {
    // İç ekibin e-postası onaysız olsa da sebep "ic_ekip" kalmalı.
    const s = hukum(profil({ rol: "founder" as UserRole, epostaOnayli: false }), [kayit()]);
    assert.equal(s.sebep, "ic_ekip");
  });
});

describe("bagRaporu ve bagOzeti", () => {
  const profiller = [
    profil({ id: "p1" }),
    profil({ id: "p2", eposta: "yok@kurum-a.test" }),
    profil({ id: "p3", kurum: KURUM_B }),
    profil({ id: "p4", rol: "founder" as UserRole }),
    profil({ id: "p5", kurum: null }),
  ];
  const kayitlar = [kayit()];
  const satirlar = bagRaporu(profiller, kayitlar, kapsananKurumlar(kayitlar));

  test("her profil için bir satır, girdinin sırasıyla", () => {
    assert.deepEqual(satirlar.map((s) => s.profil), ["p1", "p2", "p3", "p4", "p5"]);
  });

  test("özet hükümleri ve sebepleri sayar", () => {
    const o = bagOzeti(satirlar);
    assert.equal(o.toplam, 5);
    assert.equal(o.dogrulanabilir, 1);
    assert.equal(o.dogrulanamadi, 1);
    assert.equal(o.olculemedi, 1);
    assert.equal(o.kapsamda_degil, 2);
    assert.equal(o.sebepler.eslesti, 1);
    assert.equal(o.sebepler.arvoos_verisi_yok, 1);
    assert.equal(o.baskaKurumdaDa, 0);
  });
});

describe("atamaOnerileri", () => {
  const kayitlar = [kayit()];
  const baglar = bagRaporu([profil({ id: "p1" }), profil({ id: "p2", eposta: "yok@kurum-a.test" })], kayitlar, kapsananKurumlar(kayitlar));

  test("önerinin dayanağı atananın bağ hükmü", () => {
    const o = atamaOnerileri(
      [
        { proje: "c1", kurum: KURUM_A, atanan: "p1" },
        { proje: "c2", kurum: KURUM_A, atanan: "p2" },
      ],
      baglar,
    );
    assert.equal(o[0].atananinBagi, "dogrulanabilir");
    assert.equal(o[0].arvoosUserId, "a1");
    assert.equal(o[1].atananinBagi, "dogrulanamadi");
    assert.equal(o[1].arvoosUserId, null);
  });

  test("profili olmayan atama sessizce düşmez, profil_yok olarak raporlanır", () => {
    const o = atamaOnerileri([{ proje: "c3", kurum: KURUM_A, atanan: "silinmis" }], baglar);
    assert.equal(o.length, 1);
    assert.equal(o[0].atananinBagi, "profil_yok");
  });
});

describe("rolOnerileri", () => {
  /** Hüküm satırlarını gerçek yoldan üretir: çağıran da bunu geçiriyor. */
  const baglarla = (profiller: ArvolabProfili[], kayitlar: ArvoosKaydi[] = []) =>
    rolOnerileri(profiller, bagRaporu(profiller, kayitlar, kapsananKurumlar(kayitlar)));

  test("kurumlu personel rolleri iş yetkisi önerisi alır", () => {
    const profiller = [
      profil({ id: "p1", rol: "employee" as UserRole }),
      profil({ id: "p2", rol: "expert" as UserRole }),
      profil({ id: "p3", rol: "controller" as UserRole }),
      profil({ id: "p4", rol: "academic_manager" as UserRole }),
    ];
    const o = baglarla(profiller, [kayit()]);
    assert.deepEqual(o.map((x) => x.profil), ["p1", "p2", "p3", "p4"]);
    assert.ok(o.every((x) => x.oneri === "is_yetkisi"));
  });

  test("üye/öğrenci ve iç ekip öneri almaz", () => {
    const o = baglarla([
      profil({ id: "p1", rol: "client" as UserRole }),
      profil({ id: "p2", rol: "system_admin" as UserRole }),
      profil({ id: "p3", rol: "founder" as UserRole }),
    ]);
    assert.deepEqual(o, []);
  });

  /*
    DAYANAK SATIRDA GÖRÜNMELİ. Eskiden rol önerisi yalnızca role bakıyordu;
    bağı doğrulanmamış personel, onaylayan kişinin önüne bu bilgi olmadan
    düşüyordu.
  */
  test("kurumlu personelde doğrulanamadı hükmü satıra yansır", () => {
    // Kurum kapsamda (başka bir e-posta bildirildi), kişinin e-postası listede yok.
    const profiller = [profil({ id: "p1", rol: "employee" as UserRole, eposta: "yok@kurum-a.test" })];
    const o = baglarla(profiller, [kayit({ eposta: "baskasi@kurum-a.test" })]);
    assert.equal(o[0].bagi, "dogrulanamadi");
    assert.equal(o[0].oneri, "is_yetkisi", "öneri hüküm olumsuz diye düşmez; karar insanın");
  });

  test("kurumlu personelde ölçülemedi hükmü satıra yansır", () => {
    // ArvoOS tarafı o kurum için hiç satır bildirmedi.
    const profiller = [profil({ id: "p1", rol: "controller" as UserRole })];
    const o = baglarla(profiller, []);
    assert.equal(o[0].bagi, "olculemedi");
    assert.equal(o[0].oneri, "is_yetkisi");
  });

  test("doğrulanmış bağ da satıra yansır", () => {
    const o = baglarla([profil({ id: "p1", rol: "expert" as UserRole })], [kayit()]);
    assert.equal(o[0].bagi, "dogrulanabilir");
  });

  /*
    İş yetkisi ArvoOS'taki bir KURUMUN işinden gelir; kurumu olmayan
    personele "iş yetkisi" önermek hangi kurumun işi olduğunu söylemez.
    Eskiden onlar da listede is_yetkisi ile duruyordu.
  */
  test("kurumu olmayan personel iş yetkisi önerisi almaz", () => {
    const profiller = [
      profil({ id: "p1", rol: "employee" as UserRole, kurum: null }),
      profil({ id: "p2", rol: "controller" as UserRole, kurum: null }),
      profil({ id: "p3", rol: "employee" as UserRole }),
    ];
    const o = baglarla(profiller, [kayit()]);
    assert.deepEqual(o.map((x) => [x.profil, x.oneri]), [
      ["p1", "yok"],
      ["p2", "yok"],
      ["p3", "is_yetkisi"],
    ]);
    // Bağsız profilin hükmü de kapsam dışı; satır bunu söylüyor.
    assert.equal(o[0].bagi, "kapsamda_degil");
  });

  test("hüküm satırı bulunmayan profil sessizce geçmez", () => {
    const profiller = [profil({ id: "p1", rol: "employee" as UserRole })];
    assert.equal(rolOnerileri(profiller, [])[0].bagi, "profil_yok");
  });

  /*
    Teknik yetki önerisi bugün BOŞ: Asistan Kayıtları kapısı
    (lib/ai/kayit-gorunum.ts KAYIT_ROLLERI) yalnızca iç ekibe açık, yani C
    geldiğinde taşınacak mevcut bir hak yok. Kapı başka bir role açılırsa
    bu test düşer ve rolOnerileri onunla birlikte güncellenir.
  */
  test("bugün hiçbir role teknik yetki önerilmiyor", () => {
    const o = baglarla(
      [
        profil({ id: "p1", rol: "employee" as UserRole }),
        profil({ id: "p2", rol: "controller" as UserRole }),
        profil({ id: "p3", rol: "client" as UserRole }),
      ],
      [kayit()],
    );
    assert.equal(o.filter((x) => x.oneri === "teknik_yetki").length, 0);
  });
});

describe("csv", () => {
  test("virgül, tırnak ve satır sonu taşıyan alan tırnaklanır", () => {
    assert.equal(csvAlani("Ali, Veli"), '"Ali, Veli"');
    assert.equal(csvAlani('o "dedi"'), '"o ""dedi"""');
    assert.equal(csvAlani("iki\nsatır"), '"iki\nsatır"');
  });

  test("boş değerler boş alan", () => {
    assert.equal(csvAlani(null), "");
    assert.equal(csvAlani(undefined), "");
  });

  test("mantıksal değer Türkçe yazılır", () => {
    assert.equal(csvAlani(true), "evet");
    assert.equal(csvAlani(false), "hayır");
  });

  /* Hesap tablosu baştaki =, +, -, @ karakterlerini formül olarak çalıştırıyor. */
  test("formül olarak okunabilecek alan tek tırnakla öncelenir", () => {
    assert.equal(csvAlani("=1+1"), "'=1+1");
    assert.equal(csvAlani("@ad"), "'@ad");
    assert.equal(csvAlani("-5"), "'-5");
    assert.equal(csvAlani("+90"), "'+90");
  });

  test("başlık sırası satırların alan sırasını belirler", () => {
    const metin = csv(["a", "b"], [{ b: 2, a: 1 }]);
    assert.equal(metin, "a,b\n1,2\n");
  });

  test("eksik alan boş geçer", () => {
    assert.equal(csv(["a", "b"], [{ a: 1 }]), "a,b\n1,\n");
  });
});

describe("epostaAnahtari", () => {
  test("küçük harfe indirger ve kenarları kırpar", () => {
    assert.equal(epostaAnahtari("  AD@Soyad.TEST "), "ad@soyad.test");
    assert.equal(epostaAnahtari(null), "");
  });
});
