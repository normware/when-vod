# Publishing when-vod

Use this folder as the root of the GitHub repository. The workflow assumes
`package.json`, `docs/`, `src/`, `scripts/`, and `.github/` are at repo root.

## One-Time GitHub Setup

Before publishing this project, publish the central `normware.org` legal update
from `../legal/datenschutz.html` so the redirected Datenschutz page includes the
TMDB API and TMDB image-server disclosure.

1. Create a new GitHub repository, for example `normware/when-vod`.
2. Push this folder as the repository root on branch `main`.
3. In the repository settings, go to Pages and set the source to GitHub Actions.
4. In repository secrets, add `TMDB_READ_ACCESS_TOKEN`.
5. Optionally add repository variables:
   - `WATCH_REGION=US`
   - `TMDB_LANGUAGE=en-US`
6. In Pages custom domain settings, set `when-vod.normware.org`.
7. In DNS or Cloudflare, add the `when-vod` subdomain record required for
   GitHub Pages. For a GitHub Pages subdomain, this is normally a `CNAME`
   record pointing at the repository owner's GitHub Pages host.
8. Wait for DNS and certificate provisioning, then enable HTTPS enforcement if
   GitHub does not enable it automatically.

GitHub references:

- Custom workflow publishing: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Custom domains: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages
- Actions secrets: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

## Local Preflight

Run this before the first push and before manual publishing:

```sh
npm install
cp .env.example .env
# Add TMDB_READ_ACCESS_TOKEN to .env.
npm run build
npm run fetch-data
npm run screenshots
npm run check
```

Expected generated output:

- `docs/.nojekyll`
- `docs/CNAME`
- `docs/data/manifest.json`
- `docs/data/YYYY-MM.json` for previous, current, and next month
- `docs/screenshots/home.png`
- `docs/screenshots/home-mobile.png`
- `docs/impressum/index.html`, redirecting to `https://normware.org/impressum`
- `docs/datenschutz/index.html`, redirecting to `https://normware.org/datenschutz`

## Post-Publish Checks

After the GitHub Actions run succeeds:

```sh
curl -I https://when-vod.normware.org
curl -I https://when-vod.normware.org/impressum/
curl -I https://when-vod.normware.org/datenschutz/
```

The legal routes should redirect or resolve through the central
`normware.org` legal pages. `when-vod.normware.org` was added in Cloudflare on
2026-06-23; public resolvers saw the proxied record immediately, while local
resolver caches may take longer to catch up.
