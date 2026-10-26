#!/bin/sh
set -eu
npm run db:migrate
npm run db:seed
npx tsx launcher/ensure-admin.ts
exec npm start
