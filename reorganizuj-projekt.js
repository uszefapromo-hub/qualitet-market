const fs = require('fs');
const path = require('path');
const rootDir = __dirname;
const folders = ['assets/images', 'css', 'js', 'pages'];
folders.forEach(folder => {
    const folderPath = path.join(rootDir, folder);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        console.log(`✅ Utworzony folder: ${folder}`);
    }
});
const pliki = fs.readdirSync(rootDir);
pliki.forEach(plik => {
    const sciezka = path.join(rootDir, plik);
    if (fs.statSync(sciezka).isDirectory()) return;
    const rozszerzenie = path.extname(plik).toLowerCase().slice(1);
    let docelowy = null;
    if (rozszerzenie === 'svg') docelowy = 'assets/images';
    else if (rozszerzenie === 'css') docelowy = 'css';
    else if (rozszerzenie === 'js' && plik !== 'reorganizuj-projekt.js') docelowy = 'js';
    else if (rozszerzenie === 'html' && plik !== 'index.html') docelowy = 'pages';
    if (docelowy) {
        const sciezkaDocelowa = path.join(rootDir, docelowy, plik);
        if (!fs.existsSync(sciezkaDocelowa)) {
            fs.renameSync(sciezka, sciezkaDocelowa);
            console.log(`✅ Przeniesiono: ${plik} → ${docelowy}/`);
        }
    }
});
console.log('\n🎉 Reorganizacja ukończona!\n');
console.log('Nowa struktura:');
console.log('├── index.html');
console.log('├── assets/');
console.log('│   └── images/ (wszystkie pliki SVG)');
console.log('├── css/ (wszystkie pliki CSS)');
console.log('├── js/ (wszystkie pliki JS)');
console.log('└── pages/ (wszystkie pliki HTML poza index.html);