#!/bin/bash
# Test tizimini ishga tushirish (macOS / Linux)
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-3000}"

echo ""
echo "  ════════════════════════════════════════"
echo "   TEST TIZIMI"
echo "  ════════════════════════════════════════"
echo ""

# ---- 1. Node.js bormi? ----
if ! command -v node >/dev/null 2>&1; then
  echo "  ❌ Node.js o'rnatilmagan."
  echo ""
  echo "  1) https://nodejs.org saytiga kiring"
  echo "  2) Katta yashil 'LTS' tugmasini bosing"
  echo "  3) Yuklangan faylni ochib o'rnating"
  echo "  4) Keyin shu dasturni qayta oching"
  echo ""
  read -n 1 -s -r -p "  Yopish uchun istalgan tugmani bosing..."
  exit 1
fi

# ---- 2. Kutubxonalar to'g'ri o'rnatilganmi? ----
# (boshqa kompyuterdan ko'chirilgan node_modules ishlamaydi — qayta o'rnatamiz)
NEED_INSTALL=0
if [ ! -d node_modules ]; then
  NEED_INSTALL=1
elif ! node -e "require('better-sqlite3');require('express')" >/dev/null 2>&1; then
  echo "  ⚠️  Kutubxonalar bu kompyuterga mos emas — qayta o'rnatiladi."
  rm -rf node_modules
  NEED_INSTALL=1
fi

if [ "$NEED_INSTALL" = "1" ]; then
  echo "  📦 Kutubxonalar o'rnatilmoqda (1–2 daqiqa, internet kerak)..."
  echo ""
  npm install --no-audit --no-fund || {
    echo ""
    echo "  ❌ O'rnatib bo'lmadi. Internetga ulanganingizni tekshiring."
    read -n 1 -s -r -p "  Yopish uchun istalgan tugmani bosing..."
    exit 1
  }
  echo ""
fi

# ---- 3. Sozlama fayli ----
[ -f .env ] || cp .env.example .env 2>/dev/null

# ---- 4. Port bo'shmi? ----
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  ⚠️  $PORT porti band — dastur allaqachon ishlayotgan bo'lishi mumkin."
  echo "     Brauzerda oching: http://localhost:$PORT"
  echo ""
  read -n 1 -s -r -p "  Yopish uchun istalgan tugmani bosing..."
  exit 0
fi

# ---- 5. Server tayyor bo'lgach brauzerni ochamiz ----
(
  for i in $(seq 1 60); do
    if command -v curl >/dev/null 2>&1; then
      curl -s -o /dev/null "http://localhost:$PORT/healthz" && break
    else
      sleep 1; break
    fi
    sleep 1
  done
  if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"
  fi
) &

# ---- 6. Ishga tushirish ----
exec npm start
