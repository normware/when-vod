const DATA_DIR = "/data";
const STORAGE_KEY = "when-vod:bookmarks";
const today = new Date();
const todayKey = toMonthKey(today);

const app = document.querySelector("[data-app]");
const nav = document.querySelector("[data-nav]");
const todayButton = document.querySelector("[data-today]");
let monthData = null;
let activeFilters = {
  minRating: 0,
  minPopularity: 5,
  eventView: "vod_first"
};

init().catch((error) => {
  renderStatus(`Load error: ${error.message}`);
});

async function init() {
  const page = app?.dataset.page || "static";
  await renderNav(page);
  if (!app) return;

  if (todayButton) {
    todayButton.addEventListener("click", () => scrollToToday());
  }

  if (page === "bookmarks") {
    renderBookmarks();
    return;
  }

  if (page === "home") {
    await renderMonth();
  }
}

async function renderNav(page) {
  const manifest = await getManifest();
  if (!nav || !manifest) return;

  const links = [
    { label: "prev", href: `/?month=${manifest.previous}`, key: manifest.previous },
    { label: "current", href: `/?month=${manifest.current}`, key: manifest.current },
    { label: "next", href: `/?month=${manifest.next}`, key: manifest.next },
    { label: "bookmarks", href: "/bookmarks/", page: "bookmarks" }
  ];

  const selectedMonth = getRequestedMonth(manifest);
  nav.innerHTML = links
    .map((link) => {
      const current = link.page === page || link.key === selectedMonth;
      const aria = current ? ` aria-current="${link.page ? "page" : "date"}"` : "";
      return `<a href="${link.href}"${aria}>${link.label}</a>`;
    })
    .join("");
}

async function renderMonth() {
  const manifest = await getManifest();
  const month = getRequestedMonth(manifest);
  monthData = await fetchJson(`${DATA_DIR}/${month}.json`);
  activeFilters = getInitialFiltersFromUrl();

  document.title = `${monthData.label} VOD releases - when-vod`;
  app.innerHTML = `
    <section class="month-head" aria-labelledby="month-title">
      <div>
        <p class="meta">region:${monthData.region} · source:TMDB · generated:${formatDate(monthData.generatedAt)}</p>
        <h1 id="month-title">${escapeHtml(monthData.label)}</h1>
      </div>
      <p class="meta" data-results-meta>${monthData.movies.length} releases grouped by digital release date</p>
      <p class="meta" data-events-meta></p>
    </section>
    <section class="filters" aria-label="Movie filters">
      <div class="view-mode" role="group" aria-label="Release view mode">
        <button type="button" data-view-mode="vod_first" aria-pressed="${activeFilters.eventView === "vod_first"}">First Digital</button>
        <button type="button" data-view-mode="streaming_only" aria-pressed="${activeFilters.eventView === "streaming_only"}">New on Subscription</button>
        <button type="button" data-view-mode="all_events" aria-pressed="${activeFilters.eventView === "all_events"}">All Events</button>
      </div>
      <label class="filter-item">
        <span>min rating</span>
        <input data-filter-rating type="range" min="0" max="10" step="0.5" value="${activeFilters.minRating}">
        <strong data-filter-rating-label>${activeFilters.minRating.toFixed(1)}</strong>
      </label>
      <label class="filter-item">
        <span>min popularity</span>
        <input data-filter-popularity type="range" min="0" max="${computePopularityMax(monthData.movies)}" step="5" value="${activeFilters.minPopularity}">
        <strong data-filter-popularity-label>${activeFilters.minPopularity}</strong>
      </label>
      <button class="filter-reset" type="button" data-filter-reset>reset</button>
    </section>
    <div data-release-list></div>
  `;

  wireFilters();
  renderFilteredMonth();
}

function renderFilteredMonth() {
  if (!monthData) return;
  const target = app.querySelector("[data-release-list]");
  const info = app.querySelector("[data-results-meta]");
  const eventsInfo = app.querySelector("[data-events-meta]");
  const filtered = monthData.movies.filter((movie) => {
    const rating = Number(movie.voteAverage || 0);
    const popularity = Number(movie.popularity || 0);
    const visibleEvents = getVisibleEvents(movie);
    return rating >= activeFilters.minRating && popularity >= activeFilters.minPopularity && visibleEvents.length > 0;
  });
  const eventCount = filtered.reduce((sum, movie) => sum + getVisibleEvents(movie).length, 0);
  const normalized = filtered.map((movie) => normalizeMovieForView(movie));
  const groups = groupMoviesByDate(normalized);
  if (info) info.textContent = `${filtered.length} of ${monthData.movies.length} movies shown by current event filters`;
  if (eventsInfo) eventsInfo.textContent = `Events this month: ${eventCount}`;
  if (!groups.length) {
    target.innerHTML = renderEmptyState();
    wireEmptyStateActions();
    return;
  }
  target.innerHTML = groups.map(renderDateGroup).join("");
  wireBookmarkButtons();
}

