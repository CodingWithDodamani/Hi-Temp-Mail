/**
 * Compiles public/landing-src.css (Tailwind v4) into public/landing.css
 * using the project's existing node_modules (no npx/bunx needed).
 *
 * Run: node scripts/build-landing-css.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public', 'landing-src.css');
const out = path.join(root, 'public', 'landing.css');

async function main() {
    // NOTE: bare specifiers, resolved from this script's location. Do NOT
    // require() absolute package directories — that breaks on some Node
    // versions for scoped packages (MODULE_NOT_FOUND despite files existing).
    const postcss = require('postcss');
    const tailwind = require('@tailwindcss/postcss');

    const css = fs.readFileSync(src, 'utf8');
    const result = await postcss([tailwind()]).process(css, { from: src });

    // crude minify: strip comments + collapse whitespace
    const minified = result.css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,>~])\s*/g, '$1')
        .replace(/;}/g, '}');

    fs.writeFileSync(out, minified);
    console.log('Wrote', out, (minified.length / 1024).toFixed(1) + ' KiB');
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});