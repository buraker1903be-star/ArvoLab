#!/usr/bin/env node
/*
  V4.1 ÖRNEK BİLEŞEN SAYFASI. Ekran değil; v4 dilinin bileşen düzeyinde
  kanıtı. İçerik sentetik önizleme verisi; simgeler lucide (uygulamanın seti).
    node docs/tasarim/asama-4/signature-os-v4/ornek/uret.mjs
    node docs/tasarim/asama-4/signature-os-v4/ornek/cek.mjs <klasör>
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
/* Doğrulama izi işaretleri: şekil + renk + metin (yalnız renkle anlatılmaz). */
const ISARET = {
  tamam: `<svg class="isaret tamam" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="6" fill="currentColor"/><path d="M3.4 6.2 5.2 8l3.4-3.6" stroke="var(--yuzey-1)" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  kismen: `<svg class="isaret kismen" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5.1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 .9a5.1 5.1 0 0 1 0 10.2z" fill="currentColor"/></svg>`,
  bekliyor: `<svg class="isaret bekliyor" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5.1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  sorun: `<svg class="isaret sorun" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .6 11.4 6 6 11.4.6 6z" fill="currentColor"/></svg>`,
};
const iz = (ogeler) => `<div class="iz" role="list">${ogeler.map(([eksen, tur, metin]) => `<span role="listitem">${ISARET[tur]}<b>${eksen}</b>${metin}</span>`).join("")}</div>`;
const LOGO = `<img class="logo-acik" src="../../../../../public/arvolab-logo.png" alt="ArvoLAB"/><img class="logo-koyu" src="../../../../../public/arvolab-logo-koyu.png" alt="ArvoLAB"/>`;

const RENKLER = ["--yuzey-zemin", "--yuzey-kenar", "--yuzey-1", "--yuzey-2", "--yuzey-cokuk", "--yuzey-vurgu", "--kagit", "--masa",
  "--metin-1", "--metin-2", "--metin-3", "--cizgi", "--cizgi-guclu", "--vurgu", "--vurgu-metin", "--odak",
  "--ilerleme", "--basari", "--uyari", "--hata", "--basari-yumusak", "--uyari-yumusak", "--hata-yumusak", "--notr-yumusak"];

