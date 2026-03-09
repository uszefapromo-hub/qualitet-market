const fs = require('fs');
const path = require('path');

const directories = ['assets/images', 'pages', 'css', 'js'];
const baseDir = './'; // adjust if necessary

// Function to create directories if they don't exist
const createDirectories = () => {
    directories.forEach(dir => {
        if (!fs.existsSync(path.join(baseDir, dir))) {
            fs.mkdirSync(path.join(baseDir, dir), { recursive: true });
        }
    });
};

// Function to move files to appropriate directories
const moveFiles = () => {
    fs.readdirSync(baseDir).forEach(file => {
        const ext = path.extname(file);
        const filename = path.basename(file, ext);

        if (ext === '.svg') {
            fs.renameSync(path.join(baseDir, file), path.join(baseDir, 'assets/images', file));
            console.log(`Moved ${file} to assets/images/`);
        } else if (ext === '.css') {
            fs.renameSync(path.join(baseDir, file), path.join(baseDir, 'css', file));
            console.log(`Moved ${file} to css/`);
        } else if (ext === '.js' && !filename.includes('script')) {
            fs.renameSync(path.join(baseDir, file), path.join(baseDir, 'js', file));
            console.log(`Moved ${file} to js/`);
        } else if (ext === '.html' && file !== 'index.html') {
            fs.renameSync(path.join(baseDir, file), path.join(baseDir, 'pages', file));
            console.log(`Moved ${file} to pages/`);
        }
    });
};

// Function to remove duplicates
const removeDuplicates = () => {
    const seen = new Set();
    fs.readdirSync(baseDir).forEach(file => {
        const match = file.match(/^(.*?)(\d+)(\..+)$/);
        if (match && seen.has(match[1])) {
            fs.unlinkSync(path.join(baseDir, file));
            console.log(`Removed duplicate file: ${file}`);
        } else if (match) {
            seen.add(match[1]);
        }
    });
};

// Function to update HTML file paths
const updateHTMLPaths = () => {
    fs.readdirSync(path.join(baseDir, 'pages')).forEach(file => {
        if (path.extname(file) === '.html') {
            let content = fs.readFileSync(path.join(baseDir, 'pages', file), 'utf-8');
            content = content.replace(/(src|href)=['"]?(.*?)['"]?/g, (match, p1, p2) => {
                const newPath = p2.replace(/(assets|css|js|pages)/g, '');
                return `${p1}='${newPath}'`;
            });
            fs.writeFileSync(path.join(baseDir, 'pages', file), content);
            console.log(`Updated paths in ${file}`);
        }
    });
};

const cleanup = () => {
    createDirectories();
    moveFiles();
    removeDuplicates();
    updateHTMLPaths();
};

cleanup();
console.log('Cleanup and reorganization complete!');
