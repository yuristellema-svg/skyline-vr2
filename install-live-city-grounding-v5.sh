#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${1:-/workspaces/skyline-vr2}"
PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_BRANCH="skyline-live-city-grounding-v5-rebased"
EXPECTED_LIVE_BASE="09d0b01fb626a29e45a262583fe1f88173939a09"
ORIGINAL_BRANCH=""
STASHED=0
LIVE_PUSHED=0
BASE_SHA=""

say() { printf '\n===== %s =====\n' "$1"; }

restore_workspace() {
  local status=$?
  set +e

  if [[ -n "$ORIGINAL_BRANCH" ]]; then
    git -C "$REPO" switch -f "$ORIGINAL_BRANCH" >/dev/null 2>&1 || true
  fi

  if [[ "$status" != "0" ]]; then
    rm -f \
      "$REPO/tests/live-city-grounding-v5.test.mjs" \
      "$REPO/tools/live-city-grounding/apply-live-city-grounding-v5.mjs" \
      "$REPO/install-live-city-grounding-v5.sh" \
      "$REPO/LIVE_CITY_GROUNDING_V5_HANDOFF.md" \
      "$REPO/EXACT_SIGNATURE_AUDIT.json" 2>/dev/null || true
  fi

  if [[ "$STASHED" == "1" ]]; then
    git -C "$REPO" stash pop --index >/dev/null 2>&1 || {
      echo "Your pre-install work remains safely in stash@{0}."
    }
  fi

  if [[ "$status" != "0" ]]; then
    if [[ "$LIVE_PUSHED" == "0" ]]; then
      echo "LIVE CITY V5 STOPPED. gh-pages was not modified."
    else
      echo "The live push completed, but workspace restoration reported an error."
    fi
  fi
  exit "$status"
}
trap restore_workspace EXIT

if [[ ! -d "$REPO/.git" ]]; then
  echo "Repository not found at $REPO" >&2
  exit 1
fi

ORIGINAL_BRANCH="$(git -C "$REPO" branch --show-current)"
if [[ -z "$ORIGINAL_BRANCH" ]]; then
  echo "Start from a named local branch, not detached HEAD." >&2
  exit 1
fi

say "SAVING CURRENT WORK"
if [[ -n "$(git -C "$REPO" status --porcelain)" ]]; then
  git -C "$REPO" stash push -u -m "before-live-city-grounding-v5-rebased"
  STASHED=1
else
  echo "Working tree already clean."
fi

say "READING CURRENT LIVE BASE"
git -C "$REPO" fetch origin gh-pages
BASE_SHA="$(git -C "$REPO" rev-parse origin/gh-pages)"
echo "Live base: $BASE_SHA"

if [[ "$BASE_SHA" != "$EXPECTED_LIVE_BASE" ]]; then
  echo "Expected clean live base $EXPECTED_LIVE_BASE but found $BASE_SHA." >&2
  echo "Nothing was changed or published." >&2
  exit 1
fi

git -C "$REPO" switch --detach origin/gh-pages
git -C "$REPO" branch -D "$TARGET_BRANCH" >/dev/null 2>&1 || true
git -C "$REPO" switch -c "$TARGET_BRANCH"

say "VERIFYING CLEAN LIVE SOURCE CONTRACT"
grep -q 'src/main.js?v=biplane-zero-radio-v4' "$REPO/index.html"
grep -q 'skyline-biplane-zero-radio-v4-20260718' "$REPO/sw.js"
grep -q 'const targetCenterX = 2450;' "$REPO/src/worldCompletion/settlementManifestAdapter.js"
grep -q 'const targetCenterZ = -2050;' "$REPO/src/worldCompletion/settlementManifestAdapter.js"
if grep -q 'SKYLINE_LIVE_CITY_GROUNDING_V5' "$REPO/src/main.js"; then
  echo "The V5 patch is already present on the supposedly clean base." >&2
  exit 1
fi

