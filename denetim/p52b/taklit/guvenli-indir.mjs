// Kontrollü indirme: gecikme ve içerik düzenekten. SSRF süzgeci ayrıca
// birim düzeyinde sınanıyor (denetim/p52b/saf-bulgular.test.ts).
export class IndirmeHatasi extends Error {}
export const indirmeHatasiTuru = (h) => (h instanceof IndirmeHatasi ? "erisim" : "beklenmeyen");
export const guvenliIndir = async (adres, enFazla) => globalThis.__denetim.indir(adres, enFazla);
