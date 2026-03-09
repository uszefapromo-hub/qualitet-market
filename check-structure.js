#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const REQUIRED_DIRS = [
  "assets",
  "assets/images",
  "css",
  "js",
  "pages",
];

const REQUIRED_ROOT_FILES = [
  "index.html",
];

const SECONDARY_PAGES = [
  "platforma.html",
  "login.html",
  "dashboard.html",
  "cennik.html",
  "aktywuj-pro.html",
  "hurtownie.html",
  "qualitetmarket.html",
  "intelligence.html",
  "sklep.html",
  "koszyk.html",
  "checkout.html",
  "zamowienia.html",
  "panel-sklepu.html",
  "generator-sklepu.html",
  "panel-zamowien-sklepu.html",
  "sklepy.html",
  "success.html",
  "suppliers.html",
  "blueprints.html",
];

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function isDir(relPath) {
  const full = path.join(ROOT, relPath);
  return exists(relPath) && fs.statSync(full).isDirectory();
}

function isFile(relPath) {
  const full = path.join(ROOT, relPath);
  return exists(relPath) && fs.statSync(full).isFile();
}

function listFiles(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full);
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function checkDirs() {
  printSection("FOLDERY");
  let ok = true;

  for (const dir of REQUIRED_DIRS) {
    if (isDir(dir)) {
      console.log(`OK  folder: ${dir}`);
    } else {
      console.log(`ERR brak folderu: ${dir}`);
      ok = false;
    }
  }

  return ok;
}

function checkRootFiles() {
  printSection("PLIKI ROOT");
  let ok = true;

  for (const file of REQUIRED_ROOT_FILES) {
    if (isFile(file)) {
      console.log(`OK  plik: ${file}`);
    } else {
      console.log(`ERR brak pliku: ${file}`);
      ok = false;
    }
  }

  return ok;
}

function checkSecondaryPages() {
  printSection("PODSTRONY W pages/");
  let ok = true;

  for (const file of SECONDARY_PAGES) {
    const rel = path.join("pages", file);
    if (isFile(rel)) {
      console.log(`OK  ${rel}`);
    } else {
      console.log(`ERR brak ${rel}`);
      ok = false;
    }
  }

  return ok;
}

function checkLooseFiles() {
  printSection("LUŹNE PLIKI W ROOT");
  const rootItems = fs.readdirSync(ROOT, { withFileTypes: true });

  let hasProblem = false;

  for (const item of rootItems) {
    if (!item.isFile()) continue;

    const name = item.name;
    const ext = path.extname(name).toLowerCase();

    if (name === "index.html") continue;
    if (name === "check-structure.js") continue;
    if (name === "restructure-project.js") continue;
    if (name.startsWith(".")) continue;

    if (ext === ".html" || ext === ".css" || ext === ".js") {
      console.log(`ERR plik nie powinien leżeć w root: ${name}`);
      hasProblem = true;
    }
  }

  if (!hasProblem) {
    console.log("OK  brak luźnych html/css/js w root");
  }

  return !hasProblem;
}

function checkFolderContent() {
  printSection("ZAWARTOŚĆ FOLDERÓW");

  const cssFiles = listFiles("css").filter(f => f.endsWith(".css"));
  const jsFiles = listFiles("js").filter(f => f.endsWith(".js"));
  const imgFiles = listFiles("assets/images").filter(f =>
    /\.(png|jpg|jpeg|gif|webp|svg|avif|ico|bmp)$/i.test(f)
  );

  console.log(`css/: ${cssFiles.length} plików CSS`);
  console.log(`js/: ${jsFiles.length} plików JS`);
  console.log(`assets/images/: ${imgFiles.length} plików obrazów`);

  return true;
}

function main() {
  console.log("=== CHECK STRUKTURY QUALITETMARKET ===");

  const results = [
    checkDirs(),
    checkRootFiles(),
    checkSecondaryPages(),
    checkLooseFiles(),
    checkFolderContent(),
  ];

  const allOk = results.every(Boolean);

  printSection("WYNIK");
  if (allOk) {
    console.log("OK  struktura wygląda poprawnie.");
  } else {
    console.log("ERR struktura nadal wymaga poprawy.");
  }
}

main();