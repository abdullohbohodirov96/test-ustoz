# 📝 Test Ustoz — onlayn test tizimi

Talabalar uchun ABCD testlar. Word/Excel'dan savollarni avtomatik yuklash,
taymer, natijani Telegram botga yuborish, Excel hisobot va sertifikat.

**Internetsiz (lokal) ham, internetda (Render) ham bir xil ishlaydi.**

---

## Imkoniyatlar

| | |
|---|---|
| 📥 **Import** | Word (.docx), Excel (.xlsx/.xls), CSV, TXT — savol va ABCD variantlar avtomatik ajratiladi. 4 xil format qo'llab-quvvatlanadi |
| ✍️ **Qo'lda kiritish** | Admin paneldan savolni bitta-bitta qo'shish/tahrirlash |
| 👤 **Ro'yxatdan o'tish** | Familiya, Ism, Otasining ismi, Guruh — birinchi harf avtomatik KATTA qilinadi |
| ⏱ **Taymer** | Har bir test uchun alohida vaqt. Vaqt tugasa avtomatik yakunlanadi |
| ➡️ **Faqat oldinga** | Javob berib «Keyingisi» bosiladi. Orqaga qaytish yo'q (brauzer tugmasi ham bloklangan) |
| 🔀 **Aralashtirish** | Savollar va ABCD variantlar har bir talabaga boshqacha tartibda — ko'chirishning oldi olinadi |
| 📊 **Natija** | Nechta to'g'ri / nechta noto'g'ri, foiz, baho (2–5), javoblar tahlili |
| 🤖 **Telegram** | Har bir natija darhol botga tushadi |
| 📄 **Sertifikat** | Talaba natijasini PDF qilib saqlaydi (brauzer «Chop etish» oynasi) |
| 📈 **Excel** | Barcha natijalarni bitta .xlsx faylga yuklab olish |
| 📶 **QR kod** | Admin panelda talabalar ulanadigan manzil va QR kod |

---

## 1-usul: LOKAL — internetsiz, o'z kompyuteringizda

Eng qulay variant: kompyuteringiz "server" bo'ladi, talabalar telefon/noutbukdan
**bitta Wi-Fi** orqali ulanadi. **Internet kerak emas.**

### O'rnatish (bir marta)

1. [nodejs.org](https://nodejs.org) dan **LTS** versiyasini o'rnating.
2. Loyihani yuklab oling va papkani oching.
3. **macOS** — `ISHGA-TUSHIRISH.command` faylini ikki marta bosing.
   **Windows** — `ISHGA-TUSHIRISH.bat` faylini ikki marta bosing.

Birinchi ishga tushirishda kutubxonalar o'rnatiladi (1–2 daqiqa, bu bosqichga
bir marta internet kerak). Keyin brauzer o'zi ochiladi.

> macOS'da «ruxsat yo'q» desa, Terminal'da bir marta:
> `chmod +x ISHGA-TUSHIRISH.command`

### Talabalar qanday ulanadi

Terminal oynasida shunga o'xshash manzil chiqadi:

```
  Shu Wi-Fi/tarmoqdagi boshqa qurilmalarda:
     http://192.168.1.45:3000
```

Shu manzilni doskaga yozasiz. Yoki **Admin panel → 📶 Ulanish (QR)**
bo'limidagi QR kodni ko'rsatasiz — talabalar telefon kamerasi bilan skanerlaydi.

Talaba shu manzilni ochadi → ismini kiritadi → test boshlanadi.

**Shartlar:** kompyuter va telefonlar bitta Wi-Fi/routerda bo'lsin.
Agar ochilmasa — kompyuterdagi **Firewall** 3000-portga ruxsat berishi kerak
(macOS: Sozlamalar → Tarmoq → Firewall; Windows: birinchi ishga tushirishda
«Allow access» tugmasini bosing).

### Lokal rejimda nima ishlaydi / ishlamaydi

| Ishlaydi ✅ | Internet kerak ⚠️ |
|---|---|
| Test topshirish, taymer, natija | Telegramga yuborish |
| Word/Excel import | |
| Excel hisobot, sertifikat | |
| Natijalar saqlanishi (`data/test.db` fayli) | |

Telegram ishlamasa ham natijalar yo'qolmaydi — bazada qoladi va Excel'ga
yuklab olinadi. Internet paydo bo'lganda yana avtomatik yuborila boshlaydi.

---

## 2-usul: INTERNET — Render.com (bepul)

Talabalar istalgan joydan, istalgan internetdan kira oladi.

