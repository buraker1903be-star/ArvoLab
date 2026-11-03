/* citeproc-js tipsiz geliyor; yalnızca lib/atif/csl.ts'in kullandığı yüzey. */
declare module "citeproc" {
  type Sistem = {
    retrieveLocale: (dil: string) => string | false;
    retrieveItem: (id: string) => Record<string, unknown>;
  };
  interface Motor {
    setOutputFormat(bicim: "html" | "text" | "rtf"): void;
    updateItems(kimlikler: string[]): void;
    makeCitationCluster(liste: Array<{ id: string; locator?: string; label?: string; position?: number }>): string;
    makeBibliography(): [Record<string, unknown>, string[]] | false;
  }
  const CSL: { Engine: new (sys: Sistem, stil: string, dil?: string, dilZorla?: boolean) => Motor };
  export default CSL;
}
