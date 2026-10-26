#!/bin/sh
set -eu
cd "$(dirname "$0")"
trap 'echo "Tekan Enter untuk menutup."; read answer' EXIT
if ! command -v node >/dev/null; then
  echo 'Pasang Node.js 24 dari nodejs.org terlebih dahulu.'
  exit 1
fi
node launcher/start-local.mjs
