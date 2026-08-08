#!/usr/bin/env node

/**
 * Build the WealthMe prototype into one portable HTML file.
 *
 * The generated file embeds every page and all shared assets. Each page is
 * rendered inside an iframe so its page-level scripts remain isolated, while
 * a small navigation bridge keeps relative .html links working.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const prototypeDir = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(prototypeDir, "pages");
const outputPath = path.join(
  prototypeDir,
  "WealthMe-Prototype-Standalone.html",
);

const vendorUrls = {
  lucide: "https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js",
  apexcharts:
    "https://cdn.jsdelivr.net/npm/apexcharts@3.54.1/dist/apexcharts.min.js",
  fonts:
    "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap",
};

const styleMarker = "<!-- WM_STANDALONE_SHARED_STYLES -->";
const scriptMarker = "<!-- WM_STANDALONE_SHARED_SCRIPTS -->";

const fetchAsset = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok)
    throw new Error(`Gagal mengambil ${url}: HTTP ${response.status}`);
  return response;
};

const fetchText = async (url, options) =>
  (await fetchAsset(url, options)).text();

const decode = (value) => Buffer.from(value, "base64").toString("utf8");

const loadPreviousVendorAssets = async (tokensCss) => {
  try {
    const previousHtml = await readFile(outputPath, "utf8");
    const match = previousHtml.match(
      /const ASSETS = (.+?);\n\s+const frame =/s,
    );
    if (!match) return {};

    const previousAssets = JSON.parse(match[1]);
    const previousCss = decode(previousAssets.css || "");
    const tokensIndex = previousCss.indexOf(tokensCss);

    return {
      lucide: decode(
        previousAssets.lucideSource || previousAssets.lucide || "",
      ),
      apexcharts: decode(previousAssets.apexcharts || ""),
      fonts:
        tokensIndex >= 0 ? previousCss.slice(0, tokensIndex).trimEnd() : "",
    };
  } catch {
    return {};
  }
};

const fetchWithFallback = async (label, task, fallback = "") => {
  try {
    return await task();
  } catch (error) {
    if (!fallback) throw error;
    console.warn(`${label} tidak dapat diunduh; memakai bundle sebelumnya.`);
    return fallback;
  }
};

const toPascalCase = (value) =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const collectIconNames = (...sources) => {
  const names = new Set(["eye", "eye-off"]);

  for (const source of sources) {
    for (const match of source.matchAll(/data-lucide=["']([a-z0-9-]+)["']/gi))
      names.add(match[1]);
    for (const match of source.matchAll(/\bicon:\s*["']([a-z0-9-]+)["']/gi))
      names.add(match[1]);
    const glyphMap = source.match(/const ICON_GLYPHS = \{([\s\S]+?)\n  \};/);
    if (glyphMap) {
      for (const match of glyphMap[1].matchAll(/:\s*["']([a-z0-9-]+)["']/gi))
        names.add(match[1]);
    }
  }

  return [...names].sort();
};

const createPortableIconRuntime = (lucideSource, iconNames) => {
  const context = { window: {}, document: {}, navigator: {} };
  context.self = context.window;
  context.globalThis = context.window;
  vm.runInNewContext(lucideSource, context);

  const lucide = context.window.lucide;
  if (!lucide?.icons)
    throw new Error("Bundle Lucide tidak berisi definisi ikon.");

  const definitions = {};
  const missing = [];
  const aliases = { "user-lock": "LockKeyhole" };
  for (const name of iconNames) {
    const icon = lucide.icons[aliases[name] || toPascalCase(name)];
    if (!icon) {
      missing.push(name);
      continue;
    }
    definitions[name] = icon[2];
  }

  if (missing.length)
    console.warn(`Ikon Lucide tidak ditemukan: ${missing.join(", ")}`);

  return `
    (() => {
      const definitions = ${JSON.stringify(definitions)};
      const namespace = "http://www.w3.org/2000/svg";
      const rootAttributes = {
        xmlns: namespace,
        width: "24",
        height: "24",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
      };

      const appendNode = (parent, definition) => {
        const [tag, attributes = {}, children = []] = definition;
        const node = document.createElementNS(namespace, tag);
        Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
        children.forEach((child) => appendNode(node, child));
        parent.appendChild(node);
      };

      const createIcons = () => {
        document.querySelectorAll("[data-lucide]").forEach((placeholder) => {
          const name = placeholder.getAttribute("data-lucide");
          const definition = definitions[name];
          if (!definition) return;

          const svg = document.createElementNS(namespace, "svg");
          Object.entries(rootAttributes).forEach(([key, value]) => svg.setAttribute(key, value));
          [...placeholder.attributes].forEach(({ name: key, value }) => {
            if (key !== "data-lucide" && key !== "class") svg.setAttribute(key, value);
          });
          const originalClass = placeholder.getAttribute("class") || "";
          svg.setAttribute("class", ["lucide", "lucide-" + name, originalClass].filter(Boolean).join(" "));
          svg.setAttribute("data-icon", name);
          definition.forEach((child) => appendNode(svg, child));
          placeholder.replaceWith(svg);
        });
      };

      window.lucide = { createIcons };
      let renderQueued = false;
      const observer = new MutationObserver(() => {
        if (renderQueued) return;
        renderQueued = true;
        queueMicrotask(() => {
          renderQueued = false;
          createIcons();
        });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
  `;
};

const embedGoogleFonts = async () => {
  let css = await fetchText(vendorUrls.fonts, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const urls = [
    ...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g),
  ].map((match) => match[1]);

  for (const url of [...new Set(urls)]) {
    const response = await fetchAsset(url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const mime =
      response.headers.get("content-type")?.split(";")[0] || "font/ttf";
    css = css.replaceAll(
      url,
      `data:${mime};base64,${bytes.toString("base64")}`,
    );
  }

  return css;
};

const sharedLinkPattern =
  /\s*<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|assets\/(?:tokens|app)\.css)[^>]*\/?>/gis;
const sharedScriptPattern =
  /\s*<script\b[^>]*src=["'][^"']*(?:lucide[^"']*\.js|apexcharts[^"']*\.js|assets\/shell\.js|assets\/charts\.js)["'][^>]*>\s*<\/script>/gis;

const preparePage = (html) => {
  let prepared = html.replace(sharedLinkPattern, "");
  prepared = prepared.replace("</head>", `    ${styleMarker}\n  </head>`);

  let insertedScriptMarker = false;
  prepared = prepared.replace(sharedScriptPattern, () => {
    if (insertedScriptMarker) return "";
    insertedScriptMarker = true;
    return `\n    ${scriptMarker}`;
  });

  if (!insertedScriptMarker) {
    prepared = prepared.replace("</body>", `    ${scriptMarker}\n  </body>`);
  }

  return prepared;
};

const pageFiles = (await readdir(pagesDir))
  .filter((file) => file.endsWith(".html"))
  .sort();
const pageEntries = await Promise.all(
  pageFiles.map(async (file) => {
    const html = await readFile(path.join(pagesDir, file), "utf8");
    const id = path.basename(file, ".html");
    const title = html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim() || id;
    return [
      id,
      { title, html: Buffer.from(preparePage(html)).toString("base64") },
    ];
  }),
);

const indexHtml = await readFile(path.join(prototypeDir, "index.html"), "utf8");
pageEntries.unshift([
  "index",
  {
    title:
      indexHtml.match(/<title>(.*?)<\/title>/is)?.[1]?.trim() ||
      "Prototype UI/UX · WealthMe",
    html: Buffer.from(preparePage(indexHtml)).toString("base64"),
  },
]);

const [tokensCss, appCss, shellJs, chartsJs] = await Promise.all([
  readFile(path.join(prototypeDir, "assets/tokens.css"), "utf8"),
  readFile(path.join(prototypeDir, "assets/app.css"), "utf8"),
  readFile(path.join(prototypeDir, "assets/shell.js"), "utf8"),
  readFile(path.join(prototypeDir, "assets/charts.js"), "utf8"),
]);

const previousVendorAssets = await loadPreviousVendorAssets(tokensCss);
const [lucideSource, apexchartsJs, fontsCss] = await Promise.all([
  fetchWithFallback(
    "Lucide",
    () => fetchText(vendorUrls.lucide),
    previousVendorAssets.lucide,
  ),
  fetchWithFallback(
    "ApexCharts",
    () => fetchText(vendorUrls.apexcharts),
    previousVendorAssets.apexcharts,
  ),
  fetchWithFallback(
    "Google Fonts",
    embedGoogleFonts,
    previousVendorAssets.fonts,
  ),
]);

const preparedSources = pageEntries.map(([, entry]) => decode(entry.html));
const iconNames = collectIconNames(...preparedSources, shellJs, chartsJs);
const lucideJs = createPortableIconRuntime(lucideSource, iconNames);

const encode = (value) => Buffer.from(value).toString("base64");
const assets = {
  css: encode(`${fontsCss}\n${tokensCss}\n${appCss}`),
  lucide: encode(lucideJs),
  lucideSource: encode(lucideSource),
  apexcharts: encode(apexchartsJs),
  shell: encode(shellJs),
  charts: encode(chartsJs),
  bridge: encode(`
    (() => {
      document.addEventListener("click", (event) => {
        const link = event.target.closest?.("a[href]");
        if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const href = link.getAttribute("href")?.trim();
        if (!href || href.startsWith("#") || /^(?:https?:|mailto:|tel:|javascript:)/i.test(href)) return;

        const cleanPath = href.split(/[?#]/)[0];
        const file = cleanPath.split("/").pop();
        if (!file?.toLowerCase().endsWith(".html")) return;

        event.preventDefault();
        parent.postMessage(
          { type: "wealthme-standalone:navigate", page: file.replace(/\.html$/i, "") || "index" },
          "*",
        );
      });
    })();
  `),
};

const pages = Object.fromEntries(pageEntries);
const generatedAt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
}).format(new Date());

const standaloneHtml = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Prototype UI/UX WealthMe dalam satu file HTML mandiri." />
    <title>WealthMe Prototype</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #eef3f5; }
      #wealthme-app { display: block; width: 100%; height: 100%; border: 0; background: #eef3f5; }
      #wealthme-loader {
        position: fixed; inset: 0; z-index: 2; display: grid; place-items: center;
        background: #eef3f5; color: #0f766e; font: 600 14px system-ui, sans-serif;
      }
      #wealthme-loader[data-ready="true"] { display: none; }
      @media (prefers-color-scheme: dark) {
        html, body, #wealthme-app, #wealthme-loader { background: #0f1f31; }
        #wealthme-loader { color: #5eead4; }
      }
    </style>
  </head>
  <body>
    <iframe id="wealthme-app" title="WealthMe Prototype"></iframe>
    <div id="wealthme-loader" role="status" aria-live="polite">Membuka prototype WealthMe…</div>
    <script>
      // Generated ${generatedAt}. Source: docs/prototype. Do not edit this bundle by hand.
      const PAGES = ${JSON.stringify(pages)};
      const ASSETS = ${JSON.stringify(assets)};
      const frame = document.getElementById("wealthme-app");
      const loader = document.getElementById("wealthme-loader");
      const decoder = new TextDecoder();

      const decode = (value) => {
        const binary = atob(value);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return decoder.decode(bytes);
      };

      const scriptTag = (source) => "<scr" + "ipt>" + source + "</scr" + "ipt>";
      const sharedStyles = "<style>" + decode(ASSETS.css) + "</style>";
      const sharedScripts = ["lucide", "apexcharts", "shell", "charts", "bridge"]
        .map((key) => scriptTag(decode(ASSETS[key])))
        .join("\\n");

      const normalizePage = (value) => {
        const cleaned = String(value || "index")
          .replace(/^#/, "")
          .split(/[?&]/)[0]
          .split("/")
          .pop()
          .replace(/\\.html$/i, "");
        return PAGES[cleaned] ? cleaned : "index";
      };

      const renderPage = (requestedPage, addHistory = false) => {
        const page = normalizePage(requestedPage);
        const entry = PAGES[page];
        loader.dataset.ready = "false";
        loader.textContent = "Membuka " + entry.title.replace(/ · WealthMe$/, "") + "…";

        const html = decode(entry.html)
          .replace(${JSON.stringify(styleMarker)}, sharedStyles)
          .replace(${JSON.stringify(scriptMarker)}, sharedScripts);

        frame.title = entry.title;
        frame.srcdoc = html;
        document.title = entry.title;

        if (addHistory) history.pushState({ page }, "", "#" + page);
        else history.replaceState({ page }, "", "#" + page);
      };

      frame.addEventListener("load", () => {
        loader.dataset.ready = "true";
      });

      window.addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow || event.data?.type !== "wealthme-standalone:navigate") return;
        renderPage(event.data.page, true);
      });

      window.addEventListener("popstate", (event) => {
        renderPage(event.state?.page || location.hash, false);
      });

      renderPage(location.hash || "index");
    </script>
  </body>
</html>
`;

await writeFile(outputPath, standaloneHtml);
console.log(`Standalone prototype dibuat: ${outputPath}`);
console.log(`Halaman tertanam: ${pageEntries.length}`);
console.log(
  `Ukuran: ${(Buffer.byteLength(standaloneHtml) / 1024 / 1024).toFixed(2)} MB`,
);
