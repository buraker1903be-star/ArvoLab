/* Paged.js tip bildirimi yok; yalnızca kullandığımız yüzey (app/print/manuscript/sayfali-baski.tsx). */
declare module "*/pagedjs/dist/paged.esm.js" {
  export class Previewer {
    preview(
      content?: DocumentFragment | HTMLElement,
      stylesheets?: (string | Record<string, string>)[],
      renderTo?: HTMLElement,
    ): Promise<{ total: number }>;
  }
}
