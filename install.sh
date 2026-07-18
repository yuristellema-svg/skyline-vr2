#!/usr/bin/env bash
set -Eeuo pipefail

BRANCH="skyline-airfields-navigation-v1"
BASE_SHA="d3e48499e90affe4dcf01fda1fdfa882fbaef8bd"
COMMIT_MESSAGE="Build profile-fitted airfields and aviation navigation"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -d /workspaces/skyline-vr2/.git ]]; then
  ROOT=/workspaces/skyline-vr2
else
  ROOT="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "STOP: run this from inside the skyline-vr2 repository or place the package in /workspaces/skyline-vr2."
  exit 1
fi

ORIGINAL_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
ORIGINAL_BRANCH="$(git -C "$ROOT" symbolic-ref --short -q HEAD || true)"
CREATED_BRANCH=0
COMMITTED=0
PUSHED=0

restore_preinstall_state() {
  # The installer requires a clean worktree before it starts, so everything
  # present here was created by this package or its validation commands.
  git reset --hard "$BASE_SHA" >/dev/null 2>&1 || true
  git clean -fd >/dev/null 2>&1 || true

  if [[ -n "$ORIGINAL_BRANCH" ]]; then
    git switch "$ORIGINAL_BRANCH" >/dev/null 2>&1 || true
  else
    git switch --detach "$ORIGINAL_HEAD" >/dev/null 2>&1 || true
  fi
  git branch -D "$BRANCH" >/dev/null 2>&1 || true
}

cleanup() {
  code=$?
  if [[ $code -ne 0 ]]; then
    echo
    if [[ $CREATED_BRANCH -eq 1 && $COMMITTED -eq 0 ]]; then
      restore_preinstall_state
      echo "AIRFIELDS INSTALL STOPPED. The temporary branch and copied files were rolled back."
    elif [[ $COMMITTED -eq 1 && $PUSHED -eq 0 ]]; then
      echo "AIRFIELDS INSTALL STOPPED AFTER COMMIT. The local worker branch was preserved for retrying the push."
      echo "Local commit: $(git rev-parse HEAD 2>/dev/null || true)"
    else
      echo "AIRFIELDS INSTALL STOPPED. No push was performed after the failure."
    fi
  fi
}
trap cleanup EXIT

cd "$ROOT"

echo "===== FETCHING EXACT BASE ====="
git fetch origin --prune
git cat-file -e "${BASE_SHA}^{commit}"

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  echo "STOP: origin/$BRANCH already exists. Refusing to overwrite it."
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "STOP: local branch $BRANCH already exists. Refusing to overwrite it."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "STOP: repository working tree is not clean."
  git status --short
  exit 1
fi

echo "===== CREATING ISOLATED BRANCH ====="
git switch --detach "$BASE_SHA"
git switch -c "$BRANCH"
CREATED_BRANCH=1

copy_file() {
  local rel="$1"
  mkdir -p "$(dirname "$ROOT/$rel")"
  cp "$PACKAGE_DIR/$rel" "$ROOT/$rel"
}

while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  if [[ ! -f "$PACKAGE_DIR/$rel" ]]; then
    echo "STOP: package manifest references a missing file: $rel"
    exit 1
  fi
  copy_file "$rel"
done < "$PACKAGE_DIR/CHANGED_FILES.txt"

if [[ ! -f "$ROOT/install.sh" ]]; then
  echo "STOP: installer self-copy failed; repository contract tests require install.sh at the root."
  exit 1
fi

echo "===== PROTECTED-FILE CHECK ====="
for protected in \
  src/main.js \
  src/world/world.js \
  src/flightModel.js \
  src/camera.js \
  src/input.js \
  src/menu.js \
  src/aircraftVisuals.js \
  index.html \
  sw.js \
  package.json; do
  if ! git diff --quiet "$BASE_SHA" -- "$protected"; then
    echo "STOP: protected file changed: $protected"
    exit 1
  fi
done

echo "===== VALIDATING ====="
git diff --check
node --test tests/airfields-*.test.mjs tests/landing-*.test.mjs tests/package-*.test.mjs
node tools/airfields/auditWorldSites.mjs
node tools/airfields/reportCapabilities.mjs
npm test

if npm run | grep -q 'world:validate'; then
  npm run world:validate
fi

echo "===== COMMITTING ====="
git add --pathspec-from-file="$PACKAGE_DIR/CHANGED_FILES.txt"
git commit -m "$COMMIT_MESSAGE"
COMMITTED=1

echo "===== PUSHING WORKER BRANCH ====="
git push -u origin "$BRANCH"
PUSHED=1

trap - EXIT

echo
echo "=================================================="
echo "AIRFIELDS + NAVIGATION V1 PUSHED"
echo "Branch: $BRANCH"
echo "Commit: $(git rev-parse HEAD)"
echo "Base:   $BASE_SHA"
echo "gh-pages was not modified."
echo "=================================================="
