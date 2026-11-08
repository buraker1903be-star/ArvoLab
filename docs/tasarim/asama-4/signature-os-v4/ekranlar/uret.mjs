#!/usr/bin/env node
/*
  SIGNATURE OS v4 — V4.2 YÜKSEK KALİTELİ EKRANLAR (tasarım; uygulama kodu değil).
  İçerik sentetik önizleme verisi (scripts/onizleme/veri.ts ve tez fikstürü);
  simgeler lucide; logo public/. Var olmayan işlev "Önerilen yeni işlev",
  mevcut verinin yeni sunumu "Sunum önerisi" etiketi taşır.
    node docs/tasarim/asama-4/signature-os-v4/ekranlar/uret.mjs
    node docs/tasarim/asama-4/signature-os-v4/ekranlar/cek.mjs <klasör>
*/
import fs from "node:fs";
import path from "node:path";

const KOK = path.dirname(new URL(import.meta.url).pathname);
const DEPO = path.resolve(KOK, "../../../../..");
function ikon(ad, boy = 18) {
  const k = fs.readFileSync(path.join(DEPO, "node_modules/lucide-react/dist/esm/icons", `${ad}.js`), "utf8");
  const d = new Function(`return ${k.slice(k.indexOf("[", k.indexOf("createLucideIcon(")), k.lastIndexOf("]);") + 1)}`)();
  return `<svg class="ikon" width="${boy}" height="${boy}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.map(([e, o]) => `<${e} ${Object.entries(o).filter(([x]) => x !== "key").map(([x, v]) => `${x}="${v}"`).join(" ")}/>`).join("")}</svg>`;
}
const I = {
  tamam: `<svg class="isaret tamam" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="6" fill="currentColor"/><path d="M3.4 6.2 5.2 8l3.4-3.6" stroke="var(--yuzey-1)" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  kismen: `<svg class="isaret kismen" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5.1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 .9a5.1 5.1 0 0 1 0 10.2z" fill="currentColor"/></svg>`,
  bekliyor: `<svg class="isaret bekliyor" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5.1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  sorun: `<svg class="isaret sorun" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .6 11.4 6 6 11.4.6 6z" fill="currentColor"/></svg>`,
};
const iz = (ogeler) => `<div class="iz" role="list">${ogeler.map(([e, t, m]) => `<span role="listitem">${I[t]}<b>${e}</b>${m}</span>`).join("")}</div>`;
const rozet = (r, t) => `<span class="rozet ${r}">${t}</span>`;
const LOGO = (st = "") => `<img class="logo-acik" ${st} src="../../../../../public/arvolab-logo.png" alt="ArvoLAB"/><img class="logo-koyu" ${st} src="../../../../../public/arvolab-logo-koyu.png" alt="ArvoLAB"/>`;
const yeni = (t = "Önerilen yeni işlev") => `<span class="yeni-islev">${ikon("flask-conical", 13)}${t}</span>`;
const sunum = `<span class="sunum-onerisi" title="Mevcut verinin yeni sunumu; yeni yetenek değil">Sunum önerisi</span>`;

/* Veri (sentetik önizleme) */
const OZGUN = "TÜRKİYE'DE ENFLASYON VE İŞSİZLİK İLİŞKİSİNİN EKONOMETRİK ANALİZİ (2000–2025)";
const BASLIK = "Türkiye'de Enflasyon ve İşsizlik İlişkisinin Ekonometrik Analizi (2000–2025)";
const tez = JSON.parse(fs.readFileSync(path.join(DEPO, "tests/fixtures/tez-enflasyon-issizlik.json"), "utf8"));
const dug = tez.content ?? tez;
const metin = (n) => (n.content ?? []).map((x) => x.text ?? metin(x)).join("");
const gi = dug.findIndex((n) => n.type === "heading" && metin(n).startsWith("1. Giriş"));
const P = [1, 2, 3, 5].map((k) => metin(dug[gi + k]));
const H11 = metin(dug[gi + 4]);

/* ---------------- Kabuk ---------------- */
const ANA = [["home", "Ana Sayfa", "layout-dashboard"], ["calisma", "Çalışmalarım", "pen-line"], ["lit", "Kaynak Kütüphanesi", "book-open-check"], ["analiz", "Analiz Merkezi", "chart-no-axes-combined"], ["belge", "Belge Kontrol", "file-check-2"], ["destek", "Destek", "life-buoy"]];
const BOLUMLER = [["Özet", ""], ["Yazım", ""], ["Kanıt matrisi", "2"], ["Etik kurul", ""], ["Kaynaklar", "3"], ["Analiz", ""], ["Belge Kontrol", ""]];
function kenar(etkin, bolum) {
  const yalnizSecici = bolum === "*";
  const o = ([k, ad, ik]) => `<a class="go${etkin === k ? (bolum && !yalnizSecici ? " ust-etkin" : " etkin") : ""}" href="#"${etkin === k ? ' aria-current="page"' : ""}>${ikon(ik, 18)}<span>${ad}</span></a>`;
  const calisma = bolum ? `<div class="kc-calisma"><p class="etiket">Açık çalışma</p>
      <button class="kc-secici" title="${OZGUN}">${ikon("book-open", 16)}<span>Türkiye'de Enflasyon ve İşsizlik…</span>${ikon("chevrons-up-down", 14)}</button>
      ${yalnizSecici ? "" : BOLUMLER.map(([a, s]) => `<a class="kc-alt${bolum === a ? " etkin" : ""}" href="#"${bolum === a ? ' aria-current="page"' : ""}>${a}${s ? `<em>${s}</em>` : ""}</a>`).join("")}</div>` : "";
  return `<nav class="kc" aria-label="Uygulama"><div class="kc-ic">
    <div class="kc-logo">${LOGO()}${ikon("panel-left-close", 18)}</div>
    <a class="d d-tonal kc-yeni" href="#">${ikon("plus", 16)}Yeni çalışma</a>
    <div class="kc-ana">${ANA.map(o).join("")}</div>${calisma}
    <div class="kc-alt-bolum">${[["kilavuz", "Kullanım Kılavuzu", "book-marked"], ["abonelik", "Abonelik ve Kredi", "credit-card"], ["ayar", "Ayarlar", "settings"]].map(o).join("")}</div>
  </div></nav>`;
}
function ray(etkin) {
  return `<nav class="ray" aria-label="Uygulama"><div class="ray-ic">
    <div class="ray-logo" aria-label="ArvoLAB">${LOGO()}</div>
    ${ANA.slice(0, 5).map(([k, ad, ik]) => `<a class="ro${etkin === k ? " etkin" : ""}" href="#" aria-label="${ad}" title="${ad}">${ikon(ik, 20)}</a>`).join("")}
    <hr/><a class="ro" href="#" aria-label="Yeni çalışma" title="Yeni çalışma">${ikon("plus", 20)}</a>
  </div></nav>`;
}
function ust(yol) {
  return `<header class="uc"><nav class="yol" aria-label="Konum">${yol}</nav>
    <div class="uc-ara">${ikon("search", 16)}<span>Ara veya komut çalıştır</span><kbd>Ctrl K</kbd></div>
    <button class="uc-simge" aria-label="Bildirimler">${ikon("bell", 18)}</button>
    <button class="uc-simge" aria-label="Tema">${ikon("sun", 18).replace('class="ikon"', 'class="ikon tema-gunes"')}${ikon("moon", 18).replace('class="ikon"', 'class="ikon tema-ay"')}</button>
    <span class="avatar" aria-label="Hesap: Deniz Yıldız">DY</span></header>`;
}
const yol = (...p) => p.map((x, i) => (i === p.length - 1 ? `<b title="${OZGUN}">${x}</b>` : `<span>${x}</span>${ikon("chevron-right", 14)}`)).join("");
const masaustu = (etkin, bolum, y, g, rayIle = false) => `<div class="kabuk${rayIle ? " ray-ile" : ""}">${rayIle ? ray(etkin) : kenar(etkin, bolum)}<div class="govde">${ust(y)}${g}</div></div>`;

