#!/usr/bin/env bash
#
# Turn a fresh Ubuntu server into a running Yellow Pink store.
#
# Run this ONCE, as root, on a brand new Ubuntu 22.04 or 24.04 box:
#
#   curl -fsSL https://raw.githubusercontent.com/Suefyawn/YellowPink/main/scripts/provision.sh -o provision.sh
#   less provision.sh            # read it before running it as root
#   bash provision.sh yellowpink.pk
#
# It is safe to run again if it fails halfway: every step checks whether it has
# already been done. Nothing here touches Supabase, so the catalogue, orders and
# customers are never at risk from a bad run — the worst case is a server that
# does not start, with Vercel still serving the live site.
#
# What it does:
#   1. Creates the `yellowpink` system user and /srv/yellowpink.
#   2. Installs Node 22, git, and Caddy (Caddy gets the HTTPS certificate on its
#      own, which is the single biggest reason it is here rather than nginx —
#      no certbot, no renewal cron, no expired certificate at 2am).
#   3. Clones the repository.
#   4. Stops for the environment file, which is the one thing it cannot invent.
#   5. Builds, installs the systemd service and the three cron jobs, starts up.
#
# After it finishes the site answers on https://<domain> — but DO NOT move DNS
# yet. docs/SERVER-SETUP.md explains how to test it over the real domain first.

set -euo pipefail

DOMAIN="${1:-}"
REPO="${REPO:-https://github.com/Suefyawn/YellowPink.git}"
BRANCH="${BRANCH:-main}"
APP_DIR=/srv/yellowpink
APP_USER=yellowpink
ENV_FILE=/etc/yellowpink.env

