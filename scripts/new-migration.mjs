// Yeni migration dosyası açar: npm run db:new -- <ad>
//
// "supabase migration new" gerçek zaman damgasını kullanır; bu projede son
// sürüm şu an için ileri tarihli olduğundan o dosya uygulanmışların ÖNÜNE
// sıralanırdı (gerekçe: scripts/check-migrations.mjs). Bu betik sürümü
// max(şimdi, son + 1 saniye) olarak hesaplar, yani her zaman sona eklenir.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(root, "supabase", "migrations");

const raw = process.argv.slice(2).join(" ").trim();
const name = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
if (!name) {
  console.error('Kullanım: npm run db:new -- <ad>   (ör. npm run db:new -- "paylasim baglantisi suresi")');
  process.exit(1);
}

const stamp = (date) => date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const parse = (version) =>
  Date.UTC(
    +version.slice(0, 4), +version.slice(4, 6) - 1, +version.slice(6, 8),
    +version.slice(8, 10), +version.slice(10, 12), +version.slice(12, 14),
  );

fs.mkdirSync(DIR, { recursive: true });
const versions = fs.readdirSync(DIR)
  .map((file) => /^(\d{14})_/.exec(file)?.[1])
  .filter(Boolean)
  .sort();
const last = versions[versions.length - 1];

const now = Date.now();
const floor = last ? parse(last) + 1000 : now;
const version = stamp(new Date(Math.max(now, floor)));

const file = path.join(DIR, `${version}_${name}.sql`);
if (fs.existsSync(file)) {
  console.error(`Zaten var: ${path.relative(root, file)}`);
  process.exit(1);
}

fs.writeFileSync(file, `-- ${raw}\n--\n-- Yeni tablo eklerken RLS'i bu migration içinde açıp politikalarını da yazın.\n`);
console.log(`✓ ${path.relative(root, file)}`);
if (version !== stamp(new Date(now))) {
  console.log(`  Sürüm şu andan değil son migration'dan (${last}) türetildi; sıralama korunsun diye.`);
}
