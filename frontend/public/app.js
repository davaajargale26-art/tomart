const state = {
  categories: [],
  articles: [],
  activeCategory: "all",
  query: "",
  view: "home",
};

const app = document.querySelector("#app");
const homeTemplate = document.querySelector("#homeTemplate");
const categoryNav = document.querySelector("#categoryNav");
const headerSearchForm = document.querySelector("#headerSearchForm");
const headerSearchInput = document.querySelector("#headerSearchInput");
const showAddArticle = document.querySelector("#showAddArticle");

let articleGrid;
let statusText;
let articleForm;
let articleCategory;
let formStatus;

function formatDate(value) {
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function mountHome() {
  state.view = "home";
  app.innerHTML = homeTemplate.innerHTML;

  articleGrid = document.querySelector("#articleGrid");
  statusText = document.querySelector("#status");
  articleForm = document.querySelector("#articleForm");
  articleCategory = document.querySelector("#articleCategory");
  formStatus = document.querySelector("#formStatus");

  renderCategorySelect();
  bindArticleForm();
  renderArticles();
}

function renderCategories() {
  const buttons = [
    `<button class="${state.activeCategory === "all" ? "is-active" : ""}" data-category="all">Бүгд</button>`,
    ...state.categories.map(
      (category) =>
        `<button class="${state.activeCategory === category.slug ? "is-active" : ""}" data-category="${category.slug}">
          ${escapeHtml(category.name)}
        </button>`
    ),
  ];

  categoryNav.innerHTML = buttons.join("");

  categoryNav.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.dataset.category;
      state.query = "";
      headerSearchInput.value = "";
      renderCategories();
      loadArticles({ scrollNews: true });
    });
  });
}

function renderCategorySelect() {
  if (!articleCategory) return;

  articleCategory.innerHTML = state.categories
    .map((category) => `<option value="${category.slug}">${escapeHtml(category.name)}</option>`)
    .join("");
}

async function loadCategories() {
  state.categories = await fetchJson("/api/categories");
  renderCategories();
  renderCategorySelect();
}

async function loadArticles({ openSingle = false, scrollNews = false } = {}) {
  if (state.view !== "home") mountHome();

  const params = new URLSearchParams();
  if (state.activeCategory !== "all") params.set("category", state.activeCategory);
  if (state.query) params.set("q", state.query);

  statusText.textContent = "Loading articles...";

  try {
    state.articles = await fetchJson(`/api/articles?${params.toString()}`);
    statusText.textContent = state.articles.length ? "" : "No articles found.";

    if (openSingle && state.articles.length === 1) {
      openArticle(state.articles[0].slug);
      return;
    }

    renderArticles();

    if (scrollNews) {
      document.querySelector("#news").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    statusText.textContent = error.message || "Could not load articles. Check backend and MySQL.";
  }
}

function renderArticles() {
  if (!articleGrid) return;

  articleGrid.innerHTML = state.articles
    .map(
      (article) => `
        <article class="post-card" tabindex="0" data-slug="${article.slug}">
          <img src="${article.imageUrl || "/images/stagknight.jpg"}" alt="${escapeHtml(article.title)}" />
          <div class="post-overlay">
            <span>${escapeHtml(article.category.name)} / ${escapeHtml(article.author)}</span>
            <h3>${escapeHtml(article.title)}</h3>
            <small>${formatDate(article.publishedAt)}</small>
          </div>
        </article>
      `
    )
    .join("");

  articleGrid.querySelectorAll("[data-slug]").forEach((card) => {
    card.addEventListener("click", () => openArticle(card.dataset.slug));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openArticle(card.dataset.slug);
    });
  });
}

async function openArticle(slug) {
  const article = await fetchJson(`/api/articles/${slug}`);
  state.view = "article";

  app.innerHTML = `
    <section class="article-detail">
      <button class="back-link" type="button" id="backToNews">← Back</button>
      <div class="detail-layout">
        <div class="detail-image">
          <img src="${article.imageUrl || "/images/stagknight.jpg"}" alt="${escapeHtml(article.title)}" />
        </div>
        <article class="detail-copy">
          <span>${escapeHtml(article.category.name)} · ${escapeHtml(article.author)} · ${formatDate(article.publishedAt)}</span>
          <h1>${escapeHtml(article.title)}</h1>
          <p class="excerpt">${escapeHtml(article.excerpt)}</p>
          <p>${escapeHtml(article.body)}</p>
        </article>
      </div>
    </section>
  `;

  document.querySelector("#backToNews").addEventListener("click", () => {
    mountHome();
    loadArticles({ scrollNews: true });
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindArticleForm() {
  if (!articleForm) return;

  articleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    formStatus.textContent = "Saving...";

    const payload = Object.fromEntries(new FormData(articleForm).entries());

    try {
      const article = await fetchJson("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      articleForm.reset();
      formStatus.textContent = "Saved.";
      state.activeCategory = "all";
      state.query = "";
      headerSearchInput.value = "";
      renderCategories();
      await loadArticles();
      openArticle(article.slug);
    } catch (error) {
      formStatus.textContent = error.message || "Could not save article.";
    }
  });
}

headerSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = headerSearchInput.value.trim();
  loadArticles({ openSingle: true, scrollNews: true });
});

showAddArticle.addEventListener("click", (event) => {
  event.preventDefault();
  if (state.view !== "home") mountHome();
  document.querySelector("#addArticle").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => document.querySelector('[name="title"]').focus(), 350);
});

document.querySelector("#backTop").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

mountHome();
Promise.all([loadCategories(), loadArticles()]);
