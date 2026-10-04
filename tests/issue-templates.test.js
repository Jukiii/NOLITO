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

  it("hides template guidance in HTML comments but keeps safety notices visible", () => {
    const prompts = [
      [
        "bug.md",
        [
          "何が起きていますか。",
          "問題を再現するための操作を書いてください。",
          "どうなることを期待していますか。",
        ],
      ],
      [
        "feature.md",
        [
          "変更したいことを簡潔に書いてください。",
          "なぜ必要ですか。いま何が起きているかを書いてください。",
        ],
      ],
      [
        "github-operation.md",
        [
          "GitHubの操作内容を具体的に書いてください。",
          "何をどう変更するか、具体的に書いてください。",
        ],
      ],
    ];
    for (const [filename, phrases] of prompts) {
      const template = readFileSync(`${templateDir}/${filename}`, "utf8");
      for (const phrase of phrases)
        assert.ok(template.includes(`<!-- ${phrase} -->`), `${filename}: ${phrase}`);
    }
    assert.match(
      readFileSync(`${templateDir}/feature.md`, "utf8"),
      /秘密や個人情報は書かないでください。/,
    );
  });
});
