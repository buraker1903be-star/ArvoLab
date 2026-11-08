#!/usr/bin/env node
/*
  SIGNATURE OS v3 MAKET PAKETİ (kurum sahibinin kesin görsel talimatı, 08.11.2026).
  Durağan HTML; uygulama kodu değil. Token'lar tokens-v3.css, simgeler
  uygulamanın lucide seti, logo public/, içerik önizleme verisi ve
  tests/fixtures/tez-enflasyon-issizlik.json. Her denetimin uygulamadaki
  karşılığı README.md'de; var olmayan özellik çizilmez.
    node docs/tasarim/asama-3/v3/uret.mjs
*/
import fs from "node:fs";
import path from "node:path";

const KOK = path.dirname(new URL(import.meta.url).pathname);
const DEPO = path.resolve(KOK, "../../../..");

function ikon(ad, boy = 18, sinif = "") {
  const kaynak = fs.readFileSync(path.join(DEPO, "node_modules/lucide-react/dist/esm/icons", `${ad}.js`), "utf8");
  const bas = kaynak.indexOf("[", kaynak.indexOf("createLucideIcon("));
  const dugumler = new Function(`return ${kaynak.slice(bas, kaynak.lastIndexOf("]);") + 1)}`)();
  const ic = dugumler.map(([e, oz]) => `<${e} ${Object.entries(oz).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<svg class="ikon ${sinif}" width="${boy}" height="${boy}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg>`;
}

/*
  Başlık sunumu: veritabanındaki özgün başlık DEĞİŞMEZ. Tamamı büyük
  harfle girilmiş başlık arayüzde Türkçe başlık düzeniyle gösterilir
  (bağlaçlar küçük); tam özgün hâl erişilebilir adda ve ipucunda.
*/
const BAGLAC = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki", "için"]);
function baslikDuzeni(s) {
  if (s !== s.toLocaleUpperCase("tr")) return s;
  return s.toLocaleLowerCase("tr").split(" ").map((w, i) => {
    if (i > 0 && BAGLAC.has(w)) return w;
    const m = w.match(/^([("“]*)(.)(.*)$/u);
    return m ? m[1] + m[2].toLocaleUpperCase("tr") + m[3] : w;
  }).join(" ");
}
const OZGUN = "TÜRKİYE'DE ENFLASYON VE İŞSİZLİK İLİŞKİSİNİN EKONOMETRİK ANALİZİ (2000–2025)";
const BASLIK = baslikDuzeni(OZGUN);
const KISA = "Türkiye'de Enflasyon ve İşsizlik…";

/* Tez metni: gerçek fikstürden. */
const tez = JSON.parse(fs.readFileSync(path.join(DEPO, "tests/fixtures/tez-enflasyon-issizlik.json"), "utf8"));
const dugumler = tez.content ?? tez;
const metin = (n) => (n.content ?? []).map((x) => x.text ?? metin(x)).join("");
const giris = dugumler.findIndex((n) => n.type === "heading" && metin(n).startsWith("1. Giriş"));
const P = [1, 2, 3, 5].map((k) => metin(dugumler[giris + k]));
const H11 = metin(dugumler[giris + 4]);

const kaydet = (ad, html) => fs.writeFileSync(path.join(KOK, ad), html);

/* ---------------- Kabuk ---------------- */

function kenar({ etkin, bolum }) {
  const o = (k, ad, ik) => `<a class="kc-oge${etkin === k ? (bolum ? " etkin-ust" : " etkin") : ""}" href="#">${ikon(ik, 18)}<span>${ad}</span></a>`;
  const alt = (ad) => `<a class="kc-alt${bolum === ad ? " etkin" : ""}" href="#">${ad}</a>`;
  const calisma = bolum
    ? `<div class="kc-calisma"><p class="etiket">Açık çalışma</p>
        <button class="kc-secici" type="button" title="${OZGUN}">${ikon("book-open", 16)}<span>${KISA}</span>${ikon("chevrons-up-down", 14)}</button>
        ${["Özet", "Yazım", "Kanıt matrisi", "Etik kurul", "Kaynaklar", "Analiz", "Belge Kontrol"].map(alt).join("")}
      </div>`
    : "";
  return `<nav class="kc" aria-label="Uygulama"><div class="kc-ic">
    <div class="kc-logo"><img class="logo-acik" src="../../../../public/arvolab-logo.png" alt="ArvoLAB"/><img class="logo-koyu" src="../../../../public/arvolab-logo-koyu.png" alt="ArvoLAB"/>${ikon("panel-left-close", 18)}</div>
    <a class="d d-tonal kc-yeni" href="#">${ikon("plus", 16)}Yeni çalışma</a>
    <div class="kc-ana">${o("home", "Ana Sayfa", "layout-dashboard")}${o("calisma", "Çalışmalarım", "pen-line")}${o("lit", "Kaynak Kütüphanesi", "book-open-check")}${o("analiz", "Analiz Merkezi", "chart-no-axes-combined")}${o("belge", "Belge Kontrol", "file-check-2")}${o("destek", "Destek", "life-buoy")}</div>
    ${calisma}
    <div class="kc-alt-bolum">${o("kilavuz", "Kullanım Kılavuzu", "book-marked")}${o("abonelik", "Abonelik ve Kredi", "credit-card")}${o("ayar", "Ayarlar", "settings")}</div>
  </div></nav>`;
}
function ust(yol) {
  return `<header class="uc">
    <nav class="yol" aria-label="Konum">${yol}</nav>
    <div class="uc-ara">${ikon("search", 16)}<span>Ara veya komut çalıştır</span><kbd>Ctrl K</kbd></div>
    <button class="uc-simge" type="button" aria-label="Bildirimler">${ikon("bell", 18)}</button>
    <button class="uc-simge" type="button" aria-label="Tema">${ikon("sun", 18, "tema-gunes")}${ikon("moon", 18, "tema-ay")}</button>
    <span class="avatar" aria-label="Hesap">DY</span>
  </header>`;
}
const yolParca = (...p) => p.map((x, i) => (i === p.length - 1 ? `<b title="${OZGUN}">${x}</b>` : `<span>${x}</span>${ikon("chevron-right", 14)}`)).join("");
const masaustu = (etkin, bolum, yol, govde) => `<div class="kabuk">${kenar({ etkin, bolum })}<div class="govde">${ust(yol)}${govde}</div></div>`;

function telUst({ geri } = {}) {
  const sol = geri
    ? `<a class="tu-geri" href="#">${ikon("arrow-left", 18)}${geri}</a><span class="bosluk"></span>`
    : `<img class="logo-acik" src="../../../../public/arvolab-logo.png" alt="ArvoLAB"/><img class="logo-koyu" src="../../../../public/arvolab-logo-koyu.png" alt="ArvoLAB"/><span class="bosluk"></span>`;
  return `<header class="tu">${sol}<button class="uc-simge" aria-label="Ara">${ikon("search", 20)}</button><button class="uc-simge" aria-label="Bildirimler">${ikon("bell", 20)}</button><span class="avatar">DY</span></header>`;
}
function altCubuk(etkin) {
  const o = (k, ad, ik) => `<a class="${etkin === k ? "etkin" : ""}" href="#">${ikon(ik, 20)}<span>${ad}</span></a>`;
  return `<nav class="ac" aria-label="Uygulama">${o("home", "Ana Sayfa", "layout-dashboard")}${o("calisma", "Çalışmalar", "pen-line")}${o("lit", "Kaynaklar", "book-open-check")}${o("analiz", "Analiz", "chart-no-axes-combined")}${o("daha", "Daha fazla", "ellipsis")}</nav>`;
}
const telefon = (etkin, govde, opt = {}) => `<div class="tel">${opt.ust ?? telUst(opt)}${govde}${opt.alt === false ? "" : altCubuk(etkin)}</div>`;

/* ---------------- Ortak parçalar ---------------- */

const rozet = (r, t) => `<span class="rozet ${r}"><i></i>${t}</span>`;
const meta = (...p) => `<p class="meta">${p.join('<span class="nokta"></span>')}</p>`;
function simdi(tel) {
  return `<div class="simdi">${ikon("book-marked", 20)}
    <div class="simdi-metin"><p class="etiket vurgu">Şimdi</p><p class="simdi-baslik">Tez yazım kılavuzunuzu ekleyin</p>${tel ? "" : `<p class="yardim">Kurumunuzun kılavuzu katalogda yok; kuralları okuyup size onaylatalım.</p>`}</div>
    <a class="d d-ikincil d-sik" href="#">Kılavuzumu yükle</a></div>`;
}
function olcuSeridi() {
  return `<dl class="olcu-seridi">
    <div class="olcu"><dt>Teslime kalan</dt><dd><span class="sayi">41</span><small>gün</small></dd><p class="yardim">Teslim 19.12.2026</p></div>
    <div class="olcu"><dt>Yazılan</dt><dd><span class="sayi">6.354</span><small>kelime</small></dd><div class="cubuk"><span style="--oran:55%"></span></div><p class="yardim">%55 · kılavuz hedefine göre</p></div>
    <div class="olcu"><dt>Teslim hazırlığı</dt><dd><span class="sayi">1/5</span><small>hazır</small></dd><p class="yardim">3 madde bakılmayı bekliyor</p></div>
  </dl>`;
}
function olcuSatirlari() {
  return `<dl class="olcu-satirlari">
    <div><dt>Teslime kalan<span class="yardim">19.12.2026</span></dt><dd><span class="sayi">41</span><small>gün</small></dd></div>
    <div><dt>Yazılan<span class="yardim">%55 · kılavuz hedefine göre</span></dt><dd><span class="sayi">6.354</span><small>kelime</small></dd></div>
    <div><dt>Teslim hazırlığı<span class="yardim">3 madde bakılmayı bekliyor</span></dt><dd><span class="sayi">1/5</span><small>hazır</small></dd></div>
  </dl>`;
}
const satir = (ad, yardim, sag, ok = false) =>
  `<li><a class="satir" href="#"><div class="satir-govde"><strong>${ad}</strong>${yardim ? `<p class="yardim">${yardim}</p>` : ""}</div>${sag ? `<span class="satir-sag">${sag}</span>` : ""}${ok ? ikon("chevron-right", 16, "satir-ok") : ""}</a></li>`;
const teslimSatirlari = (ok) =>
  satir("Kapak sayfası", "Word ve PDF çıktısında kapak sayfası yok.", rozet("r-kirmizi", "Eksik"), ok) +
  satir("Yapı ve atıflar", "27 uyarı var.", rozet("r-sari", "Bakılacak"), ok) +
  satir("İçindekiler", "Word ve PDF çıktısında içindekiler yok.", rozet("r-sari", "Bakılacak"), ok);
const bolumBas = (baslik, ek = "", sag = "") => `<header class="bolum-bas"><h2 class="bolum-baslik">${baslik}${ek ? `<span class="yardim">${ek}</span>` : ""}</h2>${sag}</header>`;
const bag = (t) => `<a class="bag" href="#">${t}${ikon("chevron-right", 14)}</a>`;

/* ---------------- DASHBOARD ---------------- */

function dashboardMasa() {
  return masaustu("home", null, yolParca("Ana Sayfa"), `<main class="icerik">
    <header class="selam"><h1 class="sayfa-baslik">İyi günler, Deniz</h1><p class="yardim">Çalışmana kaldığın yerden devam et.</p></header>
    <section class="ana-yuzey dash-ana" aria-labelledby="ac-b">
      <p class="etiket">Aktif çalışma</p>
      <h2 id="ac-b" class="calisma-baslik" title="${OZGUN}">${BASLIK}</h2>
      ${meta("Tez · Dokuz Eylül Üniversitesi", rozet("r-mavi", "Yazım aşamasında"), "Bugün düzenlendi")}
      <div class="eylemler"><a class="d d-birincil" href="#">${ikon("pen-line", 18)}Yazmaya devam et</a><a class="d d-ikincil" href="#">Çalışma özeti</a></div>
      ${simdi(false)}
      ${olcuSeridi()}
    </section>
    <nav class="hizli" aria-label="Hızlı erişim"><span class="etiket">Hızlı erişim</span>
      <a class="d d-ucuncul d-sik" href="#">${ikon("link-2", 16)}DOI ile kaynak ekle</a>
      <a class="d d-ucuncul d-sik" href="#">${ikon("sparkles", 16)}Yazım asistanı</a>
      <a class="d d-ucuncul d-sik" href="#">${ikon("message-square-quote", 16)}Kaynağa sor</a>
      <kbd>Ctrl K</kbd></nav>
    <div class="ikili">
      <div>
        <section>${bolumBas("Teslim durumu", "1/5 hazır", bag("Teslim listesi"))}<ul class="satirlar">${teslimSatirlari(false)}</ul></section>
        <section>${bolumBas("Yazım ritmi", "son 14 gün")}<p class="yardim" style="padding-top:12px">Son iki haftada kaydedilmiş yazım yok. Editörde yazdıkça günlük ilerlemeniz burada birikir.</p></section>
        <section>${bolumBas("Diğer çalışmalarınız", "", bag("Tüm çalışmalar"))}<ul class="satirlar">${satir("Öğrenci öğretmen farkı", "Makale · henüz yazılmadı · 20 gün önce", rozet("r-gri", "Yeni"))}</ul></section>
      </div>
      <div>
        <section>${bolumBas("Kaynaklar ve kanıt")}<ul class="satirlar">
          ${satir("Literatür", "1 okundu · 1 kullandım", "3 kaynak")}
          ${satir("Kaynakça denetimi", "Son denetim 1 gün önce", rozet("r-yesil", "%94"))}
          ${satir("Kanıt matrisi", "1 iddia doğrudan destekleniyor", "2 iddia")}
          ${satir("Etik kurul", "Başvuru ve belgeleriniz", "")}
          ${satir("Belge kontrolü", "Kılavuz uyumu, orijinallik ön-kontrolü", "1 belge")}
        </ul></section>
        <section>${bolumBas("Danışmanıma gönder", "son kaydedilmiş hâl")}<div class="metin-eylemler"><a class="d d-ucuncul d-sik" href="#">${ikon("link-2", 16)}Okuma bağlantısı oluştur</a><a class="d d-ucuncul d-sik" href="#">${ikon("file-down", 16)}Dosya olarak gönder${ikon("chevron-down", 14)}</a></div></section>
        <section>${bolumBas("Abonelik ve kredi", "", bag("Ayrıntı"))}
          <div class="kredi"><p><span class="sayi">318</span> <span class="yardim">kredi kullanılabilir</span></p><a class="bag" href="#">${ikon("sparkles", 14)}Kredi satın al</a></div>
          <div class="cubuk"><span style="--oran:63.6%"></span></div>
          <div class="kredi-satir"><div>Bu ay kalan <b>318 / 500</b></div><div>Satın alınan bakiye <b>0</b></div></div></section>
      </div>
    </div>
    <details class="dipler"><summary><b>Daha fazla</b> bölümler, son eklenenler, çalışma hareketi<span>· 3 kaynak · 1 belge kontrolü</span>${ikon("chevron-down", 18)}</summary></details>
    <aside class="gb">${ikon("message-square-heart", 16)}ArvoLab işinizi kolaylaştırdı mı?<span class="puan">${[1, 2, 3, 4, 5].map((n) => `<button>${n}</button>`).join("")}</span><span class="sonra"><a class="d d-ucuncul d-sik">Sonra</a><a class="d d-ucuncul d-sik">Bir daha sorma</a></span></aside>
  </main>`);
}

function dashboardTel() {
  return telefon("home", `<main class="icerik">
    <h1 class="sayfa-baslik">İyi günler, Deniz</h1>
    <section class="ana-yuzey" style="margin-top:16px" aria-labelledby="act-b">
      <p class="etiket">Aktif çalışma</p>
      <h2 id="act-b" class="calisma-baslik" style="margin-top:8px" title="${OZGUN}">${BASLIK}</h2>
      ${meta("Tez", rozet("r-mavi", "Yazım aşamasında"), "Bugün")}
      <div class="eylemler" style="flex-direction:column;gap:4px"><a class="d d-birincil" href="#">${ikon("pen-line", 18)}Yazmaya devam et</a><a class="bag" href="#" style="justify-content:center">Çalışma özeti</a></div>
      ${simdi(true)}
      ${olcuSatirlari()}
    </section>
    <nav class="hizli-tel" aria-label="Hızlı erişim"><a href="#">${ikon("link-2", 18)}DOI ile ekle</a><a href="#">${ikon("sparkles", 18)}Yazım asistanı</a><a href="#">${ikon("message-square-quote", 18)}Kaynağa sor</a></nav>
    <section class="tel-bolum">${bolumBas("Teslim listesi", "1/5 hazır", bag("Tümü"))}<ul class="satirlar">${teslimSatirlari(false)}</ul></section>
    <section class="tel-bolum">${bolumBas("Kaynaklar ve kanıt")}<ul class="satirlar">
      ${satir("Literatür", "1 okundu · 1 kullandım", "3 kaynak", true)}
      ${satir("Kaynakça denetimi", "Son denetim 1 gün önce", rozet("r-yesil", "%94"), true)}
      ${satir("Kanıt matrisi", "1 iddia doğrudan destekleniyor", "2 iddia", true)}
      ${satir("Etik kurul", "", "", true)}
      ${satir("Belge kontrolü", "", "1 belge", true)}
    </ul></section>
    <section class="tel-bolum">${bolumBas("Diğer bilgiler")}<ul class="satirlar">
      ${satir("Danışmanıma gönder", "Okuma bağlantısı ya da dosya", "", true)}
      ${satir("Abonelik ve kredi", "Bu ay 318/500 · bakiye 0", "318 kredi", true)}
      ${satir("Yazım ritmi", "Son 14 günde kayıt yok", "", true)}
      ${satir("Diğer çalışmalarınız", "Öğrenci öğretmen farkı", "", true)}
      ${satir("Daha fazla", "Bölümler, son eklenenler, çalışma hareketi", "", true)}
    </ul></section>
    <aside class="gb" style="flex-wrap:wrap">${ikon("message-square-heart", 16)}ArvoLab işinizi kolaylaştırdı mı?<span class="puan" style="width:100%;justify-content:space-between">${[1, 2, 3, 4, 5].map((n) => `<button style="width:48px;height:44px">${n}</button>`).join("")}</span><span class="sonra" style="margin-left:0"><a class="d d-ucuncul" style="height:44px">Sonra</a><a class="d d-ucuncul" style="height:44px">Bir daha sorma</a></span></aside>
  </main>`);
}

/* ---------------- ÇALIŞMALARIM ---------------- */

function liste(tel) {
  const ok = tel ? ikon("chevron-right", 16) : "";
  return `<ul class="cl">
    <li class="${tel ? "" : "secili"}"><a href="#" ${tel ? "" : 'aria-current="true"'}>
      <div class="ok-sag"><strong title="${OZGUN}">${BASLIK}</strong>${ok}</div>
      <p class="yardim">Tez · 6.354 kelime · bugün</p>
      <div class="cl-alt">${rozet("r-mavi", "Yazım aşamasında")}<span class="yardim">41 gün kaldı</span></div>
      <div class="cubuk"><span style="--oran:55%"></span></div></a></li>
    <li><a href="#"><div class="ok-sag"><strong>Öğrenci öğretmen farkı</strong>${ok}</div>
      <p class="yardim">Makale · henüz yazılmadı · 20 gün önce</p>
      <div class="cl-alt">${rozet("r-gri", "Yeni")}<span class="yardim">Tarih yok</span></div></a></li>
  </ul>`;
}
const SEKMELER = [["Özet", ""], ["Yazım", ""], ["Kaynaklar", "3"], ["Kanıt", "2"], ["Analiz", ""]];
function calismalarimMasa() {
  return masaustu("calisma", "Özet", yolParca("Çalışmalarım", BASLIK), `<main class="icerik">
    <header class="sayfa-bas"><div><h1 class="sayfa-baslik">Çalışmalarım</h1><p class="yardim">Bir çalışma seçin; özeti, teslim durumu ve araçları sağda.</p></div><a class="d d-ikincil" href="#">${ikon("plus", 16)}Yeni çalışma</a></header>
    <div class="liste-ayrinti">
      <section aria-label="Tüm çalışmalar"><p class="etiket">Tüm çalışmalar · 2</p>${liste(false)}</section>
      <article class="ana-yuzey ayr" aria-labelledby="ayr-b">
        <div class="ayr-bas"><div><p class="etiket">Tez · Dokuz Eylül Üniversitesi</p><h2 id="ayr-b" class="calisma-baslik" title="${OZGUN}">${BASLIK}</h2>${meta(rozet("r-mavi", "Yazım aşamasında"), "Bugün düzenlendi")}</div>
          <div class="eylemler" style="margin-top:0"><a class="d d-birincil" href="#">${ikon("pen-line", 18)}Yazmaya devam et</a><button class="d d-ikincil d-simge" aria-label="Diğer işlemler: teslim paketi, düzenle, belge yükle, sil">${ikon("ellipsis", 18)}</button></div></div>
        <nav class="sekmeler" aria-label="Çalışmanın bölümleri ve araçları">
          ${SEKMELER.map(([a, s], i) => `<a class="sekme${i === 0 ? " etkin" : ""}" href="#">${a}${s ? `<em>${s}</em>` : ""}</a>`).join("")}
          <span class="ayrac komut"></span>
          <a class="sekme" href="#">${ikon("calendar-days", 15)}Takvim</a><a class="sekme" href="#">${ikon("quote", 15)}Kaynakça<em>%94</em></a><a class="sekme" href="#">${ikon("ellipsis", 15)}Diğer araçlar</a>
        </nav>
        ${olcuSeridi()}
        ${simdi(false)}
        <section class="ayr-bolum">${bolumBas("Teslim için bakılacaklar", "3")}<ul class="satirlar">${teslimSatirlari(false)}</ul></section>
      </article>
    </div>
  </main>`);
}
function calismalarimTel() {
  return telefon("calisma", `<main class="icerik">
    <h1 class="sayfa-baslik">Çalışmalarım</h1><p class="yardim" style="margin-top:4px">Bir çalışma seçin; özeti, teslim durumu ve araçları açılır.</p>
    <a class="d d-ikincil" href="#" style="width:100%;margin-top:16px">${ikon("plus", 16)}Yeni çalışma</a>
    <section class="tel-bolum" style="margin-top:24px"><div class="grup-bas"><p class="etiket">Tüm çalışmalar · 2</p></div><div class="grup liste-grubu">${liste(true)}</div></section>
  </main>`);
}
function ayrintiTel() {
  const arac = (ik, ad, d) => satir(`<span style="display:inline-flex;align-items:center;gap:10px">${ikon(ik, 18)}${ad}</span>`, "", d, true);
  return telefon("calisma", `<main class="icerik">
    <p class="etiket">Tez · Dokuz Eylül Üniversitesi</p>
    <h1 class="calisma-baslik" style="margin-top:8px" title="${OZGUN}">${BASLIK}</h1>
    ${meta(rozet("r-mavi", "Yazım aşamasında"), "Bugün düzenlendi")}
    <div class="eylemler"><a class="d d-birincil" href="#" style="flex:1">${ikon("pen-line", 18)}Yazmaya devam et</a><button class="d d-ikincil" style="width:48px;height:48px;padding:0" aria-label="Diğer işlemler">${ikon("ellipsis", 18)}</button></div>
    <section class="tel-bolum" style="margin-top:24px"><div class="grup-bas"><p class="etiket">Durum</p></div><div class="grup">${olcuSatirlari().replace('class="olcu-satirlari"', 'class="olcu-satirlari" style="margin:0;border:0;padding:0"')}</div></section>
    ${simdi(true)}
    <section class="tel-bolum"><div class="grup-bas"><p class="etiket">Teslim için bakılacaklar · 3</p></div><ul class="grup satirlar">${teslimSatirlari(true)}</ul></section>
    <section class="tel-bolum"><div class="grup-bas"><p class="etiket">Araçlar</p></div><ul class="grup satirlar">
      ${arac("pen-line", "Yazım", "")}${arac("library", "Kaynaklar", "3")}${arac("table-2", "Kanıt matrisi", "2")}${arac("chart-no-axes-combined", "Analiz", "")}${arac("calendar-days", "Takvim", "")}${arac("quote", "Kaynakça", "%94")}${arac("ellipsis", "Diğer araçlar", "")}
    </ul></section>
  </main>`, { geri: "Çalışmalarım" });
}

/* ---------------- EDİTÖR ---------------- */

function arac(tel, dar = false) {
  if (tel) {
    return `<div class="ed-tel-arac" role="toolbar" aria-label="Biçimlendirme">
      <button class="a" aria-label="Geri al">${ikon("undo-2", 18)}</button><span class="ayrac"></span>
      <button class="a" aria-label="Kalın"><b>B</b></button><button class="a" aria-label="İtalik"><em>I</em></button><button class="a" aria-label="Altı çizili"><u>U</u></button><span class="ayrac"></span>
      <button class="a" aria-label="Kaynaktan atıf ekle">${ikon("quote", 18)}Atıf</button><span style="flex:1"></span>
      <button class="a" aria-label="Belge ve diğer araçlar">${ikon("ellipsis", 18)}</button></div>`;
  }
  return `<div class="arac-grubu" role="toolbar" aria-label="Biçimlendirme">
      <button class="a" title="Geri al (Ctrl+Z)">${ikon("undo-2", 16)}</button>${dar ? "" : `<button class="a" title="Yinele (Ctrl+Y)">${ikon("redo-2", 16)}</button>`}<span class="ayrac"></span>
      <button class="a etkin" title="Kalın"><b>B</b></button><button class="a" title="İtalik"><em>I</em></button><button class="a" title="Altı çizili"><u>U</u></button><span class="ayrac"></span>
      <button class="a">Normal metin${ikon("chevron-down", 12)}</button><span class="ayrac"></span>
      <button class="a" title="Madde işaretli liste">${ikon("list", 16)}</button><button class="a" title="Numaralı liste">${ikon("list-ordered", 16)}</button><button class="a" title="Alıntı">${ikon("text-quote", 16)}</button><span class="ayrac"></span>
      <button class="a">${ikon("align-left", 16)}Paragraf${ikon("chevron-down", 12)}</button><button class="a">${ikon("plus", 16)}Ekle${ikon("chevron-down", 12)}</button><span class="ayrac"></span>
      <button class="a" title="Kaynaktan atıf ekle">${ikon("quote", 16)}Atıf</button>${dar ? "" : `<button class="a" title="Odak modu">${ikon("maximize-2", 16)}</button>`}<button class="a" title="Belge${dar ? "; sığmayanlar: Yazı, Üst simge, Yinele, Odak" : "; sığmayanlar: Yazı, Üst simge"}">${ikon("ellipsis", 16)}</button>
    </div>`;
}
function belge(secim) {
  const p2 = secim
    ? P[1].replace("Bu kadar farklı rejimin tek bir örneklem içinde yer alması, enflasyon–işsizlik ilişkisinin hem varlığını hem de istikrarını sorgulamayı gerekli kılmaktadır.",
      `<span class="secim-ai"><span class="secili-metin">Bu kadar farklı rejimin tek bir örneklem içinde yer alması, enflasyon–işsizlik ilişkisinin hem varlığını hem de istikrarını sorgulamayı gerekli kılmaktadır.</span><span class="secim-menu" style="left:0;top:62px" role="menu" aria-label="Seçili metni düzenle"><span class="baslik">${ikon("sparkles", 14)}Arvo AI</span><button class="a">Akademikleştir</button><button class="a">Kısalt</button><button class="a">Genişlet</button><button class="a">${ikon("message-square-text", 14)}Kendi isteğini yaz</button></span></span>`)
    : P[1];
  return `<h1>Türkiye'de Enflasyon ve İşsizlik İlişkisinin Ekonometrik Analizi</h1><h2>1. Giriş</h2><p class="ilk">${P[0]}</p><p>${p2}</p><p>${P[2]}</p><h3>${H11}</h3><p class="ilk">${P[3]}</p>`;
}
function aiPanel() {
  const gorev = (ad, alt) => `<li><a href="#">${ikon("sparkles", 16)}<span class="satir-govde"><strong>${ad}</strong><span class="yardim" style="display:block">${alt}</span></span>${ikon("chevron-right", 14, "satir-ok")}</a></li>`;
  return `<div class="ai-sekmeler" role="tablist" aria-label="Panel görünümleri">
      <a class="sekme etkin" role="tab">Arvo AI</a><a class="sekme" role="tab">İnceleme</a><a class="sekme" role="tab">Kaynaklar</a><a class="sekme" role="tab">Teslim<em>1/5</em></a></div>
    <div class="ai-ic">
      <div class="anahtar"><div><strong style="font-size:13px">Satır içi öneri</strong><p class="yardim">Yazma durunca gri öneri; Tab kabul eder.</p></div><span class="anahtar-dugme" role="switch" data-hedef="satır (52 px)" aria-checked="true" aria-label="Otomatik satır içi öneri"></span></div>
      <div><p class="bolum-baslik">Ne yazalım?</p><p class="yardim" style="margin-top:2px">Yazdıklarım metninize kendiliğinden girmez; eklemek size kalır.</p></div>
      <ul class="gorevler">${gorev("Bu bölüme paragraf yaz", "İmlecin olduğu bölüme göre")}${gorev("Kaldığım yerden devam et", "İmlecin önündeki metni sürdürür")}${gorev("Ana hat çıkar", "Kılavuzun zorunlu bölümleriyle")}${gorev("Kendi isteğini yaz", "Kutuya bir başlangıç koyar")}</ul>
      <div><p class="etiket">Seçili metni düzenle</p><div class="cipler"><span class="cip">Akademikleştir</span><span class="cip">Kısalt</span><span class="cip">Genişlet</span></div></div>
      <p class="ai-not">${ikon("shield-check", 14)}Yalnızca Literatür kütüphanenizdeki kaynaklara atıf yaparım ve metninizde olmayan bir sayı yazmam.</p>
    </div>
    <div class="istem"><p>Örn. Giriş için Phillips eğrisinin Türkiye'deki önemini anlatan bir paragraf yaz</p><button class="gonder" aria-label="Gönder">${ikon("arrow-up", 16)}</button></div>`;
}
function editorMasa(aiAcik) {
  return masaustu("calisma", "Yazım", yolParca("Çalışmalarım", BASLIK, "Yazım"), `<div class="ed-govde">
    <div class="ed-cubuk">
      ${arac(false, true)}
      <div class="ed-sag"><span class="kayit"><i></i>Kaydedildi · 14:20</span><span class="ayrac"></span>
        <a class="d d-ucuncul d-sik" href="#">${ikon("share-2", 16)}Paylaş</a><a class="d d-ucuncul d-sik" href="#">Dışa aktar${ikon("chevron-down", 14)}</a>
        <a class="d d-tonal d-sik" href="#">${ikon("sparkles", 16)}Arvo AI</a><button class="a" aria-label="${aiAcik ? "Yazım panelini kapat" : "Yazım panelini aç"}">${ikon(aiAcik ? "panel-right-close" : "panel-right-open", 18)}</button></div>
    </div>
    <div class="ed-alan">
      <div class="masa"><article class="sayfa">${belge(aiAcik)}</article></div>
      ${aiAcik ? `<aside class="ai" aria-label="Yazım paneli"><div class="ai-bas"><p class="bolum-baslik">Yazım paneli</p><button class="a" aria-label="Paneli kapat">${ikon("x", 16)}</button></div>${aiPanel()}</aside>` : ""}
    </div>
    <footer class="ed-durum" aria-label="Belge durumu"><span>6.354 kelime</span><span>Kılavuz bağlı değil</span><span class="sag">Tez · Dokuz Eylül Üniversitesi</span></footer>
  </div>`);
}
function editorTelUst() {
  return `<header class="ed-tel-ust"><a class="uc-simge" style="width:44px;height:44px" href="#" aria-label="Çalışma özetine dön">${ikon("arrow-left", 20)}</a>
    <span class="baslik" title="${OZGUN}">${BASLIK}</span><span class="kayit" aria-label="Kaydedildi"><i></i></span>
    <a class="d d-tonal d-sik" style="height:36px" href="#">${ikon("sparkles", 16)}Arvo AI</a><button class="uc-simge" style="width:44px;height:44px" aria-label="Belge: paylaş, dışa aktar, yazım paneli">${ikon("ellipsis-vertical", 20)}</button></header>`;
}
function editorTel(ai) {
  const govde = `${arac(true)}<article class="tel-sayfa"><h2>1. Giriş</h2><p>${P[0]}</p><p>${P[1]}</p></article>
    ${ai ? `<div class="ortu"></div><section class="alt-sayfa" aria-label="Yazım paneli"><div class="tutamak"></div><div class="ai-bas" style="height:44px"><p class="bolum-baslik">Yazım paneli</p><button class="a" style="width:44px;height:44px" aria-label="Paneli kapat">${ikon("x", 18)}</button></div>${aiPanel()}</section>` : ""}`;
  return telefon("calisma", govde, { ust: editorTelUst(), alt: !ai });
}

/* ---------------- KAYNAK KÜTÜPHANESİ ---------------- */

const KAYNAKLAR = [
  { b: "ARDL sınır testi yaklaşımı", y: "Pesaran, M. H., Shin, Y., & Smith, R. J.", yil: "2001", doi: "10.0000/ornek.2", pdf: true, d: ["r-gri", "Okunacak"], s: "Okudum", sec: true },
  { b: "Inflation and unemployment in emerging markets", y: "Smith, J., & Brown, K.", yil: "2019", doi: null, pdf: false, d: ["r-mavi", "Okundu"], s: "Kullandım olarak işaretle" },
  { b: "Türkiye'de Phillips eğrisinin istikrarı", y: "Önder, A. Ö.", yil: "2009", doi: null, pdf: false, d: ["r-yesil", "Kullandım"], s: "" },
];
function kaynakSatiri(k, tel) {
  const metaHtml = `<div class="kaynak-meta"><span>${k.y}</span><span>${k.yil}</span>${k.doi ? `<span>${ikon("link-2", 12)}DOI ${k.doi}</span>` : ""}<span>${ikon(k.pdf ? "file-check-2" : "file-x-2", 12)}${k.pdf ? "PDF var" : "PDF yok"}</span></div>`;
  if (tel) {
    return `<li><a class="kaynak" href="#"><div><strong>${k.b}</strong>${metaHtml}<div style="margin-top:8px">${rozet(k.d[0], k.d[1])}</div></div>${ikon("chevron-right", 16, "satir-ok")}</a></li>`;
  }
  return `<li class="${k.sec ? "secili" : ""}"><a class="kaynak" href="#"><div><strong>${k.b}</strong>${metaHtml}</div>
    <div class="kaynak-sag">${rozet(k.d[0], k.d[1])}${k.s ? `<span class="d d-ucuncul d-sik">${k.s}</span>` : ""}</div></a></li>`;
}
function kaynaklarMasa() {
  return masaustu("lit", null, yolParca("Kaynak Kütüphanesi"), `<main class="icerik">
    <header class="sayfa-bas"><div><h1 class="sayfa-baslik">Kaynak Kütüphanesi</h1><p class="yardim">Literatür ve kaynakça. Kaynak özeti ya da yorum üretilmez; künyeler dizinlerde doğrulanır.</p></div>
      <div class="eylemler" style="margin-top:0"><a class="d d-birincil" href="#">${ikon("search", 16)}Kaynak bul</a><a class="d d-ikincil" href="#">İçe aktar</a><button class="d d-ikincil d-simge" aria-label="Tarama asistanı, dışa aktar">${ikon("ellipsis", 18)}</button></div></header>
    <div class="kk-arac"><span class="secici-kutu">${ikon("book-open", 16)}${KISA}${ikon("chevron-down", 14)}</span><span>Kaynakça uyumu <b>94/100</b> · son denetim 1 gün önce · <b>3</b> künye</span>${bag("Sonuçları aç")}</div>
    <div class="kk-izgara">
      <section aria-label="Literatür">
        <div class="arama-satiri"><span class="girdi">${ikon("search", 16)}Başlık, yazar, dergi, yayınevi ya da DOI ara</span><span class="girdi" style="flex:0 0 300px">${ikon("link-2", 16)}DOI ile kaynak ekle</span><span class="d d-ikincil">Okuma durumu${ikon("chevron-down", 14)}</span></div>
        <div class="suzgecler"><span class="suzgec etkin">Hepsi <em>3</em></span><span class="suzgec">Okunacak <em>1</em></span><span class="suzgec">Okundu <em>1</em></span><span class="suzgec">Kullandım <em>1</em></span></div>
        <ul class="kaynaklar">${KAYNAKLAR.map((k) => kaynakSatiri(k, false)).join("")}</ul>
      </section>
      <aside class="baglam" aria-label="Seçili kaynak">
        <p class="etiket">Kaynak</p><h2>ARDL sınır testi yaklaşımı</h2><p class="yardim" style="margin-top:4px">Pesaran, M. H., Shin, Y., & Smith, R. J. · 2001</p>
        <div class="baglam-bolum"><div class="bolum-ust"><p class="bolum-baslik">Okuma durumu</p></div><div style="display:flex;gap:8px;align-items:center">${rozet("r-gri", "Okunacak")}<span class="d d-ikincil d-sik">Okudum</span></div></div>
        <div class="baglam-bolum"><div class="bolum-ust"><p class="bolum-baslik">Künye</p>${bag("Düzenle")}</div><dl class="kunye"><dt>Tür</dt><dd>Makale</dd><dt>Yazarlar</dt><dd>Pesaran, M. H., Shin, Y., & Smith, R. J.</dd><dt>Yıl</dt><dd>2001</dd><dt>DOI</dt><dd><a class="bag" style="font-weight:500">10.0000/ornek.2</a></dd></dl></div>
        <div class="baglam-bolum"><div class="bolum-ust"><p class="bolum-baslik">Dizinlerde karşılaştır</p></div><span class="d d-ikincil d-sik">Karşılaştır</span></div>
        <div class="baglam-bolum"><div class="bolum-ust"><p class="bolum-baslik">Çalışmadaki yeri</p></div><dl class="kunye"><dt>Kanıt</dt><dd>1 iddia (Yöntem)</dd><dt>PDF</dt><dd>İndirildi · ${bag("Kaynağa sor")}</dd></dl></div>
        <div class="baglam-bolum"><div class="bolum-ust"><p class="bolum-baslik">Notlarım</p></div><p class="yardim">Not eklenmedi.</p></div>
        <div class="baglam-bolum"><a class="d d-ucuncul d-sik tehlike" href="#" style="padding:0">${ikon("trash-2", 16)}Kaynağı sil</a></div>
      </aside>
    </div>
  </main>`);
}
function kaynaklarTel() {
  return telefon("lit", `<main class="icerik">
    <h1 class="sayfa-baslik">Kaynak Kütüphanesi</h1><p class="yardim" style="margin-top:4px">Künyeler dizinlerde doğrulanır.</p>
    <div class="eylemler"><a class="d d-birincil" href="#" style="flex:1">${ikon("search", 18)}Kaynak bul</a><button class="d d-ikincil" style="width:48px;height:48px;padding:0" aria-label="İçe aktar, tarama asistanı, dışa aktar">${ikon("ellipsis", 18)}</button></div>
    <span class="girdi" style="margin-top:16px;height:44px">${ikon("search", 16)}Kaynaklarda ara</span>
    <div class="suzgecler" style="flex-wrap:nowrap;overflow:hidden"><span class="suzgec etkin" style="height:36px">Hepsi <em>3</em></span><span class="suzgec" style="height:36px">Okunacak <em>1</em></span><span class="suzgec" style="height:36px">Okundu <em>1</em></span><span class="suzgec" style="height:36px">Kullandım <em>1</em></span></div>
    <section class="tel-bolum" style="margin-top:16px"><ul class="grup kaynaklar">${KAYNAKLAR.map((k) => kaynakSatiri(k, true)).join("")}</ul></section>
    <section class="tel-bolum"><ul class="satirlar">${satir("Kaynakça uyumu", "Son denetim 1 gün önce · 3 künye", "94/100", true)}${satir("DOI ile kaynak ekle", "", "", true)}</ul></section>
  </main>`);
}

/* ---------------- TOKEN VE BİLEŞEN SAYFASI ---------------- */

function tokenlar() {
  const renk = (ad, v) => `<div class="renk"><div style="background:var(${v})"></div><p><b>${ad}</b><span>${v}</span></p></div>`;
  const RENKLER = [["canvas", "--canvas"], ["sidebar", "--sidebar"], ["surface", "--surface"], ["surface-subtle", "--surface-subtle"], ["border", "--border"], ["text-primary", "--text-primary"], ["text-secondary", "--text-secondary"], ["text-tertiary (simge)", "--text-tertiary"], ["accent", "--accent"], ["accent-hover", "--accent-hover"], ["accent-soft", "--accent-soft"], ["accent-ink", "--accent-ink"], ["success", "--success"], ["success-ink", "--success-ink"], ["danger", "--danger"], ["danger-ink", "--danger-ink"], ["warning", "--warning"], ["warning-ink", "--warning-ink"]];
  return `<div class="ts">
    <h1>Signature OS — tasarım token'ları ve bileşenler</h1><p class="yardim" style="margin-top:4px">Premium Academic Editorial + Precision Workspace · Inter · 1 px çizgi · tek gölgeli ana yüzey</p>
    <section>${bolumBas("Renk token'ları", "AA için değişenler README'de")}<div class="renkler">${RENKLER.map(([a, v]) => renk(a, v)).join("")}</div></section>
    <section class="ornek-izgara">
      <div>${bolumBas("Tipografi")}<dl class="tip-ornek" style="margin-top:12px">
        <dt>Sayfa 28/34 · 650</dt><dd class="sayfa-baslik">Çalışmalarım</dd>
        <dt>Çalışma 24/30 · 650</dt><dd class="calisma-baslik">${BASLIK}</dd>
        <dt>Bölüm 13/18 · 650</dt><dd class="bolum-baslik">Teslim durumu</dd>
        <dt>Metin 14/21 · 400</dt><dd>Fiyat istikrarı ve tam istihdam, makroekonomi politikasının iki temel hedefidir.</dd>
        <dt>Yardımcı 12/18</dt><dd class="yardim">Son denetim 1 gün önce</dd>
        <dt>Etiket 11 · 600</dt><dd class="etiket">Aktif çalışma</dd>
        <dt>Sayı 28 · 650</dt><dd class="sayi">6.354</dd></dl></div>
      <div>${bolumBas("Düğmeler ve rozetler")}<div class="ornek" style="margin-top:12px">
        <div class="ornek-satir"><a class="d d-birincil">${ikon("pen-line", 18)}Yazmaya devam et</a><a class="d d-ikincil">Çalışma özeti</a><a class="d d-ucuncul">${ikon("link-2", 16)}Üçüncül</a><a class="d d-tonal">${ikon("plus", 16)}Yeni çalışma</a></div>
        <div class="ornek-satir"><a class="d d-birincil" style="height:48px">Mobil birincil · 48</a><a class="d d-ikincil" style="height:44px">Mobil ikincil · 44</a></div>
        <div class="ornek-satir">${rozet("r-mavi", "Yazım aşamasında")}${rozet("r-kirmizi", "Eksik")}${rozet("r-sari", "Bakılacak")}${rozet("r-yesil", "%94")}${rozet("r-gri", "Yeni")}</div>
        <div class="ornek-satir"><span class="girdi" style="flex:1">${ikon("search", 16)}Kaynaklarda ara</span></div>
      </div></div>
    </section>
    <section class="ornek-izgara">
      <div>${bolumBas("Şimdi bloğu ve ölçü şeridi")}<div class="ana-yuzey" style="margin-top:12px;padding:20px">${simdi(false)}${olcuSeridi()}</div></div>
      <div>${bolumBas("Liste satırı ve gezinme")}<div class="ornek" style="margin-top:12px"><ul class="satirlar">${satir("Kapak sayfası", "Word ve PDF çıktısında kapak sayfası yok.", rozet("r-kirmizi", "Eksik"))}${satir("Literatür", "1 okundu · 1 kullandım", "3 kaynak")}</ul>
        <div style="background:var(--sidebar);border-radius:var(--r-orta);padding:8px 12px"><a class="kc-oge etkin" href="#">${ikon("layout-dashboard", 18)}<span>Ana Sayfa · etkin</span></a><a class="kc-oge" href="#">${ikon("pen-line", 18)}<span>Çalışmalarım</span></a></div></div></div>
    </section>
  </div>`;
}

/* ---------------- Yaz ---------------- */

const sayfa = (baslik, masa, tel) => `<!doctype html>
<html lang="tr" data-theme="light"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${baslik}</title><link rel="stylesheet" href="tokens-v3.css"/><link rel="stylesheet" href="v3.css"/></head>
<body><div class="masaustu-yalniz">${masa}</div><div class="telefon-yalniz">${tel}</div>
<script>/* Token sayfası: örneklerin GERÇEK değerini yaz (temaya göre). */ addEventListener("load", () => document.querySelectorAll(".renk span").forEach((e) => { e.textContent += " · " + getComputedStyle(document.documentElement).getPropertyValue(e.textContent.trim()).trim(); }));</script></body></html>
`;
kaydet("dashboard.html", sayfa("v3 · Ana Sayfa", dashboardMasa(), dashboardTel()));
kaydet("calismalarim.html", sayfa("v3 · Çalışmalarım", calismalarimMasa(), calismalarimTel()));
kaydet("calisma-ayrinti.html", sayfa("v3 · Çalışma ayrıntısı", calismalarimMasa(), ayrintiTel()));
kaydet("editor.html", sayfa("v3 · Editör", editorMasa(false), editorTel(false)));
kaydet("editor-ai.html", sayfa("v3 · Editör + Arvo AI", editorMasa(true), editorTel(true)));
kaydet("kaynaklar.html", sayfa("v3 · Kaynak Kütüphanesi", kaynaklarMasa(), kaynaklarTel()));
kaydet("tokenlar.html", sayfa("v3 · Token ve bileşenler", tokenlar(), tokenlar()));
console.log("v3: 7 sayfa yazıldı");
