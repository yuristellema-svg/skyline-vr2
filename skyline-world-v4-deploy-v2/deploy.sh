#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/workspaces/skyline-vr2"
WORLD_SHA="584acbe8475b4869a4cb5e559fb226ee619c1327"
LIVE_SHA="d3e48499e90affe4dcf01fda1fdfa882fbaef8bd"
BRANCH="skyline-world-integration"
ROLLBACK="backup/gh-pages-before-world-v25-v4-$(date +%Y%m%d-%H%M%S)"

fail_cleanup() {
  code=$?
  echo
  echo "WORLD V4 DEPLOY STOPPED."
  echo "Nothing was intentionally pushed after the failure."
  git merge --abort >/dev/null 2>&1 || true
  git rebase --abort >/dev/null 2>&1 || true
  git cherry-pick --abort >/dev/null 2>&1 || true
  git reset --hard "origin/$BRANCH" >/dev/null 2>&1 || true
  echo "Local WORLD branch restored to origin/$BRANCH."
  exit "$code"
}
trap fail_cleanup ERR

cd "$ROOT"

echo "===== FETCHING ====="
git fetch origin

actual_world="$(git rev-parse "origin/$BRANCH")"
actual_live="$(git rev-parse origin/gh-pages)"

if [[ "$actual_world" != "$WORLD_SHA" ]]; then
  echo "STOP: WORLD branch changed."
  echo "Expected: $WORLD_SHA"
  echo "Actual:   $actual_world"
  exit 1
fi

if [[ "$actual_live" != "$LIVE_SHA" ]]; then
  echo "STOP: live gh-pages changed."
  echo "Expected: $LIVE_SHA"
  echo "Actual:   $actual_live"
  exit 1
fi

git merge --abort >/dev/null 2>&1 || true
git rebase --abort >/dev/null 2>&1 || true
git cherry-pick --abort >/dev/null 2>&1 || true

echo "===== RESETTING WORLD BRANCH ====="
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "STOP: tracked files are not clean."
  git status --short
  exit 1
fi

echo "===== MERGING BIPLANE V4 ====="
if git merge --no-commit --no-ff origin/gh-pages; then
  echo "Merge applied without conflicts."
else
  echo "Resolving expected shared-file conflicts."
fi

allowed_conflicts=$'deployment-version.txt\nindex.html\nsrc/main.js\nsw.js'
unmerged="$(git diff --name-only --diff-filter=U || true)"

if [[ -n "$unmerged" ]]; then
  while IFS= read -r file; do
    if ! grep -Fxq "$file" <<<"$allowed_conflicts"; then
      echo "STOP: unexpected merge conflict: $file"
      exit 1
    fi
  done <<<"$unmerged"
fi

# Keep the already-tested WORLD wiring in shared files, then layer only
# the Biplane V4 audio/radio/cache changes onto it.
for file in deployment-version.txt index.html src/main.js sw.js; do
  git show "$WORLD_SHA:$file" > "$file"
done

python3 <<'PY'
from pathlib import Path
import re

main_path = Path("src/main.js")
main = main_path.read_text()

old_version = "biplane-mobile-audio-controls-v3"
new_version = "biplane-zero-radio-v4"
main = main.replace(old_version, new_version)

start = main.find("async function completePhoneAudioGesture()")
end = main.find("\nfor (\n", start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate completePhoneAudioGesture.")

segment = main[start:end]
old = "await requestAudioFromGesture(\n      false,"
new = "await requestAudioFromGesture(\n      true,"
if old not in segment and new not in segment:
    raise SystemExit("Could not locate second-tap audio rebuild call.")
segment = segment.replace(old, new, 1)
main = main[:start] + segment + main[end:]

old_unlock = """const directAudioUnlock = () => {
  void requestAudioFromGesture(false);
};"""
new_unlock = """const directAudioUnlock = () => {
  if (awaitingPhoneAudioGesture) {
    return;
  }

  void requestAudioFromGesture(false);
};"""
if old_unlock in main:
    main = main.replace(old_unlock, new_unlock, 1)
elif new_unlock not in main:
    raise SystemExit("Could not patch directAudioUnlock guard.")

if "createWorldDetailSystem" not in main:
    raise SystemExit("WORLD wiring disappeared from src/main.js.")

main_path.write_text(main)

index_path = Path("index.html")
index = index_path.read_text()
index, count = re.subn(
    r'src="\./src/main\.js\?v=[^"]+"',
    'src="./src/main.js?v=biplane-zero-radio-v4-world-detail-v25-d3e48499e90a"',
    index,
    count=1,
)
if count != 1:
    raise SystemExit("Could not patch index.html module version.")
index_path.write_text(index)

sw_path = Path("sw.js")
sw = sw_path.read_text().replace(old_version, new_version)
sw, count = re.subn(
    r"const SHELL_CACHE = '[^']+';",
    "const SHELL_CACHE = "
    "'skyline-biplane-zero-radio-v4-20260718-"
    "skyline-world-detail-v25-d3e48499e90a';",
    sw,
    count=1,
)
if count != 1:
    raise SystemExit("Could not patch service-worker cache name.")

required_world_asset = "'./src/worldDetail/worldDetailSystem.js'"
if required_world_asset not in sw:
    raise SystemExit("WORLD service-worker assets disappeared.")
sw_path.write_text(sw)

Path("deployment-version.txt").write_text(
"""SKYLINE WORLD DETAIL V2.5 TEST
BASE BIPLANE FINAL V4
PT-17 DESKTOP AND PHONE
FORCED IOS SECOND-TAP AUDIO REBUILD
ZERO RADIO DEFAULT OFF
ZERO RADIO COCKPIT AND THIRD PERSON
RADIO PAUSES DURING MENU
RADIO RESUMES FROM SAME POSITION
RADIO SYMBOL AT 68 DEGREES
SAMPLED STUKA SIREN
FULL EFFECTS DEFAULT
OPTIONAL WORLD DETAIL ACTIVE
PHONE MODE FORCES LOW DETAIL
OPTIONAL COLLISION BOXES NOT REGISTERED
"""
)
PY

git add -A

remaining="$(git diff --name-only --diff-filter=U || true)"
if [[ -n "$remaining" ]]; then
  echo "STOP: unresolved conflicts remain:"
  echo "$remaining"
  exit 1
fi

echo "===== VALIDATING ====="
git diff --check
npm test

echo "===== COMMITTING WORLD + V4 ====="
git commit -m "Merge World Detail v2.5 with Biplane Final V4"
git push origin "$BRANCH"

echo "===== CREATING ROLLBACK ====="
git branch "$ROLLBACK" origin/gh-pages
git push origin "$ROLLBACK"

echo "===== DEPLOYING TO GH-PAGES ====="
git push origin HEAD:gh-pages

echo
echo "=================================================="
echo "WORLD DETAIL V2.5 + BIPLANE V4 DEPLOYED"
echo "Branch:   $BRANCH"
echo "Commit:   $(git rev-parse HEAD)"
echo "Rollback: $ROLLBACK"
echo "=================================================="