function wireFilters() {
  const modeButtons = [...app.querySelectorAll("[data-view-mode]")];
  const rating = app.querySelector("[data-filter-rating]");
  const popularity = app.querySelector("[data-filter-popularity]");
  const ratingLabel = app.querySelector("[data-filter-rating-label]");
  const popularityLabel = app.querySelector("[data-filter-popularity-label]");
  const reset = app.querySelector("[data-filter-reset]");
  if (!modeButtons.length || !rating || !popularity || !ratingLabel || !popularityLabel || !reset) return;

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilters.eventView = button.dataset.viewMode || "vod_first";
      modeButtons.forEach((candidate) =>
        candidate.setAttribute("aria-pressed", String(candidate.dataset.viewMode === activeFilters.eventView))
      );
      syncFiltersToUrl();
      renderFilteredMonth();
    });
  });

  rating.addEventListener("input", () => {
    activeFilters.minRating = Number(rating.value);
    ratingLabel.textContent = activeFilters.minRating.toFixed(1);
    syncFiltersToUrl();
    renderFilteredMonth();
  });
  popularity.addEventListener("input", () => {
    activeFilters.minPopularity = Number(popularity.value);
    popularityLabel.textContent = String(activeFilters.minPopularity);
    syncFiltersToUrl();
    renderFilteredMonth();
  });
  reset.addEventListener("click", () => {
    activeFilters = {
      minRating: 0,
      minPopularity: 5,
      eventView: "vod_first"
    };
    modeButtons.forEach((candidate) =>
      candidate.setAttribute("aria-pressed", String(candidate.dataset.viewMode === activeFilters.eventView))
    );
    rating.value = "0";
    popularity.value = "5";
    ratingLabel.textContent = "0.0";
    popularityLabel.textContent = "5";
    syncFiltersToUrl();
    renderFilteredMonth();
  });
}

function renderDateGroup(group) {
  return `
    <section class="date-section" id="date-${group.date}" data-date="${group.date}">
      <div class="date-heading">
        <h2>${formatLongDate(group.date)}</h2>
        <span class="meta">${group.movies.length} ${group.movies.length === 1 ? "title" : "titles"}</span>
      </div>
      <div class="grid">
        ${group.movies.map(renderMovieCard).join("")}
      </div>
    </section>
  `;
}

function renderMovieCard(movie) {
  const saved = isBookmarked(movie.id);
  const poster = movie.posterUrl
    ? `<img class="poster" src="${movie.posterUrl}" alt="" loading="lazy" width="185" height="278">`
    : `<div class="poster poster-fallback" aria-hidden="true">no poster</div>`;
  return `
    <article class="movie-card" data-movie='${escapeAttribute(JSON.stringify(movie))}'>
      ${poster}
      <div class="movie-info">
        <h3>${escapeHtml(movie.title)}</h3>
        <p class="meta">${formatLongDate(movie.releaseDate)}</p>
        ${renderEventMeta(movie)}
        <p class="meta">rating:${formatNumber(movie.voteAverage, 1)}/10 · pop:${formatNumber(movie.popularity, 0)}</p>
      </div>
      <div class="card-actions">
        <a href="${movie.tmdbUrl}" target="_blank" rel="noreferrer">tmdb</a>
        <a href="${movie.letterboxdUrl}" target="_blank" rel="noreferrer">lb</a>
        <button class="bookmark-button" type="button" aria-pressed="${saved}">${saved ? "saved" : "save"}</button>
      </div>
    </article>
  `;
}

function renderEventMeta(movie) {
  const firstLine = `first digital: ${movie.firstDigitalDate || movie.releaseDate}`;
  const firstStreaming = (movie.visibleEvents || []).find((event) => event.kind === "streaming_drop");
  const isLater = movie.firstDigitalDate && movie.firstDigitalDate < movie.releaseDate;
  const parts = [`<p class="meta">${escapeHtml(firstLine)}</p>`];
  if (isLater) parts.push(`<p class="meta">already digital since ${escapeHtml(movie.firstDigitalDate)}</p>`);
  if (firstStreaming) {
    const platform = firstStreaming.note || "platform";
    parts.push(`<p class="meta">new on: ${escapeHtml(platform)} at ${escapeHtml(firstStreaming.date)}</p>`);
  }
  return parts.join("");
}

function renderBookmarks() {
  const movies = Object.values(readBookmarks()).sort((a, b) =>
    `${b.releaseDate}-${b.title}`.localeCompare(`${a.releaseDate}-${a.title}`)
  );
  document.title = "Bookmarks - when-vod";
  app.innerHTML = `
    <section class="month-head" aria-labelledby="bookmarks-title">
      <div>
        <p class="meta">localStorage only · no sync · no cookies</p>
        <h1 id="bookmarks-title">Bookmarks</h1>
      </div>
      <p class="meta">${movies.length} saved ${movies.length === 1 ? "movie" : "movies"}</p>
    </section>
    ${movies.length ? `<div class="grid">${movies.map(renderMovieCard).join("")}</div>` : `<div class="status">No saved movies yet.</div>`}
  `;
  wireBookmarkButtons();
}

