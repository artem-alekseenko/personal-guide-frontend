import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

it("initializes the dev Vue checker without a cache and detects SFC type errors", async () => {
  const require = createRequire(import.meta.url);
  const nuxt = createRequire(require.resolve("nuxt/package.json"));
  const builder = createRequire(nuxt.resolve("@nuxt/vite-builder"));
  const checkerRoot = resolve(
    dirname(builder.resolve("vite-plugin-checker")),
    "..",
  );
  const fixture = await mkdtemp(join(tmpdir(), "pg-dev-checker-"));
  try {
    // Run the installed checker against its actual dependency graph, with a fresh
    // private cache so a previous failed initialization cannot mask the crash.
    await symlink(dirname(checkerRoot), join(fixture, "node_modules"), "dir");
    await cp(
      join(checkerRoot, "dist/checkers/vueTsc/prepareVueTsc.js"),
      join(fixture, "prepareVueTsc.mjs"),
    );
    await cp(
      join(checkerRoot, "dist/checkers/vueTsc/languagePlugins.cjs"),
      join(fixture, "languagePlugins.cjs"),
    );
    await writeFile(
      join(fixture, "check.mjs"),
      `
      import { createRequire } from 'node:module';
      import { writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      import { prepareVueTsc } from './prepareVueTsc.mjs';
      const require = createRequire(import.meta.url);
      const { targetTsDir } = await prepareVueTsc();
      const ts = require(join(targetTsDir, 'lib/typescript.js'));
      const source = join(import.meta.dirname, 'App.vue');
      const check = (value) => {
        writeFileSync(source, '<script setup lang="ts">const count: number = ' + value + '</script>');
        const options = {
          noEmit: true, strict: true, skipLibCheck: true,
          target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
        };
        const program = ts.createProgram({
          rootNames: [source], options, host: ts.createCompilerHost(options),
        });
        return ts.getPreEmitDiagnostics(program)
          .filter(d => d.file?.fileName === source)
          .map(d => d.code);
      };
      writeFileSync(join(import.meta.dirname, 'result.json'), JSON.stringify({ invalid: check('"wrong"'), valid: check('42') }));
    `,
    );
    execFileSync(process.execPath, [join(fixture, "check.mjs")], {
      encoding: "utf8",
      timeout: 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(
      await readFile(join(fixture, "result.json"), "utf8"),
    );
    expect(result.invalid).toContain(2322);
    expect(result.valid).toEqual([]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 30_000);
