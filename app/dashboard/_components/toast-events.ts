// Panel içi olaylar (yalnızca istemcide çağrılır).
//   showToast: Toaster bileşeni (dashboard düzeninde) bildirimi gösterir.
//   announceActionSuccess: açık PanelDrawer pencereleri kendiliğinden kapanır.
export type ToastKind = "success" | "error";

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