function wireBookmarkButtons() {
  document.querySelectorAll(".movie-card").forEach((card) => {
    const movie = JSON.parse(card.dataset.movie);
    const button = card.querySelector(".bookmark-button");
    button.addEventListener("click", () => {
      const saved = toggleBookmark(movie);
      button.setAttribute("aria-pressed", String(saved));
      button.textContent = saved ? "saved" : "save";
      if (app.dataset.page === "bookmarks" && !saved) renderBookmarks();
    });
  });
}

function scrollToToday() {
  const section = document.getElementById(`date-${toDateKey(today)}`);
  if (section) {
    section.scrollIntoView({ block: "start" });
    return;
  }
  window.location.href = `/?month=${todayKey}#date-${toDateKey(today)}`;
}

function readBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function isBookmarked(id) {
  return Boolean(readBookmarks()[id]);
}

function toggleBookmark(movie) {
  const bookmarks = readBookmarks();
  if (bookmarks[movie.id]) {
    delete bookmarks[movie.id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    return false;
  }
  bookmarks[movie.id] = movie;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  return true;
}

async function getManifest() {
  return fetchJson(`${DATA_DIR}/manifest.json`);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function getRequestedMonth(manifest) {
  const requested = new URLSearchParams(window.location.search).get("month");
  return manifest.months.includes(requested) ? requested : manifest.current;
}

function renderStatus(message) {
  if (app) app.innerHTML = `<div class="status">${escapeHtml(message)}</div>`;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(date) {
  return `${toMonthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T12:00:00Z`)
  );
}

function formatNumber(value, digits) {
  return Number(value || 0).toFixed(digits);
}

function groupMoviesByDate(movies) {
  const groups = new Map();
  for (const movie of movies) {
    if (!groups.has(movie.releaseDate)) groups.set(movie.releaseDate, []);
    groups.get(movie.releaseDate).push(movie);
  }
  return [...groups.entries()].map(([date, groupedMovies]) => ({ date, movies: groupedMovies }));
}

function computePopularityMax(movies) {
  const max = movies.reduce((value, movie) => Math.max(value, Number(movie.popularity || 0)), 0);
  return Math.max(100, Math.ceil(max / 10) * 10);
}

function renderEmptyState() {
  if (activeFilters.eventView === "vod_first") {
    return `
      <div class="status">
        <p>No first-digital releases match this filter state.</p>
        <p class="meta">This month currently leans more toward later platform rollouts.</p>
        <div class="empty-actions">
          <button type="button" data-empty-action="streaming_only">Show Subscription Starts</button>
          <button type="button" data-empty-action="all_events">Show All Events</button>
        </div>
      </div>
    `;
  }
  return `<div class="status">No movies match the current filters.</div>`;
}

function wireEmptyStateActions() {
  const actions = [...app.querySelectorAll("[data-empty-action]")];
  actions.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilters.eventView = button.dataset.emptyAction || "vod_first";
      syncFiltersToUrl();
      updateModeButtons();
      renderFilteredMonth();
    });
  });
}

function getVisibleEvents(movie) {
  const events = movie.monthDigitalEvents || [];
  return events.filter((event) => {
    if (activeFilters.eventView === "vod_first") return event.kind === "first_digital";
    if (activeFilters.eventView === "streaming_only") return event.kind === "streaming_drop";
    return event.kind === "first_digital" || event.kind === "streaming_drop" || event.kind === "followup_digital";
  });
}

function normalizeMovieForView(movie) {
  const visibleEvents = getVisibleEvents(movie);
  const releaseDate = visibleEvents.length ? visibleEvents.map((event) => event.date).sort()[0] : movie.releaseDate;
  return { ...movie, releaseDate, visibleEvents };
}

function getInitialFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const eventView = params.get("eventView");
  return {
    minRating: parseNumberParam(params.get("minRating"), 0),
    minPopularity: parseNumberParam(params.get("minPopularity"), 5),
    eventView: eventView === "streaming_only" || eventView === "all_events" ? eventView : "vod_first"
  };
}

function syncFiltersToUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.set("minRating", String(activeFilters.minRating));
  params.set("minPopularity", String(activeFilters.minPopularity));
  params.set("eventView", activeFilters.eventView);
  history.replaceState({}, "", `${url.pathname}?${params.toString()}${url.hash}`);
}

function updateModeButtons() {
  [...app.querySelectorAll("[data-view-mode]")].forEach((candidate) => {
    candidate.setAttribute("aria-pressed", String(candidate.dataset.viewMode === activeFilters.eventView));
  });
}

function parseNumberParam(value, fallback) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
