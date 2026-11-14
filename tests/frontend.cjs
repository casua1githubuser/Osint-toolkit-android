const { JSDOM } = require("jsdom");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const assets = path.resolve(__dirname, "../app/src/main/assets");
const html = fs.readFileSync(path.join(assets, "index.html"), "utf8");
const code = fs.readFileSync(path.join(assets, "app.js"), "utf8");
const dom = new JSDOM(html, {
  url: "https://appassets.androidplatform.net/assets/index.html",
  runScripts: "outside-only",
});
const w = dom.window,
  d = w.document;
w.scrollTo = () => {};
let count = 0;
const calls = [],
  records = [];
let searchCancels = 0;
w.NativeOSINT = {
  history() {
    queueMicrotask(() => w.receiveNative("history", { items: records }));
  },
  searchSelected(query, selected) {
    calls.push({ kind: "search", query, selected: JSON.parse(selected) });
  },
  dns(query) {
    calls.push({ kind: "dns", query });
  },
  cancelSearch() {
    searchCancels++;
  },
  historyEntry(id) {
    calls.push({ kind: "historyEntry", id });
  },
  openUrl(url) {
    calls.push({ kind: "openUrl", url });
  },
};
w.eval(fs.readFileSync(path.join(assets, "source-catalog.js"), "utf8"));
w.eval(code + "\nwindow.__testState = state;");
const tick = () => new Promise((r) => setTimeout(r, 0));
const go = async (page) => {
  w.location.hash = page;
  await tick();
};
const state = () => w.__testState;
const ok = (label, test) => {
  assert.ok(test, label);
  console.log("PASS " + label);
  count++;
};
const setQuery = (value) => {
  d.querySelector("#query").value = value;
  d.querySelector("#query").dispatchEvent(
    new w.Event("input", { bubbles: true }),
  );
};
const submit = () =>
  d
    .querySelector("#query-form")
    .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
