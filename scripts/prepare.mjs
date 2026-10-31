// 展示に使う wadalab-motion を固定コミットから取ってきて vendor/wadalab-motion/ に置く。
// onmk.work の scripts/prepare-workspace.mjs と同じ手順で、配信パスも /workspace/wadalab-motion/ にそろえる。
import {mkdtemp, readFile, writeFile, mkdir, readdir, copyFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {execFileSync} from 'node:child_process';

const root = new URL('../', import.meta.url);
const experiments = {'wadalab-motion': {repository: 'onmokoworks/wadalab-motion', commit: 'f8e49d61f832eb5bcaa79192d7fba40287632159'}};
const current = await readFile(new URL('vendor/wadalab-motion/build-source.json', root), 'utf8').then(JSON.parse).catch(() => null);
if (current?.commit === experiments['wadalab-motion'].commit) {
  console.log(`wadalab-motion @ ${current.commit}（取得済み）`);
  process.exit(0);
}
const files = ['index.html', 'style.css', 'app.js', 'renderer.js', 'native-renderer.js', 'fold-core.js', 'alpha-motion.js', 'motion-config.js', 'structure.js', 'source-engine.js', 'source-vm.js', 'source-fast.js', 'source-program.json', 'source-glyphs.json', 'deletion-schedule.js', 'playback-control.js', 'SOURCE-LICENSE.txt', 'SOURCE-NOTICE.txt', 'clock.html', 'clock.css', 'clock-app.js', 'clock-core.js', 'font/ascii-outlines.json', 'font/alpha-centerlines.json', 'font/clock-skeletons.json', 'font/LICENSE.txt'];

files.push('source-contour-motion.js', 'wadamotion-4.html', 'motion-4.js', 'motion-4-diagnostics.js', 'transition-spacing.js', 'text-spacing.js', 'night-one.json', 'wadamotion-1.html', 'wadamotion-2.html', 'wadamotion-3.html', 'motion-library.js', 'walk-core.js', 'unfold-step.js', 'clock-flow-core.js', 'glyph-morph.js', 'clock-flow.html');
for (const [name, {repository, commit}] of Object.entries(experiments)) {
  if (!/^[a-z0-9-]+$/.test(name) || !/^[\w-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid workspace source');
  const temporary = await mkdtemp(join(tmpdir(), 'onmk-workspace-'));
  try {
    const response = await fetch(`https://codeload.github.com/${repository}/tar.gz/${commit}`, {signal: AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const archive = join(temporary, 'source.tar.gz');
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    execFileSync('tar', ['-xzf', archive, '-C', temporary]);
    const entries = await readdir(temporary, {withFileTypes: true});
    const source = join(temporary, entries.find(entry => entry.isDirectory()).name, 'web');
    const output = new URL(`vendor/${name}/`, root);
    const base = `/workspace/${name}/`;
    for (const file of files) {
      const target = new URL(file, output);
      await mkdir(new URL('.', target), {recursive: true});
      if (/\.(html|js|css)$/.test(file)) {
        const text = await readFile(join(source, file), 'utf8');
        // Only asset URLs: '/' is also the Lisp VM's division operator.
        const relocated = text.replace(/(["'`])\/(?=(?:[\w-]+\/)*[\w-]+\.(?:js|css|json|txt|ttf)(?:["'`?#]))/g, `$1${base}`);
        await writeFile(target, relocated.replace(/(["'])([^"'\s]+\.(?:js|css))(["'])/g, `$1$2?v=${commit}-2$3`));
      } else await copyFile(join(source, file), target);
    }
    await copyFile(new URL('SOURCE-LICENSE.txt', output), new URL('LICENSE.txt', output));
    await copyFile(join(source, '..', 'LICENSE'), new URL('PROJECT-LICENSE.txt', output));
    await copyFile(join(source, 'font/wlmaru2004emoji.ttf'), new URL('font/wlmaru2004emoji.ttf', output));
    await mkdir(new URL('clock/', output), {recursive: true});
    await copyFile(new URL('clock.html', output), new URL('clock/index.html', output));
    await mkdir(new URL('wadamotion-1/', output), {recursive: true});
    await copyFile(new URL('wadamotion-1.html', output), new URL('wadamotion-1/index.html', output));
    await mkdir(new URL('clock-flow/', output), {recursive: true});
    await copyFile(new URL('clock-flow.html', output), new URL('clock-flow/index.html', output));
    for (const number of [2, 3, 4]) {
      await mkdir(new URL(`wadamotion-${number}/`, output), {recursive: true});
      await copyFile(new URL(`wadamotion-${number}.html`, output), new URL(`wadamotion-${number}/index.html`, output));
    }
    await writeFile(new URL('build-source.json', output), JSON.stringify({repository, commit}));
    // Exercise the packaged files before deployment, including VM arithmetic.
    const {SourceEngine} = await import(new URL('source-engine.js', output));
    const data = await Promise.all(['source-program.json', 'source-glyphs.json', 'font/ascii-outlines.json', 'font/alpha-centerlines.json'].map(async file => JSON.parse(await readFile(new URL(file, output), 'utf8'))));
    const engine = new SourceEngine(...data);
    for (const character of 'あ出羽良彰カタカナＡ０123456789?;:()@%') {
      const glyph = engine.make(character, 11);
      if (!glyph.outlineOnly || engine.alpha.has(glyph.sourceCharacter)) engine.closeLoopPaths(glyph, .5);
    }
    console.log(`workspace: ${name} @ ${commit}`);
  } finally {
    if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected temporary path');
    await rm(temporary, {recursive: true, force: true});
  }
}
