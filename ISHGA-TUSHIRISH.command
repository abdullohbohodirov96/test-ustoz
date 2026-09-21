#!/bin/bash
# macOS uchun: shu faylni ikki marta bosing.
cd "$(dirname "$0")" || exit 1

echo ""
echo "  Test tizimi ishga tushirilmoqda..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  ❌ Node.js o'rnatilmagan."
  echo "  https://nodejs.org saytidan 'LTS' versiyasini yuklab o'rnating,"
  echo "  keyin shu faylni qayta oching."
  echo ""
  read -n 1 -s -r -p "  Yopish uchun istalgan tugmani bosing..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  Birinchi ishga tushirish — kutubxonalar o'rnatilmoqda (1-2 daqiqa)..."
  npm install --no-audit --no-fund || { read -n 1 -s -r -p "Xato. Tugmani bosing..."; exit 1; }
fi

[ -f .env ] || cp .env.example .env 2>/dev/null

# Brauzerni 3 soniyadan keyin ochamiz
( sleep 3; open "http://localhost:${PORT:-3000}" ) &

npm start