function telUst({ geri, baslik, menu } = {}) {
  const sol = geri ? `<a class="tu-geri" href="#">${ikon("chevron-left", 20)}${geri}</a>${baslik ? `<span class="tu-baslik">${baslik}</span>` : '<span class="bosluk"></span>'}` : `${LOGO()}<span class="bosluk"></span>`;
  const sag = menu ? `<button class="uc-simge" aria-label="${menu}">${ikon("ellipsis", 20)}</button>` : `<button class="uc-simge" aria-label="Ara">${ikon("search", 20)}</button><button class="uc-simge" aria-label="Bildirimler">${ikon("bell", 20)}</button>`;
  return `<header class="tu">${sol}${sag}<span class="avatar">DY</span></header>`;
}
const SERIT = ["Özet", "Yazım", "Kanıt", "Kaynaklar", "Analiz", "Etik kurul", "Belge Kontrol"];
const serit = (etkin) => `<nav class="serit" aria-label="Çalışmanın bölümleri">${SERIT.map((a) => `<a href="#" class="${a === etkin ? "etkin" : ""}"${a === etkin ? ' aria-current="page"' : ""}>${a}</a>`).join("")}</nav>`;
const altCubuk = (etkin) => `<nav class="ac" aria-label="Uygulama">${[["home", "Ana Sayfa", "layout-dashboard"], ["calisma", "Çalışmalar", "pen-line"], ["lit", "Kaynaklar", "book-open-check"], ["analiz", "Analiz", "chart-no-axes-combined"], ["daha", "Daha fazla", "ellipsis"]].map(([k, a, ik]) => `<a href="#" class="${etkin === k ? "etkin" : ""}"${etkin === k ? ' aria-current="page"' : ""}>${ikon(ik, 22)}<span>${a}</span></a>`).join("")}</nav>`;
const telefon = (etkin, govde, ustHtml, alt = true) => `<div class="tel">${ustHtml ?? telUst()}${govde}${alt ? altCubuk(etkin) : ""}</div>`;

/* ---------------- Ortak parçalar ---------------- */
const simdiNotu = (tel) => `<div class="kenar-notu"><div class="govdesi"><p class="etiket" style="color:var(--vurgu-metin)">Şimdi</p><p class="baslik">Tez yazım kılavuzunuzu ekleyin</p>${tel ? "" : `<p class="yardim">Kurumunuzun kılavuzu katalogda yok. Yüklediğinizde sayfa düzeni, zorunlu bölümler ve atıf sistemi editöre uygulanır.</p>`}</div><a class="d d-ikincil d-sik" href="#">${ikon("upload", 16)}Kılavuzumu yükle</a></div>`;
const teslim = (ok) => [
  ["Kapak sayfası", "Word ve PDF çıktısında kapak sayfası yok.", rozet("r-hata", "Eksik")],
  ["Yapı ve atıflar", "27 uyarı var.", rozet("r-uyari", "Bakılacak")],
  ["İçindekiler", "Word ve PDF çıktısında içindekiler yok.", rozet("r-uyari", "Bakılacak")],
].map(([a, y, s]) => `<li><a class="satir" href="#"><span class="satir-g"><strong>${a}</strong><span class="yardim">${y}</span></span>${s}${ok ? ikon("chevron-right", 16).replace('class="ikon"', 'class="ikon ok"') : ""}</a></li>`).join("");
const KANIT_OZET = `
  <div class="kanit-satir"><span>Kaynakça</span>${iz([["94/100", "kismen", "uyum · 4 künye · dün"], ["1", "sorun", "dizinde bulunamayan kaynak"], ["1", "sorun", "kaynakçada karşılığı olmayan atıf"], ["1", "kismen", "metinde atfı olmayan kaynak"]])}<a class="bag" href="#">Sonuçlar</a></div>
  <div class="kanit-satir"><span>Kanıt matrisi</span>${iz([["1", "tamam", "iddia doğrudan destekleniyor"], ["1", "bekliyor", "iddia değerlendirilmedi"]])}<a class="bag" href="#">Matris</a></div>
  <div class="kanit-satir"><span>Literatür</span><span style="display:grid;gap:8px"><span class="adim"><b>3 kaynak</b> · Okunacak 1 · Okundu 1 · Kullandım 1</span>${iz([["PDF", "tamam", "1 indirildi"], ["Künye", "kismen", "3 kaynakta eksik alan"]])}</span><a class="bag" href="#">Kütüphane</a></div>
  <div class="kanit-satir"><span>Belge kontrolü</span><span class="meta">1 belge · kılavuz uyumu ve orijinallik ön-kontrolü</span><a class="bag" href="#">Aç</a></div>`;

