#!/usr/bin/env node
/*
  AŞAMA 3.0 MAKETLERİ (Signature Academic OS, 08.11.2026).

  Dashboard ve Çalışmalarım'ın hedef tasarımı; uygulamadan ÖNCE kurum
  sahibinin görsel onayı için. Uygulamanın kodu DEĞİL: durağan HTML,
  ama renkler gerçek token'lardan (app/styles/tokens.css), simgeler
  uygulamanın kullandığı lucide setinden, logo gerçek dosyadan, metin ve
  sayılar önizleme verisinden (scripts/onizleme/veri.ts) gelir.

  Kural: maketteki her düğme ve bağlantı bugün uygulamada VAR olan bir
  işleve karşılık gelir (eşleme: README.md). Var olmayan bir özellik
  çalışıyormuş gibi çizilmez.

    node docs/tasarim/asama-3/uret.mjs        → *.html
    node docs/tasarim/asama-3/cek.mjs <klasör> → 1440/390 × açık/koyu PNG
*/
import fs from "node:fs";
import path from "node:path";

const KOK = path.dirname(new URL(import.meta.url).pathname);
const DEPO = path.resolve(KOK, "../../..");

/* Simge: lucide-react'in kendi düğüm listesinden (uygulamayla aynı çizim). */
function ikon(ad, boy = 18, sinif = "") {
  const kaynak = fs.readFileSync(path.join(DEPO, "node_modules/lucide-react/dist/esm/icons", `${ad}.js`), "utf8");
  const bas = kaynak.indexOf("[", kaynak.indexOf("createLucideIcon("));
  const son = kaynak.lastIndexOf("]);");
  const dugumler = new Function(`return ${kaynak.slice(bas, son + 1)}`)();
  const ic = dugumler
    .map(([etiket, oz]) => `<${etiket} ${Object.entries(oz).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg class="ikon ${sinif}" width="${boy}" height="${boy}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg>`;
}

const TAM_BASLIK = "TÜRKİYE'DE ENFLASYON VE İŞSİZLİK İLİŞKİSİNİN EKONOMETRİK ANALİZİ (2000–2025)";

/* ---------------- Kabuk: kenar çubuğu, üst çubuk, alt çubuk (Aşama 2.1 düzeni) ---------------- */

function kenarCubugu({ etkin, baglam }) {
  const oge = (k, ad, ik) =>
    `<a class="kc-oge${etkin === k ? " etkin" : ""}" href="#">${ikon(ik, 18)}<span>${ad}</span></a>`;
  const baglamHtml = baglam
    ? `<div class="kc-baglam">
        <button class="kc-secici" type="button">${ikon("book-open", 16)}<span>TÜRKİYE'DE ENFLASYON VE…</span>${ikon("chevrons-up-down", 14, "kc-ok")}</button>
        <a class="kc-alt etkin" href="#">Özet</a><a class="kc-alt" href="#">Yazım</a><a class="kc-alt" href="#">Kanıt matrisi</a><a class="kc-alt" href="#">Etik kurul</a>
        <hr/>
        <a class="kc-alt" href="#">Kaynaklar</a><a class="kc-alt" href="#">Analiz</a><a class="kc-alt" href="#">Belge Kontrol</a>
      </div>`
    : "";
  return `<nav class="kc" aria-label="Uygulama"><div class="kc-ic">
    <div class="kc-logo"><img class="logo-acik" src="../../../public/arvolab-logo.png" alt="ArvoLAB"/><img class="logo-koyu" src="../../../public/arvolab-logo-koyu.png" alt="ArvoLAB"/>${ikon("panel-left-close", 18, "kc-daralt")}</div>
    <a class="kc-yeni" href="#">${ikon("plus", 16)}Yeni çalışma</a>
    ${baglamHtml}
    <div class="kc-ana">
      ${oge("home", "Ana Sayfa", "layout-dashboard")}
      ${oge("calisma", "Çalışmalarım", "pen-line")}
      ${oge("lit", "Kaynak Kütüphanesi", "book-open-check")}
      ${oge("analiz", "Analiz Merkezi", "chart-no-axes-combined")}
      ${oge("belge", "Belge Kontrol", "file-check-2")}
      ${oge("destek", "Destek", "life-buoy")}
      <p class="kc-grup">Diğer</p>
      ${oge("kilavuz", "Kullanım Kılavuzu", "book-marked")}
      ${oge("abonelik", "Abonelik ve Kredi", "credit-card")}
    </div>
    <div class="kc-alt-bolum">${oge("ayar", "Ayarlar", "settings")}</div>
  </div></nav>`;
}

function ustCubuk({ baslik, yol }) {
  return `<header class="uc">
    <div class="uc-baslik">${yol ?? `<span>${baslik}</span>`}</div>
    <div class="uc-ara">${ikon("search", 16)}<span>Ara veya komut çalıştır</span><kbd>Ctrl K</kbd></div>
    <div class="uc-simgeler"><button type="button" aria-label="Bildirimler">${ikon("bell", 18)}</button><button type="button" aria-label="Tema">${ikon("sun", 18, "tema-gunes")}${ikon("moon", 18, "tema-ay")}</button><span class="avatar">DY</span></div>
  </header>`;
}

function telefonUst({ baslik, geri }) {
  if (geri) {
    return `<header class="tu tu-geri"><a href="#" class="tu-geri-bag">${ikon("arrow-left", 18)}<span>Tüm çalışmalar</span></a>
      <div class="uc-simgeler"><button type="button" aria-label="Ara">${ikon("search", 18)}</button><button type="button" aria-label="Bildirimler">${ikon("bell", 18)}</button><span class="avatar">DY</span></div></header>`;
  }
  return `<header class="tu">
    <div class="tu-logo"><img class="logo-acik" src="../../../public/arvolab-logo.png" alt="ArvoLAB"/><img class="logo-koyu" src="../../../public/arvolab-logo-koyu.png" alt="ArvoLAB"/><span>${baslik}</span></div>
    <div class="uc-simgeler"><button type="button" aria-label="Ara">${ikon("search", 18)}</button><button type="button" aria-label="Bildirimler">${ikon("bell", 18)}</button><button type="button" aria-label="Tema">${ikon("sun", 18, "tema-gunes")}${ikon("moon", 18, "tema-ay")}</button><span class="avatar">DY</span></div>
  </header>`;
}

function altCubuk(etkin) {
  const o = (k, ad, ik) => `<a class="ac-oge${etkin === k ? " etkin" : ""}" href="#">${ikon(ik, 20)}<span>${ad}</span></a>`;
  return `<nav class="ac" aria-label="Uygulama">${o("home", "Ana Sayfa", "layout-dashboard")}${o("calisma", "Çalışmalar", "pen-line")}${o("lit", "Kaynaklar", "book-open-check")}${o("analiz", "Analiz", "chart-no-axes-combined")}${o("daha", "Daha fazla", "ellipsis")}</nav>`;
}

/* ---------------- Ortak parçalar (3.1'de tek bileşen olacaklar) ---------------- */

const durum = (tur, metin) => `<span class="durum durum-${tur}"><i></i>${metin}</span>`;

/* Ölçüler: masaüstünde dikey sütun (odak bandının sağı) ya da yatay şerit; telefonda satır listesi. */
function olculer(sinif) {
  return `<dl class="olculer ${sinif}">
    <div class="olcu"><dt>Teslime kalan</dt><dd><b>41</b><small>gün</small></dd><p>19.12.2026</p></div>
    <div class="olcu"><dt>Yazılan</dt><dd><b>6.354</b><small>kelime</small></dd><div class="olcu-cubuk" aria-hidden="true"><span style="--oran:55%"></span></div><p>%55<span class="genis-yalniz"> · kılavuz hedefine göre</span></p></div>
    <div class="olcu"><dt>Teslim hazırlığı</dt><dd><b>1/5</b><small>madde</small></dd><p>3 madde bakılmayı bekliyor</p></div>
  </dl>`;
}

/* "Şimdi" adımı: uygulamanın kendi önerdiği sıradaki iş (bugün kılavuz). */
function simdiAdimi() {
  return `<div class="simdi">
    <span class="simdi-simge">${ikon("book-marked", 18)}</span>
    <div class="simdi-metin">
      <p class="ust-etiket vurgu">Şimdi</p>
      <p class="simdi-baslik">Tez yazım kılavuzunuzu ekleyin</p>
      <p class="simdi-aciklama">Kurumunuzun kılavuzu katalogda yok. Kendi kılavuzunuzu yükleyin; kuralları okuyup size onaylatalım.</p>
    </div>
    <a class="dugme dugme-ikincil" href="#">Kılavuzumu yükle</a>
  </div>`;
}

const teslimSatirlari = `
  <li><a href="#"><div><strong>Kapak sayfası</strong><p>Word ve PDF çıktısında kapak sayfası yok.</p></div>${durum("eksik", "Eksik")}</a></li>
  <li><a href="#"><div><strong>Yapı ve atıflar</strong><p>27 uyarı var.</p></div>${durum("bakilacak", "Bakılacak")}</a></li>
  <li><a href="#"><div><strong>İçindekiler</strong><p>Word ve PDF çıktısında içindekiler yok.</p></div>${durum("bakilacak", "Bakılacak")}</a></li>`;

const bolumBas = (baslik, sag = "") => `<header class="bolum-bas"><h3>${baslik}</h3>${sag}</header>`;
const okBag = (metin) => `<a class="bag-ok" href="#">${metin}${ikon("chevron-right", 15)}</a>`;

/* ---------------- DASHBOARD ---------------- */

function dashboard(tel) {
  const odak = `<section class="odak" aria-labelledby="odak-b">
    <div class="odak-ana">
      <p class="ust-etiket">Açık çalışma · Tez · Dokuz Eylül Üniversitesi</p>
      <h2 id="odak-b" class="calisma-adi odak-adi">${TAM_BASLIK}</h2>
      <p class="hero-durum">${durum("yazim", "Yazım aşamasında")}<span>Bugün düzenlendi</span></p>
      <div class="hero-eylem">
        <a class="dugme dugme-birincil dugme-buyuk" href="#">${ikon("pen-line", 16)}Yazmaya devam et</a>
        <a class="dugme dugme-ikincil dugme-buyuk" href="#">Çalışma özeti</a>
      </div>
      ${simdiAdimi()}
    </div>
    ${olculer("olculer-dikey")}
  </section>`;

  const hizli = `<nav class="hizli" aria-label="Hızlı eylemler">
    <span class="hizli-etiket">Hızlı eylemler</span>
    <a href="#">${ikon("link-2", 16)}<span>DOI ile kaynak ekle</span></a>
    <a href="#">${ikon("sparkles", 16)}<span>Yazım asistanı</span></a>
    <a href="#">${ikon("quote", 16)}<span>Kaynağa sor</span></a>
    <kbd class="genis-yalniz">Ctrl K</kbd>
  </nav>`;

  const teslim = `<section class="bolum" aria-label="Teslim listesi">
    ${bolumBas("Teslim listesi <span>1/5 hazır</span>", okBag("Tümü"))}
    <ul class="satirlar satir-bag">${teslimSatirlari}</ul>
  </section>`;

  const ritim = `<section class="bolum" aria-label="Yazım ritmi">
    ${bolumBas("Yazım ritmi <span>son 14 gün</span>")}
    <p class="bos-not">Son iki haftada kaydedilmiş yazım yok. Editörde yazdıkça günlük ilerlemeniz burada birikir.</p>
  </section>`;

  const diger = `<section class="bolum" aria-label="Diğer çalışmalarınız">
    ${bolumBas("Diğer çalışmalarınız", okBag("Tüm çalışmalar"))}
    <ul class="satirlar satir-bag"><li><a href="#"><div><strong>Öğrenci öğretmen farkı</strong><p>Makale · henüz yazılmadı · 20 gün önce</p></div>${durum("yeni", "Yeni")}</a></li></ul>
  </section>`;

  const k = (ad, alt, sag) => `<li><a href="#"><div><strong>${ad}</strong><p>${alt}</p></div><span class="satir-deger">${sag}</span></a></li>`;
  const kaynaklar = `<section class="bolum" aria-label="Kaynaklar ve kanıt">
    ${bolumBas("Kaynaklar ve kanıt")}
    <ul class="satirlar satir-bag sik">
      ${k("Literatür", "1 okundu · 1 kullandım", "3 kaynak")}
      ${k("Kaynakça denetimi", "Son denetim 1 gün önce", durum("iyi", "%94"))}
      ${k("Kanıt matrisi", "1 iddia doğrudan destekleniyor", "2 iddia")}
      ${k("Etik kurul", "Başvuru ve belgeleriniz", "")}
      ${k("Belge kontrolü", "Kılavuz uyumu, orijinallik ön-kontrolü", "1 belge")}
    </ul>
  </section>`;

  const danisman = `<section class="bolum" aria-label="Danışmanıma gönder">
    ${bolumBas("Danışmanıma gönder")}
    <div class="metin-dugmeler">
      <a href="#">${ikon("link-2", 15)}Okuma bağlantısı oluştur</a>
      <a href="#">${ikon("file-down", 15)}Dosya olarak gönder${ikon("chevron-down", 13)}</a>
    </div>
    <p class="not">Son kaydedilmiş hâli gider; danışmanınız giriş yapmadan okur, açınca size bildirim gelir.</p>
  </section>`;

  const kredi = `<section class="bolum" aria-label="Abonelik ve kredi">
    ${bolumBas("Abonelik ve kredi", okBag("Ayrıntı"))}
    <div class="kredi-sik">
      <p class="kredi-toplam"><b>318</b><span>kredi kullanılabilir</span></p>
      <a class="bag-ok" href="#">${ikon("sparkles", 14)}Kredi satın al</a>
    </div>
    <div class="olcu-cubuk" aria-hidden="true"><span style="--oran:63.6%"></span></div>
    <dl class="kredi-ayrinti"><div><dt>Bu ay kalan</dt><dd>318 <small>/ 500</small></dd></div><div><dt>Satın alınan bakiye</dt><dd>0</dd></div></dl>
  </section>`;

  const dahaFazla = `<details class="daha-fazla"><summary><span><strong>Daha fazla</strong> bölümler, son eklenenler, çalışma hareketi</span><span class="ozet">3 kaynak · 1 belge kontrolü</span>${ikon("chevron-down", 18)}</summary></details>`;
  const geriBildirim = `<aside class="geri-bildirim" aria-label="Geri bildirim">
    <p>${ikon("message-square-heart", 16)}ArvoLab işinizi kolaylaştırdı mı?</p>
    <div class="puanlar">${[1, 2, 3, 4, 5].map((n) => `<button type="button">${n}</button>`).join("")}</div>
    <div class="gb-sonra"><button type="button">Sonra</button><button type="button">Bir daha sorma</button></div>
  </aside>`;

  const ikincil = tel
    ? `<div class="ikincil">${teslim}${kaynaklar}${danisman}${kredi}${ritim}${diger}</div>`
    : `<div class="ikincil"><div class="sutun">${teslim}${ritim}${diger}</div><div class="sutun">${kaynaklar}${danisman}${kredi}</div></div>`;

  const icerik = `<main class="icerik dash">
    <header class="selam"><h1>İyi günler, Deniz</h1><p>Çalışmalarınız, teslim tarihleriniz ve gelen yorumlar burada.</p></header>
    ${odak}
    ${hizli}
    ${ikincil}
    ${dahaFazla}
    ${geriBildirim}
  </main>`;

  return tel
    ? `<div class="telefon">${telefonUst({ baslik: "Ana Sayfa" })}${icerik}${altCubuk("home")}</div>`
    : `<div class="kabuk">${kenarCubugu({ etkin: "home" })}<div class="govde">${ustCubuk({ baslik: "Ana Sayfa" })}${icerik}</div></div>`;
}

/* ---------------- ÇALIŞMALARIM ---------------- */

function liste(tel) {
  const ok = tel ? ikon("chevron-right", 18, "satir-ok") : "";
  return `<section class="liste-panel" aria-labelledby="lis-b">
    <header class="bolum-bas"><h3 id="lis-b">Tüm çalışmalar <span>2</span></h3></header>
    <ul class="calisma-listesi">
      <li class="${tel ? "" : "secili"}"><a href="#" aria-current="${tel ? "false" : "true"}">
        <div class="cl-ust"><strong>${TAM_BASLIK}</strong>${ok}</div>
        <p class="cl-meta">Tez · 6.354 kelime · bugün</p>
        <div class="cl-alt">${durum("yazim", "Yazım aşamasında")}<span class="cl-teslim">${ikon("calendar-days", 13)}41 gün</span></div>
        <div class="olcu-cubuk ince" aria-hidden="true"><span style="--oran:55%"></span></div>
      </a></li>
      <li><a href="#">
        <div class="cl-ust"><strong>Öğrenci öğretmen farkı</strong>${ok}</div>
        <p class="cl-meta">Makale · henüz yazılmadı · 20 gün önce</p>
        <div class="cl-alt">${durum("yeni", "Yeni")}<span class="cl-teslim">Tarih yok</span></div>
      </a></li>
    </ul>
  </section>`;
}

const araclarListesi = [
  ["calendar-days", "Takvim", ""],
  ["library", "Literatür", "3"],
  ["quote", "Kaynakça", "%94"],
  ["table-2", "Kanıt matrisi", "2"],
  ["ellipsis", "Diğer araçlar", ""],
];

function ayrinti(tel) {
  const baslik = `<header class="ay-bas">
    <div class="ay-kimlik">
      <p class="ust-etiket">Tez · Dokuz Eylül Üniversitesi</p>
      <h2 id="ayr-b" class="calisma-adi">${TAM_BASLIK}</h2>
      <p class="hero-durum">${durum("yazim", "Yazım aşamasında")}<span>Bugün düzenlendi</span></p>
    </div>
    <div class="hero-eylem">
      <a class="dugme dugme-birincil dugme-buyuk" href="#">${ikon("pen-line", 16)}Yazmaya devam et</a>
      <button class="dugme dugme-simge" type="button" aria-label="Diğer işlemler: teslim paketi, düzenle, belge yükle, sil">${ikon("ellipsis", 18)}</button>
    </div>
  </header>`;
  const teslim = `<section class="grup" aria-label="Teslim için bakılacaklar">
    <h3 class="grup-bas">Teslim için bakılacaklar <span>3</span></h3>
    <ul class="satirlar satir-bag">${teslimSatirlari}</ul>
  </section>`;
  if (tel) {
    const araclar = `<section class="grup" aria-label="Çalışmanın araçları">
      <h3 class="grup-bas">Araçlar</h3>
      <ul class="satirlar satir-bag">${araclarListesi.map(([ik, ad, d]) => `<li><a href="#"><span class="satir-simge">${ikon(ik, 16)}</span><div><strong>${ad}</strong></div><span class="satir-deger">${d}</span>${ikon("chevron-right", 16, "satir-ok")}</a></li>`).join("")}</ul>
    </section>`;
    return `<article class="ayrinti-tel" aria-labelledby="ayr-b">
      ${baslik}
      <section class="grup" aria-label="Durum"><h3 class="grup-bas">Durum</h3>${olculer("olculer-satir")}</section>
      ${simdiAdimi()}
      ${teslim}
      ${araclar}
    </article>`;
  }
  const arac = (ik, ad, deger) => `<a class="arac" href="#">${ikon(ik, 15)}<span>${ad}</span>${deger ? `<em>${deger}</em>` : ""}</a>`;
  return `<article class="ayrinti" aria-labelledby="ayr-b">
    ${baslik}
    <nav class="araclar" aria-label="Çalışmanın araçları">${araclarListesi.map(([ik, ad, d]) => arac(ik, ad, d)).join("")}</nav>
    ${olculer("olculer-serit")}
    ${simdiAdimi()}
    ${teslim}
  </article>`;
}

function calismalarim(tel, ekran = "liste") {
  if (tel && ekran === "ayrinti") {
    return `<div class="telefon">${telefonUst({ geri: true })}<main class="icerik cal">${ayrinti(true)}</main>${altCubuk("calisma")}</div>`;
  }
  const bas = `<header class="sayfa-bas"><div><h1>Çalışmalarım</h1><p>Bir çalışma seçin; özeti, teslim durumu ve araçları ${tel ? "açılır" : "sağda"}.</p></div><a class="dugme dugme-ikincil" href="#">${ikon("plus", 16)}Yeni çalışma</a></header>`;
  if (tel) {
    return `<div class="telefon">${telefonUst({ baslik: "Çalışmalarım" })}<main class="icerik cal">${bas}${liste(true)}</main>${altCubuk("calisma")}</div>`;
  }
  const yol = `<nav class="yol"><a href="#">Çalışmalarım</a>${ikon("chevron-right", 14)}<span title="${TAM_BASLIK}">${TAM_BASLIK}</span></nav>`;
  return `<div class="kabuk">${kenarCubugu({ etkin: "calisma", baglam: true })}<div class="govde">${ustCubuk({ yol })}<main class="icerik cal">${bas}<div class="liste-ayrinti">${liste(false)}${ayrinti(false)}</div></main></div></div>`;
}

/* ---------------- Yaz ---------------- */

const sayfa = (baslik, govde) => `<!doctype html>
<html lang="tr" data-theme="light">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${baslik}</title>
<link rel="stylesheet" href="../../../app/styles/tokens.css"/>
<link rel="stylesheet" href="maket.css"/>
<link rel="stylesheet" href="maket-v2.css"/>
</head>
<body>
<div class="masaustu-yalniz">${govde(false)}</div>
<div class="telefon-yalniz">${govde(true)}</div>
</body>
</html>
`;

fs.writeFileSync(path.join(KOK, "dashboard.html"), sayfa("Maket · Ana Sayfa", dashboard));
fs.writeFileSync(path.join(KOK, "calismalarim.html"), sayfa("Maket · Çalışmalarım", (tel) => calismalarim(tel)));
fs.writeFileSync(path.join(KOK, "calismalarim-ayrinti.html"), sayfa("Maket · Çalışmalarım ayrıntı (telefon)", (tel) => (tel ? calismalarim(true, "ayrinti") : calismalarim(false))));
console.log("3 maket yazıldı");
