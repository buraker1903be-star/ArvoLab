/*
  Yazım asistanının istemci tarafında da gereken parçası (panel:
  app/dashboard/editor/[id]/write/yazim-paneli.tsx). Ayrı dosyada, çünkü
  lib/ai/yazim-asistani.ts istem metnini ve doğrulama kodunu taşıyor;
  onları tarayıcı paketine sokmanın sebebi yok.
*/
export type SohbetMesaji = { rol: "kullanici" | "asistan"; metin: string };

/** Eklenebilir metin → paragraflar (boş satırla ayrılmış). */
export function paragraflara(metin: string): string[] {
  return metin
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}