/* ---------------- 1-2. ANA SAYFA ---------------- */
function anaSayfaMasa() {
  return masaustu("home", null, yol("Ana Sayfa"), `<main class="icerik">
    <header class="selam"><h1 class="t-sayfa">İyi günler, Deniz</h1><p>Çalışmana kaldığın yerden devam et.</p></header>
    <section class="komuta" aria-labelledby="ac-b">
      <div class="komuta-ana">
        <p class="etiket">Aktif çalışma</p>
        <h2 id="ac-b" class="t-gosterim" title="${OZGUN}">${BASLIK}</h2>
        <p class="meta"><span>Tez</span><span class="nokta-ayr"></span><span>Dokuz Eylül Üniversitesi</span><span class="nokta-ayr"></span>${rozet("r-vurgu", "Yazım aşamasında")}</p>
        <div class="eylem-satiri"><a class="d d-birincil" href="#">${ikon("pen-line", 18)}Yazmaya devam et</a><a class="bag" href="#">Çalışma özeti${ikon("chevron-right", 14)}</a><span class="yardim" style="margin-left:auto">Bugün düzenlendi</span></div>
        ${simdiNotu(false)}
      </div>
      <dl class="hazirlik" aria-label="Teslime hazırlık">
        <div class="hz"><dt>Teslime kalan</dt><dd><span class="sayi">41</span><small>gün</small></dd><p class="yardim">19 Aralık 2026</p></div>
        <div class="hz"><dt>Teslim hazırlığı</dt><dd><span class="sayi">1/5</span><small>madde hazır</small></dd><p class="yardim">3 madde bakılmayı bekliyor</p></div>
        <div class="hz"><dt>Yazılan</dt><dd><span class="sayi">6.354</span><small>kelime</small></dd><div class="cubuk"><span style="--oran:55%"></span></div><p class="yardim" style="margin-top:6px">%55 ilerleme</p></div>
      </dl>
    </section>
    <nav class="hizli" aria-label="Hızlı erişim"><span class="etiket">Hızlı erişim</span>
      <a class="d d-ucuncul d-sik" href="#">${ikon("link-2", 16)}DOI ile kaynak ekle</a><a class="d d-ucuncul d-sik" href="#">${ikon("sparkles", 16)}Yazım asistanı</a><a class="d d-ucuncul d-sik" href="#">${ikon("message-square-quote", 16)}Kaynağa sor</a><kbd>Ctrl K</kbd></nav>
    <div class="iki">
      <section>${`<header class="bolum-bas"><h2>Teslim için bakılacaklar<small>1/5 hazır</small></h2><a class="bag" href="#">Teslim listesi${ikon("chevron-right", 14)}</a></header>`}<ul class="satirlar">${teslim(false)}</ul>
        <header class="bolum-bas" style="margin-top:32px"><h2>Diğer çalışmalarınız</h2><a class="bag" href="#">Tüm çalışmalar${ikon("chevron-right", 14)}</a></header>
        <ul class="satirlar"><li><a class="satir" href="#"><span class="satir-g"><strong class="ed-ses" style="font-size:16px">Öğrenci öğretmen farkı</strong><span class="yardim">Makale · henüz yazılmadı · 20 gün önce</span></span>${rozet("r-notr", "Yeni")}</a></li></ul></section>
      <section><header class="bolum-bas"><h2>Akademik kanıt</h2>${sunum}</header><div class="kanit-ozet">${KANIT_OZET}</div></section>
    </div>
    <section class="dip" aria-label="Diğer bilgiler">
      <div><h3>Danışmanıma gönder</h3><p class="yardim">Son kaydedilmiş hâl; danışmanınız giriş yapmadan okur.</p><a class="bag" href="#">${ikon("link-2", 14)}Okuma bağlantısı</a><a class="bag" href="#">${ikon("file-down", 14)}Dosya olarak gönder</a></div>
      <div><h3>Abonelik ve kredi</h3><p class="yardim"><b style="color:var(--metin-1)">318</b> kredi kullanılabilir · bu ay 318/500 · satın alınan 0</p><a class="bag" href="#">Ayrıntı</a><a class="bag" href="#">${ikon("sparkles", 14)}Kredi satın al</a></div>
      <div><h3>Yazım ritmi</h3><p class="yardim">Son 14 günde kaydedilmiş yazım yok. Yazdıkça günlük ilerlemeniz burada birikir.</p></div>
    </section>
    <aside class="gb" aria-label="Geri bildirim">${ikon("message-square-heart", 16)}ArvoLab işinizi kolaylaştırdı mı?<span class="puan">${[1, 2, 3, 4, 5].map((n) => `<button>${n}</button>`).join("")}</span><span class="sonra"><a class="d d-ucuncul d-sik">Sonra</a><a class="d d-ucuncul d-sik">Bir daha sorma</a></span></aside>
  </main>`);
}
function anaSayfaTel() {
  const ac = (b, o) => `<details class="acilir"><summary><span class="satir-g"><strong>${b}</strong><span class="yardim">${o}</span></span>${ikon("chevron-down", 18).replace('class="ikon"', 'class="ikon ok"')}</summary></details>`;
  return telefon("home", `<main class="icerik">
    <h1 class="t-sayfa">İyi günler, Deniz</h1>
    <section class="tel-ana" aria-labelledby="act-b">
      <p class="etiket">Aktif çalışma</p>
      <h2 id="act-b" class="t-calisma" title="${OZGUN}">${BASLIK}</h2>
      <p class="meta">Tez · Dokuz Eylül Üniversitesi</p>
      <a class="d d-birincil" href="#">${ikon("pen-line", 18)}Yazmaya devam et</a>
      <a class="bag" href="#" style="display:flex;justify-content:center">Çalışma özeti</a>
      ${simdiNotu(true)}
      <dl class="tel-hz">
        <div><dt>Teslime kalan<span class="yardim">19 Aralık 2026</span></dt><dd><span class="sayi-k">41</span><small>gün</small></dd></div>
        <div><dt>Teslim hazırlığı<span class="yardim">3 madde bakılmayı bekliyor</span></dt><dd><span class="sayi-k">1/5</span><small>hazır</small></dd></div>
        <div><dt>Yazılan<span class="yardim">%55 ilerleme</span></dt><dd><span class="sayi-k">6.354</span><small>kelime</small></dd></div>
      </dl>
    </section>
    <section class="tel-bolum"><header class="bolum-bas"><h2>Teslim için bakılacaklar</h2><a class="bag" href="#">Tümü</a></header><ul class="satirlar">${teslim(true)}</ul></section>
    <section class="tel-bolum"><header class="bolum-bas"><h2>Akademik kanıt</h2>${sunum}</header>
      <ul class="satirlar">
        <li><a class="satir" href="#"><span class="satir-g"><strong>Kaynakça · 94/100</strong>${iz([["2", "sorun", "atıf/kaynak sorunu"], ["1", "kismen", "atfı olmayan kaynak"]])}</span>${ikon("chevron-right", 16).replace('class="ikon"', 'class="ikon ok"')}</a></li>
        <li><a class="satir" href="#"><span class="satir-g"><strong>Kanıt matrisi · 2 iddia</strong>${iz([["1", "tamam", "doğrudan"], ["1", "bekliyor", "değerlendirilmedi"]])}</span>${ikon("chevron-right", 16).replace('class="ikon"', 'class="ikon ok"')}</a></li>
        <li><a class="satir" href="#"><span class="satir-g"><strong>Literatür · 3 kaynak</strong><span class="yardim">Okunacak 1 · Okundu 1 · Kullandım 1 · PDF 1</span></span>${ikon("chevron-right", 16).replace('class="ikon"', 'class="ikon ok"')}</a></li>
      </ul></section>
    <section class="tel-bolum"><header class="bolum-bas"><h2>Diğer</h2></header>
      ${ac("Hızlı erişim", "DOI, yazım asistanı, kaynağa sor")}${ac("Danışmanıma gönder", "Okuma bağlantısı ya da dosya")}${ac("Abonelik ve kredi", "318 kredi · bu ay 318/500")}${ac("Diğer çalışmalarınız", "Öğrenci öğretmen farkı")}${ac("Yazım ritmi ve daha fazlası", "Bölümler, son eklenenler, geri bildirim")}
    </section>
  </main>`);
}