(async () => {
  await tick();
  ok("Footer removed", !d.querySelector(".system-footer"));
  ok(
    "Distinct semantic tile keys",
    new Set(
      [...d.querySelectorAll(".tile")].slice(0, 3).map((x) => x.dataset.photo),
    ).size === 3,
  );
  ok(
    "Home is the exact center of five navigation destinations",
    d.querySelectorAll(".bottom-nav a").length === 5 &&
      d.querySelectorAll(".bottom-nav a")[2].getAttribute("href") === "#home",
  );
  await go("search");
  setQuery("bad nickname");
  submit();
  ok(
    "Invalid username never reaches native bridge",
    calls.length === 0 && d.querySelector('[role="alert"]'),
  );
  setQuery("example-user");
  d.querySelector('[data-source-bulk="none"]').click();
  d.querySelectorAll("[name=source]").forEach((x, i) => {
    x.checked = i < 3;
    x.dispatchEvent(new w.Event("change"));
  });
  submit();
  submit();
  ok(
    "Only selected sources sent and duplicate submit blocked",
    calls.length === 1 &&
      calls[0].selected.join(",") === "GitHub,GitLab,Reddit",
  );
  const result = {
    query: "example-user",
    items: [
      {
        site: "GitHub",
        url: "https://github.com/example-user",
        state: "candidate",
        evidence: "presence_marker",
        status: 200,
      },
      {
        site: "GitLab",
        url: "https://gitlab.com/example-user",
        state: "not_found",
        status: 404,
      },
      {
        site: "Reddit",
        url: "https://reddit.com/user/example-user",
        state: "unknown",
        status: 403,
      },
    ],
  };
  records.unshift({
    kind: "username",
    query: "example-user",
    result,
    created: 1,
  });
  w.receiveNative("search", result);
  await tick();
  ok(
    "Successful callback opens result page",
    state().page === "results" &&
      d.querySelectorAll(".result-card").length === 3,
  );
  ok(
    "Success, review and unsuccessful results remain distinct",
    d.querySelector("main").textContent.includes("Успех") &&
      d.querySelector("main").textContent.includes("Неуспех") &&
      d.querySelector("main").textContent.includes("Проверьте вручную"),
  );
  d.querySelector("#result-filter").value = "review";
  d.querySelector("#result-filter").dispatchEvent(new w.Event("change"));
  ok(
    "Status filter excludes other outcomes",
    d.querySelectorAll(".result-card").length === 1 &&
      d.querySelector(".result-card").textContent.includes("Reddit"),
  );
  await go("graph");
  d.querySelector('[data-node="0"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  ok(
    "Graph detail preserves source provenance",
    d
      .querySelector(".result-detail")
      .textContent.includes("https://github.com/example-user"),
  );
  await go("history");
  ok(
    "History has an explicit storage breadcrumb",
    d
      .querySelector('.bottom-nav [aria-current="page"]')
      .getAttribute("href") === "#databases" &&
      !!d.querySelector('.back-link[href="#databases"]'),
  );
  d.querySelector("[data-history]").click();
  await tick();
  ok(
    "Saved query opens existing results",
    state().page === "results" && state().resultKind === "search",
  );
  await go("dns");
  ok(
    "A and AAAA are descriptions, not unsupported checkboxes",
    d.querySelectorAll(".supported-records input").length === 0 &&
      d.querySelectorAll(".supported-records>div").length === 2,
  );
  setQuery("https://example.org/path");
  submit();
  ok(
    "Invalid DNS never reaches native bridge",
    calls.length === 1 && d.querySelector('[role="alert"]'),
  );
  setQuery("example.org");
  submit();
  ok(
    "DNS bridge contract unchanged",
    calls.length === 2 &&
      calls[1].kind === "dns" &&
      calls[1].query === "example.org",
  );
  const dns = {
    domain: "example.org",
    addresses: ["192.0.2.1", "2001:db8::1"],
  };
  records.unshift({
    kind: "dns",
    query: "example.org",
    result: dns,
    created: 2,
  });
  w.receiveNative("dns", dns);
  await tick();
  await go("graph");
  ok(
    "DNS graph uses only returned addresses",
    d.querySelectorAll("[data-node]").length === 2 &&
      d
        .querySelector("main")
        .textContent.includes("Домен → адрес из DNS-ответа"),
  );
  w.receiveNative("search", result);
  ok(
    "Background search does not replace selected DNS context",
    state().resultKind === "dns",
  );
  await go("dns");
  w.receiveNative("search", { error: "SEARCH_ONLY_ERROR" });
  ok(
    "Background errors stay within their query type",
    !d.querySelector("main").textContent.includes("SEARCH_ONLY_ERROR"),
  );
  await go("databases");
  ok(
    "Unsupported imports/catalogs are not actions",
    [...d.querySelectorAll(".unavailable-row")].length === 2 &&
      d.querySelectorAll(".unavailable-row a,.unavailable-row button")
        .length === 0,
  );
  d.querySelector('[data-db="sources"]').click();
  ok(
    "Available source list remains separate",
    d.querySelectorAll("#source-list .source-row").length === 12 &&
      !d.querySelector("main").textContent.includes("Sherlock"),
  );
  await go("search");
  setQuery("typing-in-progress");
  const input = d.querySelector("#query");
  input.focus();
  w.receiveNative("history", { items: records });
  ok(
    "History refresh does not destroy form input or focus",
    d.querySelector("#query") === input &&
      input.value === "typing-in-progress" &&
      d.activeElement === input,
  );
  ok(
    "No preview fixture labels shipped",
    !html.includes("Пример данных") && !code.includes("Пример данных"),
  );
  const nativeCatalog = JSON.parse(
    fs.readFileSync(path.join(assets, "source-catalog.json"), "utf8"),
  );
  ok(
    "UI and native catalog share 1000 unique names",
    state().sources.length === 1000 &&
      new Set(state().sources).size === 1000 &&
      JSON.stringify(state().sources) ===
        JSON.stringify(nativeCatalog.sites.map((s) => s.name)),
  );
  ok(
    "Only twelve source checkboxes are rendered at a time",
    d.querySelectorAll('[name="source"]').length === 12,
  );
  const sourceFilter = d.querySelector("#source-filter");
  const lastName = state().sources.at(-1);
  sourceFilter.focus();
  sourceFilter.value = lastName;
  sourceFilter.dispatchEvent(new w.Event("input"));
  d.querySelector('[data-source-bulk="all"]').click();
  ok(
    "Filtering can select a source beyond the first page",
    state().selected.includes(lastName) &&
      d.querySelector("#source-filter") === sourceFilter,
  );
  d.querySelector('[data-source-bulk="none"]').click();
  ok(
    "Filtered deselection preserves other selected sources",
    !state().selected.includes(lastName) && state().selected.includes("GitHub"),
  );
  sourceFilter.value = "";
  sourceFilter.dispatchEvent(new w.Event("input"));
  const category = d.querySelector("#source-category");
  category.value = "Игры";
  category.dispatchEvent(new w.Event("change"));
  d.querySelector('[data-source-bulk="all"]').click();
  ok(
    "Category bulk selection covers all matching pages",
    w.OSINT_SOURCE_CATALOG.sites
      .filter((s) => s.category === "Игры")
      .every((s) => state().selected.includes(s.name)),
  );
  category.value = "";
  category.dispatchEvent(new w.Event("change"));
  d.querySelector('[data-source-bulk="all"]').click();
  setQuery("catalog_fixture");
  submit();
  ok(
    "All 1000 selected sources reach the native bridge",
    calls.at(-1).selected.length === 1000,
  );
  w.receiveNative("searchProgress", { completed: 8, total: 1000 });
  ok(
    "Live progress updates without rebuilding the form",
    d.querySelector("#search-progress progress").value === 8 &&
      d.querySelector("#source-picker") === null,
  );
  d.querySelector('[data-action="cancel-search"]').click();
  ok(
    "Stop button requests native cancellation",
    searchCancels === 1 && state().busy.search,
  );
  const many = {
    query: "catalog_fixture",
    total: 1000,
    completed: 1000,
    cancelled: false,
    items: state().sources.map((site, i) => ({
      site,
      url: "https://example.org/profile/" + i,
      status: 200,
      state: i % 3 === 0 ? "candidate" : i % 3 === 1 ? "unknown" : "not_found",
      evidence: i % 3 === 0 ? "presence_marker" : "none",
      detail: i % 3 === 0 ? "Requires review" : "Fixture insufficient markers",
    })),
  };
  w.receiveNative("search", {
    ...many,
    items: many.items.slice(0, 7),
    completed: 7,
    cancelled: true,
  });
  await tick();
  ok(
    "Cancelled run shows only processed sources and its partial count",
    d.querySelector("main").textContent.includes("7 из 1000") &&
      d.querySelectorAll(".result-card").length === 7,
  );
  await go("search");
  w.receiveNative("search", many);
  await tick();
  ok(
    "Large result sets render only 24 cards",
    d.querySelectorAll(".result-card").length === 24,
  );
  d.querySelector("#result-order").value = "review";
  d.querySelector("#result-order").dispatchEvent(new w.Event("change"));
  ok(
    "Sorting can put review results first",
    d.querySelector(".result-card .badge").textContent === "Проверьте вручную",
  );
  for (const group of ["success", "review", "not_found"]) {
    d.querySelector("#result-filter").value = group;
    d.querySelector("#result-filter").dispatchEvent(new w.Event("change"));
    const link = d.querySelector("a.result-card");
    const click = new w.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(click);
    ok(
      `Every ${group} card opens its HTTPS URL in the external browser`,
      click.defaultPrevented &&
        calls.at(-1).kind === "openUrl" &&
        calls.at(-1).url === link.href &&
        link.target === "_blank" &&
        link.rel.includes("noopener"),
    );
  }
  d.querySelector("#result-order").value = "success";
  d.querySelector("#result-order").dispatchEvent(new w.Event("change"));
  d.querySelector("#result-filter").value = "all";
  d.querySelector("#result-filter").dispatchEvent(new w.Event("change"));
  d.querySelector('[data-result-page="1"]').click();
  ok(
    "Result pagination reaches subsequent sources",
    d.querySelector(".result-card h2").textContent === many.items[72].site,
  );
  d.querySelector("#result-filter").value = "success";
  d.querySelector("#result-filter").dispatchEvent(new w.Event("change"));
  ok(
    "Changing status filter resets result pagination",
    state().resultPage === 0 &&
      [...d.querySelectorAll(".result-card .badge")].every(
        (e) => e.textContent === "Успех",
      ),
  );
  await go("graph");
  ok(
    "Graph is bounded and discloses omitted sources",
    d.querySelectorAll("[data-node]").length === 8 &&
      d.querySelector("main").textContent.includes("первые 8"),
  );
  records.push({
    id: 77,
    kind: "username",
    query: "summary-only",
    created: Date.now(),
    count: 1000,
  });
  await go("history");
  w.receiveNative("history", { items: records });
  d.querySelector(`[data-history="${records.length - 1}"]`).click();
  ok(
    "History loads a single large entry on demand",
    calls.at(-1).kind === "historyEntry" &&
      calls.at(-1).id === 77 &&
      state().historyLoading,
  );
  w.receiveNative("historyEntry", { id: 77, kind: "username", result: many });
  await tick();
  ok(
    "On-demand history preserves the full result while paging its UI",
    state().search.items.length === 1000 &&
      d.querySelectorAll(".result-card").length === 24,
  );
  const viewed = state().viewedResult;
  const statusOnly = {
    query: "later-background",
    items: [
      {
        site: "StatusOnly",
        url: "https://example.org/status-only",
        status: 200,
        state: "candidate",
      },
    ],
  };
  w.receiveNative("search", statusOnly);
  ok(
    "A background search does not replace an explicitly viewed saved result",
    state().viewedResult === viewed,
  );
  await go("search");
  w.receiveNative("search", statusOnly);
  await tick();
  ok(
    "HTTP 200 without profile evidence stays in manual review",
    d.querySelector(".result-card .badge").textContent === "Проверьте вручную",
  );
  const motions = [];
  const motionEnds = [];
  let cancelled = 0;
  let running = [];
  w.matchMedia = () => ({ matches: false });
  w.HTMLElement.prototype.getAnimations = () => running;
  w.HTMLElement.prototype.animate = function (frames, options) {
    const animation = {
      finished: new Promise((resolve) => motionEnds.push(resolve)),
      cancel() {
        cancelled++;
      },
    };
    running = [animation];
    motions.push({ frames, options });
    return animation;
  };
  d.getAnimations = () => running;
  await go("settings");
  ok(
    "Outgoing page fades away while destination stays opaque",
    motions.length === 1 &&
      motions[0].options.duration === 180 &&
      motions[0].frames[1].opacity === 0 &&
      motions[0].frames.every((frame) => !("transform" in frame)),
  );
  await go("databases");
  ok(
    "Rapid navigation cancels the preceding motion",
    motions.length === 2 &&
      cancelled >= 1 &&
      d.querySelectorAll(".route-ghost").length === 1,
  );
  d.querySelector('[data-db="local"]').click();
  ok(
    "Local UI refresh does not animate the entire page again",
    motions.length === 2,
  );
  await go("settings");
  ok(
    "In-app animation setting is removed",
    !d.querySelector("#reduce-motion") &&
      !d.querySelector("main").textContent.includes("Уменьшить анимацию"),
  );
  const beforeReduced = motions.length;
  w.matchMedia = () => ({ matches: true });
  await go("home");
  ok(
    "System reduced-motion preference also skips movement",
    motions.length === beforeReduced,
  );
  ok(
    "Home has six header and nine footer squares",
    d.querySelectorAll(".ambient-square").length === 15 &&
      d
        .querySelector('.ambient-field[data-zone="footer"]')
        .querySelectorAll(".ambient-square").length === 9 &&
      d
        .querySelector('.ambient-field[data-zone="footer"]')
        .querySelectorAll(".ambient-vector").length === 3 &&
      [...d.querySelectorAll(".ambient-field")].every(
        (field) => field.getAttribute("aria-hidden") === "true",
      ),
  );
  ok(
    "System reduced motion pauses decoration",
    [...d.querySelectorAll(".ambient-field")].every((field) =>
      field.classList.contains("is-paused"),
    ),
  );
  w.matchMedia = () => ({ matches: false });
  Object.defineProperty(d, "hidden", { configurable: true, value: false });
  d.dispatchEvent(new w.Event("visibilitychange"));
  ok(
    "Visible page resumes its decoration",
    [...d.querySelectorAll(".ambient-field")].every(
      (field) => !field.classList.contains("is-paused"),
    ),
  );
  const firstSquare = d.querySelector(".ambient-square");
  for (let i = 0; i < 10; i++)
    firstSquare.dispatchEvent(new w.Event("animationiteration"));
  ok(
    "Random cycles reuse a fixed number of elements",
    d.querySelectorAll(".ambient-square").length === 15,
  );
  Object.defineProperty(d, "hidden", { configurable: true, value: true });
  d.dispatchEvent(new w.Event("visibilitychange"));
  ok(
    "Hidden tab pauses all decoration",
    [...d.querySelectorAll(".ambient-field")].every((field) =>
      field.classList.contains("is-paused"),
    ),
  );
  await go("settings");
  ok(
    "Secondary screens share the full square animation",
    d.querySelectorAll(".ambient-square").length === 12,
  );
  for (const field of d.querySelectorAll(".ambient-field")) {
    const vectors = [...field.querySelectorAll(".ambient-vector")];
    ok(
      "Each region has exactly three vectors with one straight",
      vectors.length === 3 &&
        vectors.filter((v) => v.dataset.straight === "true").length === 1,
    );
    ok(
      "Vectors are faster than squares",
      vectors.every(
        (v) =>
          parseFloat(v.style.getPropertyValue("--vector-duration")) >= 6 &&
          parseFloat(v.style.getPropertyValue("--vector-duration")) <= 8,
      ),
    );
    ok(
      "Vector paths use only right-angle turns",
      vectors.every((v) => {
        const points = v
          .querySelector("path")
          .getAttribute("d")
          .match(/-?\d+/g)
          .map(Number);
        for (let i = 2; i < points.length; i += 2)
          if (points[i] !== points[i - 2] && points[i + 1] !== points[i - 1])
            return false;
        return v.dataset.straight !== "true" || points.length === 4;
      }),
    );
    const leftSquares = [...field.querySelectorAll(".ambient-square")].filter(
      (s) => parseFloat(s.style.left) < 30,
    );
    ok(
      "Every region places squares near the left edge",
      leftSquares.length >= 2,
    );
    const vector = vectors[0];
    let lastSide = vector.dataset.entrySide;
    let lastBand = vector.dataset.band;
    let changedEveryCycle = true;
    for (let i = 0; i < 10; i++) {
      vector
        .querySelector("path")
        .dispatchEvent(new w.Event("animationiteration"));
      changedEveryCycle &&=
        vector.dataset.entrySide !== lastSide &&
        vector.dataset.band !== lastBand;
      lastSide = vector.dataset.entrySide;
      lastBand = vector.dataset.band;
    }
    ok(
      "Straight vector changes entry side and coordinate band every cycle",
      changedEveryCycle,
    );
    ok(
      "Vector cycles reuse existing elements",
      field.querySelectorAll(".ambient-vector").length === 3,
    );
    let validRoutes = true;
    let noSharedLines = true;
    const observedTurns = new Set();
    for (let cycle = 0; cycle < 100; cycle++) {
      const lines = [];
      for (const v of vectors) {
        v.querySelector("path").dispatchEvent(
          new w.Event("animationiteration"),
        );
        const coordinates = v
          .querySelector("path")
          .getAttribute("d")
          .match(/-?\d+/g)
          .map(Number);
        const turns = coordinates.length / 2 - 2;
        if (v.dataset.straight === "true") validRoutes &&= turns === 0;
        else {
          observedTurns.add(turns);
          validRoutes &&= turns >= 1 && turns <= 3;
        }
        for (let i = 2; i < coordinates.length; i += 2) {
          const horizontal = coordinates[i + 1] === coordinates[i - 1];
          validRoutes &&= horizontal || coordinates[i] === coordinates[i - 2];
          const fixed = horizontal ? coordinates[i + 1] : coordinates[i];
          noSharedLines &&= !lines.some(
            (l) =>
              l.owner !== v && l.horizontal === horizontal && l.fixed === fixed,
          );
          lines.push({ owner: v, horizontal, fixed });
        }
      }
    }
    ok(
      "Random routes use one to three right-angle turns",
      validRoutes && observedTurns.size === 3,
    );
    ok(
      "Vectors never share horizontal or vertical lines over repeated cycles",
      noSharedLines,
    );
  }
  let snapshotTransitions = 0;
  d.startViewTransition = () => {
    snapshotTransitions++;
  };
  await go("search");
  await go("databases");
  ok(
    "Rapid navigation commits the latest content without snapshot delays",
    snapshotTransitions === 0 &&
      state().page === "databases" &&
      d.querySelector("h1").textContent === "БАЗЫ ДАННЫХ",
  );
  await tick();
  motionEnds.at(-1)();
  await tick();
  ok(
    "Completed page dissolve removes its inert outgoing layer",
    !d.querySelector(".route-ghost"),
  );
  console.log(`${count} checks passed`);
  dom.window.close();
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
