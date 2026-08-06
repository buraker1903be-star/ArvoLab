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
const reportPath = path.join(dataDir, "snapshot-approval.json");

async function main() {
  const current = await fs.readFile(currentPath, "utf8");
  const rowCount = Math.max(0, current.split(/\r?\n/).filter(Boolean).length - 1);

  if (rowCount === 0) {
    throw new Error("Current academic directory is empty; snapshot approval aborted.");
  }

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(snapshotPath, current, "utf8");
  await fs.writeFile(
    reportPath,
    `${JSON.stringify(
      {
        approvedAt: new Date().toISOString(),
        rowCount,
        source: "academic_units.csv",
        snapshot: "approved_snapshot.csv"
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`Approved academic directory snapshot with ${rowCount} rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