/* ---------------- 3-5. ÇALIŞMALARIM ---------------- */
function liste(tel) {
  const ok = tel ? ikon("chevron-right", 18) : "";
  return `<ul class="cl">
    <li class="${tel ? "" : "secili"}"><a href="?sec=b1"${tel ? "" : ' aria-current="true"'}><div class="ok-sag"><strong title="${OZGUN}">${BASLIK}</strong>${ok}</div>
      <p class="yardim">Tez · 6.354 kelime · bugün</p><div class="cl-alt">${rozet("r-vurgu", "Yazım aşamasında")}<span class="yardim">41 gün kaldı</span></div><div class="cubuk"><span style="--oran:55%"></span></div></a></li>
    <li><a href="?sec=b2"><div class="ok-sag"><strong>Öğrenci öğretmen farkı</strong>${ok}</div>
      <p class="yardim">Makale · 0 kelime · 20 gün önce</p><div class="cl-alt">${rozet("r-notr", "Yeni")}<span class="yardim">Teslim tarihi yok</span></div></a></li>
  </ul>`;
}
function calismalarimMasa() {
  return masaustu("calisma", "*", yol("Çalışmalarım", BASLIK), `<main class="icerik">
    <header class="sayfa-bas"><div><h1 class="t-sayfa">Çalışmalarım</h1><p>Bir çalışma seçin; özeti, teslim durumu ve bölümleri sağda.</p></div><a class="d d-ikincil" href="#">${ikon("plus", 16)}Yeni çalışma</a></header>
    <div class="liste-ayrinti">
      <section aria-label="Tüm çalışmalar"><div class="cl-bas"><span class="etiket">Tüm çalışmalar</span><span class="yardim">2</span></div>${liste(false)}</section>
      <article class="ayr" aria-labelledby="ayr-b">
        <div class="ayr-bas"><div><p class="etiket">Tez · Dokuz Eylül Üniversitesi</p><h2 id="ayr-b" class="t-calisma" title="${OZGUN}">${BASLIK}</h2><p class="meta">${rozet("r-vurgu", "Yazım aşamasında")}<span class="nokta-ayr"></span>Bugün düzenlendi</p></div>
          <div style="display:flex;gap:8px;align-items:flex-start"><a class="d d-birincil" href="#">${ikon("pen-line", 18)}Yazmaya devam et</a><button class="d d-ikincil d-simge" aria-label="Diğer işlemler: teslim paketi, düzenle, belge yükle, sil">${ikon("ellipsis", 18)}</button></div></div>
        <nav class="sekmeler" aria-label="Çalışmanın bölümleri"><a class="sekme etkin" href="#" aria-current="page">Özet</a><a class="sekme" href="#">Yazım</a><a class="sekme" href="#">Kaynaklar<em>3</em></a><a class="sekme" href="#">Kanıt<em>2</em></a><a class="sekme" href="#">Analiz</a><button class="sekme sag" aria-haspopup="menu">${ikon("ellipsis", 15)}Diğer araçlar${ikon("chevron-down", 13)}</button></nav>
        <div class="ayr-ic">
          <div>${simdiNotu(false).replace('class="kenar-notu"', 'class="kenar-notu" style="margin-top:0"')}
            <header class="bolum-bas" style="margin-top:28px"><h2>Teslim için bakılacaklar<small>1/5 hazır</small></h2><a class="bag" href="#">Teslim listesi</a></header><ul class="satirlar">${teslim(false)}</ul></div>
          <dl class="ozet-olcu">
            <div class="hz"><dt class="meta">Teslime kalan</dt><dd style="display:flex;align-items:baseline;gap:6px"><span class="sayi-k">41</span><small class="meta">gün · 19.12.2026</small></dd></div>
            <div class="hz"><dt class="meta">Yazılan</dt><dd style="display:flex;align-items:baseline;gap:6px"><span class="sayi-k">6.354</span><small class="meta">kelime</small></dd><div class="cubuk"><span style="--oran:55%"></span></div><p class="yardim" style="margin-top:6px">%55 ilerleme</p></div>
            <div class="hz"><dt class="meta">Kaynak durumu</dt><dd style="margin-top:8px">${iz([["3", "kismen", "künyede eksik alan"], ["1", "tamam", "PDF indirildi"], ["1", "tamam", "doğrudan destek"]]).replace('class="iz"', 'class="iz" style="flex-direction:column;gap:8px"')}</dd></div>
          </dl>
        </div>
      </article>
    </div>
  </main>`);
}
function calismalarimTel() {
  return telefon("calisma", `<main class="icerik">
    <h1 class="t-sayfa">Çalışmalarım</h1><p class="meta" style="margin-top:4px">Bir çalışma seçin; özeti ve bölümleri açılır.</p>
    <a class="d d-ikincil" href="#" style="width:100%;margin-top:16px">${ikon("plus", 16)}Yeni çalışma</a>
    <section class="tel-bolum" style="margin-top:24px"><div class="grup-bas"><span class="etiket">Tüm çalışmalar</span><span class="yardim">2</span></div><div class="grup" style="padding:0;overflow:hidden">${liste(true)}</div></section>
  </main>`);
}
function ayrintiTel() {
  return telefon("calisma", `${serit("Özet")}<main class="icerik">
    <p class="etiket">Tez · Dokuz Eylül Üniversitesi</p>
    <h1 class="t-calisma" style="font:var(--tip-calisma-tel);margin-top:8px" title="${OZGUN}">${BASLIK}</h1>
    <p class="meta" style="margin-top:8px">${rozet("r-vurgu", "Yazım aşamasında")}<span class="nokta-ayr"></span>Bugün düzenlendi</p>
    <a class="d d-birincil" href="#" style="margin-top:16px">${ikon("pen-line", 18)}Yazmaya devam et</a>
    <dl class="tel-hz">
      <div><dt>Teslime kalan<span class="yardim">19.12.2026</span></dt><dd><span class="sayi-k">41</span><small>gün</small></dd></div>
      <div><dt>Teslim hazırlığı<span class="yardim">3 madde bakılmayı bekliyor</span></dt><dd><span class="sayi-k">1/5</span><small>hazır</small></dd></div>
      <div><dt>Yazılan<span class="yardim">%55 ilerleme</span></dt><dd><span class="sayi-k">6.354</span><small>kelime</small></dd></div>
    </dl>
    ${simdiNotu(true).replace('class="kenar-notu"', 'class="kenar-notu" style="margin-top:20px"')}
    <section class="tel-bolum"><div class="grup-bas"><span class="etiket">Teslim kontrol listesi</span><span class="yardim">1/5</span></div><ul class="grup satirlar">${teslim(true)}</ul></section>
    <section class="tel-bolum"><ul class="grup satirlar"><li><a class="satir" href="#"><span class="satir-g"><strong>Diğer araçlar</strong><span class="yardim">Takvim, Kaynakça %94, Etik kurul</span></span>${ikon("chevron-right", 16).replace('class="ikon"', 'class="ikon ok"')}</a></li></ul>
      <p class="yardim" style="margin-top:8px">Yazım, Kanıt, Kaynaklar ve Analiz yukarıdaki çalışma şeridinde (tek gezinme).</p></section>
  </main>`, telUst({ geri: "Çalışmalar", menu: "Diğer işlemler: teslim paketi, düzenle, belge yükle, sil" }));
}

