import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const sourcePath = path.join(__dirname, "sources.json");
const outputDir = path.join(rootDir, "data", "academic-directory");

const TYPE_RULES = [
  ["vocational_school", /meslek\s+y[uü]ksekokulu$/iu],
  ["conservatory", /konservatuvar[ıi]$/iu],
  ["faculty", /fak[uü]ltesi$/iu],
  ["institute", /enstit[uü]s[uü]$/iu],
  ["school", /y[uü]ksekokulu$/iu],
  ["department", /b[oö]l[uü]m[uü]$/iu],
  ["division", /ana\s*bilim\s*dal[ıi]$/iu],
  ["program", /program[ıi]$/iu],
];

const GLOBAL_EXCLUSIONS = [
  /^(fak[uü]lteler|enstit[uü]ler|y[uü]ksekokullar|b[oö]l[uü]mler)$/iu,
  /^(akademik birimler|academic units)$/iu,
  /^(ileti[sş]im|ana sayfa|hakkımızda)$/iu,
];

function decodeHtml(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, key) => named[key.toLowerCase()] ?? match);
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  )
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeName(value, replacements = []) {
  let normalized = value
    .replace(/^[\s•·▪◦\-–—:;|]+/u, "")
    .replace(/[\s•·▪◦\-–—:;|]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const replacement of replacements) {
    normalized = normalized.replace(new RegExp(replacement.pattern, replacement.flags ?? "giu"), replacement.value ?? "");
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function matchesConfiguredPattern(value, patterns = []) {
  return patterns.some((item) => new RegExp(item.pattern ?? item, item.flags ?? "iu").test(value));
}

function classify(line, parser = {}) {
  const normalized = normalizeName(line, parser.replacements ?? []);
  if (normalized.length < 4 || normalized.length > (parser.maxNameLength ?? 180)) return null;
  if (GLOBAL_EXCLUSIONS.some((pattern) => pattern.test(normalized))) return null;
  if (matchesConfiguredPattern(normalized, parser.excludePatterns ?? [])) return null;
  if ((parser.includePatterns?.length ?? 0) > 0 && !matchesConfiguredPattern(normalized, parser.includePatterns)) return null;

  for (const [unitType, pattern] of TYPE_RULES) {
    if (parser.includeTypes?.length && !parser.includeTypes.includes(unitType)) continue;
    if (parser.excludeTypes?.includes(unitType)) continue;
    if (pattern.test(normalized)) return { unitName: normalized, unitType };
  }

  return null;
}

function assertOfficialUrl(rawUrl, officialDomains) {
  const url = new URL(rawUrl);
  const allowed = officialDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  if (!allowed) throw new Error(`Official-domain check failed for ${rawUrl}`);
  return url;
}

async function fetchPage(url, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "ArvoLabAcademicDirectoryBot/1.1 (+research-data-maintenance)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sqlLiteral(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function deduplicate(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = [row.universityName, row.parentName ?? "", row.unitName, row.unitType]
      .join("|")
      .toLocaleLowerCase("tr-TR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarize(rows, sources) {
  const summary = {};
  for (const source of sources) {
    summary[source.universityName] = { total: 0, byType: {}, pageCount: source.pages.length };
  }
  for (const row of rows) {
    const entry = summary[row.universityName] ??= { total: 0, byType: {}, pageCount: 0 };
    entry.total += 1;
    entry.byType[row.unitType] = (entry.byType[row.unitType] ?? 0) + 1;
  }
  return summary;
}

async function main() {
  const sources = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const rows = [];
  const failures = [];
  const warnings = [];

  for (const source of sources) {
    for (const rawUrl of source.pages) {
      try {
        assertOfficialUrl(rawUrl, source.officialDomains);
        const html = await fetchPage(rawUrl, source.timeoutMs ?? 20_000);
        const text = htmlToText(html);
        let pageRowCount = 0;

        for (const line of text.split("\n")) {
          const match = classify(line, source.parser ?? {});
          if (!match) continue;
          rows.push({
            universityName: source.universityName,
            parentName: null,
            unitName: match.unitName,
            unitType: match.unitType,
            sourceUrl: rawUrl,
          });
          pageRowCount += 1;
        }

        if (pageRowCount === 0) {
          warnings.push({ universityName: source.universityName, sourceUrl: rawUrl, warning: "No academic units extracted" });
        }
      } catch (error) {
        failures.push({
          universityName: source.universityName,
          sourceUrl: rawUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const uniqueRows = deduplicate(rows).sort((a, b) =>
    `${a.universityName}|${a.unitType}|${a.unitName}`.localeCompare(
      `${b.universityName}|${b.unitType}|${b.unitName}`,
      "tr"
    )
  );

  await fs.mkdir(outputDir, { recursive: true });

  const csvHeader = ["university_name", "parent_name", "unit_name", "unit_type", "source_url"];
  const csv = [
    csvHeader.join(","),
    ...uniqueRows.map((row) =>
      [row.universityName, row.parentName, row.unitName, row.unitType, row.sourceUrl].map(csvEscape).join(",")
    ),
  ].join("\n");

  const values = uniqueRows
    .map((row) =>
      `  (${sqlLiteral(row.universityName)}, ${sqlLiteral(row.parentName)}, ${sqlLiteral(row.unitName)}, ${sqlLiteral(row.unitType)}, ${sqlLiteral(row.sourceUrl)})`
    )
    .join(",\n");

  const sql = `-- Generated by scripts/academic-directory/crawl.mjs\n` +
    `insert into public.academic_unit_import_staging\n` +
    `  (university_name, parent_name, unit_name, unit_type, source_url)\n` +
    `values\n${values || "  -- no rows extracted"}\n` +
    `${values ? "on conflict do nothing;\n\nselect * from public.import_academic_units();\n" : ""}`;

  const report = {
    generatedAt: new Date().toISOString(),
    sourceCount: sources.length,
    rowCount: uniqueRows.length,
    failureCount: failures.length,
    warningCount: warnings.length,
    summary: summarize(uniqueRows, sources),
    warnings,
    failures,
  };

  await Promise.all([
    fs.writeFile(path.join(outputDir, "academic_units.csv"), `${csv}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "academic_units.sql"), sql, "utf8"),
    fs.writeFile(path.join(outputDir, "crawl-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  ]);

  console.log(`Generated ${uniqueRows.length} unique academic-unit rows.`);
  if (warnings.length > 0) console.warn(`${warnings.length} source pages produced warnings.`);
  if (failures.length > 0) {
    console.warn(`${failures.length} source pages failed. See crawl-report.json.`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
