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
  errors: { search: "", dns: "" },
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
let ambientObserver = null;
let pageTransition = null;
let navigationRevision = 0;
const systemReducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const ambient = (zone = "footer") =>
  `<div class="ambient-field is-paused" data-zone="${zone}" aria-hidden="true">${Array.from({ length: 6 }, () => '<span class="ambient-square"></span>').join("")}${Array.from({ length: 3 }, (_, i) => `<span class="ambient-vector" data-side="${i}" data-straight="${i === 0}"><svg><path pathLength="100"/></svg><i></i></span>`).join("")}</div>`;
const banner = (title, subtitle, img = "") =>
  `<div class="page-banner" data-image="${img || state.page}"><h1>${title}</h1><p class="eyebrow">/ ${subtitle}</p>${ambient("header")}</div>`;
const strip = () =>
  `<div class="photo-strip" data-scene="${state.page}" aria-hidden="true">${ambient()}</div>`;
const notice = (s, error = false) =>
  `<div class="notice${error ? " error" : ""}" role="${error ? "alert" : "status"}">${esc(s)}</div>`;
function navigate(page) {
  if (location.hash === "#" + page) render();
  else location.hash = page;
}
function syncViewportWidth() {
  const width = document.documentElement.clientWidth;
  if (width > 0)
    document.documentElement.style.setProperty(
      "--app-viewport-width",
      `${width}px`,
    );
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
      "Профили и никнеймы",
      "Публичные источники",
      "search",
    ],
    [
      "graph",
      "graph",
      "ГРАФ СВЯЗЕЙ",
      "Объекты и источники",
      "Рабочая схема",
      "graph",
    ],
    [
      "dns",
      "globe",
      "ДОМЕНЫ / DNS",
      "Адреса A / AAAA",
      "Проверка доменов",
      "dns",
    ],
    [
      "databases",
      "db",
      "БАЗЫ ДАННЫХ",
      "Хранение и источники",
      "На этом устройстве",
      "4",
    ],
    [
      "history",
      "archive",
      "ИСТОРИЯ",
      "Сохранённые запросы",
      "Результаты проверок",
      "5",
    ],
    [
      "settings",
      "settings",
      "НАСТРОЙКИ",
      "Интерфейс и система",
      "Локальный режим",
      "6",
    ],
  ];
  return `<div class="hero">${logo()}<span class="crosshair" aria-hidden="true"></span>${ambient("eye")}<span class="hero-note">OPEN SOURCE INTELLIGENCE</span></div><div class="tiles">${tiles.map((t) => `<a class="tile" href="#${t[0]}" data-photo="${t[5]}"><span class="tile-icon">${icon(t[1])}</span><strong>${t[2]}</strong><small>${t[3]}<br>${t[4]}</small>${icon("arrow", "arrow")}</a>`).join("")}</div><div class="section-heading"><h2>Последние запросы</h2><a class="text-button" href="#history">Все ${icon("arrow")}</a></div><div id="home-history">${historyRows(3)}</div>${strip()}`;
}

