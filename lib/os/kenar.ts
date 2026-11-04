/*
  KENAR ÇUBUĞU: GENİŞ / DAR (Signature OS, 04.11.2026).

  Masaüstünde (≥1200) kenar çubuğu daraltılabiliyor; dar hâli tabletteki
  rayın aynısı (simge + kısa ad). Eskiden genişlik ekran boyuna bağlıydı,
  kullanıcının seçimi yoktu: yazarken 248 piksellik menüyü kapatıp
  belgeye yer açmanın yolu yoktu.

  Tercih tema gibi BOYAMADAN ÖNCE uygulanır (<html data-kenar="dar">):
  React yüklenince uygulansaydı dar seçen kullanıcı her sayfa açılışında
  önce geniş menüyü görür, sonra içerik sola kayardı (düzen kayması).
  Betik app/layout.tsx'te <head> içinde, tema betiğinin yanında.

  Varsayılan GENİŞ: kaydı olmayan, tanınmayan değer taşıyan ya da
  depolaması kapalı (gizli sekme) kullanıcı bugünkü düzeni görür.
  Tablette ve telefonda tercih yok sayılır (CSS yalnızca ≥1200'de okur):
  tablette ray zaten dar, telefonda gezinme altta.
*/

export const KENAR_ANAHTARI = "arvolab.kenar";
export type KenarHali = "genis" | "dar";

/** Depodan gelen ham değer → hâl. Bilinmeyen her şey "genis". */
export function kenarOku(ham: unknown): KenarHali {
  return ham === "dar" ? "dar" : "genis";
}

/*
  "storage" olayı başka sekmede yapılan seçimi bu sekmeye taşır: iki
  sekmede açık panelin biri dar, öteki geniş kalmasın. ES5 ve try/catch:
  eski tarayıcıyı ve kapalı depolamayı düşürmesin.
*/
export const KENAR_BETIGI = `(function(){var K=${JSON.stringify(KENAR_ANAHTARI)},d=document.documentElement;function uygula(){var v=null;try{v=localStorage.getItem(K)}catch(e){}if(v==="dar")d.setAttribute("data-kenar","dar");else d.removeAttribute("data-kenar")}uygula();try{window.addEventListener("storage",function(o){if(o.key===K||o.key===null)uygula()})}catch(e){}})()`;
