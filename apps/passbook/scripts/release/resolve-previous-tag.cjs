#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");

const { resolvePreviousPassbookTag } = require("./version.cjs");

function listGitTags(cwd = process.cwd()) {
  const stdout = execFileSync("git", ["tag", "--list", "v*"], {
    cwd,
    encoding: "utf8",
  });
  return stdout
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function main() {
  const args = process.argv.slice(2);
  const readArg = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1 || index === args.length - 1) {
      throw new Error(`Missing required argument ${flag}`);
    }
    return args[index + 1];
  };

  const currentTag = readArg("--current-tag");
  const githubOutput = args.includes("--github-output")
    ? process.env.GITHUB_OUTPUT
    : undefined;
  const previousTag =
    resolvePreviousPassbookTag(listGitTags(), currentTag) ?? "";

  if (githubOutput) {
    fs.appendFileSync(githubOutput, `previous_tag=${previousTag}\n`);
    return;
  }

  process.stdout.write(`previous_tag=${previousTag}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  listGitTags,
};
