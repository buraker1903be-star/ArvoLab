import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test, describe } from "node:test";
import { KATALOG_STILLERI, STIL_SECENEKLERI, stilAdiMetni, stilTanimi } from "@/lib/atif/stiller";
import { formatInTextCitation, formatReferenceParts, type CitableSource, type CitationStyle } from "@/lib/citation-format";

/*
  KATALOĞUN SÖZLEŞMESİ. Seçicilerin gösterdiği liste tek kaynaktan
  (STIL_SECENEKLERI) geliyor, ama katalog üç ayrı yerle AYNI olmak
  zorunda: künye biçimlendirici (lib/citation-format.ts), veritabanı
  kısıtı ve bildirim etiketi (migration). Bunlardan biri geride kalırsa
  hata sessiz oluyor:
    - biçimlendirici bilmiyorsa stil APA çıktısına düşer ve öğrenci
      yanlış biçimde kaynakça kopyalar;
    - kısıt bilmiyorsa seçicide görünen stil KAYDEDİLEMEZ;
    - etiket bilmiyorsa bildirimde ham kimlik ("chicago-notlar") yazar.
  Bu dosya üçünü birden sabitler.
*/

const KITAP = {
  id: "1",
  title: "Osmanlı'da Şehir Kültürü",
  authors: "Yılmaz, Ahmet",
  year: "2020",
  publisher: "İletişim Yayınları",
  publication_place: "İstanbul",
  container_title: null,
  volume: null,
  issue: null,
  pages: null,
  doi_or_url: null,
  source_type: "book",
} as unknown as CitableSource;

const MAKALE = {
  ...KITAP,
  title: "Metinlerarasılık",
  container_title: "Edebiyat Dergisi",
  volume: "12",
  issue: "3",
  pages: "45-60",
  publisher: null,
  publication_place: null,
  source_type: "article",
} as unknown as CitableSource;

const kunye = (kaynak: CitableSource, stil: string) =>
  formatReferenceParts(kaynak, stil as CitationStyle, 1).map((p) => p.text).join("");

/** Kısıt ve etiketi taşıyan EN YENİ migration. */
const sonMigration = () => {
  const dizin = "supabase/migrations";
  const dosya = readdirSync(dizin)
    .filter((ad) => ad.endsWith(".sql"))
    .filter((ad) => readFileSync(`${dizin}/${ad}`, "utf8").includes("citation_style_check"))
    .sort()
    .at(-1)!;
  return readFileSync(`${dizin}/${dosya}`, "utf8");
};

describe("katalog ekranda eksiksiz ve iki dilde", () => {
  test("seçici listesi katalogla aynı", () => {
    assert.deepEqual(STIL_SECENEKLERI.map((s) => s.deger), KATALOG_STILLERI);
  });

  test("her stilin TR ve EN adı var", () => {
    for (const secenek of STIL_SECENEKLERI) {
      assert.ok(secenek.etiket.tr.length > 1, secenek.deger);
      assert.ok(secenek.etiket.en.length > 1, secenek.deger);
    }
  });

  test("Chicago'nun iki türü ayrı adlarla ve ayrı atıf türüyle görünüyor", () => {
    const yazarTarih = stilAdiMetni("chicago");
    const notlar = stilAdiMetni("chicago-notlar");
    assert.notEqual(yazarTarih.tr, notlar.tr);
    assert.notEqual(yazarTarih.en, notlar.en);
    assert.match(yazarTarih.en, /Author–Date/);
    assert.match(notlar.en, /Notes–Bibliography/);
    assert.equal(stilTanimi("chicago").tur, "yazar-tarih");
    assert.equal(stilTanimi("chicago-notlar").tur, "dipnot");
  });
});

describe("her stilin kendi biçimi var", () => {
  test("künyeler birbirinden farklı (hiçbiri APA çıktısına düşmüyor)", () => {
    for (const kaynak of [KITAP, MAKALE]) {
      const ciktilar = KATALOG_STILLERI.map((id) => kunye(kaynak, id));
      assert.equal(new Set(ciktilar).size, KATALOG_STILLERI.length, ciktilar.join("\n"));
    }
  });

  test("Chicago Notlar–Kaynakça: yıl SONDA, klasik dipnottan ayrı", () => {
    /* Yazar–tarih sürümünde yıl yazardan hemen sonra; burada künyenin sonunda. */
    assert.equal(kunye(KITAP, "chicago-notlar"), "Yılmaz, Ahmet. Osmanlı'da Şehir Kültürü. İstanbul: İletişim Yayınları, 2020.");
    assert.equal(kunye(MAKALE, "chicago-notlar"), "Yılmaz, Ahmet. “Metinlerarasılık.” Edebiyat Dergisi 12, sy. 3 (2020): 45-60.");
    assert.notEqual(kunye(KITAP, "chicago-notlar"), kunye(KITAP, "dipnot"));
  });

  test("Chicago (Yazar–Tarih) kitap künyesinde başlıktan sonra nokta var", () => {
    /* Eskiden düşüyordu: "… Şehir Kültürü İstanbul: İletişim Yayınları." */
    assert.equal(kunye(KITAP, "chicago"), "Yılmaz, Ahmet. 2020. Osmanlı'da Şehir Kültürü. İstanbul: İletişim Yayınları.");
  });

  test("Chicago Notlar–Kaynakça atfı dipnot metni üretiyor", () => {
    const atif = formatInTextCitation(MAKALE, "chicago-notlar", 1, { sayfa: "50" });
    assert.equal(atif, "Ahmet Yılmaz, “Metinlerarasılık,” Edebiyat Dergisi 12, sy. 3 (2020): 50.");
    /* Parantezli metin içi atıf DEĞİL: atıf dipnota yazılır. */
    assert.ok(!atif.startsWith("("));
  });
});

describe("katalog veritabanıyla aynı", () => {
  test("kısıt katalogdaki her stili kabul ediyor, fazlası yok", () => {
    const sql = sonMigration();
    const liste = /citation_style in \(([^)]*)\)/.exec(sql);
    assert.ok(liste, "kısıttaki stil listesi bulunamadı");
    const kisit = [...liste[1].matchAll(/''([a-z0-9-]+)''/g)].map((m) => m[1]);
    assert.deepEqual([...kisit].sort(), [...KATALOG_STILLERI].sort());
  });

  test("bildirim etiketi her stili tanıyor", () => {
    const sql = sonMigration();
    for (const id of KATALOG_STILLERI) {
      assert.match(sql, new RegExp(`p_style = '${id}'`), `citation_style_label ${id} stilini tanımıyor`);
    }
  });
});
