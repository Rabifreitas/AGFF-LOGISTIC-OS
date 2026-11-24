#!/bin/sh
# Build no Vercel: migra a base de dados (ligação directa do Neon, se existir), seed de sistema e build.
set -e
if [ -z "${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" ]; then
  echo "DATABASE_URL em falta: ligue uma base de dados Neon ao projecto (Vercel > Storage) e volte a fazer deploy." >&2
  exit 1
fi
if [ "$VERCEL_ENV" = "production" ] || [ "$RUN_MIGRATIONS" = "1" ]; then
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma migrate deploy
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma db seed
fi
npx next build
