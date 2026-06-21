import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnv(join(root, ".env"));

const token = process.env.TMDB_READ_ACCESS_TOKEN;
const region = process.env.WATCH_REGION || "US";
const language = process.env.TMDB_LANGUAGE || "en-US";
const maxPages = Number(process.env.TMDB_MAX_PAGES || 8);
const maxMovieAgeMonths = Number(process.env.TMDB_MAX_MOVIE_AGE_MONTHS || 24);
const streamingPlatforms = [
  "disney+",
  "netflix",
  "hulu",
  "hbo max",
  "max",
  "prime video",
  "starz",
  "shudder",
  "amc+",
  "youtube",
  "paramount+",
  "apple tv+",
  "peacock"
];
const dataDir = join(root, "docs", "data");

if (!token) {
  console.error("Missing TMDB_READ_ACCESS_TOKEN. Copy .env.example to .env or set a GitHub Actions secret.");
  process.exit(1);
}

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

for (const month of months) {
  const payload = await fetchMonth(month);
  writeJson(join(dataDir, `${month}.json`), payload);
  console.log(`${month}: ${payload.movies.length} movies`);
}

writeJson(join(dataDir, "manifest.json"), manifest);

async function fetchMonth(month) {
  const [start, end] = monthBounds(month);
  const discovered = [];
  let totalPages = 1;

  for (let page = 1; page <= Math.min(totalPages, maxPages); page += 1) {
    const data = await tmdb("/discover/movie", {
      include_adult: "false",
      include_video: "false",
      language,
      page: String(page),
      region,
      sort_by: "primary_release_date.asc",
      "release_date.gte": start,
      "release_date.lte": end,
      with_release_type: "4"
    });
    totalPages = data.total_pages || 1;
    discovered.push(...(data.results || []));
  }

  const unique = [...new Map(discovered.map((movie) => [movie.id, movie])).values()];
  const movies = [];

  for (const movie of unique) {
    const details = await tmdb(`/movie/${movie.id}`, {
      append_to_response: "release_dates,watch/providers",
      language
    });
    const eventInfo = classifyDigitalEvents(details, region, start, end);
    if (!eventInfo.monthDigitalEvents.length) continue;
    if (!isRecentByPrimaryRelease(details.release_date, start, maxMovieAgeMonths)) continue;

    movies.push(normalizeMovie(details, eventInfo, region));
  }

  movies.sort((a, b) => `${a.releaseDate}-${a.title}`.localeCompare(`${b.releaseDate}-${b.title}`));

  return {
    generatedAt: new Date().toISOString(),
    month,
    label: monthLabel(month),
    region,
    movies,
    groups: groupByDate(movies)
  };
}

async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function normalizeMovie(movie, eventInfo, watchRegion) {
  const providers = movie["watch/providers"]?.results?.[watchRegion] || {};
  // Keep provider info concise: subscription streaming providers only.
  const providerNames = [...(providers.flatrate || [])]
    .map((provider) => provider.provider_name)
    .filter(Boolean);
  return {
    id: movie.id,
    title: movie.title || movie.original_title || "Untitled",
    releaseDate: eventInfo.releaseDate,
    firstDigitalDate: eventInfo.firstDigitalDate,
    monthDigitalEvents: eventInfo.monthDigitalEvents,
    voteAverage: Number(movie.vote_average || 0),
    voteCount: Number(movie.vote_count || 0),
    popularity: Number(movie.popularity || 0),
    posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w185${movie.poster_path}` : "",
    tmdbUrl: `https://www.themoviedb.org/movie/${movie.id}`,
    letterboxdUrl: `https://letterboxd.com/search/${encodeURIComponent(movie.title || movie.original_title || "")}/`,
    providers: [...new Set(providerNames)].slice(0, 6)
  };
}

function classifyDigitalEvents(movie, watchRegion, start, end) {
  const regions = movie.release_dates?.results || [];
  const preferred = regions.find((entry) => entry.iso_3166_1 === watchRegion) || regions.find((entry) => entry.iso_3166_1 === "US");
  const releases = preferred?.release_dates || [];
  const digital = releases
    .filter((release) => release.type === 4 && release.release_date)
    .map((release) => ({
      date: release.release_date.slice(0, 10),
      note: (release.note || "").trim()
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstDigitalDate = digital[0]?.date || "";
  const monthDigitalEvents = digital
    .filter((event) => event.date >= start && event.date <= end)
    .map((event) => ({
      date: event.date,
      note: event.note,
      kind: classifyEventKind(event, firstDigitalDate)
    }));
  const releaseDate = monthDigitalEvents[0]?.date || "";
  return { releaseDate, firstDigitalDate, monthDigitalEvents };
}

function classifyEventKind(event, firstDigitalDate) {
  if (event.date === firstDigitalDate) return "first_digital";
  const note = event.note.toLowerCase();
  if (streamingPlatforms.some((platform) => note.includes(platform))) return "streaming_drop";
  return "followup_digital";
}

function isRecentByPrimaryRelease(primaryReleaseDate, monthStart, maxAgeMonths) {
  if (!primaryReleaseDate) return false;
  const primary = new Date(`${primaryReleaseDate}T12:00:00Z`);
  const month = new Date(`${monthStart}T12:00:00Z`);
  if (Number.isNaN(primary.getTime()) || Number.isNaN(month.getTime())) return false;
  const ageMonths = (month.getUTCFullYear() - primary.getUTCFullYear()) * 12 + (month.getUTCMonth() - primary.getUTCMonth());
  return ageMonths >= 0 && ageMonths <= maxAgeMonths;
}

function groupByDate(movies) {
  const groups = new Map();
  for (const movie of movies) {
    if (!groups.has(movie.releaseDate)) groups.set(movie.releaseDate, []);
    groups.get(movie.releaseDate).push(movie);
  }
  return [...groups.entries()].map(([date, groupedMovies]) => ({ date, movies: groupedMovies }));
}

function monthBounds(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endDate = new Date(Date.UTC(year, monthIndex, 0));
  const end = `${month}-${String(endDate.getUTCDate()).padStart(2, "0")}`;
  return [start, end];
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T12:00:00Z`)
  );
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function loadEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
