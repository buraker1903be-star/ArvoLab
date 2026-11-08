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

function olcuSeridi(sayfa) {
  const dash = sayfa === "dashboard";
  return `<dl class="olcu-seridi">
    <div class="olcu">
      <dt>Teslime kalan</dt>
      <dd><b>41</b><small>gün</small></dd>
      <p>19.12.2026</p>
    </div>
    <div class="olcu">
      <dt>Yazılan</dt>
      <dd><b>6.354</b><small>kelime</small></dd>
      <div class="olcu-cubuk" aria-hidden="true"><span style="--oran:55%"></span></div>
      <p>%55<span class="genis-yalniz"> · kılavuz hedefine göre</span></p>
    </div>
    <div class="olcu">
      <dt>Teslim hazırlığı</dt>
      <dd><b>1/5</b><small>madde</small></dd>
      <p>${dash ? "3 madde bakılmayı bekliyor" : "3 madde bakılmayı bekliyor"}</p>
    </div>
  </dl>`;
}

function kilavuzSatiri(dugme) {
  return `<div class="kilavuz-satiri">
    <span class="kilavuz-simge">${ikon("book-marked", 18)}</span>
    <div class="kilavuz-metin">
      <p><span class="adim">Önce</span><strong>Tez yazım kılavuzu</strong></p>
      <p class="ikincil">Kurumunuzun kılavuzu katalogda yok. Kendi kılavuzunuzu yükleyin; kuralları okuyup size onaylatalım.</p>
    </div>
    ${dugme ? `<a class="dugme dugme-ikincil" href="#">Kılavuzumu yükle</a>` : `<a class="bag-ok" href="#">Kılavuzumu yükle${ikon("chevron-right", 16)}</a>`}
  </div>`;
}

const teslimSatirlari = `
  <li><div><strong>Kapak sayfası</strong><p>Word ve PDF çıktısında kapak sayfası yok.</p></div>${durum("eksik", "Eksik")}</li>
  <li><div><strong>Yapı ve atıflar</strong><p>27 uyarı var.</p></div>${durum("bakilacak", "Bakılacak")}</li>
  <li><div><strong>İçindekiler</strong><p>Word ve PDF çıktısında içindekiler yok.</p></div>${durum("bakilacak", "Bakılacak")}</li>`;

/* ---------------- DASHBOARD ---------------- */

