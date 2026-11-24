#!/bin/sh
# Build no Vercel: migra a base de dados (ligação directa do Neon, se existir), seed de sistema e build.
set -e
if [ "$VERCEL_ENV" = "production" ] || [ "$RUN_MIGRATIONS" = "1" ]; then
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma migrate deploy
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma db seed
fi
npx next build
