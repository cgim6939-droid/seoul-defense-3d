// 소스 조각(src/)을 하나의 index.html로 합칩니다:  node build.mjs
import fs from 'node:fs';
const dir = new URL('./src/', import.meta.url);
const js = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const head = fs.readFileSync(new URL('head.html', dir), 'utf8');
const tail = fs.readFileSync(new URL('tail.html', dir), 'utf8');
const body = js.map(f => `// ---- ${f} ----\n` + fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
fs.writeFileSync(new URL('./index.html', import.meta.url), head + body + '\n' + tail);
fs.writeFileSync(new URL('./.build_check.mjs', import.meta.url), body);
console.log(`index.html built from ${js.length} parts, ${(head.length + body.length + tail.length) / 1024 | 0} KB`);
