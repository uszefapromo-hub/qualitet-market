#!/usr/bin/env node

/**
 * QualitetMarket / Zarabianie u Szefa
 * Automatyczna reorganizacja repo pod GitHub Pages
 *
 * Co robi:
 * 1. Tworzy foldery:
 *    - assets/images
 *    - css
 *    - js
 *    - pages
 * 2. Przenosi:
 *    - pliki .css -> css/
 *    - pliki .js  -> js/
 *    - obrazy -> assets/images/
 *    - wszystkie .html poza index.html -> pages/
 * 3. Poprawia ścieżki w HTML/CSS/JS po przeniesieniu
 *
 * Uruchomienie:
 * node restructure-project.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const DIRS = {
  assets: path.join(ROOT, "assets"),
  images: path.join(ROOT, "assets", "images"),
  css: path.join(ROOT, "css"),
  js: path.join(ROOT, "js"),
  pages: path.join(ROOT, "pages"),
};

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".avif",
  ".ico",
  ".bmp"
]);

const HTML_KEEP_IN_ROOT = new Set([
  "index.html"
]);

const IGNORE_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "assets",
  "css",
  "js",
  "pages"
]);

function log(message) {
  console.log(message);
}

function exists(p) {
  return fs.existsSync(p);
}

function ensureDir(dir) {
  if (!exists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`+ folder: ${path.relative(ROOT, dir)}`);
  }
}

function safeRead(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function safeWrite(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function moveFile(oldPath, newPath) {
  if (oldPath === newPath) return;
  if (!exists(oldPath)) return;

  ensureDir(path.dirname(newPath));

  if (exists(newPath)) {
    log(`! pomijam, plik już istnieje: ${path.relative(ROOT, newPath)}`);
    return;
  }

  fs.renameSync(oldPath, newPath);
  log(`> przeniesiono: ${path.relative(ROOT, oldPath)} -> ${path.relative(ROOT, newPath)}`);
}

function listRootFiles() {
  return fs.readdirSync(ROOT, { withFileTypes: true });
}

function isRootFile(entry) {
  return entry.isFile();
}

function isRootDir(entry) {
  return entry.isDirectory();
}

function getExt(filename) {
  return path.extname(filename).toLowerCase();
}

function isHtml(filename) {
  return getExt(filename) === ".html";
}

function isCss(filename) {
  return getExt(filename) === ".css";
}

function isJs(filename) {
  return getExt(filename) === ".js";
}

function isImage(filename) {
  return IMAGE_EXTENSIONS.has(getExt(filename));
}

function createTargetFolders() {
  ensureDir(DIRS.assets);
  ensureDir(DIRS.images);
  ensureDir(DIRS.css);
  ensureDir(DIRS.js);
  ensureDir(DIRS.pages);
}

function moveRootFiles() {
  const entries = listRootFiles();

  for (const entry of entries) {
    if (!isRootFile(entry)) continue;

    const fileName = entry.name;
    const oldPath = path.join(ROOT, fileName);

    if (fileName === path.basename(__filename)) continue;

    if (isCss(fileName)) {
      moveFile(oldPath, path.join(DIRS.css, fileName));
      continue;
    }

    if (isJs(fileName)) {
      moveFile(oldPath, path.join(DIRS.js, fileName));
      continue;
    }

    if (isImage(fileName)) {
      moveFile(oldPath, path.join(DIRS.images, fileName));
      continue;
    }

    if (isHtml(fileName) && !HTML_KEEP_IN_ROOT.has(fileName)) {
      moveFile(oldPath, path.join(DIRS.pages, fileName));
      continue;
    }
  }
}

function collectFilesRecursive(dir, matcher, result = []) {
  if (!exists(dir)) return result;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectFilesRecursive(fullPath, matcher, result);
      continue;
    }

    if (matcher(fullPath)) {
      result.push(fullPath);
    }
  }

  return result;
}

function normalizeSlashes(str) {
  return str.replace(/\\/g, "/");
}

function replaceAllSafe(content, from, to) {
  if (!from || from === to) return content;
  return content.split(from).join(to);
}

function fixRootIndexHtml(filePath) {
  let content = safeRead(filePath);

  // CSS
  content = content.replace(
    /href=(["'])(?!https?:\/\/|#|mailto:|tel:|data:|\/)([^"']+\.css)\1/gi,
    (match, quote, href) => {
      const base = path.basename(href);
      return `href=${quote}./css/${base}${quote}`;
    }
  );

  // JS
  content = content.replace(
    /src=(["'])(?!https?:\/\/|#|mailto:|tel:|data:|\/)([^"']+\.js)\1/gi,
    (match, quote, src) => {
      const base = path.basename(src);
      return `src=${quote}./js/${base}${quote}`;
    }
  );

  // Images
  content = content.replace(
    /(src|href)=(["'])(?!https?:\/\/|#|mailto:|tel:|data:|\/)([^"']+\.(png|jpg|jpeg|gif|webp|svg|avif|ico|bmp))\2/gi,
    (match, attr, quote, src) => {
      const base = path.basename(src);
      return `${attr}=${quote}./assets/images/${base}${quote}`;
    }
  );

  // HTML links
  content = content.replace(
    /href=(["'])(?!https?:\/\/|#|mailto:|tel:|data:|\/)([^"']+\.html)\1/gi,
    (match, quote, href) => {
      const base = path.basename(href);
      if (base === "index.html") return `href=${quote}./index.html${quote}`;
      return `href=${quote}./pages/${base}${quote}`;
    }
  );

  safeWrite(filePath, content);
  log(`✓ poprawiono ścieżki: ${path.relative(ROOT, filePath)}`);
}

function fixPageHtml(filePath) {
  let content = safeRead(filePath);

  // CSS
  content = content.replace(
    /href=(["'])(?!https?:\/\/|#|mailto:|tel:|data:|\/)([^"']+\.css)\1/gi,
    (match, quote, href) => {
      const base = path.basename(href);
      return `href=${quote}../css/${base}${quote}`;
    }
  );

  // JS
  content = content.replace(
    /src=(["'])(?!https?:\/\/|#|mailto:|tel:|data:|\/)([^"']+\.js)\1/gi,
    (match, quote, src) => {
      const base = path.basename(src);
      return `src=${quote}../js/${base}${quote}`;
    }
  );

  // Images
  content = content.replace(
    /(src|href)=(["'])(?!https?:\/\/|#|mailto:|tel:|data:|\/)([^"']+\.(png|jpg|jpeg|gif|webp|svg|avif|ico|bmp))\2/gi,
    (match, attr, quote, src) => {
      const base = path.basename(src);
      return `${attr}=${quote}../assets/images/${base}${quote}`;
    }
  );

  // HTML links
  content = content.replace(
    /href=(["'])(?!https?:\/\/|#|mailto:|tel:|data:|\/)([^"']+\.html)\1/gi,
    (match, quote, href) => {
      const base = path.basename(href);
      if (base === "index.html") {
        return `href=${quote}../index.html${quote}`;
      }
      return `href=${quote}./${base}${quote}`;
    }
  );

  safeWrite(filePath, content);
  log(`✓ poprawiono ścieżki: ${path.relative(ROOT, filePath)}`);
}

function fixCssFiles() {
  const cssFiles = collectFilesRecursive(DIRS.css, (f) => f.endsWith(".css"));

  for (const filePath of cssFiles) {
    let content = safeRead(filePath);

    content = content.replace(
      /url\((["']?)(?!https?:\/\/|data:|\/)([^"')]+\.(png|jpg|jpeg|gif|webp|svg|avif|ico|bmp))\1\)/gi,
      (match, quote, assetPath) => {
        const base = path.basename(assetPath);
        const q = quote || "";
        return `url(${q}../assets/images/${base}${q})`;
      }
    );

    safeWrite(filePath, content);
    log(`✓ poprawiono assety CSS: ${path.relative(ROOT, filePath)}`);
  }
}

function fixJsFiles() {
  const jsFiles = collectFilesRecursive(DIRS.js, (f) => f.endsWith(".js"));

  for (const filePath of jsFiles) {
    let content = safeRead(filePath);

    // Najczęstsze stringi ze ścieżkami do stron
    const replacements = [
      ["'dashboard.html'", "'./pages/dashboard.html'"],
      ['"dashboard.html"', '"./pages/dashboard.html"'],
      ["'login.html'", "'./pages/login.html'"],
      ['"login.html"', '"./pages/login.html"'],
      ["'platforma.html'", "'./pages/platforma.html'"],
      ['"platforma.html"', '"./pages/platforma.html"'],
      ["'cennik.html'", "'./pages/cennik.html'"],
      ['"cennik.html"', '"./pages/cennik.html"'],
      ["'hurtownie.html'", "'./pages/hurtownie.html'"],
      ['"hurtownie.html"', '"./pages/hurtownie.html"'],
      ["'qualitetmarket.html'", "'./pages/qualitetmarket.html'"],
      ['"qualitetmarket.html"', '"./pages/qualitetmarket.html"'],
      ["'intelligence.html'", "'./pages/intelligence.html'"],
      ['"intelligence.html"', '"./pages/intelligence.html"'],
      ["'sklep.html'", "'./pages/sklep.html'"],
      ['"sklep.html"', '"./pages/sklep.html"'],
      ["'koszyk.html'", "'./pages/koszyk.html'"],
      ['"koszyk.html"', '"./pages/koszyk.html"'],
      ["'checkout.html'", "'./pages/checkout.html'"],
      ['"checkout.html"', '"./pages/checkout.html"'],
      ["'zamowienia.html'", "'./pages/zamowienia.html'"],
      ['"zamowienia.html"', '"./pages/zamowienia.html"'],
      ["'panel-sklepu.html'", "'./pages/panel-sklepu.html'"],
      ['"panel-sklepu.html"', '"./pages/panel-sklepu.html"'],
      ["'generator-sklepu.html'", "'./pages/generator-sklepu.html'"],
      ['"generator-sklepu.html"', '"./pages/generator-sklepu.html"'],
      ["'panel-zamowien-sklepu.html'", "'./pages/panel-zamowien-sklepu.html'"],
      ['"panel-zamowien-sklepu.html"', '"./pages/panel-zamowien-sklepu.html"'],
      ["'sklepy.html'", "'./pages/sklepy.html'"],
      ['"sklepy.html"', '"./pages/sklepy.html"'],
      ["'success.html'", "'./pages/success.html'"],
      ['"success.html"', '"./pages/success.html"'],
      ["'suppliers.html'", "'./pages/suppliers.html'"],
      ['"suppliers.html"', '"./pages/suppliers.html"'],
      ["'blueprints.html'", "'./pages/blueprints.html'"],
      ['"blueprints.html"', '"./pages/blueprints.html"']
    ];

    for (const [from, to] of replacements) {
      content = replaceAllSafe(content, from, to);
    }

    safeWrite(filePath, content);
    log(`✓ poprawiono linki JS: ${path.relative(ROOT, filePath)}`);
  }
}

function scanNestedLooseFiles() {
  const entries = listRootFiles();

  for (const entry of entries) {
    if (!isRootDir(entry)) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const fullDir = path.join(ROOT, entry.name);
    const nestedFiles = collectFilesRecursive(fullDir, () => true);

    for (const filePath of nestedFiles) {
      const fileName = path.basename(filePath);
      const ext = getExt(fileName);

      if (ext === ".css") {
        moveFile(filePath, path.join(DIRS.css, fileName));
        continue;
      }

      if (ext === ".js") {
        moveFile(filePath, path.join(DIRS.js, fileName));
        continue;
      }

      if (IMAGE_EXTENSIONS.has(ext)) {
        moveFile(filePath, path.join(DIRS.images, fileName));
        continue;
      }

      if (ext === ".html" && fileName !== "index.html") {
        moveFile(filePath, path.join(DIRS.pages, fileName));
        continue;
      }
    }
  }
}

function main() {
  log("=== QualitetMarket: start reorganizacji ===");

  createTargetFolders();
  moveRootFiles();
  scanNestedLooseFiles();

  const rootIndex = path.join(ROOT, "index.html");
  if (exists(rootIndex)) {
    fixRootIndexHtml(rootIndex);
  } else {
    log("! brak index.html w root");
  }

  const pageHtmlFiles = collectFilesRecursive(DIRS.pages, (f) => f.endsWith(".html"));
  for (const filePath of pageHtmlFiles) {
    fixPageHtml(filePath);
  }

  fixCssFiles();
  fixJsFiles();

  log("=== Gotowe ===");
  log("Sprawdź teraz pliki, zrób commit i wrzuć na GitHub Pages.");
}

main();