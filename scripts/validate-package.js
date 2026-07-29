'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.equal(packageJson.name, 'node-red-contrib-blaulicht-sms');
assert.match(packageJson.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.ok(packageJson.keywords.includes('node-red'));
assert.equal(packageJson.license, 'MIT');
assert.ok(packageJson.repository.url.includes('riederch/node-red-contrib-blaulicht-sms'));
assert.ok(packageJson['node-red'] && packageJson['node-red'].nodes);

for (const nodeFile of Object.values(packageJson['node-red'].nodes)) {
    const javascriptPath = path.join(root, nodeFile);
    const htmlPath = javascriptPath.replace(/\.js$/, '.html');
    assert.ok(fs.existsSync(javascriptPath), `Missing Node-RED runtime file: ${nodeFile}`);
    assert.ok(fs.existsSync(htmlPath), `Missing Node-RED editor file: ${path.relative(root, htmlPath)}`);

    const html = fs.readFileSync(htmlPath, 'utf8');
    const iconMatch = html.match(/icon:\s*['"]([^'"]+)['"]/);
    if (iconMatch && !iconMatch[1].startsWith('font-awesome/')) {
        const iconPath = path.join(root, 'icons', iconMatch[1]);
        assert.ok(fs.existsSync(iconPath), `Missing custom Node-RED icon: ${path.relative(root, iconPath)}`);
    }
}

const requiredFiles = [
    'README.md',
    'README.de.md',
    'LICENSE',
    'CHANGELOG.md',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'docs/ARCHITECTURE.md'
];
for (const file of requiredFiles) {
    assert.ok(fs.existsSync(path.join(root, file)), `Missing required project file: ${file}`);
}

function collectFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
    });
}

const javascriptFiles = collectFiles(root).filter((file) =>
    file.endsWith('.js') && !file.includes(`${path.sep}node_modules${path.sep}`)
);
for (const file of javascriptFiles) {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: path.relative(root, file) });
}

const examplesDirectory = path.join(root, 'examples');
for (const file of collectFiles(examplesDirectory).filter((entry) => entry.endsWith('.json'))) {
    const flow = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(Array.isArray(flow), `Example flow must be an array: ${path.relative(root, file)}`);
}

console.log(`Validated ${javascriptFiles.length} JavaScript files and package metadata.`);
