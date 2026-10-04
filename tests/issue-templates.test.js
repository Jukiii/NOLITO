import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const templateDir = `${root}.github/ISSUE_TEMPLATE`;
const templateFiles = readdirSync(templateDir).sort();
const expectedFiles = ["bug.md", "feature.md", "github-operation.md"];

describe("Issue templates", () => {
  it("three Markdown templates cover bugs, improvements, and GitHub operations", () => {
    assert.deepEqual(templateFiles, expectedFiles);
  });

  it("does not preselect labels or assignees", () => {
    for (const filename of expectedFiles) {
      const template = readFileSync(`${templateDir}/${filename}`, "utf8");
      const frontMatter = /^---\n([\s\S]*?)\n---/m.exec(template)?.[1];
      assert.ok(frontMatter, `${filename} has no GitHub template metadata`);
      assert.doesNotMatch(frontMatter, /^(?:labels|assignees):/m, filename);
    }
  });

  it("does not automatically assign issues based on labels", () => {
    assert.equal(existsSync(`${root}.github/workflows/issue-routing.yml`), false);
  });
});
