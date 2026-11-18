import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { YENIDEN_DENENEBILIR, doiListesiniHazirla, sayacArizasiSonucu } from "@/lib/doi-toplu";

/*
  D5 (13.11.2026): toplu DOI içe aktarmada sayaç arızası, fail-closed.
  Eskiden (D5'in ilk hâli) arıza dalı yalnızca "vardi" satırlarını
  döndürüyordu: aranacak DOI'ler sonuçta hiç görünmüyor, özet
  "ertelenen: 0" diyordu ve "yeniden denenecekleri kutuya koy" düğmesi
  onları bulamıyordu. Karar saf işlevde (sayacArizasiSonucu) ve burada
  doğrudan sınanıyor; eylemdeki bağlantı ve ekran metinleri kaynak
  metninden okunuyor (AGENTS.md: tests/unit Next/Supabase'e dokunmaz).
*/

// Kullanıcının sırası: Y1, M (çalışmada zaten var), Y2, Y3.
const MEVCUT = "10.1000/mevcut";
const GIRDI = ["10.1000/y1", MEVCUT, "10.1000/y2", "10.1000/y3"];
const plan = () => doiListesiniHazirla(GIRDI, new Set([`doi:${MEVCUT}`]));

describe("sayacArizasiSonucu: aranacak DOI'lerin tamamı ertelendi / ariza", () => {
  test("her aranacak DOI 'ertelendi' ve neden 'ariza'; mevcut 'vardi'; sıra kullanıcınınki", () => {
    const { sonuclar } = sayacArizasiSonucu(plan());
    assert.deepEqual(sonuclar, [
      { doi: "10.1000/y1", durum: "ertelendi", neden: "ariza" },
      { doi: MEVCUT, durum: "vardi" },
      { doi: "10.1000/y2", durum: "ertelendi", neden: "ariza" },
      { doi: "10.1000/y3", durum: "ertelendi", neden: "ariza" },
    ]);
  });

  test("arıza hiçbir satırda 'hak' (kota) olarak işaretlenmez", () => {
    const { sonuclar } = sayacArizasiSonucu(plan());
    assert.equal(sonuclar.filter((s) => s.neden === "hak").length, 0);
  });

  test("özet: ertelenen gerçek sayıyla eşit, sorgu/rezervasyon sıfır, kalan hak ve yenilenme bilinmiyor", () => {
    const { sonuclar, ozet } = sayacArizasiSonucu(plan());
    assert.equal(ozet.ertelenen, 3);
    assert.equal(ozet.ertelenen, sonuclar.filter((s) => s.durum === "ertelendi").length);
    assert.equal(ozet.istenen, 3);
    assert.equal(ozet.rezerve, 0);
    assert.equal(ozet.sorgulanan, 0);
    assert.equal(ozet.kullanilmayan, 0);
    assert.equal(ozet.kalanHak, null);
    assert.equal(ozet.yenilenme, null);
    assert.equal(ozet.sayacsiz, true);
  });

  test("geçersiz ve listede tekrar sayıları korunur", () => {
    const p = doiListesiniHazirla([...GIRDI, "doi değil", "10.1000/Y1"], new Set([`doi:${MEVCUT}`]));
    const { ozet } = sayacArizasiSonucu(p);
    assert.equal(ozet.gecersiz, 1);
    assert.equal(ozet.listedeTekrar, 1);
  });

  test("yeniden deneme: kutuya tam olarak aranacak DOI'ler, kullanıcının sırasıyla gider", () => {
    const { sonuclar } = sayacArizasiSonucu(plan());
    assert.deepEqual(
      sonuclar.filter((s) => YENIDEN_DENENEBILIR.has(s.durum)).map((s) => s.doi),
      ["10.1000/y1", "10.1000/y2", "10.1000/y3"],
    );
  });

  test("aranacak yoksa ertelenen de yok", () => {
    const { sonuclar, ozet } = sayacArizasiSonucu(doiListesiniHazirla([MEVCUT], new Set([`doi:${MEVCUT}`])));
    assert.deepEqual(sonuclar, [{ doi: MEVCUT, durum: "vardi" }]);
    assert.equal(ozet.ertelenen, 0);
  });
});

describe("doiIleEkle arıza dalı (eylem kaynağı)", () => {
  const kaynak = readFileSync("app/actions/kaynak-aktarim.ts", "utf8");
  const govde = kaynak.slice(kaynak.indexOf("export async function doiIleEkle"));

  test("arıza dalı saf işlevi kullanır ve Crossref'ten, kayıttan ÖNCE döner", () => {
    const dal = govde.indexOf('hak.tur === "ariza"');
    const cagri = govde.indexOf("sayacArizasiSonucu(plan)");
    const crossref = govde.indexOf("fetch(crossrefWorkUrl(doi)");
    const kayit = govde.indexOf('.from("literature_sources")');
    assert.ok(dal >= 0 && cagri > dal, `arıza dalı ya da çağrı yok: ${dal} / ${cagri}`);
    assert.ok(cagri < crossref && cagri < kayit, `sıra bozuk: ${cagri} / ${crossref} / ${kayit}`);
    // Dalın içinde kota nedeni yazılmaz.
    assert.doesNotMatch(govde.slice(dal, cagri + 200), /neden: "hak"/);
  });

  test("sayaca tek çağrı: arıza dalı RPC'yi yeniden denemez", () => {
    assert.equal(govde.match(/rpc\("rate_limit_take"/g)?.length, 1);
  });
});

describe("ekran: üç erteleme nedeni üç ayrı metin", () => {
  const ekran = readFileSync("app/dashboard/literature/kaynak-aktarim-araclari.tsx", "utf8");
  const blok = ekran.slice(ekran.indexOf("const ERTELEME_NEDENI"), ekran.indexOf("const durumAdi"));

  test("hak, sure ve ariza ayrı anahtarlar; arıza metni kota demez", () => {
    assert.ok(blok.length > 0, "ERTELEME_NEDENI bulunamadı");
    const metin = (anahtar: string) => blok.match(new RegExp(`${anahtar}: \\{ tr: "([^"]+)", en: "([^"]+)" \\}`))?.slice(1) ?? [];
    const [hakTr, hakEn] = metin("hak");
    const [sureTr] = metin("sure");
    const [arizaTr, arizaEn] = metin("ariza");
    assert.ok(hakTr && sureTr && arizaTr, "üç metinden biri eksik");
    assert.equal(new Set([hakTr, sureTr, arizaTr]).size, 3);
    assert.doesNotMatch(arizaTr, /hakkı doldu/);
    assert.doesNotMatch(arizaEn, /limit reached/);
    // Hakkın düşülüp düşülmediği bilinmiyor (RPC rezervasyonu yapıp cevabı
    // kaybolmuş olabilir): arıza metni hak hakkında güvence vermez.
    assert.doesNotMatch(arizaTr, /düşülmedi|hakkınız/);
    assert.doesNotMatch(arizaEn, /deducted|limit/);
    assert.match(arizaTr, /sorgulanmadı/);
    assert.match(hakTr, /hakkı doldu/);
    assert.match(hakEn, /limit reached/);
  });

  test("satır etiketi nedeni tablodan alır", () => {
    assert.match(ekran, /s\.durum === "ertelendi" && s\.neden \? ERTELEME_NEDENI\[s\.neden\] : DURUM_ADI\[s\.durum\]/);
  });
});
