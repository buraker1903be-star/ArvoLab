/*
  TEMA TERCİHİ: AÇIK / KOYU / SİSTEM (Phase 4.1, 04.11.2026).

  Eskiden iki durum vardı: açık ya da koyu. Kayıt yoksa ilk açılışta
  işletim sisteminin ayarı alınıyordu, ama kullanıcı düğmeye bir kez
  basınca seçim kalıcı oluyor ve "sisteme uy"a dönmenin yolu kalmıyordu;
  sistem teması gün içinde değiştiğinde (macOS/iOS otomatik koyu mod)
  açık sekme de bunu izlemiyordu.

  Şimdi üç tercih var. İki kavram bilerek ayrı tutuluyor:
  - TERCİH (light | dark | system): kullanıcının seçtiği, localStorage'da.
    <html data-theme-tercih> özniteliğinde de durur; menü onu gösterir.
  - TEMA (light | dark): ekrana uygulanan sonuç. <html data-theme>.
    Bütün CSS yalnızca bunu okur (tokens.css); "system" diye bir CSS
    teması yok, olmamalı da — her bileşen iki kez yazılırdı.

  Geriye dönük uyumluluk: depolama anahtarı ve "light"/"dark" değerleri
  aynı. Kaydı olmayan (ya da tanınmayan değer taşıyan) kullanıcı "system"
  sayılır — bu, eskiden kayıtsız kullanıcının aldığı davranışın aynısı.

  Bu dosya saf: DOM'a dokunan iki yer (ön boyama betiği ve
  app/_components/tema.ts) buradaki karar fonksiyonlarını kullanır,
  birim testi de onları sınar (tests/unit/tema.test.ts).
*/

export const TEMA_ANAHTARI = "arvolab.theme";
export const TEMA_TERCIHLERI = ["light", "dark", "system"] as const;
export type TemaTercihi = (typeof TEMA_TERCIHLERI)[number];
export type Tema = "light" | "dark";
export const KOYU_SORGUSU = "(prefers-color-scheme: dark)";

/*
  TARAYICI ÇUBUĞUNUN RENGİ (<meta name="theme-color">, Phase 4.2).
  Eskiden yalnızca cihazın temasına göre seçiliyordu (media sorgulu iki
  etiket): cihazı açık olan kullanıcı uygulamada Koyu'yu seçince tarayıcı
  çubuğu açık kalıyordu. Açık renk de uygulamanın zemini değildi
  (#f2f2f7, eski iOS grisi). Artık etiketin içeriği
  UYGULANAN temaya göre yazılır (ön boyama betiği ve tema seçici).

  Değerler tokens.css'teki --bg'nin aynısı olmalı; CSS değişkeni ilk
  boyamadan önce okunamadığı için burada sabit. tema.test.ts ikisini
  karşılaştırır: zemin değişince (4.3, Warm Ivory) test bunu söyler.
*/
export const TEMA_RENGI: Record<Tema, string> = { light: "#f7f5f0", dark: "#0f1626" };

/** Depodan gelen ham değer → tercih. Bilinmeyen her şey "system". */
export function tercihOku(ham: unknown): TemaTercihi {
  return ham === "light" || ham === "dark" || ham === "system" ? ham : "system";
}

/** Tercih + işletim sisteminin koyu olup olmadığı → uygulanacak tema. */
export function temaCoz(tercih: TemaTercihi, sistemKoyu: boolean): Tema {
  if (tercih === "system") return sistemKoyu ? "dark" : "light";
  return tercih;
}

/*
  ÖN BOYAMA BETİĞİ. app/layout.tsx bunu beforeInteractive ile <head>'e
  koyar: sayfa boyanmadan önce data-theme yazılır, koyu temada açılışta
  beyaz bir an ("flash") görünmez.

  Dinleyiciler de BURADA, bir bileşende değil: tema düğmesi her sayfada
  yok (editörün tam ekran hâli, giriş akışının bazı adımları), sistem
  teması değişince her sayfa uymalı. Değişiklik anında tercih yeniden
  okunur: kullanıcı sonradan "Sistem"e geçerse dinleyici zaten kurulu.
  "storage" olayı başka bir sekmede yapılan seçimi bu sekmeye taşır.

  <head> gözcüsü: Next, hidrasyon sırasında meta verisini yeniden yazıp
  sona bir theme-color etiketi daha ekliyor (ölçüldü, 04.11.2026); o
  etiket cihazın temasının rengini taşıyordu. Tarayıcı eşleşen İLK
  etiketi kullandığı için bugün sonuç doğru, ama bu sıraya güvenmek
  yerine sonradan eklenen etiket de uygulanan temanın rengine boyanır.

  Betik eski tarayıcıları düşürmesin diye ES5 ve try/catch içinde:
  depolama kapalıysa (gizli sekme) tercih "system" sayılır.
*/
export const TEMA_BETIGI = `(function(){var K=${JSON.stringify(TEMA_ANAHTARI)},R=${JSON.stringify(TEMA_RENGI)},d=document.documentElement,m=null;try{m=window.matchMedia(${JSON.stringify(KOYU_SORGUSU)})}catch(e){}function oku(){var t=null;try{t=localStorage.getItem(K)}catch(e){}return t==="light"||t==="dark"||t==="system"?t:"system"}function uygula(){var p=oku(),t=p==="system"?(m&&m.matches?"dark":"light"):p;d.setAttribute("data-theme",t);d.setAttribute("data-theme-tercih",p);boya()}function boya(){try{var t=d.getAttribute("data-theme")==="dark"?"dark":"light",e=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<e.length;i++)if(e[i].getAttribute("content")!==R[t])e[i].setAttribute("content",R[t])}catch(x){}}uygula();try{new MutationObserver(boya).observe(document.head,{childList:true})}catch(x){}function sistem(){if(oku()==="system")uygula()}if(m){if(m.addEventListener)m.addEventListener("change",sistem);else if(m.addListener)m.addListener(sistem)}window.addEventListener("storage",function(o){if(o.key===K||o.key===null)uygula()})})()`;
