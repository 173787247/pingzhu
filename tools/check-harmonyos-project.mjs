#!/usr/bin/env node
/**
 * Checks that the HarmonyOS project declares what the system looks for.
 *
 * Run it on the project, anywhere with node:
 *
 *   node tools/check-harmonyos-project.mjs harmonyos
 *
 * ## Why each check exists
 *
 * Every one of these was a real failure on a real phone, and not one of them
 * produced an error message that pointed at the cause:
 *
 *   - a module without its three files: hvigor names a file you did not touch
 *   - an input method declared as the module's ability rather than as an
 *     extension: the HAP installs, the module is listed, and `bm dump` reports
 *     `"extensionInfos": []` — the system never sees a keyboard
 *   - a metadata resource that does not exist: the extension is declared and
 *     offers nothing
 *   - a subtype list that is empty: same, one level deeper
 *   - a `$media:` or `$string:` reference with nothing behind it: a missing icon
 *     is a build failure, a missing string is a blank label at runtime
 *
 * ## It lives in a file, not in the workflow
 *
 * The first version was inline in harmonyos.yml. A later rewrite of that file
 * replaced it with a one-line placeholder and nobody noticed, because a check
 * that quietly stops running looks exactly like a check that passes.
 *
 * Being a file means it can be run before pushing. Which is how the json5
 * parsing bug in it was found — the same class of bug it exists to catch.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'harmonyos';
const failures = [];
let checks = 0;

function check(what, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`ok    ${what}`);
  } else {
    console.log(`FAIL  ${what}${detail ? ': ' + detail : ''}`);
    failures.push(what);
  }
}

/**
 * json5 → JSON.
 *
 * The two features these files use are comments and trailing commas. Both have
 * to go.
 *
 * The first version of this stripped only commas, which worked until a comment
 * was added to module.json5 — at which point the checker became the build
 * failure. Running it locally first is the only reason that was not a red CI.
 */
function parseJson5(path) {
  return JSON.parse(
    readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/,(\s*[}\]])/g, '$1'),
  );
}

const profilePath = join(root, 'build-profile.json5');
check('build-profile.json5 exists', existsSync(profilePath));
if (!existsSync(profilePath)) {
  console.log(`\n${failures.length} of ${checks} checks failed`);
  process.exit(1);
}

const profile = parseJson5(profilePath);

