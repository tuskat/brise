#!/usr/bin/env bash
# Back-compat shim. The real logic lives in deploy-nas.sh.
set -euo pipefail
export NAS_TYPE=ugreen
exec "$(dirname "$0")/deploy-nas.sh" "$@"
