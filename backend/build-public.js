const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../frontend');
const destination = path.resolve(__dirname, '../public');

if (!fs.existsSync(path.join(source, 'index.html'))) {
  throw new Error(`Frontend introuvable : ${source}`);
}

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
console.info(`Frontend copié vers ${destination}`);
