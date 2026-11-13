// Panel içi olaylar (yalnızca istemcide çağrılır).
//   showToast: Toaster bileşeni (dashboard düzeninde) bildirimi gösterir.
//   announceActionSuccess: açık PanelDrawer pencereleri kendiliğinden kapanır.
/*
  "info": yapılamayan değil, ERTELENEN ya da bilgi verilen iş (T2, 14.11.2026).
  Eskiden yalnızca iki tür vardı ve "dizine ulaşılamayan künyeler için PDF
  araması ertelendi" gibi bir not kırmızı "İşlem tamamlanamadı" başlığıyla,
  role="alert" ile gösteriliyordu: hata olmayan bir durumu ekran okuyucuya
  acil uyarı diye okutmak.
*/
export type ToastKind = "success" | "error" | "info";

export const TOAST_EVENT = "arvolab:toast";
export const ACTION_SUCCESS_EVENT = "arvolab:action-success";

export interface ToastDetail {
  kind: ToastKind;
  text: string;
}

export function showToast(kind: ToastKind, text: string) {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { kind, text } }));
}

export function announceActionSuccess() {
  window.dispatchEvent(new Event(ACTION_SUCCESS_EVENT));
}
