#!/bin/sh
set -eu
cd "$(dirname "$0")"
trap 'echo "Jika gagal, periksa Docker Desktop, koneksi internet, dan port 3000. Tekan Enter untuk menutup."; read answer' EXIT
docker info >/dev/null
docker run --rm --mount "type=bind,source=$(pwd),target=/work" -w /work node:24-bookworm-slim node launcher/configure.mjs
docker compose --env-file launcher/local.env -f compose.local.yml up -d --build --wait --wait-timeout 300
open http://localhost:3000
open -e AKUN-ADMIN.txt