// ---------------------------------------------------------------- modules
for (const module of profile.modules ?? []) {
  const name = module.name;
  const src = join(root, module.srcPath.replace(/^\.\//, ''));

  for (const required of ['build-profile.json5', 'hvigorfile.ts', 'oh-package.json5']) {
    check(`${name} has ${required}`, existsSync(join(src, required)));
  }

  const manifestPath = join(src, 'src/main/module.json5');
  check(`${name} has src/main/module.json5`, existsSync(manifestPath));
  if (!existsSync(manifestPath)) continue;

  const manifest = parseJson5(manifestPath).module;
  check(`${name}: module.json5 agrees on the name`, manifest.name === name,
    `it says '${manifest.name}'`);
  check(`${name}: module type is known`,
    ['entry', 'feature', 'shared'].includes(manifest.type), manifest.type);

  // Every $media: and $string: the manifest names must resolve. A missing icon
  // is a build failure; a missing string is a blank label at runtime, and
  // nothing reports it.
  const scope = join(src, 'src/main/resources/base');
  for (const [, kind, ref] of readFileSync(manifestPath, 'utf8')
    .matchAll(/\$(media|string):([A-Za-z0-9_]+)/g)) {
    if (kind === 'media') {
      const dir = join(scope, 'media');
      const found = existsSync(dir) && readdirSync(dir).some((f) => f.startsWith(ref + '.'));
      check(`${name}: $media:${ref} resolves`, found);
    } else {
      const file = join(scope, 'element/string.json');
      const has = existsSync(file)
        && JSON.parse(readFileSync(file, 'utf8')).string.some((e) => e.name === ref);
      check(`${name}: $string:${ref} resolves`, has);
    }
  }
}

// ------------------------------------------------------- the input method
const imeManifestPath = join(root, 'keyboard/src/main/module.json5');
if (existsSync(imeManifestPath)) {
  const ime = parseJson5(imeManifestPath).module;

  // The one that cost the most time. An InputMethodExtensionAbility is an
  // extension, so it belongs in extensionAbilities with type "inputMethod" —
  // not in the module's own srcEntry/mainElement, which is how an entry module
  // names its ability. Getting this wrong installs a HAP that the system never
  // offers as a keyboard, with no error anywhere.
  const extensions = (ime.extensionAbilities ?? []).filter((e) => e.type === 'inputMethod');
  check('keyboard declares an inputMethod extension', extensions.length > 0,
    'without it the HAP installs and the system never offers the keyboard');

  for (const ext of extensions) {
    check(`${ext.name}: has a srcEntry`, typeof ext.srcEntry === 'string');
    if (typeof ext.srcEntry === 'string') {
      const file = join(root, 'keyboard/src/main', ext.srcEntry.replace(/^\.\//, ''));
      check(`${ext.name}: srcEntry exists`, existsSync(file), file);
      if (existsSync(file)) {
        check(`${ext.name}: srcEntry extends InputMethodExtensionAbility`,
          readFileSync(file, 'utf8').includes('InputMethodExtensionAbility'));
      }
    }

    const meta = (ext.metadata ?? []).find((m) => m.name === 'ohos.extension.input_method');
    check(`${ext.name}: declares the ohos.extension.input_method metadata`, meta !== undefined);
    if (!meta) continue;

    const profileName = meta.resource.replace('$profile:', '');
    const path = join(root, `keyboard/src/main/resources/base/profile/${profileName}.json`);
    check(`${ext.name}: ${profileName}.json exists`, existsSync(path), path);
    if (!existsSync(path)) continue;

    const subtypes = JSON.parse(readFileSync(path, 'utf8')).subtypes ?? [];
    check(`${ext.name}: declares at least one subtype`, subtypes.length > 0,
      'an extension with no subtypes is declared and offers nothing');
    for (const subtype of subtypes) {
      check(`${ext.name}/${subtype.id}: has an id and a label`,
        typeof subtype.id === 'string' && typeof subtype.label === 'string');
    }
  }

  // setUiContent loads a page; if the page is not registered it loads nothing
  // and the keyboard appears as an empty panel.
  const pages = parseJson5(join(root, 'keyboard/src/main/resources/base/profile/main_pages.json')).src ?? [];
  check('keyboard registers the page setUiContent loads', pages.length > 0);
  for (const page of pages) {
    check(`page ${page} exists`,
      existsSync(join(root, 'keyboard/src/main/ets', page + '.ets')));
  }

  // The engine's declarations and the C++ descriptors are two descriptions of
  // one thing, and nothing keeps them in step. (They were out of step once:
  // index.d.ts said `const composing: string` while napi_init.cpp registered a
  // function, and ArkTS refused to render the component.)
  const dts = join(root, 'keyboard/src/main/cpp/types/libpingzhu/index.d.ts');
  const cpp = join(root, 'keyboard/src/main/cpp/napi_init.cpp');
  if (existsSync(dts) && existsSync(cpp)) {
    const declared = new Set(
      [...readFileSync(dts, 'utf8').matchAll(/export function (\w+)/g)].map((m) => m[1]));
    const registered = new Set(
      [...readFileSync(cpp, 'utf8').matchAll(/\{"(\w+)", nullptr, \w+,/g)].map((m) => m[1]));
    for (const name of registered) {
      check(`index.d.ts declares ${name}`, declared.has(name),
        'registered in napi_init.cpp but missing from the declarations');
    }
    for (const name of declared) {
      check(`napi_init.cpp registers ${name}`, registered.has(name),
        'declared but not registered');
    }
  }
}

console.log();
if (failures.length > 0) {
  console.log(`${failures.length} of ${checks} checks failed`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log(`harmonyos project checks passed (${checks} checks)`);
