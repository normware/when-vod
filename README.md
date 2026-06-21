# when-vod

Fast static GitHub Pages site for current VOD movie releases, generated from TMDB data and hosted at `when-vod.normware.org`.

![Latest desktop screenshot](docs/screenshots/home.png)

## What It Does

`when-vod` fetches previous, current, and next month digital movie releases from TMDB during the build/update step. The deployed site reads small static JSON files from `docs/data`, groups movies by release date, and renders a monospaced, keyboard-friendly interface with local-only bookmarks.

No cookies. No tracking. Bookmarks are stored only in `localStorage` in the visitor's browser.

## Local Setup

Requires Node.js 20 or newer.

```sh
npm install
cp .env.example .env
```

Add a TMDB Read Access Token / JWT to `.env`:

```sh
TMDB_READ_ACCESS_TOKEN=your_tmdb_read_access_token_jwt_here
```

Optional settings:

```sh
WATCH_REGION=US
TMDB_LANGUAGE=en-US
TMDB_MAX_PAGES=8
```

## Commands

```sh
npm run build
npm run fetch-data
npm run screenshots
npm run check
npm run dev
```

Recommended local flow:

```sh
npm run build
npm run fetch-data
npm run screenshots
npm run check
npm run dev
```

Then open `http://localhost:4173`.

## TMDB Token Setup

Create a TMDB account, request API access, and use the Read Access Token / JWT from the TMDB API settings. The token is used only by `scripts/fetch-data.js` at build time.

Do not commit `.env` or real tokens. In GitHub, add the token as a repository-level Actions secret named `TMDB_READ_ACCESS_TOKEN`.

TMDB attribution is included in the footer using their required notice:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

See TMDB's official [FAQ](https://developer.themoviedb.org/docs/faq) and [Logos & Attribution](https://www.themoviedb.org/about/logos-attribution) pages for current requirements.

## GitHub Pages Deployment

The deployable static site is built into `docs/`.
See `PUBLISHING.md` for the first-time GitHub, secret, Pages, and DNS setup
checklist.

The workflow in `.github/workflows/pages.yml`:

1. Installs Node dependencies.
2. Builds the static site.
3. Fetches previous/current/next month TMDB data.
4. Generates refreshed screenshots with Playwright.
5. Checks that the deployable `docs/` output has the expected domain, data, screenshots, legal redirects, and no browser-side TMDB API plumbing.
6. Publishes `docs/` to GitHub Pages.
7. Commits generated `docs/data` and `docs/screenshots` changes on scheduled/manual runs.

Configure GitHub Pages to deploy from GitHub Actions.

Required GitHub settings:

- Actions secret: `TMDB_READ_ACCESS_TOKEN`
- Optional Actions variable: `WATCH_REGION`, defaults to `US`
- Optional Actions variable: `TMDB_LANGUAGE`, defaults to `en-US`
- Pages source: GitHub Actions
- Pages custom domain: `when-vod.normware.org`

## Custom Domain

The repository includes `CNAME` and `src/CNAME` with:

```txt
when-vod.normware.org
```

Point the domain's DNS to GitHub Pages according to GitHub's current custom domain documentation.

## Monthly Update Workflow

The scheduled workflow runs once per month and regenerates:

- `docs/data/manifest.json`
- `docs/data/YYYY-MM.json` for previous, current, and next month
- `docs/screenshots/home.png`
- `docs/screenshots/home-mobile.png`

You can also run it manually from the GitHub Actions tab.

## Screenshot Workflow

Screenshots are created with Playwright by serving the built `docs/` site locally, then capturing desktop and mobile views. The README points at `docs/screenshots/home.png`, so the displayed screenshot updates when the generated screenshot file changes.

Run locally:

```sh
npx playwright install chromium
npm run build
npm run screenshots
```

## Legal And Privacy Notes

The deployable output includes `/datenschutz/` and `/impressum/` redirect pages generated from `src/datenschutz/index.html` and `src/impressum/index.html`. They send visitors to the central legal pages at `https://normware.org/datenschutz` and `https://normware.org/impressum`.

The site itself does not use cookies or analytics. Movie bookmarks are saved via `localStorage` only and never leave the browser. Poster images are loaded from TMDB image URLs, so visitors may make requests to TMDB image servers when posters render.

## Project Shape

```txt
src/                  static source files
src/assets/app.js     small browser app
src/assets/styles.css monospaced UI
scripts/build.js      copies src to docs and creates fallback empty data
scripts/fetch-data.js TMDB fetch and static JSON generation
scripts/screenshots.js Playwright screenshot generation
docs/                 generated GitHub Pages output
```
