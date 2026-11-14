"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  home: "M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10",
  search: "M20 20l-6-6M16 9a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  graph:
    "M12 7v6M6 17l6-4 6 4M15 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0M7 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0M23 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  globe:
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2c-6 5-6 15 0 20 6-5 6-15 0-20",
  db: "M21 6c0 6-18 6-18 0s18-6 18 0M3 6v12c0 6 18 6 18 0V6M3 12c0 6 18 6 18 0",
  archive: "M4 4h16l2 6v11H2V10l2-6M2 10h6l1 4h6l1-4h6",
  settings:
    "m10 2-1 3-3 1-3-1-2 4 2 2v3l-2 2 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-2v-3l2-2-2-4-3 1-3-1-1-3h-4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  arrow: "M3 12h18m-6-6 6 6-6 6",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v7l4 2",
  user: "M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M3 22c0-11 18-11 18 0",
  play: "M5 2v20l16-10L5 2",
  plus: "M12 4v16M4 12h16",
  minus: "M4 12h16",
  fit: "M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5",
  layers: "m2 8 10-6 10 6-10 6L2 8m0 5 10 6 10-6M2 18l10 6 10-6",
  check: "m4 12 5 5L20 5",
};
const icon = (name, cls = "") =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.user}"/></svg>`;
const logo = () =>
  `<div class="wordmark" aria-label="OSINT / 2002"><svg viewBox="0 0 260 34" aria-hidden="true"><path d="M17 3h23c19 0 19 27 0 27H17C-2 30-2 3 17 3ZM111 3H72c-14 0-14 13 0 13h27c15 0 15 14 0 14H58M122 3v27M134 30V3l59 27V3M204 3h54m-27 0v27"/></svg><div class="year">/ 2002</div></div>`;
const state = {
  page: "home",
  history: null,
  historyError: "",
  search: null,
  dns: null,
  busy: { search: false, dns: false },
  error: "",
  query: "",
  domain: "",
  sources: ["GitHub", "GitLab", "Reddit", "Pinterest", "TikTok"],
  selected: ["GitHub", "GitLab", "Reddit", "Pinterest", "TikTok"],
  filter: "all",
  dbTab: "local",
  zoom: 1,
  graphDetail: null,
};
const native = () => typeof window.NativeOSINT !== "undefined";
const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, v) {
    try {
      localStorage.setItem(key, v);
    } catch {}
  },
};
document.documentElement.classList.toggle(
  "reduced-motion",
  storage.get("reduced-motion") === "true",
);
const banner = (title, subtitle, img = "") =>
  `<div class="page-banner" data-image="${img}"><h1>${title}</h1><p class="eyebrow">/ ${subtitle}</p></div>`;
const strip = () => '<div class="photo-strip" aria-hidden="true"></div>';
const notice = (s, error = false) =>
  `<div class="notice${error ? " error" : ""}" role="${error ? "alert" : "status"}">${esc(s)}</div>`;
