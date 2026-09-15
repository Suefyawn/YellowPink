#!/usr/bin/env bash
#
# Update the running store to the latest code. Run this after every change that
# has been merged to main:
#
#   sudo bash /srv/yellowpink/scripts/deploy.sh
#
# It builds FIRST and only swaps the running server once the build has
# succeeded, so a broken commit leaves the current site untouched rather than
# taking the store down. The worst case is "the site is still on yesterday's
# code", which is a problem you can fix at your leisure.

set -euo pipefail

APP_DIR=/srv/yellowpink
APP_USER=yellowpink
ENV_FILE=/etc/yellowpink.env
BRANCH="${BRANCH:-main}"

c_ok()   { printf '\033[32m  ✓\033[0m %s\n' "$*"; }
c_step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
die()    { printf '\n\033[31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root:  sudo bash $0"
[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR is not a checkout. Run scripts/provision.sh first."

c_step "Fetching"
before=$(git -C "$APP_DIR" rev-parse --short HEAD)
git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
after=$(git -C "$APP_DIR" rev-parse --short "origin/$BRANCH")
if [[ "$before" == "$after" ]]; then
  c_ok "already on $after — nothing to deploy"
  exit 0
fi
git -C "$APP_DIR" reset --hard --quiet "origin/$BRANCH"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
c_ok "$before → $after"

c_step "Building"
sudo -u "$APP_USER" env HOME=/home/$APP_USER bash -c "cd $APP_DIR && npm ci --no-audit --no-fund" >/dev/null
sudo -u "$APP_USER" env HOME=/home/$APP_USER bash -c "set -a; . $ENV_FILE; set +a; cd $APP_DIR && npm run build:standalone" >/dev/null
[[ -f "$APP_DIR/.next/standalone/server.js" ]] || die "Build produced no server.js. The running site was NOT touched."
[[ -d "$APP_DIR/.next/standalone/public" ]] || die "public/ missing from the build. The running site was NOT touched."
c_ok "built"

c_step "Restarting"
systemctl restart yellowpink
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/ || true)
  [[ "$code" == "200" ]] && break
  sleep 2
done
[[ "${code:-}" == "200" ]] || die "The store did not come back up (last status: ${code:-none}).
     Look at:  journalctl -u yellowpink -n 50 --no-pager
     Roll back: git -C $APP_DIR reset --hard $before && bash $0"
c_ok "answering 200 on $after"
