#!/usr/bin/env bash
# One-shot update for your Brise NAS instance.
#
# First-time setup:
#   cp scripts/update.env.example scripts/update.env
#   # edit scripts/update.env with your NAS_TYPE + DEPLOY_HOST
#
# Then just run: ./scripts/update.sh

set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="scripts/update.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Create it from the template:" >&2
  echo "  cp scripts/update.env.example $ENV_FILE" >&2
  echo "Then edit it with your NAS settings." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${ASSUME_YES:=true}"
export ASSUME_YES

exec ./scripts/deploy-nas.sh
