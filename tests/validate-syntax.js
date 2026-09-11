const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const serverFiles = fs.readdirSync(projectRoot)
  .filter(file => file.endsWith('.gs'))
  .sort();

serverFiles.forEach(file => {
  const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
  new vm.Script(source, { filename: file });
});

const html = fs.readFileSync(path.join(projectRoot, 'Index.html'), 'utf8');
const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi));
if (!scripts.length) throw new Error('Index.html does not contain an inline script.');

scripts.forEach((match, index) => {
  if (/(['"`])https?:\/\//.test(match[1])) {
    throw new Error(`Index.html#script-${index + 1} contains a literal URL protocol that Apps Script may truncate.`);
  }
  new vm.Script(match[1], { filename: `Index.html#script-${index + 1}` });
});

console.log(`Syntax passed: ${serverFiles.length} Apps Script files and ${scripts.length} HTML script block(s).`);
