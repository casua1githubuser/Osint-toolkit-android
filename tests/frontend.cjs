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
    "History has a direct navigation destination",
    d.querySelector('.bottom-nav a[href="#history"]'),
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
    "History selects its own navigation item",
    d
      .querySelector('.bottom-nav [aria-current="page"]')
      .getAttribute("href") === "#history",
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
  console.log(`${count} checks passed`);
  dom.window.close();
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
