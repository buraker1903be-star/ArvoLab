// P52b denetim düzeneği: sunucu eylemlerini Next DIŞINDA çalıştırmak için
// yalnızca Next'e ve dış ağa bağlı modüller taklit edilir; eylemlerin kendisi
// (app/actions/kaynak-pdf.ts) DEĞİŞTİRİLMEDEN içe aktarılır.
import "../../../tests/register.mjs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const KOK = path.dirname(new URL(import.meta.url).pathname);
const TAKLIT = {
  "next/cache": "next-cache.mjs",
  "@/lib/auth-guards": "auth-guards.mjs",
  "@/lib/access": "access.mjs",
  "@/lib/dil-sunucu": "dil-sunucu.mjs",
  "@/lib/kanit/dizin": "dizin.mjs",
  "@/lib/guvenli-indir": "guvenli-indir.mjs",
  "@/lib/document-extract": "document-extract.mjs",
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (TAKLIT[specifier]) return { url: pathToFileURL(path.join(KOK, TAKLIT[specifier])).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
