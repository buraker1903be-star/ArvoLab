import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Editördeki resimler depoda (project-files/<yazar>/editor-images/...) durur ve metne
// imzalı bağlantıyla eklenir. İmzanın süresi dolsa da resim kaybolmasın diye editör,
// yazdırma sayfası ve Word çıktısı dosyayı depo yolundan yeniden imzalar/indirir.
//
// Güvenlik: metin kullanıcı tarafından yazılabildiği için yalnızca O METNİN YAZARLARININ
// (çalışma sahibi ve atanan uzman) editor-images klasöründeki dosyalar işlenir; başka
// birinin dosya yolunu metne yazmak o dosyaya erişim sağlamaz. Sunucu dış adreslere istek atmaz.

export const IMAGE_BUCKET = "project-files";
export const SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60;

const EDITOR_IMAGE_PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/editor-images\/[^/]+$/i;

type StorageClient = Pick<SupabaseClient, "storage">;

interface DocNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
}

/** Kendi Supabase depomuzdaki dosya bağlantısından depo yolunu çıkarır (başka adresler: null) */
export function storagePathFromUrl(src: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  try {
    const url = new URL(src);
    if (url.origin !== new URL(base).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/project-files\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function isWriterImagePath(path: string, writerIds: (string | null | undefined)[]): boolean {
  const match = path.match(EDITOR_IMAGE_PATH);
  if (!match) return false;
  const owner = match[1].toLowerCase();
  return writerIds.some((id) => id?.toLowerCase() === owner);
}

function imagePath(node: DocNode, writerIds: (string | null | undefined)[]): string | null {
  if (node.type !== "image" || typeof node.attrs?.src !== "string") return null;
  const path = storagePathFromUrl(node.attrs.src);
  return path && isWriterImagePath(path, writerIds) ? path : null;
}

function collectPaths(nodes: DocNode[] | undefined, writerIds: (string | null | undefined)[], out: Set<string>) {
  for (const node of nodes ?? []) {
    const path = imagePath(node, writerIds);
    if (path) out.add(path);
    collectPaths(node.content, writerIds, out);
  }
}

function replaceSources(nodes: DocNode[] | undefined, writerIds: (string | null | undefined)[], urls: Map<string, string>): DocNode[] | undefined {
  return nodes?.map((node) => {
    const path = imagePath(node, writerIds);
    const next: DocNode = path && urls.has(path) ? { ...node, attrs: { ...node.attrs, src: urls.get(path) } } : { ...node };
    if (node.content) next.content = replaceSources(node.content, writerIds, urls);
    return next;
  });
}

/** Metindeki yazar resimlerinin bağlantılarını tazeler; hata olursa metni olduğu gibi döndürür */
export async function refreshImageUrls<T extends { content?: DocNode[] }>(
  doc: T,
  writerIds: (string | null | undefined)[],
  client?: StorageClient
): Promise<T> {
  const paths = new Set<string>();
  collectPaths(doc?.content, writerIds, paths);
  if (paths.size === 0) return doc;
  try {
    const storage = (client ?? createAdminClient()).storage;
    const { data, error } = await storage.from(IMAGE_BUCKET).createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS);
    if (error || !data) return doc;
    const urls = new Map<string, string>();
    for (const item of data) if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
    if (urls.size === 0) return doc;
    return { ...doc, content: replaceSources(doc.content, writerIds, urls) };
  } catch (error) {
    console.error(error);
    return doc;
  }
}

/** Word çıktısı için yazar resmini indirir (yetkisiz yol: null) */
export async function downloadWriterImage(
  path: string,
  writerIds: (string | null | undefined)[],
  client?: StorageClient
): Promise<Buffer | null> {
  if (!isWriterImagePath(path, writerIds)) return null;
  try {
    const storage = (client ?? createAdminClient()).storage;
    const { data, error } = await storage.from(IMAGE_BUCKET).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    console.error(error);
    return null;
  }
}