/* ---------------- 6-9. EDİTÖR ---------------- */
function aracCubugu(aiAcik) {
  return `<div class="ed-cubuk">
    <span class="kayit" role="status"><i></i>Kaydedildi · 14:20</span><span class="ayr"></span>
    <div role="toolbar" aria-label="Biçimlendirme" style="display:flex;align-items:center;gap:2px">
      <button class="a" title="Geri al (Ctrl+Z)">${ikon("undo-2", 16)}</button><span class="ayr"></span>
      <button class="a">Normal metin${ikon("chevron-down", 12)}</button><span class="ayr"></span>
      <button class="a etkin" title="Kalın"><b>B</b></button><button class="a" title="İtalik"><em>I</em></button><button class="a" title="Altı çizili"><u>U</u></button><span class="ayr"></span>
      <button class="a" title="Madde işaretli liste">${ikon("list", 16)}</button><button class="a" title="Numaralı liste">${ikon("list-ordered", 16)}</button>${aiAcik ? "" : `<button class="a" title="Paragraf">${ikon("align-left", 16)}${ikon("chevron-down", 12)}</button><button class="a" title="Ekle">${ikon("plus", 16)}${ikon("chevron-down", 12)}</button>`}<span class="ayr"></span>
      <button class="a" title="Kaynaktan atıf ekle">${ikon("quote", 16)}Atıf</button><button class="a" title="Belge ve sığmayan araçlar">${ikon("ellipsis", 16)}</button>
    </div>
    <div class="ed-sag"><span class="cip">${ikon("book-marked", 13)}Kılavuz bağlı değil · <a class="bag">Bağla</a></span>
      ${aiAcik ? "" : `<a class="d d-ucuncul d-sik" href="#">${ikon("share-2", 16)}Paylaş</a><a class="d d-ucuncul d-sik" href="#">Dışa aktar${ikon("chevron-down", 14)}</a>`}
      <a class="d d-tonal d-sik" href="#" aria-pressed="${aiAcik}">${ikon("sparkles", 16)}Arvo AI</a></div>
  </div>`;
}
function belge(secim) {
  const p2 = secim ? P[1].replace("Bu kadar farklı rejimin tek bir örneklem içinde yer alması, enflasyon–işsizlik ilişkisinin hem varlığını hem de istikrarını sorgulamayı gerekli kılmaktadır.",
    `<span class="secim-ai"><span class="secili-metin">Bu kadar farklı rejimin tek bir örneklem içinde yer alması, enflasyon–işsizlik ilişkisinin hem varlığını hem de istikrarını sorgulamayı gerekli kılmaktadır.</span></span>`) : P[1];
  const p1 = P[0].replace("Phillips'in (1958)", `<span class="atif-ok" title="Kütüphanede eşleşti">Phillips'in (1958)</span>`).replace("Friedman (1968)", `<span class="atif-yok" title="Kütüphanede karşılığı yok">Friedman (1968)</span>`);
  return `<h2>1. Giriş</h2><p>${p1}</p><p>${p2}</p><p>${P[2]}</p><h3>${H11}</h3><p>${P[3]}</p>`;
}
function aiAkis(tel) {
  return `${tel ? "" : `<div class="baglam-satiri"><span class="cip">${ikon("map-pin", 13)}1. Giriş</span><span class="cip">${ikon("text-select", 13)}seçili 1 cümle</span>${sunum}</div>`}
    ${tel ? "" : `<div class="uygulandi">${ikon("circle-check", 15)}Paragraf belgeye eklendi · 14:12<a class="bag" href="#">${ikon("undo-2", 13)}Geri al</a></div>`}
    <p class="istem">Seçili cümleyi akademikleştir.</p>
    <article class="yanit" aria-label="Asistan önerisi">
      <header class="yanit-bas"><span class="etiket">Akademik hâli</span><span class="yardim">+5 kelime · −3 kelime</span></header>
      <p class="yanit-govde fark">Bu kadar farklı rejimin tek bir örneklem içinde yer alması, <del>enflasyon–işsizlik ilişkisinin hem varlığını hem de istikrarını sorgulamayı gerekli kılmaktadır</del> <ins>enflasyon ile işsizlik arasındaki ilişkinin hem varlığının hem de dönemler arası istikrarının ayrı ayrı sınanmasını gerektirmektedir</ins>.</p>
      <p class="dayanak"><b>Dayanak</b> · yalnız seçili metin; yeni atıf ve sayı yok</p>
      <div class="yanit-eylem"><a class="d d-birincil d-sik" href="#">Kabul et</a><a class="d d-ikincil d-sik" href="#">Düzenleyerek kabul et</a><a class="d d-ucuncul d-sik" href="#">Reddet</a></div>
    </article>
    <div class="uyari-kart" role="note">${I.sorun}<div><strong>Bir yanıt gösterilmedi</strong><p>Önerilen paragraf kütüphanenizde olmayan bir atıf içeriyordu (Friedman, 1968). Kaynağı kütüphanenize ekleyip yeniden isteyin.</p><a class="bag" href="#" style="margin-top:6px">${ikon("link-2", 13)}DOI ile ekle</a></div></div>`;
}
const besteci = (tel) => `<div class="besteci"><p>Phillips eğrisinin Türkiye'de neden tartışmalı olduğunu iki cümleyle açıkla</p><div class="besteci-alt"><span class="yardim">${tel ? "Kütüphanenizden atıf yapar." : "Yalnız kütüphanenizdeki kaynaklara atıf yapar; metinde olmayan sayı yazmaz."}</span><button class="gonder" aria-label="Gönder">${ikon("arrow-up", 16)}</button></div></div>`;
function editorMasa(ai) {
  return masaustu("calisma", "Yazım", yol("Çalışmalarım", "Türkiye'de Enflasyon ve İşsizlik…", "Yazım"), `<div class="ed-govde">
    ${aracCubugu(ai)}
    <div class="ed-alan">
      <div class="masa"><article class="kagit belge-metin" aria-label="Belge">${belge(ai)}</article></div>
      ${ai ? `<aside class="bolme" aria-label="Yazım paneli"><nav class="bolme-sekme" role="tablist"><a class="etkin" role="tab" aria-selected="true">${ikon("sparkles", 14)}Arvo AI</a><a role="tab">İnceleme</a><a role="tab">Kaynaklar</a><a role="tab">Teslim <em>1/5</em></a></nav><div class="akis">${aiAkis(false)}</div>${besteci(false)}</aside>` : ""}
    </div>
    <footer class="ed-durum" aria-label="Belge durumu"><span>6.354 kelime</span><span>49.041 karakter</span><span>≈ 20 sayfa</span><span class="sag">Kılavuz bağlı değil · varsayılan belge yazısı</span></footer>
  </div>`);
}
function editorTelUst() {
  return `<header class="ed-tel-ust"><a class="uc-simge" style="width:44px;height:44px" href="#" aria-label="Çalışma özetine dön">${ikon("chevron-left", 22)}</a>
    <span class="tu-baslik" title="${OZGUN}">Türkiye'de Enflasyon ve İşsizlik…</span><span class="kayit" aria-label="Kaydedildi"><i></i></span>
    <a class="d d-tonal d-sik" style="height:44px" href="#">${ikon("sparkles", 16)}Arvo AI</a><button class="uc-simge" style="width:44px;height:44px" aria-label="Belge: paylaş, dışa aktar, yazım paneli">${ikon("ellipsis-vertical", 20)}</button></header>`;
}
const telArac = `<div class="ed-tel-arac" role="toolbar" aria-label="Biçimlendirme"><button class="a" aria-label="Geri al">${ikon("undo-2", 18)}</button><span class="ayr"></span><button class="a" aria-label="Kalın"><b>B</b></button><button class="a" aria-label="İtalik"><em>I</em></button><button class="a" aria-label="Altı çizili"><u>U</u></button><span class="ayr"></span><button class="a" aria-label="Kaynaktan atıf ekle">${ikon("quote", 18)}Atıf</button><span style="flex:1"></span><button class="a" aria-label="Diğer araçlar">${ikon("ellipsis", 18)}</button></div>`;
function editorTel(ai) {
  const g = `${telArac}<article class="tel-kagit belge-metin" aria-label="Belge"><h2>1. Giriş</h2><p>${P[0]}</p><p>${P[1]}</p></article>
    ${ai ? `<div class="ortu"></div><section class="alt-sayfa" role="dialog" aria-modal="true" aria-label="Yazım paneli"><div class="tutamak"></div><div class="as-bas"><span class="t-bolum">Arvo AI</span><button class="uc-simge" style="width:44px;height:44px" aria-label="Paneli kapat">${ikon("x", 18)}</button></div>
      <nav class="bolme-sekme" role="tablist"><a class="etkin" role="tab">Arvo AI</a><a role="tab">İnceleme</a><a role="tab">Kaynaklar</a><a role="tab">Teslim <em>1/5</em></a></nav><div class="akis">${aiAkis(true)}</div>${besteci(true)}</section>` : ""}`;
  return telefon("calisma", g, editorTelUst() + (ai ? "" : serit("Yazım")), !ai);
}