function navigate(page) {
  if (location.hash === "#" + page) render();
  else location.hash = page;
}
function bridge(method, ...args) {
  if (!native())
    throw new Error(
      "В браузере открыт макет. Поиск и SQLite работают в Android-приложении.",
    );
  window.NativeOSINT[method](...args);
}
function requestHistory() {
  if (!native()) return;
  try {
    bridge("history");
  } catch (e) {
    state.historyError = e.message;
  }
}
function historyRows(limit) {
  if (state.historyError) return notice(state.historyError, true);
  if (!native())
    return '<p class="empty">История доступна в Android-приложении. Здесь — просмотр интерфейса.</p>';
  if (state.history === null)
    return '<p class="empty" role="status">Читаем локальную историю…</p>';
  if (!state.history.length)
    return '<p class="empty">Здесь появятся ваши запросы.<br>История хранится только на этом устройстве.</p>';
  return state.history
    .slice(0, limit)
    .map(
      (x, i) =>
        `<button class="row" data-history="${i}">${icon(x.kind === "dns" ? "globe" : "clock")}<span class="row-content"><strong class="mono">${esc(x.query)}</strong><small>${x.kind === "dns" ? "DNS / A и AAAA" : "Поиск профилей"}</small></span><time>${esc(new Date(x.created).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }))}</time></button>`,
    )
    .join("");
}
function home() {
  const tiles = [
    [
      "search",
      "search",
      "ПОИСК",
      "Профили / никнеймы",
      "Публичные источники",
      2,
    ],
    [
      "graph",
      "graph",
      "ГРАФ СВЯЗЕЙ",
      "Объекты / источники",
      "Рабочая схема",
      3,
    ],
    [
      "dns",
      "globe",
      "ДОМЕНЫ / DNS",
      "Адреса A / AAAA",
      "Разрешение доменов",
      2,
    ],
    [
      "databases",
      "db",
      "БАЗЫ ДАННЫХ",
      "История / источники",
      "Локальное хранилище",
      4,
    ],
    [
      "history",
      "archive",
      "КОЛЛЕКЦИИ",
      "Сохранённые запросы",
      "История проверок",
      5,
    ],
    [
      "settings",
      "settings",
      "НАСТРОЙКИ",
      "Интерфейс / система",
      "Локальный режим",
      6,
    ],
  ];
  return `<div class="hero">${logo()}<span class="crosshair" aria-hidden="true"></span><span class="hero-note">OPEN SOURCE INTELLIGENCE</span></div><div class="tiles">${tiles.map((t) => `<a class="tile" href="#${t[0]}" data-photo="${t[5]}"><span class="tile-icon">${icon(t[1])}</span><strong>${t[2]}</strong><small>${t[3]}<br>${t[4]}</small>${icon("arrow", "arrow")}</a>`).join("")}</div><div class="section-heading"><h2 class="eyebrow">Последние запросы</h2><a class="text-button" href="#history">Все ${icon("arrow")}</a></div><div id="home-history">${historyRows(3)}</div>`;
}
function searchPage(dns = false) {
  const busy = state.busy[dns ? "dns" : "search"];
  return `${banner(dns ? "ДОМЕНЫ / DNS" : "ПОИСК", dns ? "Network footprint" : "Search engine")}<form id="query-form" data-kind="${dns ? "dns" : "search"}"><label class="form-label" for="query">${dns ? "Домен для проверки" : "Никнейм для поиска"}</label><div class="query-field">${icon(dns ? "globe" : "search")}<input id="query" name="query" value="${esc(dns ? state.domain : state.query)}" placeholder="${dns ? "example.org" : "Введите никнейм"}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" maxlength="${dns ? "253" : "40"}" ${busy ? "readonly" : ""}><button class="clear-button" type="button" data-action="clear" aria-label="Очистить запрос" ${busy ? "disabled" : ""}>×</button></div><div class="section-heading"><span class="eyebrow">Тип запроса</span></div><div class="chips"><a class="chip ${dns ? "" : "selected"}" href="#search" ${dns ? "" : 'aria-current="page"'}>${icon("user")}Аккаунт</a><a class="chip ${dns ? "selected" : ""}" href="#dns" ${dns ? 'aria-current="page"' : ""}>${icon("globe")}Домен</a></div>${dns ? `<div class="notice">Проверка записей A / AAAA через системный DNS. WHOIS, MX и TXT пока не подключены.</div>` : `<div class="section-heading"><span class="eyebrow">Источники</span><span class="meta">HTTPS / ${state.sources.length}</span></div><fieldset class="source-list" ${busy ? "disabled" : ""}><legend class="sr-only">Выберите источники для поиска</legend>${state.sources.map((s, i) => `<label class="source-row"><input type="checkbox" name="source" value="${s}" ${state.selected.includes(s) ? "checked" : ""}><span>${s}</span><span class="meta">${String(i + 1).padStart(2, "0")}</span></label>`).join("")}</fieldset>`}<div id="form-message" aria-live="polite">${state.error ? notice(state.error, true) : ""}${busy ? notice(dns ? "Запрашиваем DNS…" : "Проверяем выбранные источники. Это может занять до минуты.") + '<div class="working" aria-hidden="true"></div>' : ""}</div><button class="primary" type="submit" ${busy ? "disabled" : ""}>${icon("play")}${busy ? "ВЫПОЛНЯЕТСЯ…" : dns ? "ПРОВЕРИТЬ ДОМЕН" : "ЗАПУСТИТЬ ПОИСК"}</button><p class="hint">${dns ? "Публичные IP-адреса не подтверждают владельца домена." : "HTTP 200 — кандидат, а не подтверждение аккаунта. Редиректы, блокировки и ошибки остаются неопределёнными."}</p></form>${strip()}`;
}
function results() {
  const kind = state.resultKind || "search",
    data = state[kind];
  if (!data)
    return `${banner("РЕЗУЛЬТАТЫ", "Search results", "results")}<p class="empty">Сначала выполните поиск или откройте запрос из истории.</p><a href="#search" class="primary">Перейти к поиску ${icon("arrow")}</a>`;
  const dns = kind === "dns";
  const items = dns
    ? data.addresses.map((ip) => ({
        site: ip,
        url: data.domain,
        state: "resolved",
      }))
    : data.items;
  const filtered = items.filter(
    (x) => state.filter === "all" || x.state === state.filter,
  );
  return `${banner("РЕЗУЛЬТАТЫ", "Search results", "results")}<a class="back-link" href="#${dns ? "dns" : "search"}">${icon("arrow")}Новый запрос</a><p class="query-context">ЗАПРОС: <b>${esc(dns ? data.domain : data.query)}</b><br>${dns ? "СИСТЕМНЫЙ DNS / A, AAAA" : "ПРОВЕРКА ПУБЛИЧНЫХ URL / HTTPS"}</p>${dns ? "" : `<label class="filter-label">Статус<select id="result-filter"><option value="all">Все результаты</option><option value="candidate" ${state.filter === "candidate" ? "selected" : ""}>Кандидаты</option><option value="not_found" ${state.filter === "not_found" ? "selected" : ""}>Не найдено</option><option value="unknown" ${state.filter === "unknown" ? "selected" : ""}>Не определено</option></select></label>`}<p class="results-count">${dns ? "АДРЕСОВ" : "ПРОВЕРЕНО ИСТОЧНИКОВ"}: ${items.length} · ПОКАЗАНО: ${filtered.length}</p>${
    filtered
      .map((x) => {
        const text =
          {
            candidate: "Кандидат",
            not_found: "Не найдено",
            unknown: "Не определено",
            resolved: "DNS-ответ",
          }[x.state] || "Не определено";
        return `<article class="result-card"><div class="result-head"><span class="entity-icon">${icon(dns ? "globe" : "user")}</span><h2>${esc(x.site)}</h2><span class="badge ${x.state === "unknown" ? "unknown" : x.state === "not_found" ? "negative" : ""}">${text}</span></div><p class="result-url">${esc(x.url)}</p><p class="result-detail">${dns ? "Системное разрешение имени домена" : x.status ? "HTTP " + esc(x.status) + (x.state === "candidate" ? " · Требуется ручная проверка профиля." : "") : esc(x.detail || "Источник не ответил. Статус неизвестен.")}</p></article>`;
      })
      .join("") || '<p class="empty">Нет результатов с этим статусом.</p>'
  }<p class="hint">Запрос автоматически сохранён в локальную историю Android.</p><a class="primary" href="#graph">${icon("graph")}ОТКРЫТЬ ГРАФ ${icon("arrow")}</a>`;
}
function databases() {
  return `${banner("БАЗЫ ДАННЫХ", "Local workspace", "db")}<div class="chips"><button class="chip" data-db="local" aria-pressed="${state.dbTab === "local"}">${icon("db")}Локальные</button><button class="chip" data-db="sources" aria-pressed="${state.dbTab === "sources"}">${icon("layers")}Источники</button></div>${state.dbTab === "local" ? `<div class="section-heading"><h2 class="eyebrow">Хранилище устройства</h2></div><div class="row">${icon("db")}<div class="row-content"><strong>История запросов</strong><small>SQLite / osint.db</small></div><span class="meta">${native() ? "ANDROID" : "В ПРИЛОЖЕНИИ"}</span></div><a class="secondary" href="#history">Открыть историю ${icon("arrow")}</a><details><summary>Импорт и внешние каталоги</summary><p>Импорт CSV/XLSX и каталоги Sherlock / Maigret пока не подключены. Они не входят в локальную базу этого приложения.</p></details>` : `<div class="section-heading"><h2 class="eyebrow">Публичные профили</h2><span class="meta">${state.sources.length} URL</span></div>${state.sources.map((s, i) => `<div class="row">${icon("globe")}<div class="row-content"><strong>${s}</strong><small>Проверка HTTP-статуса профиля</small></div><span class="meta">0${i + 1}</span></div>`).join("")}<p class="hint" style="margin-top:16px">Это список проверяемых сайтов, а не база аккаунтов или утечек.</p>`}${strip()}`;
}
function graph() {
  const data = state[state.resultKind || "search"];
  const dns = state.resultKind === "dns";
  const entities = data
    ? dns
      ? data.addresses.map((a) => ({
          title: a,
          detail: "DNS-ответ A / AAAA",
          icon: "globe",
        }))
      : data.items.map((x) => ({
          title: x.site,
          detail:
            x.url +
            " · " +
            ({
              candidate: "кандидат",
              unknown: "не определено",
              not_found: "не найдено",
            }[x.state] || x.state),
          icon: "user",
        }))
    : [];
  const center = data ? (dns ? data.domain : data.query) : "Нет запроса";
  const nodes = entities.map((x, i) => ({
    ...x,
    x: 150 + 102 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / entities.length),
    y: 155 + 100 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / entities.length),
  }));
  return `${banner("ГРАФ СВЯЗЕЙ", "Relationship graph", "graph")}<p class="hint" style="margin-bottom:16px">Предварительный макет · ${data ? "связи текущего запроса" : "без данных"}</p><div class="graph-field"><div class="graph-label">N: ${data ? nodes.length + 1 : 0}<br>E: ${nodes.length}</div>${data ? `<svg class="graph-svg" viewBox="0 0 300 310" role="group" aria-label="Запрос и проверенные источники"><g transform="translate(150 155) scale(${state.zoom}) translate(-150 -155)">${nodes.map((n) => `<path d="M150 155L${n.x} ${n.y}" stroke="#7697a0" stroke-dasharray="3 3"/>`).join("")}<rect x="123" y="128" width="54" height="54" rx="10" fill="#b9dce5"/><text x="150" y="160" text-anchor="middle" stroke="none" fill="#123b49" font-size="12">ЗАПРОС</text>${nodes.map((n, i) => `<g class="graph-hit" role="button" tabindex="0" aria-label="${esc(n.title)}" data-node="${i}"><rect x="${n.x - 30}" y="${n.y - 30}" width="60" height="60" rx="7" fill="#f0f2f3"/><text x="${n.x}" y="${n.y + 4}" text-anchor="middle" stroke="none" fill="#123b49" font-size="12">${esc(n.title.length > 10 ? n.title.slice(0, 9) + "…" : n.title)}</text></g>`).join("")}</g></svg>` : `<div class="graph-center"><span class="graph-node">${icon("user")}</span><p class="graph-empty">Выполните поиск, чтобы увидеть запрос и проверенные источники.</p></div>`}<div class="graph-controls"><button data-zoom="in" aria-label="Увеличить" ${!data || state.zoom >= 1.6 ? "disabled" : ""}>${icon("plus")}</button><button data-zoom="out" aria-label="Уменьшить" ${!data || state.zoom <= 0.6 ? "disabled" : ""}>${icon("minus")}</button><button data-zoom="fit" aria-label="По размеру поля" ${data ? "" : "disabled"}>${icon("fit")}</button></div></div><p class="graph-legend">- - - ${dns ? "Домен → адрес из DNS-ответа" : "Запрос → проверенный URL"}.<br>Личные связи и владение аккаунтами не установлены.</p><div class="result-card"><div class="result-head"><span class="entity-icon">${icon(dns ? "globe" : "user")}</span><h2 class="mono">${esc(state.graphDetail !== null && nodes[state.graphDetail] ? nodes[state.graphDetail].title : center)}</h2></div><p class="result-detail">${esc(state.graphDetail !== null && nodes[state.graphDetail] ? nodes[state.graphDetail].detail : data ? "Источник связей — результаты последней проверки." : "Выберите существующий запрос из истории или начните новый поиск.")}</p></div><a class="secondary" href="#${data ? "results" : "search"}">${data ? "К результатам" : "Перейти к поиску"} ${icon("arrow")}</a>`;
}
function settings() {
  return `${banner("НАСТРОЙКИ", "System preferences")}<div class="section-heading"><h2 class="eyebrow">Интерфейс</h2></div><label class="settings-row"><span>Уменьшить анимацию<br><small>Без переходов между экранами</small></span><input id="reduce-motion" type="checkbox" ${storage.get("reduced-motion") === "true" ? "checked" : ""}></label><div class="section-heading"><h2 class="eyebrow">О приложении</h2></div><div class="row"><span class="row-content"><strong>OSINT / 2002</strong><small>Android Java · 0.3.1-alpha</small></span></div><p class="notice">${native() ? "Поиск профилей, системный DNS и SQLite работают на устройстве." : "Открыт браузерный макет. Нативные проверки доступны в APK."}</p><details><summary>Данные и хранение</summary><p>Запросы и ответы сохраняются в SQLite на устройстве. Для проверки профилей приложение обращается к выбранным сайтам. Удалённый API и облачная синхронизация не подключены.</p></details><details><summary>Возможности текущей версии</summary><p>Проверка публичных URL, DNS A / AAAA, история запросов. Граф показывает связь запроса с проверенными источниками. Поиск телефонов и почты, импорт файлов, WHOIS, Sherlock и Maigret не подключены.</p></details>${strip()}`;
}
function render() {
  const page = location.hash.slice(1) || "home";
  state.page = [
    "home",
    "search",
    "dns",
    "results",
    "graph",
    "databases",
    "history",
    "settings",
    "splash",
  ].includes(page)
    ? page
    : "home";
  const screens = {
    home,
    search: () => searchPage(),
    dns: () => searchPage(true),
    results,
    graph,
    databases,
    history: () =>
      `${banner("КОЛЛЕКЦИИ", "Query history")}<div class="section-heading"><h2 class="eyebrow">История запросов</h2><button class="text-button" data-action="refresh">Обновить</button></div><div id="history-list">${historyRows(30)}</div>`,
    settings,
    splash: () =>
      `<div class="splash">${logo()}${strip()}<p class="eyebrow">Рабочее пространство</p><p class="hint">Локальный режим · Android</p><a class="secondary" href="#home">Открыть ${icon("arrow")}</a></div>`,
  };
  $("main").innerHTML = screens[state.page]();
  $("main").className = "screen-enter";
  const active =
    state.page === "dns" || state.page === "results"
      ? "search"
      : state.page === "history"
        ? "databases"
        : state.page;
  document.querySelector(".bottom-nav").innerHTML = [
    ["home", "home", "Главная"],
    ["search", "search", "Поиск"],
    ["graph", "graph", "Граф"],
    ["databases", "db", "Базы"],
    ["settings", "settings", "Настройки"],
  ]
    .map(
      ([p, i, t]) =>
        `<a href="#${p}" ${active === p ? 'aria-current="page"' : ""}>${icon(i)}<span>${t}</span></a>`,
    )
    .join("");
  $("bridge-status").textContent = native()
    ? "ANDROID / ЛОКАЛЬНЫЙ РЕЖИМ"
    : "БРАУЗЕР / МАКЕТ";
  bind();
}
function bind() {
  const form = $("query-form");
  if (form) {
    form.addEventListener("submit", submit);
    $("query").addEventListener("input", (e) => {
      state[state.page === "dns" ? "domain" : "query"] = e.target.value;
    });
    form.querySelectorAll("[name=source]").forEach((c) =>
      c.addEventListener("change", () => {
        state.selected = [
          ...form.querySelectorAll("[name=source]:checked"),
        ].map((c) => c.value);
      }),
    );
  }
  document.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.action === "clear") {
          $("query").value = "";
          state[state.page === "dns" ? "domain" : "query"] = "";
          $("query").focus();
        } else requestHistory();
      }),
  );
  document.querySelectorAll("[data-history]").forEach(
    (b) =>
      (b.onclick = () => {
        const h = state.history[Number(b.dataset.history)];
        const k = h.kind === "dns" ? "dns" : "search";
        state[k] = h.result;
        state.resultKind = k;
        state.filter = "all";
        state.graphDetail = null;
        navigate("results");
      }),
  );
  document.querySelectorAll("[data-db]").forEach(
    (b) =>
      (b.onclick = () => {
        state.dbTab = b.dataset.db;
        render();
      }),
  );
  if ($("result-filter"))
    $("result-filter").onchange = (e) => {
      state.filter = e.target.value;
      render();
    };
  if ($("reduce-motion"))
    $("reduce-motion").onchange = (e) => {
      storage.set("reduced-motion", String(e.target.checked));
      document.documentElement.classList.toggle(
        "reduced-motion",
        e.target.checked,
      );
    };
  document.querySelectorAll("[data-zoom]").forEach(
    (b) =>
      (b.onclick = () => {
        state.zoom =
          b.dataset.zoom === "fit"
            ? 1
            : Math.max(
                0.6,
                Math.min(
                  1.6,
                  state.zoom + (b.dataset.zoom === "in" ? 0.2 : -0.2),
                ),
              );
        render();
      }),
  );
  document.querySelectorAll("[data-node]").forEach((n) => {
    const select = () => {
      state.graphDetail = Number(n.dataset.node);
      render();
    };
    n.onclick = select;
    n.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    };
  });
}
function submit(e) {
  e.preventDefault();
  const kind = e.target.dataset.kind;
  if (state.busy[kind]) return;
  const q = $("query").value.trim();
  state.error = "";
  state[kind === "dns" ? "domain" : "query"] = q;
  if (kind === "search" && !/^[A-Za-z0-9_.-]{1,40}$/.test(q))
    state.error = "Никнейм: от 1 до 40 символов A–Z, 0–9, _ . -";
  if (
    kind === "dns" &&
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
      q,
    )
  )
    state.error = "Введите домен, например example.org, без https:// и пути.";
  if (kind === "search" && !state.selected.length)
    state.error = "Выберите хотя бы один источник.";
  if (state.error) {
    render();
    $("query").focus();
    return;
  }
  state.busy[kind] = true;
  render();
  try {
    if (kind === "search")
      bridge("searchSelected", q, JSON.stringify(state.selected));
    else bridge("dns", q);
  } catch (err) {
    state.busy[kind] = false;
    state.error = err.message;
    render();
  }
}
window.receiveNative = (event, data) => {
  if (event === "history") {
    if (data.error) state.historyError = data.error;
    else {
      state.history = data.items;
      state.historyError = "";
    }
    if (["home", "history", "databases"].includes(state.page)) render();
    return;
  }
  if (!["search", "dns"].includes(event)) return;
  state.busy[event] = false;
  if (data.error) {
    state.error = data.error;
    if (state.page === event) render();
    return;
  }
  state[event] = data;
  state.resultKind = event;
  state.filter = "all";
  state.graphDetail = null;
  state.zoom = 1;
  requestHistory();
  if (state.page === event) navigate("results");
};
window.appBack = () => {
  if (state.page !== "home") {
    navigate("home");
    return true;
  }
  return false;
};
addEventListener("hashchange", () => {
  state.error = "";
  render();
  scrollTo(0, 0);
  $("main").focus({ preventScroll: true });
});
render();
requestHistory();
