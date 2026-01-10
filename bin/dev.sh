#!/bin/bash

[ -f .env ] || cp .env.example .env
[ -f .env.prod ] || cp .env.example .env.prod

docker compose --env-file .env up --build --force-recreate --remove-orphans