/* ---------------- 10-11. KAYNAK KÜTÜPHANESİ ---------------- */
const KAYNAK = [
  { b: "ARDL sınır testi yaklaşımı", y: "Pesaran, M. H., Shin, Y., & Smith, R. J. · 2001 · DOI 10.0000/ornek.2", iz: [["Künye", "bekliyor", "bakılmadı"], ["PDF", "tamam", "indirildi"], ["Kanıt", "bekliyor", "1 iddia · değerlendirilmedi"]], okuma: 0, s: "Okudum", sec: true, pdf: true },
  { b: "Inflation and unemployment in emerging markets", y: "Smith, J., & Brown, K. · 2019", iz: [["Künye", "kismen", "eksik: dergi, cilt, sayfa"], ["PDF", "bekliyor", "bakılmadı"], ["Kanıt", "bekliyor", "iddiaya bağlı değil"]], okuma: 1, s: "Kullandım olarak işaretle" },
  { b: "Türkiye'de Phillips eğrisinin istikrarı", y: "Önder, A. Ö. · 2009", iz: [["Künye", "kismen", "eksik: dergi, cilt, DOI"], ["PDF", "bekliyor", "bakılmadı"], ["Kanıt", "tamam", "1 iddia · doğrudan"]], okuma: 2, s: "" },
];
const okuma = (n) => `<span class="adim">${["Okunacak", "Okundu", "Kullandım"].map((a, i) => `<i class="${i <= n ? "dolu" : ""}"></i>${i === n ? `<b>${a}</b>` : a}`).join("<s></s>")}</span>`;
function kaynakSatiri(k, tel) {
  return `<li class="${k.sec && !tel ? "secili" : ""} ks-satir"><div class="ks"><div><a class="ks-baslik" href="#"${k.sec && !tel ? ' aria-current="true"' : ""}>${k.b}</a><p class="meta">${k.y}</p>${iz(k.iz)}</div>
    ${tel ? `<div class="ks-tel-alt">${okuma(k.okuma)}${k.pdf ? `<a class="d d-ikincil d-sik" href="#">${ikon("message-square-quote", 14)}Kaynağa sor</a>` : ""}</div>` : `<div class="ks-sag">${okuma(k.okuma)}${k.s ? `<button class="d d-ikincil d-sik">${k.s}</button>` : `<span class="yardim">son adım</span>`}</div>`}</div></li>`;
}
function kaynaklarMasa() {
  return masaustu("lit", null, yol("Kaynak Kütüphanesi"), `<main class="icerik">
    <header class="kk-ust"><div><h1 class="t-sayfa">Kaynak Kütüphanesi</h1><p class="meta" style="margin-top:6px">Literatür ve kaynakça. Kaynak özeti ya da yorum üretilmez; künyeler dizinlerde doğrulanır.</p></div>
      <div style="display:flex;gap:8px"><span class="d d-ikincil">${ikon("book-open", 16)}Türkiye'de Enflasyon…${ikon("chevron-down", 14)}</span><a class="d d-ikincil" href="#">İçe aktar</a><button class="d d-ikincil d-simge" aria-label="Tarama asistanı, dışa aktar">${ikon("ellipsis", 18)}</button><a class="d d-birincil" href="#">${ikon("search", 16)}Kaynak bul</a></div></header>
    <section class="kk-ozet" aria-label="Kaynakça denetimi">
      <div><p class="etiket">Kaynakça denetimi</p><p class="puan-blok" style="margin-top:6px"><span class="sayi">94</span><span class="meta">/100 uyum · 4 künye · dün</span></p></div>
      ${iz([["1", "sorun", "Dizinlerde bulunamayan kaynak"], ["1", "sorun", "Kaynakçada karşılığı olmayan atıf"], ["1", "kismen", "Metinde atfı olmayan kaynak"]])}
      <div style="display:flex;gap:8px"><a class="d d-ikincil d-sik" href="#">${ikon("quote", 15)}Sonuçları aç</a><a class="d d-ucuncul d-sik" href="#">Yeniden denetle</a></div>
    </section>
    <div class="kk-izgara">
      <section aria-label="Literatür">
        <div class="arama"><span class="girdi">${ikon("search", 16)}Başlık, yazar, dergi, yayınevi ya da DOI ara</span><span class="girdi" style="flex:0 0 280px">${ikon("link-2", 16)}DOI yapıştırın — ör. 10.1002/jae.616</span><button class="d d-ikincil">Okuma durumu${ikon("chevron-down", 14)}</button></div>
        <div class="suzgecler"><span class="suzgec etkin">Hepsi <em>3</em></span><span class="suzgec">Okunacak <em>1</em></span><span class="suzgec">Okundu <em>1</em></span><span class="suzgec">Kullandım <em>1</em></span><span class="suzgec">${I.kismen}Eksik künye <em>3</em></span></div>
        <ul class="ks-liste">${KAYNAK.map((k) => kaynakSatiri(k, false)).join("")}</ul>
      </section>
      <aside class="kaynak-ayr" aria-label="Seçili kaynak">
        <p class="etiket">Kaynak · makale</p><h2>ARDL sınır testi yaklaşımı</h2><p class="meta" style="margin-top:4px">Pesaran, M. H., Shin, Y., & Smith, R. J. · 2001</p>
        <div class="dugmeler" style="margin-top:14px"><a class="d d-ikincil d-sik" href="#">${ikon("message-square-quote", 15)}Kaynağa sor</a><a class="d d-ucuncul d-sik" href="#">${ikon("external-link", 15)}PDF'i aç</a><a class="d d-ucuncul d-sik" href="#">${ikon("quote", 15)}Atıf ekle</a></div>
        <div class="ka-bolum"><div class="ka-bolum-bas"><span class="t-bolum">Doğrulama</span><span class="yardim">eksenler ayrı</span></div>
          <dl class="dogrulama"><dt>Künye</dt><dd>${I.bekliyor}<span>Dizinlerde karşılaştırılmadı · <a class="bag">Karşılaştır</a></span></dd>
            <dt>PDF</dt><dd>${I.tamam}<span>Hazır · açık erişim (indirildi, dün)</span></dd>
            <dt>Kanıt</dt><dd>${I.bekliyor}<span>1 iddia: "Sınır testi, değişkenlerin bütünleşme derecesinden bağımsız…" · değerlendirilmedi</span></dd></dl></div>
        <div class="ka-bolum"><div class="ka-bolum-bas"><span class="t-bolum">Okuma</span></div>${okuma(0)}<button class="d d-ikincil d-sik" style="margin-top:10px">Okudum</button></div>
        <div class="ka-bolum"><div class="ka-bolum-bas"><span class="t-bolum">Künye</span><a class="bag">Düzenle</a></div>
          <dl class="kunye"><dt>Tür</dt><dd>Makale</dd><dt>Yazarlar</dt><dd>Pesaran, M. H., Shin, Y., & Smith, R. J.</dd><dt>Yıl</dt><dd>2001</dd><dt>DOI</dt><dd><a class="bag" style="font-weight:500">10.0000/ornek.2</a></dd><dt>Eksik</dt><dd class="meta">dergi adı, cilt, sayı, sayfa aralığı</dd></dl></div>
        <div class="ka-bolum" style="display:flex;justify-content:space-between;align-items:center"><span class="meta">Notlarım · not yok</span><a class="d d-ucuncul d-sik tehlike" href="#">${ikon("trash-2", 15)}Kaynağı sil</a></div>
      </aside>
    </div>
  </main>`);
}
function kaynaklarTel() {
  return telefon("lit", `<main class="icerik">
    <h1 class="t-sayfa">Kaynak Kütüphanesi</h1>
    <div style="display:flex;gap:8px;margin-top:14px"><a class="d d-birincil" href="#" style="flex:1">${ikon("search", 18)}Kaynak bul</a><button class="d d-ikincil" style="width:48px;height:48px;padding:0" aria-label="İçe aktar, tarama asistanı, dışa aktar">${ikon("ellipsis", 18)}</button></div>
    <a class="satir" href="#" style="margin-top:12px;padding:12px 14px;background:var(--yuzey-1);border:1px solid var(--cizgi);border-radius:var(--r-4)"><span class="satir-g"><strong>Kaynakça · 94/100</strong>${iz([["2", "sorun", "atıf/kaynak sorunu"], ["1", "kismen", "atfı olmayan"]])}</span>${ikon("chevron-right", 16).replace('class="ikon"', 'class="ikon ok"')}</a>
    <span class="girdi" style="margin-top:16px;height:44px">${ikon("search", 16)}Kaynaklarda ara ya da DOI yapıştır</span>
    <div class="suzgecler"><span class="suzgec etkin">Hepsi <em>3</em></span><span class="suzgec">Okunacak <em>1</em></span><span class="suzgec">Okundu <em>1</em></span><span class="suzgec">Kullandım <em>1</em></span><span class="suzgec">Eksik künye <em>3</em></span></div>
    <ul class="grup ks-liste" style="padding:0;overflow:hidden;margin-top:8px">${KAYNAK.map((k) => kaynakSatiri(k, true)).join("")}</ul>
  </main>`);
}

