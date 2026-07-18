SKYLINE WORLD V4 DEPLOY V2

This corrects the final index cache-bust test from the previous deploy script.

Run:
  cd /workspaces/skyline-vr2
  unzip -oq skyline-world-v4-deploy-v2.zip
  bash skyline-world-v4-deploy-v2/deploy.sh

It merges WORLD v2.5 with Biplane V4, runs the full test suite,
creates a rollback branch, and deploys to gh-pages only after all tests pass.
