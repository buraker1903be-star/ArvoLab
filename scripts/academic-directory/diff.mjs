import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const dataDir = path.join(rootDir, "data", "academic-directory");
const currentPath = path.join(dataDir, "academic_units.csv");
const snapshotPath = path.join(dataDir, "approved_snapshot.csv");
const reportPath = path.join(dataDir, "change-report.json");

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  values.push(value);
  return values;
}

async function readCsv(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() ?? "");

  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function identity(row) {
  return [row.university_name, row.parent_name, row.unit_name]
    .join("|")
    .toLocaleLowerCase("tr-TR");
}

function exactIdentity(row) {
  return [identity(row), row.unit_type]
    .join("|")
    .toLocaleLowerCase("tr-TR");
}

function indexBy(rows, keyFn) {
  return new Map(rows.map((row) => [keyFn(row), row]));
}

async function main() {
  const current = await readCsv(currentPath);
  let previous = [];
  let snapshotMissing = false;

  try {
    previous = await readCsv(snapshotPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    snapshotMissing = true;
  }

  const currentExact = indexBy(current, exactIdentity);
  const previousExact = indexBy(previous, exactIdentity);
  const currentByName = indexBy(current, identity);
  const previousByName = indexBy(previous, identity);

  const added = [...currentExact.entries()]
    .filter(([key]) => !previousExact.has(key))
    .map(([, row]) => row)
    .filter((row) => {
      const oldRow = previousByName.get(identity(row));
      return !oldRow || oldRow.unit_type === row.unit_type;
    });

  const removed = [...previousExact.entries()]
    .filter(([key]) => !currentExact.has(key))
    .map(([, row]) => row)
    .filter((row) => {
      const newRow = currentByName.get(identity(row));
      return !newRow || newRow.unit_type === row.unit_type;
    });

  const typeChanged = [...currentByName.entries()]
    .filter(([key, row]) => {
      const oldRow = previousByName.get(key);
      return oldRow && oldRow.unit_type !== row.unit_type;
    })
    .map(([key, row]) => ({
      university_name: row.university_name,
      parent_name: row.parent_name,
      unit_name: row.unit_name,
      previous_unit_type: previousByName.get(key).unit_type,
      current_unit_type: row.unit_type,
      source_url: row.source_url,
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    snapshotMissing,
    previousCount: previous.length,
    currentCount: current.length,
    addedCount: added.length,
    removedCount: removed.length,
    typeChangedCount: typeChanged.length,
    added,
    removed,
    typeChanged,
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    `Academic directory diff: +${added.length} -${removed.length} ~${typeChanged.length}`
  );

  if (!snapshotMissing && removed.length > 0) {
    console.warn("Removed units require manual review before deactivation.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
