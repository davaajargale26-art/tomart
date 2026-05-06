# Tomujin Article

Article-only publishing site. No login, no cart, no checkout.

Run:

```powershell
cd "C:\Users\erhemee\OneDrive\Desktop\news-site\backend"
node index.js
```

Open:

```text
http://localhost:8890
```

Edit seed articles in:

```text
backend/index.js
```

Render settings:

```text
Build Command: npm run build
Start Command: npm start
```

Set environment variables in Render:

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
PORT
```

If you do not have an online MySQL database yet, set only `PORT=10000`.
The app will still deploy with sample in-memory articles.