function dashboard(tel) {
  const hero = `<section class="kart hero" aria-labelledby="hero-baslik">
    <div class="hero-ust">
      <div class="hero-kimlik">
        <p class="ust-etiket">Tez · Dokuz Eylül Üniversitesi</p>
        <h2 id="hero-baslik" class="calisma-adi">${TAM_BASLIK}</h2>
        <p class="hero-durum">${durum("yazim", "Yazım aşamasında")}<span>Bugün düzenlendi</span></p>
      </div>
      <div class="hero-eylem">
        <a class="dugme dugme-birincil dugme-buyuk" href="#">${ikon("pen-line", 16)}Yazmaya devam et</a>
        <a class="dugme dugme-ikincil dugme-buyuk" href="#">Çalışma özeti</a>
      </div>
    </div>
    ${olcuSeridi("dashboard")}
    ${kilavuzSatiri(false)}
  </section>`;

  const siradaki = `<section class="kart" aria-labelledby="sir-b">
    <header class="kart-bas"><div><h3 id="sir-b">Sıradaki adımlar</h3><p>Teslim listesi · 1/5 madde hazır</p></div><a class="bag-ok" href="#">Teslim listesi${ikon("chevron-right", 16)}</a></header>
    <ul class="satirlar">${teslimSatirlari}</ul>
    <div class="alt-bolum">
      <div class="alt-bolum-bas"><h4>Yazım ritmi</h4><span>Son 14 gün</span></div>
      <p class="bos-not">Son iki haftada kaydedilmiş yazım yok. Editörde yazdıkça günlük ilerlemeniz burada birikir.</p>
    </div>
  </section>`;

  const hizli = `<section class="kart" aria-labelledby="hiz-b">
    <header class="kart-bas"><div><h3 id="hiz-b">Hızlı eylemler</h3><p>Ctrl+K ile de açılır</p></div></header>
    <ul class="satirlar satir-bag">
      <li><a href="#"><span class="satir-simge">${ikon("link-2", 16)}</span><div><strong>DOI ile kaynak ekle</strong></div>${ikon("chevron-right", 16, "satir-ok")}</a></li>
      <li><a href="#"><span class="satir-simge">${ikon("sparkles", 16)}</span><div><strong>Yazım asistanını aç</strong></div>${ikon("chevron-right", 16, "satir-ok")}</a></li>
      <li><a href="#"><span class="satir-simge">${ikon("quote", 16)}</span><div><strong>Kaynağa sor</strong><p>PDF'e soru, birebir alıntıyla</p></div>${ikon("chevron-right", 16, "satir-ok")}</a></li>
    </ul>
  </section>`;

  const diger = `<section class="kart" aria-labelledby="dig-b">
    <header class="kart-bas"><div><h3 id="dig-b">Diğer çalışmalarınız</h3></div><a class="bag-ok" href="#">Tüm çalışmalar${ikon("chevron-right", 16)}</a></header>
    <ul class="satirlar satir-bag">
      <li><a href="#"><div><strong>Öğrenci öğretmen farkı</strong><p>Makale · henüz yazılmadı · 20 gün önce düzenlendi</p></div>${durum("yeni", "Yeni")}${ikon("chevron-right", 16, "satir-ok")}</a></li>
    </ul>
  </section>`;

  const kaynak = (ik, ad, alt, sag) =>
    `<li><a href="#"><span class="satir-simge">${ikon(ik, 16)}</span><div><strong>${ad}</strong><p>${alt}</p></div><span class="satir-deger">${sag}</span></a></li>`;
  const kaynaklar = `<section class="kart" aria-labelledby="kay-b">
    <header class="kart-bas"><div><h3 id="kay-b">Kaynaklar ve kanıt</h3><p>Tezinizin dayanakları</p></div></header>
    <ul class="satirlar satir-bag">
      ${kaynak("library", "Literatür", "1 okundu · 1 kullandım olarak işaretli", "3 kaynak")}
      ${kaynak("quote", "Kaynakça denetimi", "Son denetim 1 gün önce", durum("iyi", "%94"))}
      ${kaynak("table-2", "Kanıt matrisi", "1 iddia doğrudan destekleniyor", "2 iddia")}
      ${kaynak("shield-check", "Etik kurul", "Başvurunuzu ve belgelerinizi takip edin", "")}
      ${kaynak("file-check-2", "Belge kontrolü", "Kılavuz uyumu ve orijinallik ön-kontrolü", "1 belge")}
    </ul>
  </section>`;

  const danisman = `<section class="kart" aria-labelledby="dan-b">
    <header class="kart-bas"><div><h3 id="dan-b">Danışmanıma gönder</h3><p>Metninizin son kaydedilmiş hâli</p></div></header>
    <div class="dugme-satiri">
      <a class="dugme dugme-ikincil" href="#">${ikon("link-2", 16)}Okuma bağlantısı oluştur</a>
      <a class="dugme dugme-ikincil" href="#">${ikon("file-down", 16)}Dosya olarak gönder${ikon("chevron-down", 14)}</a>
    </div>
    <p class="not">Danışmanınız giriş yapmadan okur; açınca size bildirim gelir.</p>
  </section>`;

  const kredi = `<section class="kart" aria-labelledby="kre-b">
    <header class="kart-bas"><div><h3 id="kre-b">Abonelik ve kredi</h3><p>Planınız ve asistan hakkınız</p></div><a class="bag-ok" href="#">Ayrıntı${ikon("chevron-right", 16)}</a></header>
    <p class="kredi-toplam"><b>318</b><span>kredi kullanılabilir</span></p>
    <div class="olcu-cubuk kredi-cubuk" aria-hidden="true"><span style="--oran:63.6%"></span></div>
    <dl class="kredi-ayrinti">
      <div><dt>Bu ay kalan</dt><dd>318 <small>/ 500</small></dd></div>
      <div><dt>Satın alınan bakiye</dt><dd>0</dd></div>
    </dl>
    <a class="dugme dugme-ikincil" href="#">${ikon("sparkles", 16)}Kredi satın al</a>
  </section>`;

  const dahaFazla = `<details class="daha-fazla"><summary><span><strong>Daha fazla</strong> bölümler, son eklenenler, çalışma hareketi</span><span class="ozet">3 kaynak · 1 belge kontrolü</span>${ikon("chevron-down", 18)}</summary></details>`;

  const geriBildirim = `<aside class="geri-bildirim" aria-label="Geri bildirim">
    <p>${ikon("message-square-heart", 16)}ArvoLab işinizi kolaylaştırdı mı?</p>
    <div class="puanlar">${[1, 2, 3, 4, 5].map((n) => `<button type="button">${n}</button>`).join("")}</div>
    <div class="gb-sonra"><button type="button">Sonra</button><button type="button">Bir daha sorma</button></div>
  </aside>`;

  const icerik = `<main class="icerik dash">
    <header class="sayfa-bas"><div><h1>İyi günler, Deniz</h1><p>Çalışmalarınız, teslim tarihleriniz ve gelen yorumlar burada.</p></div></header>
    ${hero}
    <div class="iki-sutun">
      <div class="sutun sol">${siradaki}${hizli}${tel ? "" : diger}</div>
      <div class="sutun sag">${kaynaklar}${danisman}${kredi}${tel ? diger : ""}</div>
    </div>
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
  return `<section class="kart liste-karti" aria-labelledby="lis-b">
    <header class="kart-bas"><div><h3 id="lis-b">Tüm çalışmalar</h3><p>2 çalışma</p></div></header>
    <ul class="calisma-listesi">
      <li class="${tel ? "" : "secili"}"><a href="#" aria-current="${tel ? "false" : "true"}">
        <div class="cl-ust"><strong>${TAM_BASLIK}</strong>${ok}</div>
        <p class="cl-meta">Tez · 6.354 kelime · bugün düzenlendi</p>
        <div class="cl-alt">${durum("yazim", "Yazım aşamasında")}<span class="cl-teslim">${ikon("calendar-days", 14)}41 gün kaldı</span></div>
        <div class="olcu-cubuk ince" aria-hidden="true"><span style="--oran:55%"></span></div>
      </a></li>
      <li><a href="#">
        <div class="cl-ust"><strong>Öğrenci öğretmen farkı</strong>${ok}</div>
        <p class="cl-meta">Makale · henüz yazılmadı · 20 gün önce düzenlendi</p>
        <div class="cl-alt">${durum("yeni", "Yeni")}<span class="cl-teslim">Tarih belirtilmedi</span></div>
      </a></li>
    </ul>
  </section>`;
}

function ayrinti() {
  const arac = (ik, ad, deger) => `<a class="arac" href="#">${ikon(ik, 16)}<span>${ad}</span>${deger ? `<em>${deger}</em>` : ""}</a>`;
  return `<section class="kart ayrinti" aria-labelledby="ayr-b">
    <div class="hero-ust">
      <div class="hero-kimlik">
        <p class="ust-etiket">Tez · Dokuz Eylül Üniversitesi</p>
        <h2 id="ayr-b" class="calisma-adi">${TAM_BASLIK}</h2>
        <p class="hero-durum">${durum("yazim", "Yazım aşamasında")}<span>Bugün düzenlendi</span></p>
      </div>
      <div class="hero-eylem">
        <a class="dugme dugme-birincil dugme-buyuk" href="#">${ikon("pen-line", 16)}Yazmaya devam et</a>
        <button class="dugme dugme-simge" type="button" aria-label="Diğer işlemler: teslim paketi, düzenle, belge yükle, sil">${ikon("ellipsis", 18)}</button>
      </div>
    </div>
    ${olcuSeridi("calismalarim")}
    ${kilavuzSatiri(true)}
    <div class="alt-bolum">
      <div class="alt-bolum-bas"><h4>Teslim için bakılacaklar</h4><span>3</span></div>
      <ul class="satirlar">${teslimSatirlari}</ul>
    </div>
    <nav class="araclar" aria-label="Çalışmanın araçları">
      ${arac("calendar-days", "Takvim", "")}
      ${arac("library", "Literatür", "3")}
      ${arac("quote", "Kaynakça", "%94")}
      ${arac("table-2", "Kanıt matrisi", "2")}
      ${arac("ellipsis", "Diğer araçlar", "")}
    </nav>
  </section>`;
}

function calismalarim(tel, ekran = "liste") {
  if (tel && ekran === "ayrinti") {
    return `<div class="telefon">${telefonUst({ geri: true })}<main class="icerik cal">${ayrinti()}</main>${altCubuk("calisma")}</div>`;
  }
  const bas = `<header class="sayfa-bas"><div><h1>Çalışmalarım</h1><p>Bir çalışma seçin; özeti, teslim durumu ve araçları ${tel ? "açılır" : "sağda"}.</p></div><a class="dugme dugme-ikincil" href="#">${ikon("plus", 16)}Yeni çalışma</a></header>`;
  if (tel) {
    return `<div class="telefon">${telefonUst({ baslik: "Çalışmalarım" })}<main class="icerik cal">${bas}${liste(true)}</main>${altCubuk("calisma")}</div>`;
  }
  const yol = `<nav class="yol"><a href="#">Çalışmalarım</a>${ikon("chevron-right", 14)}<span title="${TAM_BASLIK}">${TAM_BASLIK}</span></nav>`;
  return `<div class="kabuk">${kenarCubugu({ etkin: "calisma", baglam: true })}<div class="govde">${ustCubuk({ yol })}<main class="icerik cal">${bas}<div class="liste-ayrinti">${liste(false)}${ayrinti()}</div></main></div></div>`;
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
