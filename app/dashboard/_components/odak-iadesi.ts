"use client";

import { enUstPencere } from "./odak-tuzagi";

/*
  PENCERE KAPANINCA ODAK NEREYE DÖNER (24.11.2026).

  Eskiden iki ayrı cevap vardı ve ikisi de eksikti.

  PanelDrawer odağı kendi tetik düğmesine veriyordu; tetiksiz açılan
  pencerede (adresten gelen kılavuz penceresi, ActionForm'un onay
  penceresi) tetik hiç çizilmiyor ve odak sayfanın gövdesine düşüyordu.

  Dialog ise "pencere açılırken odakta olan öğe"yi hatırlıyordu. Editörün
  Belge menüsünden açılan Kısayollar, Sürümler ve Paylaş pencerelerinde o
  öğe menünün İÇİNDE kalıyor, menü de pencere açılırken kapanıyor: gizli
  bir alt ağaçtaki düğmeye focus() sessizce başarısız olur. Sonuç, üç
  pencerede de Esc'ten sonra odağın sayfanın en başına düşmesiydi;
  klavyeyle çalışan biri her pencereden sonra metne Tab'layarak dönmek
  zorunda kalıyordu.

  Hedef sırayla aranır, ilk bulunan kazanır:

   1. Aday hâlâ görünürse odak ona döner (tetik düğmesi yerinde duruyor).
   2. Aday gizli bir kabın içindeyse o kabı AÇAN görünür düğme: menünün
      kendi düğmesi (aria-controls) ya da <details>'in summary'si.
      Kullanıcının gözünde pencere oradan açıldı, oraya dönmeli.
   3. Altta açık başka bir pencere varsa odak ONA döner. Üstteki pencere
      kapanınca kullanıcı alttaki pencerede kalmalı; arkadaki sayfaya
      düşmek pencereden çıkmış gibi hissettirir.
   4. Hiçbiri yoksa sayfanın ana başlığı. Gövdeye düşmek "klavyeyle
      devam edilecek yer yok" demektir: Tab sayfanın en başından başlar.
*/

/** Öğe ekranda çizili ve odaklanabilir durumda mı? */
function gorunur(oge: Element | null | undefined): oge is HTMLElement {
  if (!(oge instanceof HTMLElement) || !oge.isConnected) return false;
  /* inert bir ağaçtaki öğe odak alamaz: açık pencerenin arkasındaki sayfa. */
  if (oge.closest("[inert]")) return false;
  /*
    KAPALI BİR <details> İÇİ GİZLİDİR (24.11.2026). Yalnızca çizim
    kutusuna bakmak yetmiyordu: hesap menüsünün paneli CSS'te konumlanmış
    olduğu için <details> kapalıyken de yerleşimde kalıyor ve
    getClientRects() dolu dönüyordu. Pencere kapanınca odak o gizli
    bağlantıya "iade ediliyor", focus() sessizce düşüyor ve klavye odağı
    sayfanın gövdesine kalıyordu — düzeltmeye çalıştığımız hatanın
    aynısı, başka bir kapıdan.
  */
  const kapsayici = oge.closest("details");
  if (kapsayici && !kapsayici.open && !oge.matches(":scope > summary, details > summary")) return false;
  /* checkVisibility görünürlük/opaklık/content-visibility'yi de sayar. */
  if (typeof oge.checkVisibility === "function" && !oge.checkVisibility()) return false;
  /* Gizli öğenin çizim kutusu yoktur; focus() çağrısı sessizce düşer. */
  return oge.getClientRects().length > 0;
}

/** Gizli kalmış adayı açan görünür düğme (menü düğmesi ya da summary). */
function acanDugme(aday: HTMLElement): HTMLElement | null {
  for (let ata: HTMLElement | null = aday; ata; ata = ata.parentElement) {
    if (ata instanceof HTMLDetailsElement) {
      const ozet = ata.querySelector<HTMLElement>(":scope > summary");
      if (gorunur(ozet)) return ozet;
    }
    if (ata.id) {
      /* useId() ":r1:" gibi kimlikler üretir; seçiciye kaçışsız girmez. */
      const denetleyen = document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(ata.id)}"]`);
      if (gorunur(denetleyen)) return denetleyen;
    }
  }
  return null;
}

/** Sayfada klavyeyle devam edilebilecek anlamlı hedef. */
function sayfaHedefi(): HTMLElement | null {
  const ana = document.querySelector<HTMLElement>("main");
  if (!ana) return null;
  const baslik = ana.querySelector<HTMLElement>("h1");
  const hedef = gorunur(baslik) ? baslik : ana;
  /* Başlık ve <main> normalde odak almaz; atlama hedefi olarak alabilsin. */
  if (!hedef.hasAttribute("tabindex")) hedef.setAttribute("tabindex", "-1");
  return hedef;
}

/**
 * Kapanan pencerenin odağını iade eder.
 *
 * `aday` pencereyi açan düğme ya da açılış anında odakta olan öğedir;
 * ikisi de kullanılamıyorsa yukarıdaki sıra işler.
 */
export function odagiIadeEt(aday: HTMLElement | null | undefined): void {
  /* Gövde bir hedef değildir: odaktaki öğe gizlenince tarayıcı odağı
     oraya alır, yani "gövde" aslında "aday kayboldu" demektir. */
  const kullanilir = aday && aday !== document.body && aday !== document.documentElement ? aday : null;
  if (kullanilir?.isConnected) {
    if (gorunur(kullanilir)) {
      kullanilir.focus();
      return;
    }
    const dugme = acanDugme(kullanilir);
    if (dugme) {
      dugme.focus();
      return;
    }
  }
  const altPencere = enUstPencere()?.querySelector<HTMLElement>("section.drawer");
  if (gorunur(altPencere)) {
    altPencere.focus();
    return;
  }
  sayfaHedefi()?.focus();
}
