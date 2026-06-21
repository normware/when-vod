import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const docs = join(root, "docs");
const expectedDomain = "when-vod.normware.org";
const expectedLegal = {
  "docs/impressum/index.html": "https://normware.org/impressum",
  "docs/datenschutz/index.html": "https://normware.org/datenschutz"
};
const requiredFiles = [
  "docs/.nojekyll",
  "docs/CNAME",
  "docs/index.html",
  "docs/bookmarks/index.html",
  "docs/assets/app.js",
  "docs/assets/styles.css",
  "docs/data/manifest.json",
  "docs/screenshots/home.png",
  "docs/screenshots/home-mobile.png",
  ...Object.keys(expectedLegal)
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`missing ${file}`);
}

if (existsSync(join(docs, "CNAME"))) {
  const cname = read("docs/CNAME").trim();
  if (cname !== expectedDomain) failures.push(`docs/CNAME is ${JSON.stringify(cname)}, expected ${expectedDomain}`);
}

if (existsSync(join(docs, "data", "manifest.json"))) {
  const manifest = JSON.parse(read("docs/data/manifest.json"));
  const expectedMonths = relativeMonthKeys(new Date(), [-1, 0, 1]);
  for (const month of expectedMonths) {
    if (!manifest.months?.includes(month)) failures.push(`manifest missing month ${month}`);
    if (!existsSync(join(docs, "data", `${month}.json`))) failures.push(`missing docs/data/${month}.json`);
  }
  if (manifest.previous !== expectedMonths[0]) failures.push(`manifest.previous is ${manifest.previous}, expected ${expectedMonths[0]}`);
  if (manifest.current !== expectedMonths[1]) failures.push(`manifest.current is ${manifest.current}, expected ${expectedMonths[1]}`);
  if (manifest.next !== expectedMonths[2]) failures.push(`manifest.next is ${manifest.next}, expected ${expectedMonths[2]}`);
}

for (const [file, target] of Object.entries(expectedLegal)) {
  if (!existsSync(join(root, file))) continue;
  const html = read(file);
  if (!html.includes(`url=${target}`)) failures.push(`${file} meta refresh does not target ${target}`);
  if (!html.includes(`window.location.replace("${target}")`)) failures.push(`${file} script redirect does not target ${target}`);
  if (!html.includes(`<link rel="canonical" href="${target}">`)) failures.push(`${file} canonical link does not target ${target}`);
}

const docsApp = existsSync(join(docs, "assets", "app.js")) ? read("docs/assets/app.js") : "";
if (docsApp.includes("TMDB_READ_ACCESS_TOKEN") || docsApp.includes("api.themoviedb.org/3")) {
  failures.push("browser app appears to include TMDB API token plumbing");
}

if (failures.length) {
  console.error("Publish check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Publish check passed.");

function read(file) {
  return readFileSync(join(root, file), "utf8");
}

function relativeMonthKeys(date, offsets) {
  return offsets.map((offset) => {
    const candidate = new Date(date.getFullYear(), date.getMonth() + offset, 1);
    return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}`;
  });
}
