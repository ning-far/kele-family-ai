import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {RELEASE_VERSION} from '../apps/web/src/release.ts';

const platform = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = existsSync(resolve(platform,'originals/EnglishLearning/src'))
  ? resolve(platform,'originals') : resolve(platform, '..');
const publicRoot = resolve(platform, 'apps/web/public/legacy');
await mkdir(publicRoot, { recursive: true });
const english = resolve(publicRoot, 'english');
await mkdir(english, { recursive: true });
// Explicit client allowlist: never copy server, .env, certificates, recordings or model weights.
await cp(resolve(project, 'EnglishLearning/src'), join(english, 'src'), { recursive: true });
// Preserve artwork with an extension allowlist; never publish arbitrary files from assets.
async function copyArtwork(source,target){
  await mkdir(target,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})){
    if(entry.isDirectory())await copyArtwork(join(source,entry.name),join(target,entry.name));
    else if(entry.isFile()&&/\.(png|jpe?g|webp|gif|svg|woff2?|ttf|otf)$/i.test(entry.name))await cp(join(source,entry.name),join(target,entry.name));
  }
}
await copyArtwork(resolve(project,'EnglishLearning/assets'),join(english,'assets'));
const rewrite = text => text.replace(/(["'`])\/(src|assets|models|api)(?=[/"'`])/g, '$1/legacy/english/$2');
async function rebase(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await rebase(path);
    else if (/\.(js|css)$/.test(entry.name)) await writeFile(path, rewrite(await readFile(path, 'utf8')));
  }
}
await rebase(join(english, 'src'));
const mainPath=join(english,'src/main.js');
let main=await readFile(mainPath,'utf8');
main=main.replace(/connectBtn\.addEventListener\("click", \(\) => \{[\s\S]*?\n\}\);/, 'connectBtn.hidden = true;');
main=main.replace(/\/\* Try to auto-connect[\s\S]*?\/\* Gentle capability warnings\. \*\//, '/* Gentle capability warnings. */');
main=main.replace('probeMic().catch(() => {});', '// Microphone access only starts after the user chooses to record.');
main=main.replace('import { initDebug, probeMic, debugLog }', 'import { initDebug, debugLog }');
main=main.replace(/if \(!serial\.supported\) \{[\s\S]*?\n\}/, '');
main=main.replace('parts.push(connected ? "Board connected" : "Board not connected");','parts.push("无线按键 / 屏幕操作");');
await writeFile(mainPath,main);
const html = rewrite(await readFile(resolve(project, 'EnglishLearning/index.html'), 'utf8'))
  .replace(', maximum-scale=1.0, user-scalable=no', '');
await cp(join(platform,'scripts/english-mobile.css'),join(english,'mobile.css'));
await cp(join(platform,'scripts/english-short-screen.css'),join(english,'short-screen.css'));
await cp(join(platform,'apps/web/src/viewport-layout.css'),join(english,'viewport-layout.css'));
await writeFile(join(english, 'index.html'), html.replace('</head>',`<link rel="stylesheet" href="/legacy/english/mobile.css?v=${RELEASE_VERSION}"><link rel="stylesheet" href="/legacy/english/short-screen.css?v=${RELEASE_VERSION}"></head>`).replace('</body>','<script type="module" src="/legacy/english/wireless.js"></script></body>'));
const drum = resolve(project, 'drumRhythmGame');
const built = spawnSync(process.execPath, [resolve(drum, 'node_modules/vite/bin/vite.js'), 'build', '--base', '/legacy/drum/', '--outDir', resolve(publicRoot, 'drum'), '--emptyOutDir', 'false'], { cwd: drum, env:{...process.env,VITE_KELE_WIRELESS_ONLY:'1',VITE_KELE_RELEASE:RELEASE_VERSION}, stdio: 'inherit' });
if (built.status !== 0) throw new Error('Original drum build failed');
await cp(resolve(platform, 'scripts/original-drum-touch.js'), resolve(publicRoot, 'drum/touch.js'));
const drumHtml = resolve(publicRoot, 'drum/index.html');
await cp(join(platform,'apps/web/src/viewport-layout.css'),join(publicRoot,'drum/viewport-layout.css'));
await writeFile(drumHtml, (await readFile(drumHtml, 'utf8')).replace(', maximum-scale=1.0, user-scalable=no','').replace('</body>', '<script type="module" src="/legacy/drum/touch.js"></script><script type="module" src="/legacy/drum/wireless.js"></script></body>'));
for(const dir of [english,resolve(publicRoot,'drum')])await cp(resolve(platform,'scripts/original-wireless.js'),join(dir,'wireless.js'));
for(const dir of [english,resolve(publicRoot,'drum')]){
 const page=join(dir,'index.html');
 await writeFile(page,(await readFile(page,'utf8')).replace('</head>',`<link rel="stylesheet" href="./viewport-layout.css?v=${RELEASE_VERSION}"></head>`));
}
console.log('Original clients prepared; no credentials or model weights copied.');
