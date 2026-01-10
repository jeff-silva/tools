#!/bin/bash

[ -f .env ] || cp .env.example .env
[ -f .env.prod ] || cp .env.example .env.prod

docker compose stop

docker compose --env-file .env.prod run --rm service-front sh -c '{
  npm install;
  npm run generate;
}'

rsync -av "./service-front/src/.output/public/" "./docs"