import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "src");
const out = join(root, "docs");

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
ensureFallbackData();

function ensureFallbackData() {
  const dataDir = join(out, "data");
  if (existsSync(join(dataDir, "manifest.json"))) return;

  mkdirSync(dataDir, { recursive: true });
  const now = new Date();
  const months = [-1, 0, 1].map((offset) => monthKey(new Date(now.getFullYear(), now.getMonth() + offset, 1)));
  const manifest = {
    generatedAt: now.toISOString(),
    current: months[1],
    previous: months[0],
    next: months[2],
    months
  };
  writeFileSync(join(dataDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  for (const month of months) {
    const payload = {
      generatedAt: now.toISOString(),
      month,
      label: monthLabel(month),
      region: "US",
      movies: [],
      groups: []
    };
    writeFileSync(join(dataDir, `${month}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  }
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T12:00:00Z`)
  );
}
