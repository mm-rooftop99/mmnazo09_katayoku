const DATA_URL = "./data.tsv";
const CORRECT_ANSWER = "めいりょう";
const POST_TEXT = `片翼をクリアしました！
#mmの謎解き #片翼_mm謎
https://mm-rooftop99.github.io/mmnazo09_katayoku/`;

const state = {
  articles: [],
  filteredArticles: [],
  statusFilter: "",
  favoriteFilter: "",
  pendingTagFilter: ""
};

const searchForm = document.getElementById("searchForm");
const resetButton = document.getElementById("resetButton");
const articleList = document.getElementById("articleList");
const resultCount = document.getElementById("resultCount");
const publicMetaButton = document.getElementById("publicMetaButton");
const nazoMetaButton = document.getElementById("nazoMetaButton");
const activeFilters = document.getElementById("activeFilters");
const introOverlay = document.getElementById("introOverlay");
const introCloseButton = document.getElementById("introCloseButton");
const introFavoriteButton = document.getElementById("introFavoriteButton");
const answerForm = document.getElementById("answerForm");
const answerInput = document.getElementById("answerInput");
const answerMessage = document.getElementById("answerMessage");
const clearOverlay = document.getElementById("clearOverlay");
const clearCloseButton = document.getElementById("clearCloseButton");
const postButton = document.getElementById("postButton");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (!setupPageMode()) return;
  setupIntroModal();
  setupAnswerForm();
  setupToggleableRadios();
  setupPublicMetaFilter();
  setupNazoMetaSelector();
  setupIntroFavoriteFilter();

  try {
    state.articles = await loadArticles();
    applySearch();
  } catch (error) {
    console.error(error);
    state.articles = [];
    resultCount.textContent = "0件中 0件を表示";
    articleList.innerHTML = "";
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch();
  });

  resetButton.addEventListener("click", () => {
    searchForm.reset();
    document.querySelector('input[name="dateOrder"][value="old"]').checked = true;
    document.querySelector('input[name="limit"][value="5"]').checked = true;
    state.statusFilter = "";
    state.favoriteFilter = "";
    state.pendingTagFilter = "";
    publicMetaButton.classList.remove("is-active");
    nazoMetaButton.classList.remove("is-active");
    introFavoriteButton.classList.remove("is-active");
    applySearch();
  });
}

function setupPageMode() {
  const params = new URLSearchParams(window.location.search);

  if (!params.has("add")) {
    params.set("add", "frame");
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.location.replace(nextUrl);
    return false;
  }

  const add = params.get("add");

  document.body.classList.toggle("mode-form", add === "form");
  document.body.classList.toggle("mode-frame", add !== "form");
  return true;
}