function searchPage(dns = false) {
  const kind = dns ? "dns" : "search";
  const busy = state.busy[kind];
  return `${banner(dns ? "ДОМЕНЫ / DNS" : "ПОИСК", dns ? "Network footprint" : "Search engine", kind)}<form id="query-form" data-kind="${kind}"><label class="form-label" for="query">${dns ? "Домен для проверки" : "Никнейм для поиска"}</label><div class="query-field">${icon(dns ? "globe" : "search")}<input id="query" name="query" value="${esc(dns ? state.domain : state.query)}" placeholder="${dns ? "example.org" : "Введите никнейм"}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" maxlength="${dns ? "253" : "40"}" ${busy ? "readonly" : ""}><button class="clear-button" type="button" data-action="clear" aria-label="Очистить запрос" ${busy ? "disabled" : ""}>×</button></div><div class="section-heading"><h2>Тип запроса</h2></div><div class="chips"><a class="chip ${dns ? "" : "selected"}" href="#search" ${dns ? "" : 'aria-current="page"'}>${icon("user")}Аккаунт</a><a class="chip ${dns ? "selected" : ""}" href="#dns" ${dns ? 'aria-current="page"' : ""}>${icon("globe")}Домен</a></div>${dns ? `<div class="section-heading"><h2>Тип проверки</h2></div><div class="supported-records"><div>${icon("check")}<span>A — IPv4</span></div><div>${icon("check")}<span>AAAA — IPv6</span></div></div><p class="hint">Оба типа адресов запрашиваются через системный DNS.</p>` : `<div class="section-heading"><h2>Источники</h2><span class="meta">HTTPS / ${state.sources.length}</span></div><fieldset class="source-list" ${busy ? "disabled" : ""}><legend class="sr-only">Выберите источники для поиска</legend>${state.sources.map((site, i) => `<label class="source-row"><input type="checkbox" name="source" value="${site}" ${state.selected.includes(site) ? "checked" : ""}><span>${site}</span><span class="meta">${String(i + 1).padStart(2, "0")}</span></label>`).join("")}</fieldset>`}<div id="form-message" aria-live="polite">${state.errors[kind] ? notice(state.errors[kind], true) : ""}${busy ? notice(dns ? "Запрашиваем DNS…" : "Проверяем выбранные источники. Это может занять до минуты.") + '<div class="working" aria-hidden="true"></div>' : ""}</div><button class="primary" type="submit" ${busy ? "disabled" : ""}>${icon("play")}<span>${busy ? "Выполняется…" : dns ? "Проверить домен" : "Запустить поиск"}</span></button><p class="hint">${dns ? "Публичные IP-адреса не подтверждают владельца домена." : "HTTP 200 — кандидат, а не подтверждение аккаунта. Ошибки и блокировки остаются неопределёнными."}</p>${dns ? notice("WHOIS, MX и TXT пока не подключены.") : ""}</form>${strip()}`;
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
  return `${banner("РЕЗУЛЬТАТЫ", "Search results", "results")}<a class="back-link" href="#${dns ? "dns" : "search"}">${icon("arrow")}Новый запрос</a><p class="query-context">ЗАПРОС: <b>${esc(dns ? data.domain : data.query)}</b><br>${dns ? "Системный DNS / A, AAAA" : "Проверка публичных URL / HTTPS"}</p>${dns ? "" : `<label class="filter-label">Статус<select id="result-filter"><option value="all">Все результаты</option><option value="candidate" ${state.filter === "candidate" ? "selected" : ""}>Кандидаты</option><option value="not_found" ${state.filter === "not_found" ? "selected" : ""}>Не найдено</option><option value="unknown" ${state.filter === "unknown" ? "selected" : ""}>Не определено</option></select></label>`}<p class="results-count">${dns ? "АДРЕСОВ" : "ПРОВЕРЕНО ИСТОЧНИКОВ"}: ${items.length} · ПОКАЗАНО: ${filtered.length}</p>${
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
  }<p class="hint">Результат сохранён в истории на этом устройстве.</p><a class="primary" href="#graph">${icon("graph")}ОТКРЫТЬ ГРАФ ${icon("arrow")}</a>${strip()}`;
}
function databases() {
  return `${banner("БАЗЫ ДАННЫХ", "Local workspace", "db")}<div class="chips"><button class="chip" data-db="local" aria-pressed="${state.dbTab === "local"}">${icon("db")}Хранилище</button><button class="chip" data-db="sources" aria-pressed="${state.dbTab === "sources"}">${icon("layers")}Источники</button></div>${state.dbTab === "local" ? `<div class="section-heading"><h2>На этом устройстве</h2></div><a class="row linked-row" href="#history">${icon("clock")}<div class="row-content"><strong>История запросов</strong><small>Результаты проверок · SQLite</small></div>${icon("arrow")}</a><div class="section-heading"><h2>Внешние каталоги</h2></div><div class="unavailable-row"><strong>Sherlock / Maigret</strong><span>Не подключены</span></div><div class="unavailable-row"><strong>Импорт CSV / XLSX</strong><span>Пока недоступен</span></div><p class="hint">Каталоги сайтов и импорт файлов не входят в локальную историю.</p>` : `<div class="section-heading"><h2>Проверяемые сайты</h2><span class="meta">${state.sources.length} URL</span></div>${state.sources.map((site) => `<div class="row">${icon("globe")}<div class="row-content"><strong>${site}</strong><small>HTTP-проверка публичного профиля</small></div></div>`).join("")}<p class="hint">Это список сайтов для проверки, а не база аккаунтов или утечек.</p><a class="secondary" href="#search">Выбрать источники ${icon("arrow")}</a>`}${strip()}`;
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
  return `${banner("ГРАФ СВЯЗЕЙ", "Relationship graph", "graph")}<p class="hint" style="margin-bottom:16px">Предварительный макет · ${data ? "связи текущего запроса" : "без данных"}</p><div class="graph-field"><div class="graph-label">N: ${data ? nodes.length + 1 : 0}<br>E: ${nodes.length}</div>${data ? `<svg class="graph-svg" viewBox="0 0 300 310" role="group" aria-label="Запрос и проверенные источники"><g transform="translate(150 155) scale(${state.zoom}) translate(-150 -155)">${nodes.map((n) => `<path d="M150 155L${n.x} ${n.y}" stroke="#7697a0" stroke-dasharray="3 3"/>`).join("")}<rect x="115" y="120" width="70" height="70" rx="10" fill="#285e7c"/><svg x="137" y="131" width="26" height="26" viewBox="0 0 24 24" stroke="#f6f8fa" fill="none" stroke-width="1.4"><path d="${paths[dns ? "globe" : "user"]}"/></svg><text x="150" y="178" text-anchor="middle" stroke="none" fill="#f6f8fa" font-size="11">${dns ? "ДОМЕН" : "ЗАПРОС"}</text>${nodes.map((n, i) => `<g class="graph-hit" role="button" tabindex="0" aria-label="${esc(n.title)}" data-node="${i}"><rect x="${n.x - 30}" y="${n.y - 30}" width="60" height="60" rx="7" fill="#f0f2f3"/><text x="${n.x}" y="${n.y + 4}" text-anchor="middle" stroke="none" fill="#123b49" font-size="12">${esc(n.title.length > 10 ? n.title.slice(0, 9) + "…" : n.title)}</text></g>`).join("")}</g></svg>` : `<div class="graph-center"><span class="graph-node">${icon("user")}</span><p class="graph-empty">Выполните поиск, чтобы увидеть запрос и проверенные источники.</p></div>`}<div class="graph-controls"><button data-zoom="in" aria-label="Увеличить" ${!data || state.zoom >= 1.6 ? "disabled" : ""}>${icon("plus")}</button><button data-zoom="out" aria-label="Уменьшить" ${!data || state.zoom <= 0.6 ? "disabled" : ""}>${icon("minus")}</button><button data-zoom="fit" aria-label="По размеру поля" ${data ? "" : "disabled"}>${icon("fit")}</button></div></div><p class="graph-legend">- - - ${dns ? "Домен → адрес из DNS-ответа" : "Запрос → проверенный URL"}.<br>Личные связи и владение аккаунтами не установлены.</p><div class="result-card"><div class="result-head"><span class="entity-icon">${icon(dns ? "globe" : "user")}</span><h2 class="mono">${esc(state.graphDetail !== null && nodes[state.graphDetail] ? nodes[state.graphDetail].title : center)}</h2></div><p class="result-detail">${esc(state.graphDetail !== null && nodes[state.graphDetail] ? nodes[state.graphDetail].detail : data ? "Источник связей — результаты последней проверки." : "Выберите существующий запрос из истории или начните новый поиск.")}</p></div><a class="secondary" href="#${data ? "results" : "search"}">${data ? "К результатам" : "Перейти к поиску"} ${icon("arrow")}</a>${strip()}`;
}
function settings() {
  return `${banner("НАСТРОЙКИ", "System preferences")}<div class="section-heading"><h2 class="section-title">О приложении</h2></div><div class="row"><span class="row-content"><strong>OSINT / 2002</strong><small>Android · 0.7.0-alpha</small></span></div><p class="notice">${native() ? "Поиск профилей, системный DNS и SQLite работают на устройстве." : "Открыт браузерный макет. Нативные проверки доступны в APK."}</p><details><summary>Данные и хранение</summary><p>Запросы и ответы сохраняются в SQLite на устройстве. Для проверки профилей приложение обращается к выбранным сайтам. Удалённый API и облачная синхронизация не подключены.</p></details><details><summary>Возможности текущей версии</summary><p>Проверка публичных URL, DNS A / AAAA, история запросов. Граф показывает связь запроса с проверенными источниками. Поиск телефонов и почты, импорт файлов, WHOIS, Sherlock и Maigret не подключены.</p></details>${strip()}`;
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
      `${banner("ИСТОРИЯ", "Query history", "history")}<a class="back-link" href="#databases">${icon("arrow")}Хранилище / история</a><div class="section-heading"><h2>Сохранённые запросы</h2><button class="text-button" data-action="refresh">Обновить</button></div><div id="history-list">${historyRows(30)}</div>${strip()}`,
    settings,
    splash: () =>
      `<div class="splash">${logo()}${strip()}<p class="eyebrow">Рабочее пространство</p><p class="hint">Локальный режим · Android</p><a class="secondary" href="#home">Открыть ${icon("arrow")}</a></div>`,
  };
  $("main").innerHTML = screens[state.page]();
  $("main").className = "screen";
  document.body.dataset.page = state.page;
  const active =
    state.page === "dns" || state.page === "results"
      ? "search"
      : state.page === "history"
        ? "databases"
        : state.page;
  document.querySelector(".bottom-nav").innerHTML = [
    ["search", "search", "Поиск"],
    ["graph", "graph", "Граф"],
    ["home", "home", "Главная"],
    ["databases", "db", "Базы"],
    ["settings", "settings", "Настройки"],
  ]
    .map(
      ([p, i, t]) =>
        `<a href="#${p}" ${active === p ? 'aria-current="page"' : ""}>${icon(i)}<span>${t}</span></a>`,
    )
    .join("");
  bind();
  syncViewportWidth();
  setupAmbient();
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
  bindHistory();
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
function bindHistory() {
  document.querySelectorAll("[data-history]").forEach(
    (b) =>
      (b.onclick = () => {
        const h = state.history[Number(b.dataset.history)];
        const k = h.kind === "dns" ? "dns" : "search";
        state[k] = h.result;
        state.resultKind = k;
        state.filter = "all";
        state.zoom = 1;
        state.graphDetail = null;
        navigate("results");
      }),
  );
}
function submit(e) {
  e.preventDefault();
  const kind = e.target.dataset.kind;
  if (state.busy[kind]) return;
  const q = $("query").value.trim();
  state.errors[kind] = "";
  state[kind === "dns" ? "domain" : "query"] = q;
  if (kind === "search" && !/^[A-Za-z0-9_.-]{1,40}$/.test(q))
    state.errors[kind] = "Никнейм: от 1 до 40 символов A–Z, 0–9, _ . -";
  if (
    kind === "dns" &&
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
      q,
    )
  )
    state.errors[kind] =
      "Введите домен, например example.org, без https:// и пути.";
  if (kind === "search" && !state.selected.length)
    state.errors[kind] = "Выберите хотя бы один источник.";
  if (state.errors[kind]) {
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
    state.errors[kind] = err.message;
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
    if (["home", "history"].includes(state.page)) {
      const list = $(state.page === "home" ? "home-history" : "history-list");
      if (list) {
        list.innerHTML = historyRows(state.page === "home" ? 3 : 30);
        bindHistory();
      }
    }
    return;
  }
  if (!["search", "dns"].includes(event)) return;
  state.busy[event] = false;
  if (data.error) {
    state.errors[event] = data.error;
    if (state.page === event) render();
    return;
  }
  state[event] = data;
  if (state.page === event || !state.resultKind) {
    state.resultKind = event;
    state.filter = "all";
    state.graphDetail = null;
    state.zoom = 1;
  }
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
function randomizeSquare(square, initial = false) {
  // Placement changes only at a fully transparent cycle boundary, not per frame.
  const size = 24 + Math.random() * 30;
  square.style.width = `${size}px`;
  square.style.height = `${size}px`;
  // Stratify placement so the left side never stays empty for an entire cycle.
  const slot = [
    ...square.parentElement.querySelectorAll(".ambient-square"),
  ].indexOf(square);
  square.style.left = `${5 + (slot % 3) * 31 + Math.random() * 23}%`;
  square.style.top = `${18 + Math.floor(slot / 3) * 42 + Math.random() * 20}%`;
  if (initial) {
    const duration = 9 + Math.random() * 5;
    square.style.animationDuration = `${duration}s`;
    square.style.animationDelay = `${-Math.random() * duration}s`;
  }
}
function randomizeVector(vector, initial = false) {
  const field = vector.parentElement;
  const width = field.clientWidth || 360;
  const height = field.clientHeight || 180;
  const straight = vector.dataset.straight === "true";
  const previousSide = vector.dataset.entrySide;
  const side = straight
    ? previousSide === undefined
      ? Math.floor(Math.random() * 3)
      : (Number(previousSide) + 1 + Math.floor(Math.random() * 2)) % 3
    : Number(vector.dataset.side);
  vector.dataset.entrySide = String(side);
  // Alternate coordinate bands so repeated cycles visibly move, even with a
  // similar random sample. Changing paths happens only at zero opacity.
  const lowBand = vector.dataset.band !== "low";
  vector.dataset.band = lowBand ? "low" : "high";
  const coordinate = () => (lowBand ? 0.18 : 0.62) + Math.random() * 0.2;
  const x = Math.round(width * coordinate());
  const y = Math.round(height * coordinate());
  const footer = field.dataset.zone === "footer";
  // Each region has left/right/top entries (bottom instead of top in the footer).
  // Vector zero is always straight; the others use only horizontal/vertical legs.
  const points = straight
    ? side === 0
      ? [
          [-16, y],
          [width + 16, y],
        ]
      : side === 1
        ? [
            [width + 16, y],
            [-16, y],
          ]
        : [
            [x, footer ? height + 16 : -16],
            [x, footer ? -16 : height + 16],
          ]
    : side === 0
      ? [
          [-16, y],
          [width + 16, y],
        ]
      : side === 1
        ? [
            [width + 16, y],
            [x, y],
            [x, footer ? -16 : height + 16],
          ]
        : [
            [x, footer ? height + 16 : -16],
            [x, y],
            [-16, y],
          ];
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`)
    .join(" ");
  vector.querySelector("path").setAttribute("d", path);
  vector.querySelector("i").style.offsetPath = `path("${path}")`;
  if (initial) {
    const duration = 6 + Math.random() * 2;
    vector.style.setProperty("--vector-duration", `${duration}s`);
    vector.style.setProperty("--vector-delay", `${-Math.random() * duration}s`);
  }
}
function updateAmbientPlayback() {
  const paused = document.hidden || systemReducedMotion();
  document.querySelectorAll(".ambient-field").forEach((field) => {
    field.classList.toggle(
      "is-paused",
      paused || field.dataset.visible === "false",
    );
  });
}
function setupAmbient() {
  if (ambientObserver) ambientObserver.disconnect();
  const fields = document.querySelectorAll(".ambient-field");
  fields.forEach((field) => {
    field.querySelectorAll(".ambient-square").forEach((square) => {
      randomizeSquare(square, true);
      square.addEventListener("animationiteration", () =>
        randomizeSquare(square),
      );
    });
    field.querySelectorAll(".ambient-vector").forEach((vector) => {
      randomizeVector(vector, true);
      vector
        .querySelector("path")
        .addEventListener("animationiteration", () => randomizeVector(vector));
    });
  });
  if (typeof IntersectionObserver === "function") {
    if (!ambientObserver)
      ambientObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.dataset.visible = String(entry.isIntersecting);
          });
          updateAmbientPlayback();
        },
        { threshold: 0 },
      );
    fields.forEach((field) => {
      field.dataset.visible = "false";
      ambientObserver.observe(field);
    });
  }
  updateAmbientPlayback();
}
document.addEventListener("visibilitychange", updateAmbientPlayback);
if (typeof matchMedia === "function") {
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  if (typeof preference.addEventListener === "function")
    preference.addEventListener("change", updateAmbientPlayback);
}
function animatePageEntry() {
  if (systemReducedMotion() || typeof $("main").animate !== "function") return;
  if (typeof $("main").getAnimations === "function")
    $("main")
      .getAnimations()
      .forEach((animation) => animation.cancel());
  $("main").animate([{ opacity: 0.88 }, { opacity: 1 }], {
    duration: 160,
    easing: "ease-out",
  });
}
function changePage() {
  const revision = ++navigationRevision;
  if (pageTransition && typeof pageTransition.skipTransition === "function")
    pageTransition.skipTransition();
  const update = () => {
    if (revision !== navigationRevision) return;
    render();
    scrollTo(0, 0);
    $("main").focus({ preventScroll: true });
  };
  if (
    !systemReducedMotion() &&
    typeof document.startViewTransition === "function"
  ) {
    try {
      const current = document.startViewTransition(update);
      pageTransition = current;
      current.finished
        .catch(() => {})
        .finally(() => {
          if (pageTransition === current) pageTransition = null;
        });
      return;
    } catch (_) {
      /* Older WebViews use the opacity-only fallback. */
    }
  }
  update();
  animatePageEntry();
}
addEventListener("hashchange", changePage);

render();
requestHistory();
// Font scaling can make navigation taller; reserve its real measured height.
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(([entry]) => {
    document.documentElement.style.setProperty(
      "--nav-height",
      `${Math.ceil(entry.target.getBoundingClientRect().height)}px`,
    );
    syncViewportWidth();
  }).observe(document.querySelector(".bottom-nav"));
}
addEventListener("resize", syncViewportWidth);
