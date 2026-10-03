import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const strip = (text) => text.replace(/^\/\/# sourceMappingURL=.*$/m, "").trim();

test("同梱の marked は、インストールされた marked と同じ(Dependabot で上がったら、コピーし直す)", () => {
  const vendored = readFileSync(
    new URL("../scripts/lib/vendor/marked.esm.js", import.meta.url),
    "utf8",
  );
  const installed = readFileSync(
    new URL("../node_modules/marked/lib/marked.esm.js", import.meta.url),
    "utf8",
  );
  assert.equal(
    strip(vendored),
    strip(installed),
    "node_modules/marked/lib/marked.esm.js を scripts/lib/vendor/marked.esm.js へコピーし直してください(LICENSE も)",
  );
});

test("markdown.mjs・Functions は、npm の marked を直接 import しない(Cloudflare Pages は依存を入れない)", () => {
  const source = readFileSync(new URL("../scripts/lib/markdown.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from "marked"/);
  assert.match(source, /from "\.\/vendor\/marked\.esm\.js"/);
});