say "APPLYING COMPLETE REBASED CITY FIX"
node "$PACKAGE_ROOT/tools/live-city-grounding/apply-live-city-grounding-v5.mjs" "$REPO"
mkdir -p "$REPO/tests" "$REPO/tools/live-city-grounding"
cp "$PACKAGE_ROOT/tests/live-city-grounding-v5.test.mjs" "$REPO/tests/live-city-grounding-v5.test.mjs"
cp "$PACKAGE_ROOT/tools/live-city-grounding/apply-live-city-grounding-v5.mjs" "$REPO/tools/live-city-grounding/apply-live-city-grounding-v5.mjs"
cp "$PACKAGE_ROOT/install-live-city-grounding-v5.sh" "$REPO/install-live-city-grounding-v5.sh"
cp "$PACKAGE_ROOT/LIVE_CITY_GROUNDING_V5_HANDOFF.md" "$REPO/LIVE_CITY_GROUNDING_V5_HANDOFF.md"
cp "$PACKAGE_ROOT/EXACT_SIGNATURE_AUDIT.json" "$REPO/EXACT_SIGNATURE_AUDIT.json"

say "SOURCE VALIDATION"
node --check "$REPO/src/main.js"
node --check "$REPO/src/world/world.js"
node --check "$REPO/src/worldCompletion/settlementManifestAdapter.js"
node --check "$REPO/tools/live-city-grounding/apply-live-city-grounding-v5.mjs"
bash -n "$REPO/install-live-city-grounding-v5.sh"
git -C "$REPO" diff --check

say "EXACT PACKED-TERRAIN AND STARTUP AUDIT"
(
  cd "$REPO"
  node --test tests/live-city-grounding-v5.test.mjs
)

say "FULL REPOSITORY TEST SUITE"
(
  cd "$REPO"
  npm test
)

if [[ -f "$REPO/package.json" ]] && grep -q 'world:validate' "$REPO/package.json"; then
  say "WORLD VALIDATION"
  (
    cd "$REPO"
    npm run world:validate
  )
fi

say "COMMITTING VERIFIED FIX"
git -C "$REPO" config user.name >/dev/null 2>&1 || \
  git -C "$REPO" config user.name "Skyline City Worker"
git -C "$REPO" config user.email >/dev/null 2>&1 || \
  git -C "$REPO" config user.email "skyline-city-worker@users.noreply.github.com"

git -C "$REPO" add \
  src/main.js \
  src/world/world.js \
  src/worldCompletion/settlementManifestAdapter.js \
  sw.js \
  tests/live-city-grounding-v5.test.mjs \
  tools/live-city-grounding/apply-live-city-grounding-v5.mjs \
  install-live-city-grounding-v5.sh \
  LIVE_CITY_GROUNDING_V5_HANDOFF.md \
  EXACT_SIGNATURE_AUDIT.json

git -C "$REPO" commit -m "Relocate and ground live settlement city from clean base"
COMMIT_SHA="$(git -C "$REPO" rev-parse HEAD)"

say "PUSHING AUDITABLE WORKER BRANCH"
git -C "$REPO" push --force-with-lease origin "HEAD:refs/heads/$TARGET_BRANCH"

say "VERIFYING LIVE BRANCH DID NOT MOVE"
git -C "$REPO" fetch origin gh-pages
CURRENT_LIVE="$(git -C "$REPO" rev-parse origin/gh-pages)"
if [[ "$CURRENT_LIVE" != "$BASE_SHA" ]]; then
  echo "gh-pages changed during validation: $BASE_SHA -> $CURRENT_LIVE" >&2
  echo "Worker branch was pushed, but live was intentionally not overwritten." >&2
  exit 1
fi

say "PUBLISHING VERIFIED FIX TO GH-PAGES"
git -C "$REPO" push origin "$COMMIT_SHA:refs/heads/gh-pages"
LIVE_PUSHED=1

echo
printf '%s\n' \
  "LIVE CITY V5 PUBLISHED" \
  "Worker branch: $TARGET_BRANCH" \
  "Commit: $COMMIT_SHA" \
  "Previous live: $BASE_SHA" \
  "New live: $COMMIT_SHA" \
  "Audited settlement center: X -1965, Z -451" \
  "Legacy drowned box city: disabled" \
  "All signature buildings passed exact packed-terrain planning" \
  "Locked Biplane deployment identifiers unchanged"