function setupAnswerForm() {
  if (!answerForm) return;

  postButton.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(POST_TEXT)}`;

  clearCloseButton.addEventListener("click", () => {
    clearOverlay.classList.add("is-hidden");
  });

  answerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const answer = normalizeAnswer(answerInput.value);

    if (answer === CORRECT_ANSWER) {
      answerMessage.textContent = "";
      answerInput.blur();
      clearOverlay.classList.remove("is-hidden");
      return;
    }

    answerMessage.textContent = "不正解です。";
  });
}

function normalizeAnswer(value) {
  return value
    .trim()
    .replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[ぁ-ん]/g, (char) => char)
    .replace(/\s+/g, "");
}

function setupIntroModal() {
  introCloseButton.addEventListener("click", () => {
    introOverlay.classList.add("is-hidden");
  });
}

function setupToggleableRadios() {
  const radios = document.querySelectorAll('input[type="radio"]');

  radios.forEach((radio) => {
    radio.addEventListener("pointerdown", () => {
      radio.dataset.wasChecked = radio.checked ? "true" : "false";
    });

    radio.addEventListener("click", () => {
      if (radio.dataset.wasChecked === "true") {
        radio.checked = false;
        radio.dataset.wasChecked = "false";
      }

      if (radio.name === "tag") {
        if (radio.checked) {
          state.pendingTagFilter = radio.value;
          nazoMetaButton.classList.remove("is-active");
        } else {
          state.pendingTagFilter = "";
        }
      }
    });
  });
}

function setupPublicMetaFilter() {
  publicMetaButton.addEventListener("click", () => {
    if (state.statusFilter === "公開") {
      state.statusFilter = "";
      publicMetaButton.classList.remove("is-active");
    } else {
      state.statusFilter = "公開";
      publicMetaButton.classList.add("is-active");
    }

    applySearch();
  });
}

function setupNazoMetaSelector() {
  nazoMetaButton.addEventListener("click", () => {
    const tagRadios = document.querySelectorAll('input[name="tag"]');

    if (state.pendingTagFilter === "謎解き") {
      state.pendingTagFilter = "";
      nazoMetaButton.classList.remove("is-active");
    } else {
      state.pendingTagFilter = "謎解き";
      nazoMetaButton.classList.add("is-active");
      tagRadios.forEach((radio) => {
        radio.checked = false;
        radio.dataset.wasChecked = "false";
      });
    }
  });
}

function setupIntroFavoriteFilter() {
  introFavoriteButton.addEventListener("click", () => {
    if (state.favoriteFilter === "お気に入り") {
      state.favoriteFilter = "";
      introFavoriteButton.classList.remove("is-active");
    } else {
      state.favoriteFilter = "お気に入り";
      state.statusFilter = "";
      state.pendingTagFilter = "";

      introFavoriteButton.classList.add("is-active");
      publicMetaButton.classList.remove("is-active");
      nazoMetaButton.classList.remove("is-active");

      document.querySelectorAll('input[name="tag"]').forEach((radio) => {
        radio.checked = false;
        radio.dataset.wasChecked = "false";
      });
    }

    applySearch();
  });
}

async function loadArticles() {
  const response = await fetch(DATA_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("data.tsvの読み込みに失敗しました。");
  }

  const text = await response.text();
  return parseTsv(text);
}

function parseTsv(tsvText) {
  const lines = tsvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length <= 1) {
    return [];
  }

  const headers = lines[0].split("\t").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split("\t");

    const article = {};
    headers.forEach((header, index) => {
      article[header] = values[index] ? values[index].trim() : "";
    });

    return article;
  });
}

function applySearch() {
  const selectedDateOrder = getSelectedValue("dateOrder") || "old";
  const limit = Number(getSelectedValue("limit") || 5);

  let results = [...state.articles];

  if (state.pendingTagFilter) {
    results = results.filter((article) => article["タグ"] === state.pendingTagFilter);
  }

  if (state.statusFilter) {
    results = results.filter((article) => article["ステータス"] === state.statusFilter);
  }

  if (state.favoriteFilter) {
    results = results.filter((article) => article["ステータス2"] === state.favoriteFilter);
  }

  const canShowFavoriteNormally =
    state.favoriteFilter === "お気に入り" ||
    (state.pendingTagFilter === "謎解き" && state.statusFilter === "公開");

  if (!canShowFavoriteNormally) {
    results = results.filter((article) => article["ステータス2"] !== "お気に入り");
  }

  results.sort((a, b) => {
    const dateA = new Date(a["日付"]);
    const dateB = new Date(b["日付"]);

    if (selectedDateOrder === "new") {
      return dateB - dateA;
    }

    return dateA - dateB;
  });

  state.filteredArticles = results;

  syncFavoriteFilterButtons();
  renderActiveFilters();
  renderArticles(results.slice(0, limit), results.length, limit);
}

function getSelectedValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function syncFavoriteFilterButtons() {
  if (state.favoriteFilter === "お気に入り") {
    introFavoriteButton.classList.add("is-active");
  } else {
    introFavoriteButton.classList.remove("is-active");
  }
}

function renderActiveFilters() {
  activeFilters.innerHTML = "";

  if (state.favoriteFilter === "お気に入り") {
    const chip = document.createElement("span");
    chip.className = "active-filter-chip";
    chip.textContent = "お気に入り";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "active-filter-remove";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      state.favoriteFilter = "";
      applySearch();
    });

    chip.appendChild(removeButton);
    activeFilters.appendChild(chip);
  }
}

function activateFavoriteFilter() {
  if (state.favoriteFilter === "お気に入り") {
    state.favoriteFilter = "";
  } else {
    state.favoriteFilter = "お気に入り";
    state.statusFilter = "";
    state.pendingTagFilter = "";

    publicMetaButton.classList.remove("is-active");
    nazoMetaButton.classList.remove("is-active");

    document.querySelectorAll('input[name="tag"]').forEach((radio) => {
      radio.checked = false;
      radio.dataset.wasChecked = "false";
    });
  }

  applySearch();
}

function renderArticles(articles, totalCount, limit) {
  articleList.innerHTML = "";

  resultCount.textContent = `${totalCount}件中 ${Math.min(totalCount, limit)}件を表示`;

  if (articles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "条件に合う記事は見つかりませんでした。";
    articleList.appendChild(empty);
    return;
  }

  articles.forEach((article) => {
    const item = document.createElement("article");
    const isFavorite = article["ステータス2"] === "お気に入り";
    item.className = isFavorite ? "article is-favorite" : "article";

    const title = document.createElement("h3");
    title.className = "article-title";
    title.textContent = article["記事タイトル"];

    const meta = document.createElement("div");
    meta.className = "article-meta";

    const date = document.createElement("span");
    date.textContent = article["日付"];

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = article["タグ"];

    meta.appendChild(date);
    meta.appendChild(tag);

    if (isFavorite) {
      const favoriteBadge = document.createElement("button");
      favoriteBadge.type = "button";
      favoriteBadge.className = state.favoriteFilter === "お気に入り" ? "favorite-badge is-active" : "favorite-badge";
      favoriteBadge.textContent = "お気に入り";
      favoriteBadge.addEventListener("click", activateFavoriteFilter);

      meta.appendChild(favoriteBadge);
    }

    const main = document.createElement("div");
    main.className = "article-main";

    const body = document.createElement("p");
    body.className = "article-body";
    body.textContent = makeExcerpt(article["本文"], 20);

    main.appendChild(body);

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(main);

    articleList.appendChild(item);
  });
}

function makeExcerpt(text, maxLength) {
  if (!text) return "";

  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength) + "…";
}