import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  /*
    Şablon metnin içine NESNE girmesin (28.10.2026). Etiketler iki dilli
    nesnelere döndü (lib/dil.ts, Metin); `${statusLabel(x)}` derlemede hata
    vermiyor ve ekrana "[object Object]" yazıyor. JSX'te aynı hata
    derlemede yakalanıyor, şablon metinde yalnızca bu kural yakalıyor.
    Tip bilgisi gerektirdiği için yalnızca uygulama koduna uygulanıyor.
  */
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { "@typescript-eslint/restrict-template-expressions": "error" },
  },
  // tests/fixtures: check-rakamlar'ın örnek ağacı — bilerek hatalı kod içerir.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "tests/fixtures/**"]),
]);
