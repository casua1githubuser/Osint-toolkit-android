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
};
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
    "Candidate, negative and unknown remain distinct",
    d.querySelector("main").textContent.includes("Кандидат") &&
      d.querySelector("main").textContent.includes("Не найдено") &&
      d.querySelector("main").textContent.includes("Не определено"),
  );
  d.querySelector("#result-filter").value = "unknown";
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
    d.querySelectorAll(".row").length === 5 &&
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
  const motions = [];
  let cancelled = 0;
  let running = [];
  w.matchMedia = () => ({ matches: false });
  w.HTMLElement.prototype.getAnimations = () => running;
  w.HTMLElement.prototype.animate = function (frames, options) {
    const animation = {
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
    "Fallback entry uses only opacity, without page displacement",
    motions.length === 1 &&
      motions[0].options.duration === 160 &&
      motions[0].frames[1].opacity === 1 &&
      motions[0].frames.every((frame) => !("transform" in frame)),
  );
  await go("databases");
  ok(
    "Rapid navigation cancels the preceding motion",
    motions.length === 2 && cancelled >= 1,
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
    "Home has a bounded six decorative squares",
    d.querySelectorAll(".ambient-square").length === 6 &&
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
    d.querySelectorAll(".ambient-square").length === 6,
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
    "Secondary screens have fewer decorative squares",
    d.querySelectorAll(".ambient-square").length === 4,
  );
  const updates = [];
  const finishes = [];
  let skipped = 0;
  d.startViewTransition = (update) => {
    updates.push(update);
    return {
      skipTransition() {
        skipped++;
      },
      finished: new Promise((resolve) => finishes.push(resolve)),
    };
  };
  await go("search");
  await go("databases");
  updates[0]();
  updates[1]();
  ok(
    "Rapid view transitions skip stale page updates",
    skipped === 1 && state().page === "databases",
  );
  finishes.forEach((resolve) => resolve());
  await tick();
  console.log(`${count} checks passed`);
  dom.window.close();
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
