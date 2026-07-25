#!/usr/bin/env bash
# Pull-based autodeploy for the character sheet.
#
# Run on the server (by a systemd timer, or by hand). Checks the deploy branch,
# and when it has moved, rebuilds and restarts the stack. Nothing inbound is
# needed: GitHub never holds credentials to this machine, the server only ever
# reaches out.
#
# Safety properties this script is built around:
#
#   * The running site is never taken down by a broken commit. The image is
#     built *before* anything is restarted, and a build failure leaves the
#     current container serving.
#   * A commit that builds but does not come up healthy is rolled back to the
#     previously deployed commit automatically.
#   * User data is never touched. The bind mount lives at ./data, which is
#     gitignored, so `git reset --hard` and `git clean -fd` both leave it alone.
#     This is why the clean below must never grow an `-x`: that would delete
#     every registered account and synced character.
#
# Configuration (environment, or /etc/default/charactersheet-deploy):
#   CS_DEPLOY_DIR     checkout to update            (default /srv/charactersheet)
#   CS_DEPLOY_BRANCH  branch to follow              (default deploy)
#   CS_DEPLOY_REMOTE  remote to fetch from          (default origin)
#   CS_DEPLOY_FORCE   set to 1 to redeploy even when the branch has not moved
#   CS_DEPLOY_LOCK    lock file, kept outside the checkout (see below)

set -Eeuo pipefail

DIR="${CS_DEPLOY_DIR:-/srv/charactersheet}"
BRANCH="${CS_DEPLOY_BRANCH:-deploy}"
REMOTE="${CS_DEPLOY_REMOTE:-origin}"
FORCE="${CS_DEPLOY_FORCE:-0}"

log() { printf '%s  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
die() { log "ERROR: $*"; exit 1; }

# Compose is `docker compose` on anything current, `docker-compose` on older
# hosts. Resolve once so the rest of the script does not care.
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() { docker-compose "$@"; }
else
  die "neither 'docker compose' nor 'docker-compose' is available"
fi

[ -d "$DIR/.git" ] || die "$DIR is not a git checkout (see deploy/README.md)"
cd "$DIR"

# Timer fires can overlap when a build runs long. Take the lock or step aside;
# the next tick will pick the work up.
#
# The lock lives outside the checkout on purpose: `git clean` below would
# delete it mid-deploy as an untracked file, and a second run would then make a
# fresh one and sail straight past this guard.
LOCK="${CS_DEPLOY_LOCK:-/tmp/charactersheet-deploy$(printf '%s' "$DIR" | tr -c 'A-Za-z0-9' '-').lock}"
exec {lock}>"$LOCK"
if ! flock -n "$lock"; then
  log "another deploy is already running — skipping this tick"
  exit 0
fi

git fetch --prune "$REMOTE" "$BRANCH" || die "fetch failed"

previous="$(git rev-parse HEAD)"
target="$(git rev-parse "$REMOTE/$BRANCH")"

if [ "$previous" = "$target" ] && [ "$FORCE" != "1" ]; then
  log "already at ${target:0:12} — nothing to do"
  exit 0
fi

log "deploying ${previous:0:12} -> ${target:0:12} ($BRANCH)"
git --no-pager log --oneline "$previous..$target" 2>/dev/null | sed 's/^/    /' || true

checkout() {
  git reset --hard "$1" --quiet
  # Drop stray untracked files from an interrupted deploy. No -x: ignored paths
  # (./data, node_modules) must survive.
  git clean -fd --quiet
}

# Build the new image before touching the running one. A commit that does not
# compile therefore costs nothing but a log line.
checkout "$target"
if ! compose build; then
  log "build failed at ${target:0:12} — the running site is untouched"
  checkout "$previous"
  exit 1
fi

if compose up -d --wait; then
  log "deployed ${target:0:12}"
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

# It built but would not come up. Put the previous commit back rather than
# leaving a broken container serving.
log "startup/health check failed at ${target:0:12} — rolling back to ${previous:0:12}"
compose logs --tail 40 --no-color || true
checkout "$previous"
if compose build && compose up -d --wait; then
  log "rolled back to ${previous:0:12}"
else
  log "ROLLBACK FAILED — the site is down and needs a look"
fi
exit 1
