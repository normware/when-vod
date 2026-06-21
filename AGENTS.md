# AGENTS.md

## Architecture

This is a small static site. Source files live in `src/`; GitHub Pages output lives in `docs/`.

The browser app is vanilla JavaScript in `src/assets/app.js`. It loads generated JSON from `/data`, renders month pages, groups releases by date, and manages bookmarks with `localStorage`.

## Build And Update Flow

Use this order for a full refresh:

```sh
npm run build
npm run fetch-data
npm run screenshots
```

`npm run build` copies `src/` to `docs/` and creates fallback empty data if no generated data exists yet. `npm run fetch-data` replaces `docs/data` JSON with real TMDB data. `npm run screenshots` serves `docs/` locally and writes screenshots to `docs/screenshots`.

## API Fetching

All TMDB API access happens in `scripts/fetch-data.js`. The deployed browser code must never call TMDB APIs with a token.

Required secret:

```sh
TMDB_READ_ACCESS_TOKEN
```

Optional environment variables:

```sh
WATCH_REGION
TMDB_LANGUAGE
TMDB_MAX_PAGES
```

Never commit real secrets.

## Generated Data

Generated data lives in:

```txt
docs/data/manifest.json
docs/data/YYYY-MM.json
```

The site expects previous, current, and next month entries in `manifest.json`.

## Bookmarks

Bookmarks use `localStorage` under the key `when-vod:bookmarks`. There are no cookies, accounts, sync, tracking pixels, or server writes. Keep it that way.

## Coding Style

Keep dependencies minimal. Prefer vanilla HTML/CSS/JS and readable functions. Preserve the monospaced, fast, low-JS design. Add comments only where future extension would be unclear.

Use accessible HTML, real links/buttons, visible focus states, and keyboard-friendly controls.

## Legal Pages

Legal links are:

```txt
/datenschutz
/impressum
```

Their source files are `src/datenschutz/index.html` and `src/impressum/index.html`. These pages are static redirects to the central `https://normware.org/datenschutz` and `https://normware.org/impressum` pages.

## Performance Goals

The deployed page should load fast from static files:

- no client-side API token
- no framework runtime
- small CSS and JS
- lazy-loaded posters
- generated JSON instead of live API calls

## TMDB Attribution

Keep TMDB attribution visible in the footer and preserve the required notice:

```txt
This product uses the TMDB API but is not endorsed or certified by TMDB.
```