# ── helpers ────────────────────────────────────────────────────────────────
c_ok()   { printf '\033[32m  ✓\033[0m %s\n' "$*"; }
c_step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
c_warn() { printf '\033[33m  !\033[0m %s\n' "$*"; }
die()    { printf '\n\033[31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run this as root:  sudo bash $0 ${DOMAIN:-yellowpink.pk}"
[[ -n "$DOMAIN" ]] || die "Give the domain as the first argument, e.g.  sudo bash $0 yellowpink.pk"
command -v apt-get >/dev/null || die "This script is for Ubuntu/Debian. Nothing else is supported."

# Refuse a domain with a scheme or path: Caddy takes a bare hostname, and
# "https://yellowpink.pk" here produces a site block that never matches, which
# fails later as a confusing 404 rather than an error now.
[[ "$DOMAIN" =~ ^[a-zA-Z0-9.-]+$ ]] || die "Give a bare hostname, not a URL. Example: yellowpink.pk"

c_step "Yellow Pink server setup — $DOMAIN"

# ── 1. packages ────────────────────────────────────────────────────────────
c_step "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https ufw >/dev/null
c_ok "base packages"

if ! command -v node >/dev/null || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
c_ok "Node $(node -v)"

if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
c_ok "Caddy $(caddy version | head -1)"

# ── 2. user + directory ────────────────────────────────────────────────────
c_step "Creating the application user"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/$APP_USER --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
c_ok "$APP_USER, $APP_DIR"

# ── 3. code ────────────────────────────────────────────────────────────────
c_step "Fetching the code"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" reset --hard --quiet "origin/$BRANCH"
else
  # --depth 1: this is a deployment, not a working copy. It saves ~100 MB and
  # several minutes on a small server, and `git pull` still works afterwards.
  git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
c_ok "$(git -C "$APP_DIR" rev-parse --short HEAD) on $BRANCH"

# ── 4. environment ─────────────────────────────────────────────────────────
# The only step that cannot be automated: these are secrets, and they live in
# the Vercel dashboard rather than anywhere this script can reach.
if [[ ! -f "$ENV_FILE" ]]; then
  install -m 600 /dev/null "$ENV_FILE"
  {
    echo "# Yellow Pink server environment."
    echo "# Copy the values from Vercel → Project → Settings → Environment Variables."
    echo "# This file is read by systemd and by cron. Keep it mode 600."
    echo
    echo "APP_URL=https://$DOMAIN"
    echo "NEXT_PUBLIC_SITE_URL=https://$DOMAIN"
    echo
    grep -vE '^\s*#' "$APP_DIR/.env.example" 2>/dev/null | grep -E '^[A-Z]' | sed 's/=.*/=/' || true
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  cat <<MSG

  ────────────────────────────────────────────────────────────────────────
  STOP HERE. One thing is missing and it is the one thing only you have.

  I have written a blank environment file:

      $ENV_FILE

  Fill in the values from Vercel → your project → Settings →
  Environment Variables. Then run this script again and it will carry on
  from here.

      nano $ENV_FILE
      sudo bash $0 $DOMAIN

  The store will boot without these, but in demo mode: fake products, no
  orders, no email. Getting them right is what makes it the real store.
  ────────────────────────────────────────────────────────────────────────

MSG
  exit 0
fi

# A filled-in file still has to contain the three that decide demo mode, or the
# build succeeds and the site silently serves demo products — which looks like
# a working deploy and is the worst possible failure here.
missing=()
for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  grep -qE "^${key}=.+" "$ENV_FILE" || missing+=("$key")
done
if (( ${#missing[@]} )); then
  die "$ENV_FILE is still missing values for: ${missing[*]}
     Without these the store boots in DEMO mode with fake products.
     Fill them in (nano $ENV_FILE) and run this script again."
fi
chmod 600 "$ENV_FILE"
c_ok "environment file looks complete"

# ── 4b. swap ───────────────────────────────────────────────────────────────
# `next build` is the memory high-water mark of the whole system and will be
# killed by the OOM reaper on a 1-2 GB box. The failure is genuinely confusing
# when it happens — the build just stops, sometimes with no message at all —
# so add swap first rather than debugging it later.
ram_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if (( ram_mb < 4096 )) && ! swapon --show --noheadings | grep -q .; then
  c_step "Adding swap (only ${ram_mb} MB of RAM; the build needs more)"
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  c_ok "4 GB swap file, enabled at boot"
fi

# ── 5. build ───────────────────────────────────────────────────────────────
c_step "Building (this takes a few minutes on a small server)"
# Build as the app user so nothing in the tree ends up root-owned.
sudo -u "$APP_USER" env HOME=/home/$APP_USER bash -c "cd $APP_DIR && npm ci --no-audit --no-fund" >/dev/null
# The build reads NEXT_PUBLIC_* at compile time, so it needs the env file too.
sudo -u "$APP_USER" env HOME=/home/$APP_USER bash -c "set -a; . $ENV_FILE; set +a; cd $APP_DIR && npm run build:standalone" >/dev/null
[[ -f "$APP_DIR/.next/standalone/server.js" ]] || die "Build finished but .next/standalone/server.js is missing."
[[ -d "$APP_DIR/.next/standalone/public" ]] || die "Build finished but public/ was not copied into standalone. The site would serve with no images."
c_ok "built"

# ── 6. service ─────────────────────────────────────────────────────────────
c_step "Installing the service"
install -m 644 "$APP_DIR/deploy/yellowpink.service" /etc/systemd/system/yellowpink.service
systemctl daemon-reload
systemctl enable --quiet yellowpink
systemctl restart yellowpink
c_ok "systemd service enabled and started"

# ── 7. web server ──────────────────────────────────────────────────────────
c_step "Configuring HTTPS"
cat > /etc/caddy/Caddyfile <<CADDY
# Yellow Pink. Caddy obtains and renews the TLS certificate by itself; there is
# no certbot and no renewal cron to forget about.
#
# This file is REWRITTEN by scripts/provision.sh. Put hand edits somewhere else
# or they will be lost on the next run.

$DOMAIN, www.$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl reload caddy 2>/dev/null || systemctl restart caddy
c_ok "Caddy serving $DOMAIN"

# ── 8. firewall ────────────────────────────────────────────────────────────
c_step "Firewall"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp  >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true
c_ok "ports 22, 80, 443 open; everything else closed"

# ── 9. cron ────────────────────────────────────────────────────────────────
c_step "Scheduled jobs"
chmod +x "$APP_DIR/scripts/run-cron.sh"
# Written as a file in /etc/cron.d rather than a user crontab so it is visible,
# version-controllable and removable without `crontab -e`. Times are UTC to
# match the schedules Vercel ran.
cat > /etc/cron.d/yellowpink <<CRON
# Yellow Pink scheduled jobs. Installed by scripts/provision.sh.
# Only these three: /api/cron/daily fans out to nine more in its own handler,
# so listing those here would double-run them.
SHELL=/bin/bash
CRON_TZ=UTC
MAILTO=root

0  9 * * *  $APP_USER  $APP_DIR/scripts/run-cron.sh daily          >> /var/log/yellowpink-cron.log 2>&1
30 9 * * *  $APP_USER  $APP_DIR/scripts/run-cron.sh indexing-check >> /var/log/yellowpink-cron.log 2>&1
0 10 * * 1  $APP_USER  $APP_DIR/scripts/run-cron.sh weekly         >> /var/log/yellowpink-cron.log 2>&1
CRON
chmod 644 /etc/cron.d/yellowpink
touch /var/log/yellowpink-cron.log && chown "$APP_USER:$APP_USER" /var/log/yellowpink-cron.log
c_ok "daily 09:00 UTC, indexing 09:30 UTC, weekly Monday 10:00 UTC"

# ── 10. check ──────────────────────────────────────────────────────────────
c_step "Checking it answers"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/ || true)
  [[ "$code" == "200" ]] && break
  sleep 2
done
if [[ "${code:-}" == "200" ]]; then
  c_ok "the store answered 200 on localhost"
else
  c_warn "the store has not answered yet (last status: ${code:-none})."
  c_warn "Look at why:   journalctl -u yellowpink -n 50 --no-pager"
fi

cat <<DONE

$(printf '\033[1;32m')Done.$(printf '\033[0m')

  Site        https://$DOMAIN  (once DNS points here)
  Logs        journalctl -u yellowpink -f
  Restart     systemctl restart yellowpink
  Update      bash $APP_DIR/scripts/deploy.sh

  DNS is deliberately NOT changed by this script. Test over the real domain
  first — docs/SERVER-SETUP.md, "Test before you switch" — and keep Vercel
  running until the new server has served a full day including one successful
  daily cron run.

DONE
