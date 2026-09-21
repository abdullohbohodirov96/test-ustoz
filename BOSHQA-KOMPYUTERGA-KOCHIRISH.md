# Boshqa kompyuterga ko'chirish

## Nima kerak?

Faqat bitta narsa: **Node.js**. Boshqa hech narsa o'rnatish shart emas.

---

## 1-usul: USB flesh orqali (eng oson)

### Birinchi kompyuterda (bu yerda)
1. `test-ustoz` papkasini fleshga nusxalang.
2. Ichidagi **`node_modules`** papkasini fleshdan **o'chiring** — u juda katta va
   boshqa kompyuterda ishlamasligi mumkin. Yangi kompyuterda qaytadan yaratiladi.
3. Agar savollaringiz saqlanishini istasangiz — **`data`** papkasini ham oling
   (ichida `test.db` — barcha testlar va natijalar shu faylda).

### Yangi kompyuterda
1. [nodejs.org](https://nodejs.org) ga kiring → katta yashil **LTS** tugmasini bosing →
   yuklab olingan faylni oching → «Next / Continue» bosib o'rnating.
2. Fleshdagi `test-ustoz` papkasini kompyuterga nusxalang
   (masalan Ishchi stol — Desktop ga).
3. **macOS** → `ISHGA-TUSHIRISH.command` faylini ikki marta bosing.
   **Windows** → `ISHGA-TUSHIRISH.bat` faylini ikki marta bosing.
4. Birinchi ochilishda 1–2 daqiqa kutasiz (kutubxonalar yuklanadi —
   **shu bir martagina internet kerak**). Keyin brauzer o'zi ochiladi.

Tamom. Keyingi safar internetsiz ham ishlayveradi.

---

## 2-usul: GitHub orqali (flesh kerak emas)

Yangi kompyuterda:

1. Node.js o'rnating (yuqoridagidek).
2. Brauzerda oching:
   **https://github.com/abdullohbohodirov96/test-ustoz**
3. Yashil **Code** tugmasi → **Download ZIP**.
4. ZIP ni oching (ochib chiqaring), papkani Desktop ga qo'ying.
5. `ISHGA-TUSHIRISH.command` (Mac) yoki `ISHGA-TUSHIRISH.bat` (Windows) ni
   ikki marta bosing.

> Kod o'zgargan bo'lsa yana shu yerdan yangisini yuklab olasiz.

---

## macOS'da xato chiqsa

**«ruxsat yo'q» / «permission denied»** — Terminal'ni oching va yozing:
```
cd ~/Desktop/test-ustoz
chmod +x ISHGA-TUSHIRISH.command
```

**«Apple tekshira olmadi» / «cannot be opened»** — faylni **o'ng tugma** bilan
bosing → **Open** → yana **Open**. Bir martagina shunday qilinadi.

---

## Savollar va natijalar qayerda saqlanadi?

`test-ustoz/data/test.db` — bitta fayl. Hamma narsa shunda.

- **Zaxira nusxa:** shu faylni vaqti-vaqti bilan nusxalab qo'ying.
- **Boshqa kompyuterga o'tkazish:** shu faylni yangi kompyuterdagi
  `data` papkasiga qo'ying — testlar ham, natijalar ham o'tadi.
- **Toza boshlash:** `data` papkasini o'chirib tashlang — dastur yangisini yaratadi.

Natijalarni Excel'ga chiqarish: Admin panel → **📊 Natijalar** → **⬇ Excel**.

---

## Talabalar qanday ulanadi?

Dastur ishga tushganda Terminal oynasida shunga o'xshash manzil chiqadi:

```
  Shu Wi-Fi/tarmoqdagi boshqa qurilmalarda:
     http://192.168.1.45:3000
```

Shu manzilni doskaga yozing. Yoki **Admin panel → 📶 Ulanish (QR)** bo'limini
proyektorda ko'rsating — talabalar telefon kamerasi bilan QR ni skanerlaydi.

**Shartlar:**
- Kompyuter va telefonlar **bitta Wi-Fi** (yoki bitta router) ga ulangan bo'lsin.
- Internet kerak emas — hatto routerda internet bo'lmasa ham ishlayveradi.
- Dastur ishlab turgan kompyuterni **o'chirmang** va uyqu rejimiga qo'ymang.

### Ochilmasa nima qilish kerak?

| Muammo | Yechim |
|---|---|
| Telefonda sahifa ochilmaydi | Bitta Wi-Fi'da ekanini tekshiring |
| Baribir ochilmaydi | Kompyuterda Firewall (himoya devori) 3000-portga ruxsat bersin. macOS: Sozlamalar → Tarmoq → Firewall → o'chirib turing. Windows: birinchi ishga tushirishda «Allow access» bosing |
| Wi-Fi'da «qurilmalar bir-birini ko'rmasin» rejimi yoqilgan | Router sozlamalarida **AP isolation / Client isolation** ni o'chiring, yoki kompyuterdan telefon hotspot ga ulaning |
| Manzil chiqmadi | Kompyuter Wi-Fi ga ulanmagan. Ulang va qayta ishga tushiring |

---

## Portni o'zgartirish

3000-port band bo'lsa, `.env` faylini oching va yozing:
```
PORT=4000
```
Keyin manzil `http://192.168.1.45:4000` bo'ladi.