const govde = `<main class="sayfa">
  <header class="kunye-ust">
    <div>${LOGO.replace(/<img /g, '<img style="width:140px;height:32px;object-fit:cover" ')}
      <h1>Signature Academic OS — bileşen dili</h1>
      <p>Academic Editorial × Precision SaaS. İçerik editoryal (Newsreader), araç hassas (Inter); belge metni kılavuzun yazısıyla. V4.1 örneği — ekran değil.</p></div>
    <span class="tema-etiket" data-tema-adi></span>
  </header>

  <div class="izgara">
    <section class="blok s12"><span class="etiket">Renk ve yüzey</span>
      <div class="renkler">${RENKLER.map((r) => `<div class="renk"><i style="background:var(${r})"></i><span><b>${r.slice(2)}</b><em data-deger="${r}"></em></span></div>`).join("")}</div>
    </section>

    <section class="blok s7"><span class="etiket">Tipografi — iki ses</span>
      <dl class="yuzey">
        <div class="tip-satir"><dt>gösterim · Newsreader 34</dt><dd class="t-gosterim">Türkiye'de Enflasyon ve İşsizlik İlişkisinin Ekonometrik Analizi</dd></div>
        <div class="tip-satir"><dt>çalışma · Newsreader 24</dt><dd class="t-calisma">ARDL sınır testi yaklaşımı</dd></div>
        <div class="tip-satir"><dt>alıntı · Newsreader italik</dt><dd class="t-alinti">“…ters yönlü ilişki…” <span class="meta" style="font-style:normal">— Önder, 2009, s. 12</span></dd></div>
        <div class="tip-satir"><dt>bölüm · Inter 15/600</dt><dd class="t-bolum">Teslim durumu</dd></div>
        <div class="tip-satir"><dt>gövde · Inter 14</dt><dd>Kaynakça denetimi son çalıştırmada 3 künyede eksik alan buldu.</dd></div>
        <div class="tip-satir"><dt>meta · Inter 13</dt><dd class="meta">Tez · Dokuz Eylül Üniversitesi · bugün düzenlendi</dd></div>
        <div class="tip-satir"><dt>etiket · Inter 11 büyük</dt><dd class="etiket">Aktif çalışma</dd></div>
        <div class="tip-satir"><dt>sayı · Inter 26 eşit gen.</dt><dd class="t-sayi">6.354 <span class="meta">kelime</span></dd></div>
      </dl>
    </section>

    <section class="blok s5"><span class="etiket">Düğme hiyerarşisi ve durumlar</span>
      <div class="yuzey" style="display:grid;gap:16px">
        <div class="dizi"><a class="d d-birincil">${ikon("pen-line", 18)}Yazmaya devam et</a><a class="d d-ikincil">Çalışma özeti</a><a class="d d-ucuncul">${ikon("link-2", 16)}DOI ekle</a></div>
        <div class="dizi"><a class="d d-tonal">${ikon("plus", 16)}Yeni çalışma</a><a class="d d-tonal">${ikon("sparkles", 16)}Arvo AI</a><a class="d d-tehlike">${ikon("trash-2", 16)}Kaynağı sil</a></div>
        <div class="dizi">
          <span class="durum-hucre"><a class="d d-birincil d-sik">Kaydet</a><span class="durum-adi">varsayılan</span></span>
          <span class="durum-hucre"><a class="d d-birincil d-sik uzerinde">Kaydet</a><span class="durum-adi">üzerinde</span></span>
          <span class="durum-hucre"><a class="d d-birincil d-sik odak">Kaydet</a><span class="durum-adi">odak</span></span>
          <span class="durum-hucre"><a class="d d-sik kapali">Kaydet</a><span class="durum-adi">devre dışı</span></span>
          <span class="durum-hucre"><a class="d d-ikincil d-sik uzerinde">İptal</a><span class="durum-adi">ikincil · üzerinde</span></span>
        </div>
        <div class="dizi"><span class="girdi">${ikon("search", 16)}Kaynaklarda ara<kbd>Ctrl K</kbd></span><span class="girdi odak">${ikon("link-2", 16)}10.1002/jae.616</span></div>
        <div class="dizi"><a class="d d-birincil d-tel" style="flex:1">${ikon("pen-line", 18)}Telefonda birincil · 48</a></div>
      </div>
    </section>

    <section class="blok s12"><span class="etiket">Gezinme: kenar çubuğu (≥1200) · 64 px ray (761–1199) · alt çubuk (≤760)</span>
      <div class="gez">
        <nav class="kenar" aria-label="Uygulama">${LOGO.replace(/<img /g, '<img style="width:112px;height:26px;object-fit:cover;margin:2px 4px 14px" ')}
          <a class="go etkin" aria-current="page">${ikon("layout-dashboard", 18)}Ana Sayfa</a>
          <a class="go uzerinde">${ikon("pen-line", 18)}Çalışmalarım</a>
          <a class="go">${ikon("book-open-check", 18)}Kaynak Kütüphanesi</a>
          <a class="go">${ikon("chart-no-axes-combined", 18)}Analiz Merkezi</a>
          <p class="etiket grup-adi">Açık çalışma</p>
          <a class="go">${ikon("book-open", 18)}Türkiye'de Enflasyon…</a>
        </nav>
        <nav class="ray" aria-label="Uygulama (ray)">
          <a class="ro etkin" aria-label="Ana Sayfa" aria-current="page">${ikon("layout-dashboard", 20)}</a>
          <a class="ro" aria-label="Çalışmalarım">${ikon("pen-line", 20)}</a>
          <a class="ro odak" aria-label="Kaynak Kütüphanesi">${ikon("book-open-check", 20)}</a>
          <a class="ro" aria-label="Analiz Merkezi">${ikon("chart-no-axes-combined", 20)}</a>
          <a class="ro" aria-label="Belge Kontrol">${ikon("file-check-2", 20)}</a>
          <span class="ipucu" role="tooltip">Kaynak Kütüphanesi</span>
        </nav>
        <div style="display:flex;flex-direction:column;gap:12px;justify-content:flex-end">
          <p class="yardim" style="max-width:380px">Ray: simge 20 px, hedef 44 px, ipucu odakta ve üzerindeyken; erişilebilir ad her simgede; ↑/↓ ile gezinme. Uygulama bugün 88 px etiketli ray kullanıyor; bu aşamada değişmez (K2).</p>
          <nav class="alt-cubuk" aria-label="Uygulama (telefon)"><a class="etkin">${ikon("layout-dashboard", 20)}Ana Sayfa</a><a>${ikon("pen-line", 20)}Çalışmalar</a><a>${ikon("book-open-check", 20)}Kaynaklar</a><a>${ikon("chart-no-axes-combined", 20)}Analiz</a><a>${ikon("ellipsis", 20)}Daha fazla</a></nav>
        </div>
      </div>
    </section>

    <section class="blok s7"><span class="etiket">Editör: tek çubuk + kâğıt</span>
      <div class="ed">
        <div class="ed-cubuk">
          <span class="kayit"><i></i>Kaydedildi · 14:20</span><span class="ayr"></span>
          <span class="a">${ikon("undo-2", 16)}</span><span class="ayr"></span><span class="a etkin"><b>B</b></span><span class="a"><em>I</em></span><span class="a"><u>U</u></span><span class="ayr"></span>
          <span class="a">Normal metin ${ikon("chevron-down", 12)}</span><span class="a">${ikon("quote", 16)}&nbsp;Atıf</span><span class="a">${ikon("ellipsis", 16)}</span>
          <span style="margin-left:auto" class="cip">Kılavuz bağlı değil · <a>Bağla</a></span>
        </div>
        <div class="kagit-alan"><article class="kagit">
          <span class="not">Belge metni kılavuzun yazısıyla (örnek: Times New Roman 12 pt). Arayüz token'ları belgeye uygulanmaz.</span>
          <h2>1. Giriş</h2>
          <p>Fiyat istikrarı ve tam istihdam, makroekonomi politikasının iki temel hedefidir. Bu iki hedef arasında bir değiş-tokuş bulunup bulunmadığı sorusu, <span class="atif" title="Kütüphanede eşleşti · künye doğrulandı">Phillips'in (1958)</span> ortaya koyduğu ters yönlü ilişkiden bu yana tartışılmaktadır; <span class="atif-sorun" title="Kütüphanede karşılığı yok">Friedman (1968)</span> ise uzun dönemde bu menünün ortadan kalkacağını ileri sürmüştür.</p>
        </article></div>
      </div>
      <p class="yardim" style="margin-top:8px">Atıfın altı çizgisi doğrulama izinin rengini taşır (yeşil eşleşti, kiremit kütüphanede yok); ipucunda metinle söylenir. <span class="yeni">Önerilen yeni işlev</span></p>
    </section>

    <section class="blok s5"><span class="etiket">Doğrulama izi — eksenler ayrı, puan yok</span>
      <div class="yuzey" style="display:grid;gap:14px">
        ${iz([["Künye", "tamam", "dizinde eşleşti"], ["PDF", "kismen", "bulunamadı · siz yükleyin"], ["Atıf", "tamam", "metinde 2"], ["Kanıt", "bekliyor", "değerlendirilmedi"]])}
        <table class="iz-tablo"><tbody>
          <tr><td>${ISARET.tamam} Doğrulandı</td><td>künye eşleşti · PDF indirildi/yüklendi · atıf kütüphanede · kanıt doğrudan</td></tr>
          <tr><td>${ISARET.kismen} Kısmen</td><td>künye kısmen eşleşti · PDF bulunamadı/erişilemedi · kanıt dolaylı</td></tr>
          <tr><td>${ISARET.bekliyor} Bekliyor</td><td>künye bakılmadı · kanıt değerlendirilmedi</td></tr>
          <tr><td>${ISARET.sorun} Sorun</td><td>künye uyuşmuyor · dizinde kayıt yok · atıf kütüphanede yok</td></tr>
        </tbody></table>
        <p class="yardim">Okuma durumu doğrulama değildir; ayrı adım göstergesi:</p>
        <span class="adim"><span class="nokta dolu"></span>Okunacak<span class="cizgi"></span><span class="nokta dolu"></span>Okundu<span class="cizgi"></span><span class="nokta"></span>Kullandım</span>
      </div>
    </section>

    <section class="blok s7"><span class="etiket">Kaynak satırı (sık yoğunluk)</span>
      <div class="yuzey" style="padding:4px 20px">
        <div class="ks"><div><strong>ARDL sınır testi yaklaşımı</strong><p class="meta">Pesaran, M. H., Shin, Y., & Smith, R. J. · 2001 · DOI 10.0000/ornek.2</p>${iz([["Künye", "bekliyor", "bakılmadı"], ["PDF", "tamam", "indirildi"], ["Atıf", "bekliyor", "metinde yok"], ["Kanıt", "bekliyor", "1 iddia · değerlendirilmedi"]])}</div><div class="dizi"><span class="rozet r-notr">Okunacak</span><a class="d d-ikincil d-sik">Okudum</a></div></div>
        <div class="ks"><div><strong>Türkiye'de Phillips eğrisinin istikrarı</strong><p class="meta">Önder, A. Ö. · 2009</p>${iz([["Künye", "kismen", "eksik alan: dergi, cilt"], ["PDF", "sorun", "dizinde kayıt yok"], ["Atıf", "tamam", "metinde 1"], ["Kanıt", "tamam", "doğrudan destek"]])}</div><div class="dizi"><span class="rozet r-basari">Kullandım</span></div></div>
      </div>
    </section>

    <section class="blok s5"><span class="etiket">PDF bölmesi</span>
      <div class="pdf">
        <div class="pdf-bas"><span class="yeni">Önerilen yeni işlev</span><span class="meta" style="margin-left:auto">s. 12 / 34</span><span class="a">${ikon("zoom-in", 16)}</span><a class="d d-ucuncul d-sik">${ikon("message-square-quote", 16)}Kaynağa sor</a><a class="d d-ucuncul d-sik">${ikon("external-link", 16)}</a></div>
        <div class="pdf-alan"><div class="pdf-sayfa">Bulgular, kısa dönemde enflasyon ile işsizlik arasında <mark>ters yönlü ilişki</mark> bulunduğuna işaret etmektedir. Uzun dönem katsayısı ise istatistiksel olarak anlamlı değildir; bu sonuç, beklentilerin uyarlanması…</div></div>
      </div>
      <p class="yardim" style="margin-top:8px">Bugün: "PDF'i aç" yeni sekmede, "Kaynağa sor" ayrı pencerede (değişmez).</p>
    </section>

    <section class="blok s7"><span class="etiket">Arvo AI — tek yüzey, kaynağa dayalı yanıt</span>
      <div class="ai">
        <nav class="ai-sekmeler" role="tablist"><a class="etkin" role="tab">${ikon("sparkles", 15)}Arvo AI</a><a role="tab">İnceleme</a><a role="tab">Kaynaklar</a><a role="tab">Teslim <em>1/5</em></a><a role="tab">PDF</a></nav>
        <div class="ai-ic">
          <div class="baglam"><span class="cip">${ikon("map-pin", 13)}1. Giriş</span><span class="cip">${ikon("text-select", 13)}seçili 1 cümle</span><span class="cip">Kılavuz yok</span><span class="yardim" style="align-self:center">bağlam satırı: sunum önerisi</span></div>
          <p class="istem">Bu paragrafı daha akademik bir dille yeniden yaz.</p>
          <article class="yanit">
            <header class="yanit-bas"><span class="etiket" style="color:var(--metin-1)">Akademik hâli</span><span class="yardim">+4 kelime · −2 kelime</span></header>
            <p class="yanit-govde fark">Bu çalışma, 2000–2025 döneminde <del>enflasyonla işsizlik arasındaki ilişkiye bakıyor</del> <ins>enflasyon ile işsizlik arasındaki ilişkiyi Phillips eğrisi çerçevesinde sınamaktadır</ins> <span class="atif-isaret">${ISARET.tamam.replace('class="isaret tamam"', 'class="isaret" style="color:currentColor"')}Önder, 2009</span>.</p>
            <p class="dayanak"><b>Dayanak</b> · Literatür kütüphanenizden 1 kaynak · yeni sayı yok</p>
            <div class="yanit-eylem"><a class="d d-birincil d-sik">Kabul et</a><a class="d d-ikincil d-sik">Düzenleyerek kabul et</a><a class="d d-ucuncul d-sik">Reddet</a></div>
          </article>
        </div>
        <div class="istem-kutu"><p>Örn. Giriş için Phillips eğrisinin Türkiye'deki önemini anlatan bir paragraf yaz</p><span class="gonder">${ikon("arrow-up", 16)}</span></div>
      </div>
      <p class="yardim" style="margin-top:8px">Var: istem, fark kartı, Kabul et / Düzenleyerek kabul et / Reddet → "Uygulandı · Geri al". Sunum önerisi: bağlam satırı, dayanak notu, atıf işaretinde doğrulama. PDF sekmesi önerilen yeni işlev. Asistan kaynak önermez.</p>
    </section>

    <section class="blok s5"><span class="etiket">Durumlar</span>
      <div class="durumlar" style="grid-template-columns:1fr">
        <div class="yuzey"><span class="etiket" style="display:block;margin-bottom:10px">Yükleniyor</span><div class="iskelet" aria-busy="true"><i style="width:70%"></i><i style="width:92%"></i><i style="width:56%"></i></div></div>
        <div class="yuzey bos"><span class="etiket" style="display:block;margin-bottom:8px">Boş</span><h3>Henüz kaynak yok</h3><p class="meta" style="margin:4px 0 12px">DOI yapıştırarak ilk kaynağınızı ekleyin; künye dizinlerden doldurulur.</p><a class="d d-ikincil d-sik">${ikon("link-2", 16)}DOI ile ekle</a></div>
        <div class="yuzey"><span class="etiket" style="display:block;margin-bottom:8px">Hata</span><p class="hata-satir">${ISARET.sorun}<span>Kaynaklar okunamadı. Kayıtlarınız yerinde; bağlantı düzelince yeniden deneyin.</span></p><a class="d d-ucuncul d-sik" style="margin-top:8px">${ikon("rotate-cw", 16)}Tekrar dene</a></div>
        <div class="bildirim" role="status">${ikon("circle-check", 18)}Son değişiklikler kaydedildi.</div>
      </div>
    </section>
  </div>
</main>
<script>
addEventListener("load", () => {
  const st = getComputedStyle(document.documentElement);
  document.querySelectorAll("[data-deger]").forEach((e) => { e.textContent = " " + st.getPropertyValue(e.dataset.deger).trim(); });
  document.querySelectorAll("[data-tema-adi]").forEach((e) => { e.textContent = document.documentElement.dataset.theme === "dark" ? "Koyu tema" : "Açık tema"; });
});
</script>`;

fs.writeFileSync(path.join(KOK, "bilesenler.html"), `<!doctype html>
<html lang="tr" data-theme="light"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Signature OS v4 · bileşen dili</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="../tokens-v4.css"/><link rel="stylesheet" href="bilesenler.css"/></head>
<body>${govde}</body></html>
`);
console.log("bilesenler.html yazıldı");
