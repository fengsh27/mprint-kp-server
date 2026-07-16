/**
 * Guards the version-bump scripts. Runs before `standard-version` in the
 * `bump:*` and `release` scripts; run it directly with:
 *
 *   npm run check:release
 *
 * Two checks:
 *   1. HEAD is on `main`.
 *   2. The working tree is clean.
 *
 * Both exist because a bump is hard to undo once it lands: standard-version
 * writes package.json / app/version.json / CHANGELOG.md, commits them, and
 * creates a tag. Bumping off `main` puts a release tag on a commit that may
 * never merge, and bumping a dirty tree tags a commit that doesn't match what
 * you were actually looking at.
 *
 * Exits 0 when both pass, 1 otherwise.
 */

import { execFileSync } from 'node:child_process';

const RELEASE_BRANCH = 'main';

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const problems: string[] = [];

// 1. Branch check.
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== RELEASE_BRANCH) {
  problems.push(
    `On branch '${branch}', but releases must be cut from '${RELEASE_BRANCH}'.\n` +
    `    Switch with: git checkout ${RELEASE_BRANCH}`
  );
}

// 2. Clean-tree check. --porcelain reports staged, unstaged and untracked in
// one pass; split them apart so the message says which one is actually the
// blocker rather than just "tree is dirty".
const status = git('status', '--porcelain');
if (status) {
  const lines = status.split('\n');
  const untracked = lines.filter(line => line.startsWith('??'));
  const tracked = lines.filter(line => !line.startsWith('??'));

  if (tracked.length) {
    problems.push(
      `Working tree has ${tracked.length} uncommitted change(s):\n` +
      tracked.map(line => `      ${line}`).join('\n') +
      `\n    Commit or stash them first.`
    );
  }
  if (untracked.length) {
    problems.push(
      `Working tree has ${untracked.length} untracked file(s):\n` +
      untracked.map(line => `      ${line}`).join('\n') +
      `\n    Commit them, delete them, or add them to .gitignore.`
    );
  }
}

if (problems.length) {
  console.error('\n  Release checks failed:\n');
  for (const problem of problems) {
    console.error(`  ✖ ${problem}\n`);
  }
  process.exit(1);
}

console.log(`✔ release checks passed (on ${RELEASE_BRANCH}, working tree clean)`);