/* ---------------- KONSEPTLER: Editör + PDF (+ AI) — ÖNERİLEN YENİ İŞLEV ---------------- */
const pdfSayfa = `<div class="pdf-sayfa"><h4>4. Bounds testing procedure</h4>
  <p>The approach adopted here is <mark>applicable irrespective of whether the underlying regressors are purely I(0), purely I(1) or mutually cointegrated</mark>. The statistic underlying our procedure is the familiar Wald or F-statistic in a generalized Dickey–Fuller type regression used to test the significance of lagged levels of the variables.</p>
  <p>Under the null hypothesis that there exists no level relationship, the asymptotic distributions of the statistic are non-standard.</p>
  <p>Two sets of asymptotic critical values are provided: one set assuming that all the regressors are I(1) and another assuming that they are all I(0).</p><span class="sayfa-no">— 12 —</span></div>`;
const pdfBas = (kisa) => `<div class="pdf-bas">${ikon("file-text", 18)}<span class="baslik"><b>ARDL sınır testi yaklaşımı</b><span class="yardim">Pesaran vd., 2001 · s. 12 / 34</span></span>
  <button class="a" aria-label="Uzaklaştır">${ikon("zoom-out", 16)}</button><button class="a" aria-label="Yakınlaştır">${ikon("zoom-in", 16)}</button>${kisa ? "" : `<a class="d d-ucuncul d-sik" href="#">${ikon("quote", 15)}Atıf ekle</a>`}<a class="d d-ucuncul d-sik" href="#" aria-label="Yeni sekmede aç">${ikon("external-link", 15)}</a><button class="a" aria-label="Bölmeyi kapat">${ikon("x", 16)}</button></div>`;
