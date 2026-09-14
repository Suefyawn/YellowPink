#!/usr/bin/env bash
#
# Cron driver for the self-hosted deployment.
#
# On Vercel the three schedules lived in vercel.json and the platform called the
# routes for us. A plain Node server has no such thing, so system cron calls
# them instead. The routes themselves are unchanged: each one authenticates with
# `Authorization: Bearer $CRON_SECRET`, exactly as it did before.
#
# Only three jobs are scheduled, matching vercel.json. /api/cron/daily fans out
# to nine more (abandoned-cart, courier-sync, order-actions, occasion-coupons,
# popularity-refresh, review-requests, stuck-payments, not-found-digest,
# analytics-refresh) in its own handler, so do NOT add those here: calling them
# directly would double-run them.
#
# Usage:  run-cron.sh <daily|weekly|indexing-check>
#
# Install (crontab -e), times in UTC to match the Vercel schedules:
#   0  9 * * *  /srv/yellowpink/scripts/run-cron.sh daily          >> /var/log/yellowpink-cron.log 2>&1
#   30 9 * * *  /srv/yellowpink/scripts/run-cron.sh indexing-check >> /var/log/yellowpink-cron.log 2>&1
#   0 10 * * 1  /srv/yellowpink/scripts/run-cron.sh weekly         >> /var/log/yellowpink-cron.log 2>&1
#
# Set the crontab's own timezone explicitly if the box is not on UTC:
#   CRON_TZ=UTC
#
# CRON_SECRET and APP_URL are read from the environment. Cron runs with almost
# no environment, so the file below is sourced rather than relying on the shell
# profile.

set -uo pipefail

ENV_FILE="${YELLOWPINK_ENV_FILE:-/etc/yellowpink.env}"
[ -r "$ENV_FILE" ] && . "$ENV_FILE"

APP_URL="${APP_URL:-http://127.0.0.1:3000}"
JOB="${1:-}"

case "$JOB" in
  daily|weekly|indexing-check) ;;
  *)
    echo "usage: $(basename "$0") <daily|weekly|indexing-check>" >&2
    exit 2
    ;;
esac

if [ -z "${CRON_SECRET:-}" ]; then
  echo "$(date -u +%FT%TZ) $JOB FATAL CRON_SECRET is not set (looked in $ENV_FILE)" >&2
  exit 1
fi

start=$(date -u +%FT%TZ)

# --max-time is deliberately generous: the daily job fans out to nine
# sub-jobs and legitimately runs for minutes. --fail-with-body keeps the
# response text on a non-2xx so the log says WHY, not just that it failed.
body=$(curl -sS --fail-with-body \
  --max-time 900 \
  --retry 2 --retry-delay 10 --retry-connrefused \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/${JOB}" 2>&1)
status=$?

end=$(date -u +%FT%TZ)

if [ $status -eq 0 ]; then
  echo "$start $JOB ok (finished $end) ${body:0:600}"
else
  # Non-zero exit so a cron-monitoring wrapper (or MAILTO) notices. A silently
  # failing cron is how the abandoned-cart and review-request emails would stop
  # without anyone finding out for weeks.
  echo "$start $JOB FAILED curl=$status (finished $end) ${body:0:600}" >&2
  exit 1
fi
