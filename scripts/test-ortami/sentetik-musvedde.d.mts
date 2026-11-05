/* scripts/test-ortami/sentetik-musvedde.mjs'in tipleri (birim testi içe aktarıyor). */
import type { TiptapDoc } from "../../lib/tiptap-text";
export function musveddeSatiri(
  icerik: TiptapDoc,
  kimlik: { projeId: string; sahipId: string },
): Promise<{ project_id: string; content: TiptapDoc; plain_text: string; word_count: number; updated_by: string }>;