1. Ushbu loyihani GitHub'ga yuklang.
2. [render.com](https://render.com) → **New → Web Service** → GitHub repo'ni tanlang.
3. Sozlamalar:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Environment** bo'limiga quyidagilarni kiriting:

| Kalit | Qiymat |
|---|---|
| `ADMIN_USER` | `admin` |
| `ADMIN_PASSWORD` | o'zingizning kuchli parolingiz |
| `SESSION_SECRET` | uzun tasodifiy matn |
| `TELEGRAM_BOT_TOKEN` | @BotFather bergan token |
| `TELEGRAM_CHAT_ID` | natija boradigan chat ID |

5. **Deploy** → 2-3 daqiqada manzil beradi: `https://test-ustoz.onrender.com`

> ⚠️ **Muhim:** Render'ning bepul tarifida disk vaqtinchalik — server qayta
> yuklansa (yangi deploy yoki 15 daqiqa harakatsizlik) **savollar va natijalar
> o'chib ketadi**. Buning yechimi: bepul PostgreSQL oching
> ([neon.tech](https://neon.tech) yoki [supabase.com](https://supabase.com)) va
> uning ulanish manzilini `DATABASE_URL` sifatida Render'ga qo'shing —
> shunda hamma narsa doimiy saqlanadi. Kodda hech narsa o'zgartirish shart emas.

---

## Telegram botni ulash

1. Telegramda **@BotFather** → `/newbot` → nom bering → **tokenni** nusxalang.
2. O'z botingizga kirib `/start` bosing (aks holda bot sizga yoza olmaydi).
3. **@userinfobot** ga `/start` yozing — u sizning **chat ID** ingizni beradi.
4. Token va chat ID ni `.env` faylga (lokal) yoki Render → Environment ga yozing.
5. Admin panel → **🤖 Telegram** → «Sinov xabari yuborish» bilan tekshiring.

Bir nechta odamga yuborish uchun chat ID larni vergul bilan yozing:
`123456789,987654321`. Guruhga yuborish uchun botni guruhga qo'shib,
guruh ID sini (`-100...`) kiriting.

---

## Savollarni yuklash formatlari

Admin panel → **📥 Import** → faylni tanlang → tizim savollarni ko'rsatadi →
to'g'ri javoblarni tekshirasiz → «Testga qo'shish».

**1) Word/TXT — raqamlangan:**
```
1. O'zbekiston poytaxti qaysi shahar?
A) Samarqand
B) Toshkent
C) Buxoro
D) Xiva
Javob: B
```

**2) To'g'ri javob "+" bilan:**
```
1. 2 + 2 * 2 = ?
A) 8
+B) 6
C) 4
D) 2
```

**3) ? va +/- belgilari bilan:**
```
? Eng katta okean qaysi?
+ Tinch okean
- Atlantika
- Hind
- Shimoliy Muz
```

**4) Raqamli variantlar:**
```
1. Uchburchak burchaklari yig'indisi?
1) 90
2) 180
3) 270
4) 360
Javob: 2
```

**5) Excel:** ustunlar — `Savol | A | B | C | D | To'g'ri javob`
(namunani admin paneldan yuklab olish mumkin)

Kirill harflar (`а) б) в) г)`) va `Ответ:` ham tushuniladi.
Eski `.doc` format ishlamaydi — Word'da ochib `.docx` qilib saqlang.

---

## Baholash mezoni

| Foiz | Baho |
|---|---|
| 86–100% | 5 |
| 71–85% | 4 |
| 56–70% | 3 |
| 0–55% | 2 |

«O'tdi/O'tmadi» chegarasini har bir test uchun alohida belgilash mumkin.

---

## Texnik ma'lumot

- **Backend:** Node.js + Express
- **Baza:** SQLite (oddiy fayl, hech qanday sozlash kerak emas) yoki
  PostgreSQL (`DATABASE_URL` berilsa avtomatik o'tadi)
- **Frontend:** toza HTML/CSS/JS — build qilish shart emas, internetsiz ishlaydi
- Javoblar serverda tekshiriladi, to'g'ri javob brauzerga umuman yuborilmaydi
- Har bir urinish maxfiy token bilan himoyalangan

### Buyruqlar

```bash
npm install     # kutubxonalarni o'rnatish
npm start       # ishga tushirish
npm run dev     # tahrirlaganda avtomatik qayta yuklash
npm run seed    # demo testlarni qayta qo'shish
```

### Sozlamalar (.env)

`.env.example` faylini `.env` deb nusxalang va to'ldiring.

| Kalit | Tavsif |
|---|---|
| `PORT` | Port (default 3000) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Admin paneliga kirish |
| `SESSION_SECRET` | Cookie imzolash kaliti |
| `DATABASE_URL` | PostgreSQL (bo'sh bo'lsa SQLite ishlatiladi) |
| `DATA_DIR` | SQLite fayl papkasi (default `./data`) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Telegram |
| `SEED_DEMO` | `0` qilinsa demo testlar qo'shilmaydi |

---

MIT