const kaynakAi = `<section class="kaynak-ai" aria-label="Kaynakla çalış"><div class="kaynak-ai-bas">${ikon("message-square-quote", 16)}<span class="t-bolum" style="font-size:14px">Kaynağa sor</span><span class="yardim">bu PDF'e bağlı</span><span style="margin-left:auto">${yeni("Bölmede")}</span></div>
  <div class="akis"><p class="istem">Bu yöntem I(1) değişkenlerle kullanılabilir mi?</p>
    <article class="yanit"><p class="yanit-govde">Evet. Yazarlara göre yaklaşım, regresörlerin I(0), I(1) ya da karışık olmasından bağımsız uygulanabilir.</p>
      <div class="alinti-kart" style="margin:0 12px 10px"><p class="alinti" style="font-size:14px;line-height:22px">“…applicable irrespective of whether the underlying regressors are purely I(0), purely I(1) or mutually cointegrated.”</p><p class="yardim" style="margin-top:4px">${I.tamam} birebir alıntı · PDF'te işaretli · sayfa numarası sizin girişiniz</p></div>
      <div class="yanit-eylem"><a class="d d-ikincil d-sik" href="#">${ikon("quote", 14)}Alıntıyla atıf ekle</a><a class="d d-ucuncul d-sik" href="#">PDF'te göster</a></div></article></div></section>`;
function konseptPdf(ai, w) {
  if (w === 1024) {
    return masaustu("calisma", "Yazım", yol("Çalışmalarım", "Türkiye'de Enflasyon…", "Yazım"), `<div class="ed-govde" style="position:relative">
      <div class="konsept-bant">${yeni()}<span>1024 px: belge ile PDF ana alanda sekme; Arvo AI sağda kalır (ikisi aynı anda görünür)</span></div>
      <div class="belge-sekme" role="tablist"><a class="sekme" role="tab">${ikon("file-pen-line", 15)}Belge</a><a class="sekme etkin" role="tab" aria-selected="true">${ikon("file-text", 15)}ARDL sınır testi (PDF)</a><span style="margin-left:auto" class="kayit"><i></i>Kaydedildi · 14:20</span></div>
      <div class="ed-alan"><div class="pdf-bolme" style="flex:1">${pdfBas(false)}<div class="pdf-alan">${pdfSayfa}</div></div>
        <aside class="bolme" style="width:360px" aria-label="Yazım paneli"><nav class="bolme-sekme"><a class="etkin">${ikon("sparkles", 14)}Arvo AI</a><a>İnceleme</a><a>Kaynaklar</a><a>Teslim</a></nav>${kaynakAi.replace('class="kaynak-ai"', 'class="kaynak-ai" style="border-top:0;flex:1"')}</aside></div></div>`, true);
  }
  return masaustu("calisma", "Yazım", yol("Çalışmalarım", "Türkiye'de Enflasyon…", "Yazım"), `<div class="ed-govde" style="position:relative">
    <div class="konsept-bant">${yeni()}<span>${ai ? "Belge + PDF + Arvo AI: PDF ve AI aynı anda; AI bu PDF'e bağlı" : "Belge + PDF yan yana; kenar çubuğu raya iner"}</span></div>
    ${aracCubugu(true)}
    <div class="bolunmus${ai ? " uclu" : ""}">
      <div class="masa" style="padding:20px 24px 0"><article class="kagit belge-metin" style="padding:48px 40px">${belge(false)}</article></div>
      <div class="ayirici" role="separator" aria-orientation="vertical" aria-label="Bölme genişliği (←/→)" tabindex="0"></div>
      ${ai ? `<div class="dikey"><div class="pdf-bolme">${pdfBas(true)}<div class="pdf-alan" style="padding:14px">${pdfSayfa}</div></div>${kaynakAi}</div>` : `<div class="pdf-bolme">${pdfBas(false)}<div class="pdf-alan">${pdfSayfa}</div></div>`}
    </div>
    <footer class="ed-durum"><span>6.354 kelime</span><span class="sag">Bugün: "PDF'i aç" yeni sekmede, "Kaynağa sor" ayrı pencerede — değişmez</span></footer>
  </div>`, true);
}

/* ---------------- Yaz ---------------- */
const sayfa = (b, masa, tel) => `<!doctype html>
<html lang="tr" data-theme="light"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${b}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="../tokens-v4.css"/><link rel="stylesheet" href="ekranlar.css"/></head>
<body><div class="masaustu-yalniz">${masa}</div><div class="telefon-yalniz">${tel}</div></body></html>
`;
const yaz = (ad, html) => fs.writeFileSync(path.join(KOK, ad), html);
yaz("ana-sayfa.html", sayfa("v4 · Ana Sayfa", anaSayfaMasa(), anaSayfaTel()));
yaz("calismalarim.html", sayfa("v4 · Çalışmalarım", calismalarimMasa(), calismalarimTel()));
yaz("calisma-ayrinti.html", sayfa("v4 · Çalışma ayrıntısı", calismalarimMasa(), ayrintiTel()));
yaz("editor.html", sayfa("v4 · Editör", editorMasa(false), editorTel(false)));
yaz("editor-ai.html", sayfa("v4 · Editör + Arvo AI", editorMasa(true), editorTel(true)));
yaz("kaynaklar.html", sayfa("v4 · Kaynak Kütüphanesi", kaynaklarMasa(), kaynaklarTel()));
yaz("konsept-editor-pdf.html", sayfa("v4 konsept · Editör + PDF", konseptPdf(false, 1440), ""));
yaz("konsept-editor-pdf-ai.html", sayfa("v4 konsept · Editör + PDF + AI", konseptPdf(true, 1440), ""));
yaz("konsept-editor-pdf-ai-1024.html", sayfa("v4 konsept · Editör + PDF + AI (1024)", konseptPdf(true, 1024), ""));
console.log("v4: 9 sayfa yazıldı");
