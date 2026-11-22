import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  Signature OS 5 / Phase 4: öğrencinin ana sayfası. Sayfa sunucu
  bileşeni ve Supabase'e bağlı; burada kaynak metni üzerinden kurum
  sahibinin kuralları sabitleniyor:
   - tek birincil eylem,
   - ilerleme yalnızca gerçek veriden (uydurma yüzde yok),
   - yeni metrik ya da yeni sorgu yok,
   - stil yalnızca ana sayfaya dokunuyor.
  Tarayıcı kabulü (taşma, klavye, uzun başlık, boş hesap, çoklu çalışma):
  PR açıklamasındaki ölçümler.
*/

const oku = (yol: string) => readFileSync(yol, "utf8");
const yorumsuz = (m: string) => m.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sayfa = oku("app/dashboard/ana-sayfa-icerik.tsx");
const ogrenci = sayfa.slice(sayfa.indexOf(") : ogrenciGorunumu && resume ? ("), sayfa.indexOf("<SeriKarti"));

/*
  PREMIUM ÇALIŞMA ALANI (17.11.2026, onaylı tasarım): öğrencinin ana
  sayfası iki bölüm — "Çalışmanıza devam edin" ve "Son kaynaklar".
  Eskiden (Phase 4) burada ölçüler, ilerleme çubukları ve "Teslim için
  kalanlar" vardı; o testler (uydurma yüzde yok, tam liste) artık çalışma
  özetini (calisma-durum-karti.tsx) ilgilendiriyor ve bu dosyada değil.
*/
describe("tek birincil eylem", () => {
  test("öğrenci görünümünde yalnızca bir birincil düğme var: Yazmaya devam et", () => {
    const kod = yorumsuz(ogrenci);
    assert.equal(kod.match(/tur="birincil"/g)?.length, 1);
    assert.doesNotMatch(kod, /projects-primary-button/);
    assert.match(kod, /tur="birincil">\s*<PenLine[^>]*\/>\s*\{resumeStats \? t\(\{ tr: "Yazmaya devam et"/);
  });
  test("boş hesapta da tek birincil: İlk çalışmayı oluştur", () => {
    const bas = sayfa.slice(sayfa.indexOf("{yeniKullanici ? ("), sayfa.indexOf(") : ogrenciGorunumu && resume ? ("));
    assert.equal(yorumsuz(bas).match(/tur="birincil"/g)?.length, 1);
  });
});

describe("sade ana sayfa: yalnızca devam ve son kaynaklar", () => {
  test("ölçüler, araç ızgarası ve abonelik kartı öğrenci ana sayfasında yok", () => {
    const kod = yorumsuz(ogrenci);
    for (const yok of ["os5-ana-olcu", "os5-ana-arac", "AbonelikOzetKarti", "RitimKarti", "DanismanaGonder", "TeslimTarihiFormu"]) {
      assert.doesNotMatch(kod, new RegExp(yok), yok);
    }
  });
  /*
    ANA SAYFA YENİLENDİ (22.11.2026, onaylı mockup): devam kartı iki
    bölümlü (solda kimlik ve eylemler, sağda kaydedilmiş belgenin
    önizlemesi), altında tam genişlikte "Son kaynaklar". Sayfanın
    sonundaki "Teslim durumu, takvim, kılavuz ve kontroller çalışma
    özetinde" cümlesi kalktı: aynı yere devam kartındaki "Çalışma
    ayrıntıları" bağlantısı götürüyor.
  */
  test("ayrıntılara giden yol açık: mevcut ayrıntılar paneli ve son kaynaklarda kütüphane", () => {
    /* Panelin İKİNCİ bir uygulaması yok: bağlantı Çalışmalarım'daki paneli açık getiriyor. */
    assert.match(ogrenci, /href=\{calismaAdresi\(resume\.id, \{ ayrinti: true \}\)\}/);
    assert.doesNotMatch(yorumsuz(ogrenci), /<CalismaDurumKarti/);
    assert.match(ogrenci, /\/dashboard\/literature\?calisma=/);
    /* Sayfanın sonundaki ikinci açıklama kalktı. */
    assert.doesNotMatch(yorumsuz(ogrenci), /pw-not/);
  });

  test("devam kartı iki bölümlü; önizleme KAYDEDİLMİŞ içerikten, içerik yoksa hiç çizilmez", () => {
    const kod = yorumsuz(ogrenci);
    assert.match(kod, /data-onizleme=\{onizlemeDolu\(onizleme\) \? "var" : "yok"\}/);
    assert.match(kod, /\{onizlemeDolu\(onizleme\) \? \(/);
    /* Önizleme Çalışmalarım'la AYNI saf yardımcıdan; editör başlatılmıyor. */
    assert.match(sayfa, /import \{ belgeOnizlemesi, onizlemeDolu \} from "@\/lib\/calisma-onizleme";/);
    assert.match(sayfa, /const onizleme = belgeOnizlemesi\(resumeManuscript\?\.content\);/);
    /* İçerik için AYRI bir sorgu açılmadı: zaten okunan müsvedde satırı kullanılıyor. */
    assert.equal(sayfa.match(/\.from\("project_manuscripts"\)/g)?.length, 1);
  });

  test("ortak kart menüsü ana sayfada da: aynı bileşen, silme yetkisi sunucuda", () => {
    assert.match(yorumsuz(ogrenci), /<CalismaKartMenusu[\s\S]*?silebilir=\{silebilir\}/);
    /* Yetki istemci görünürlüğünden değil, sunucudaki rol ve sahiplik kuralından. */
    assert.match(sayfa, /const silebilir =\s*\n?\s*resume\?\.owner_id === user\.id \|\|/);
    assert.match(sayfa, /profile\?\.role === "academic_manager"/);
  });
  test("son kaynaklar okunamazsa 'kaynak yok' çizilmez, uyarı çıkar", () => {
    assert.match(ogrenci, /\{sonKaynakHatasi \? \(/);
  });
  /*
    Görsel uyum (19.11.2026, onaylı prototip): kartın altındaki üç satırlık
    liste yerine son çalışmaların kompakt tablosu (Çalışma, Tür, Son
    düzenleme, Kelime). Satırlar sınırlı (GENEL_BAKIS_SATIR), tamamı
    Çalışmalarım'da; kelime gerçek veriden, ilerleme çubuğu yok.
  */
  test("çok çalışmalı öğrenci: son çalışmalar kompakt tabloda, tamamı Çalışmalarım'da", () => {
    assert.match(ogrenci, /className="pw-tablo"/);
    assert.match(ogrenci, /calismalarim\.map\(/);
    assert.match(ogrenci, /href="\/dashboard\/editor" className="pw-bolum-baglanti"/);
    assert.match(ogrenci, /yazim \? sayi\(yazim\.words\) : "—"/);
    assert.doesNotMatch(yorumsuz(ogrenci), /ilerleme|progress/i);
  });
  /*
    Paylaşım herkesin kendi çalışmasında (20.11.2026, tek ana deneyim).
    22.11.2026 sadeleştirmesinde sağ sütun kalkınca kart ayrı bir sütun
    olmaktan çıkıp öne çıkan kartın "⋯" menüsüne taşındı
    (calisma-kart-menusu.tsx); menü girişi ve panel başlığı "Paylaş ve
    indir" oldu, çünkü aynı panelde Word/PDF/ZIP indirme de var.
    Sınanan şey yeri değil VARLIĞI: Çalışmalarım sayfasından hem paylaşıma
    hem indirmeye ulaşılabilmeli ve menü girişi ikisini de söylemeli.
  */
  test("Paylaş ve indir Çalışmalarım'dan erişilebilir (sadeleştirmede '⋯' menüsüne taşındı)", () => {
    const liste = oku("app/dashboard/editor/calisma-listesi.tsx");
    assert.match(liste, /<CalismaKartMenusu\b/);
    const menu = oku("app/dashboard/editor/calisma-kart-menusu.tsx");
    /* Menü girişi ve panel başlığı aynı metni taşır. */
    assert.match(menu, /triggerLabel=\{t\(\{ tr: "Paylaş ve indir", en: "Share and download" \}\)\}/);
    assert.match(menu, /kicker=\{t\(\{ tr: "Paylaş ve indir", en: "Share and download" \}\)\}/);
    /* İçerideki işlevler duruyor: paylaşım kartı ve teslim paketi. */
    assert.match(menu, /<DanismanaGonder /);
    assert.match(menu, /<TeslimPaketi /);
  });

  /*
    ÇALIŞMAYI SİL ANA "⋯" MENÜSÜNDE (22.11.2026). Eskiden yalnızca
    "Çalışma ayrıntıları" panelinin en altındaki ikinci bir "⋯"
    menüsündeydi: üç tıklama derinde. Aynı bileşen, aynı onay penceresi,
    aynı sunucu eylemi; panel kipinde ikinci kopya çizilmiyor.
  */
  test("Çalışmayı sil öne çıkan kartın ana menüsünde, ayırıcıdan sonra", () => {
    const menu = oku("app/dashboard/editor/calisma-kart-menusu.tsx");
    assert.match(menu, /<hr className="kart-menu-ayirici" \/>\s*\n\s*<DeleteProjectButton /);
    /* Menünün adı artık menünün tamamını anlatıyor. */
    assert.match(menu, /aria-label=\{t\(\{ tr: `\$\{baslik\}: diğer işlemler`/);
    /* Yetki sunucuda, çağıranda hesaplanıyor; menü kendi kuralını yazmıyor. */
    assert.match(menu, /silebilir \? \(/);
    assert.doesNotMatch(yorumsuz(menu), /role === "(system_admin|founder|academic_manager)"/);
    const liste = oku("app/dashboard/editor/calisma-listesi.tsx");
    assert.match(liste, /silebilir=\{profile\?\.id === oneCikan\.owner_id \|\| canDeleteAnyProject\}/);
  });

  test("ayrıntılar panelinde silme girişi tekrar edilmiyor; panel dışı kullanım bozulmuyor", () => {
    const kart = oku("app/dashboard/editor/calisma-durum-karti.tsx");
    assert.match(kart, /\{silebilir && !panelIcinde \? <DeleteProjectButton /);
  });
});

describe("veri modeli ve sorgular", () => {
  test("yeni tablo ya da RPC okunmuyor; kaldırılan kartların sorguları da yok", () => {
    const tablolar = new Set([...sayfa.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]));
    const izinli = ["project_manuscripts", "literature_sources", "citation_checks", "consultancy_requests", "app_support_requests", "profiles", "manuscript_comments", "document_uploads", "tablo"];
    for (const t of tablolar) assert.ok(izinli.includes(t), `beklenmeyen tablo: ${t}`);
    /*
      yazim_ritmi 22.11.2026'da kalktı: selamlamanın alt satırı sabit bir
      cümle oldu ("Araştırmanıza kaldığınız yerden devam edin") ve ritmi
      gösteren tek yer oydu. Okunup gösterilmeyen veri her açılışta
      boşuna maliyet.
    */
    const rpc = new Set([...sayfa.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]));
    assert.deepEqual([...rpc].sort(), ["calisma_hareketlerim"]);
  });
  test("sunucu eylemi çağrısı eklenmedi", () => {
    assert.doesNotMatch(sayfa, /from "@\/app\/actions\/(?!projects|profile|geri-bildirim)/);
  });
});

describe("ana sayfa stili yalnızca .os5-ana altında", () => {
  const css = oku("app/styles/os5-ana-sayfa.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const seciciler = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].trim()).filter((s) => s && !/^(to|from|\d+%)$/.test(s));
  test("her seçici os5-ana önekli", () => {
    assert.ok(seciciler.length > 30);
    for (const s of seciciler) for (const p of s.split(",")) assert.match(p, /\.os5-ana/, `ana sayfaya bağlı olmayan seçici: ${p.trim()}`);
  });
  test("ham renk yok, en küçük yazı 11 px, azaltılmış hareket karşılığı var", () => {
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
    for (const m of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 11);
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
  test("os5-ana yalnızca öğrenci ve boş hesap görünümüne verilir (personel ana sayfası değişmez)", () => {
    assert.match(sayfa, /className=\{ogrenciGorunumu \|\| yeniKullanici \? "dashboard-page gb gb-ana-sayfa os5-ana" : "dashboard-page gb gb-ana-sayfa"\}/);
  });
});
