import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // tests/fixtures: check-rakamlar'ın örnek ağacı — bilerek hatalı kod içerir.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "tests/fixtures/**"]),
]);
