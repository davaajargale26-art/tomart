const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    });
}

loadEnvFile(path.join(__dirname, ".env"));

const app = express();
const PORT = Number(process.env.PORT) || 8890;
const publicPath = path.join(__dirname, "..", "frontend", "public");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "login_app",
  waitForConnections: true,
  connectionLimit: 10,
});

const seedCategories = [
  ["guides", "Зөвлөгөө"],
  ["culture", "Соёл"],
  ["games", "Тоглоом"],
  ["updates", "Шинэ мэдээ"],
];

const visibleCategorySlugs = seedCategories.map(([slug]) => slug);

const seedArticles = [
  {
    slug: "tomujin-first-note",
    category: "updates",
    title: "Tomujin Article нээгдлээ",
    excerpt: "Хүмүүсийн бичсэн нийтлэл, бодол, тэмдэглэлийг тайван унших булан.",
    body:
      "Tomujin Article бол хүмүүсийн бичсэн нийтлэл, тэмдэглэл, бодлыг цэгцтэй харуулах зориулалттай сайт. Энэ эхний хувилбар нь хайлт, ангилал, дэлгэрэнгүй унших хуудас, нийтлэл нэмэх хэсэгтэй.",
    author: "Tomujin Editorial",
    imageUrl: "/images/stagknight.jpg",
    featured: true,
  },
  {
    slug: "quiet-voices",
    category: "culture",
    title: "Тайван хоолойнуудын булан",
    excerpt: "Уншигчдад зориулсан төвлөрсөн нийтлэлийн орчин.",
    body:
      "Энэ сайт худалдан авалтгүй, бүртгэлгүй. Зөвхөн хүмүүст нийтлэл харуулахад төвлөрнө. Нүүр хэсэг, ангилал, хайлт, нийтлэлийн дэлгэрэнгүй хуудас бүгд нэг backend-ээр ажиллана.",
    author: "Tomujin Editorial",
    imageUrl: "/images/stagknight.jpg",
    featured: true,
  },
  {
    slug: "how-to-read-updates",
    category: "guides",
    title: "Нийтлэлийг хурдан олох нь",
    excerpt: "Хайлт болон ангиллаар хэрэгтэй нийтлэлээ хурдан олох боломжтой.",
    body:
      "Дээд хэсгийн хайлт дээр түлхүүр үг бичээд Enter дарахад тохирох нийтлэлүүд гарна. Хэрэв ганцхан нийтлэл олдвол шууд унших хуудас руу орно. Нийтлэлийн карт дээр дарахад дэлгэрэнгүй хуудас нээгдэнэ.",
    author: "Guide Desk",
    imageUrl: "/images/stagknight.jpg",
    featured: false,
  },
  {
    slug: "weekly-notes",
    category: "games",
    title: "Долоо хоногийн тэмдэглэл",
    excerpt: "Богино бодол, ажиглалт, сонирхолтой санаанууд нэг дор.",
    body:
      "Мэдээний сайт дээр соёл, зарлал, зөвлөгөө, хувийн тэмдэглэл зэрэг төрлийн нийтлэлүүдийг тусад нь ангилж хадгална. Дараа нь админ хэсэг нэмэхэд энэ бүтэц бэлэн байна.",
    author: "Article Desk",
    imageUrl: "/images/stagknight.jpg",
    featured: false,
  },
];

function categoryPlaceholders() {
  return visibleCategorySlugs.map(() => "?").join(", ");
}

async function initializeNews() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS news_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(80) NOT NULL UNIQUE,
      name VARCHAR(140) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS news_articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(160) NOT NULL UNIQUE,
      category_id INT NOT NULL,
      title VARCHAR(220) NOT NULL,
      excerpt TEXT NOT NULL,
      body TEXT NOT NULL,
      author VARCHAR(140) NOT NULL,
      image_url VARCHAR(255) NULL,
      featured TINYINT(1) NOT NULL DEFAULT 0,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES news_categories(id)
    )
  `);

  await db.query(
    "INSERT INTO news_categories (slug, name) VALUES ? ON DUPLICATE KEY UPDATE name = VALUES(name)",
    [seedCategories]
  );

  const [categories] = await db.query("SELECT id, slug FROM news_categories");
  const categoryIds = Object.fromEntries(categories.map((category) => [category.slug, category.id]));

  const articleRows = seedArticles.map((article) => [
    article.slug,
    categoryIds[article.category],
    article.title,
    article.excerpt,
    article.body,
    article.author,
    article.imageUrl,
    article.featured ? 1 : 0,
  ]);

  await db.query(
    `INSERT INTO news_articles
      (slug, category_id, title, excerpt, body, author, image_url, featured)
     VALUES ?
     ON DUPLICATE KEY UPDATE
      category_id = VALUES(category_id),
      title = VALUES(title),
      excerpt = VALUES(excerpt),
      body = VALUES(body),
      author = VALUES(author),
      image_url = VALUES(image_url),
      featured = VALUES(featured)`,
    [articleRows]
  );
}

function mapArticle(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    author: row.author,
    imageUrl: row.image_url,
    featured: Boolean(row.featured),
    publishedAt: row.published_at,
    category: {
      id: row.category_id,
      slug: row.category_slug,
      name: row.category_name,
    },
  };
}

function makeSlug(title) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "article"}-${Date.now().toString(36)}`;
}

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true, database: true, name: "tomujin-article-api" });
  } catch (error) {
    res.status(500).json({ ok: false, database: false, message: error.message });
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    const placeholders = categoryPlaceholders();
    const [rows] = await db.query(
      `
      SELECT c.id, c.slug, c.name, COUNT(a.id) AS articleCount
      FROM news_categories c
      LEFT JOIN news_articles a ON a.category_id = c.id
      WHERE c.slug IN (${placeholders})
      GROUP BY c.id, c.slug, c.name
      ORDER BY FIELD(c.slug, ${placeholders})
      `,
      [...visibleCategorySlugs, ...visibleCategorySlugs]
    );

    res.json(rows);
  } catch {
    res.status(500).json({ message: "Could not load categories." });
  }
});

app.get("/api/articles", async (req, res) => {
  try {
    const { q = "", category = "" } = req.query;
    const placeholders = categoryPlaceholders();
    const where = [`c.slug IN (${placeholders})`];
    const params = [...visibleCategorySlugs];

    if (category && category !== "all") {
      where.push("c.slug = ?");
      params.push(category);
    }

    if (q.trim()) {
      where.push("(LOWER(a.title) LIKE ? OR LOWER(a.excerpt) LIKE ? OR LOWER(a.body) LIKE ? OR LOWER(a.author) LIKE ?)");
      const search = `%${q.trim().toLowerCase()}%`;
      params.push(search, search, search, search);
    }

    const [rows] = await db.query(
      `
      SELECT
        a.id,
        a.slug,
        a.category_id,
        a.title,
        a.excerpt,
        a.body,
        a.author,
        a.image_url,
        a.featured,
        a.published_at,
        c.slug AS category_slug,
        c.name AS category_name
      FROM news_articles a
      JOIN news_categories c ON c.id = a.category_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.featured DESC, a.published_at DESC, a.id DESC
      `,
      params
    );

    res.json(rows.map(mapArticle));
  } catch {
    res.status(500).json({ message: "Could not load articles." });
  }
});

app.get("/api/articles/:slug", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        a.id,
        a.slug,
        a.category_id,
        a.title,
        a.excerpt,
        a.body,
        a.author,
        a.image_url,
        a.featured,
        a.published_at,
        c.slug AS category_slug,
        c.name AS category_name
      FROM news_articles a
      JOIN news_categories c ON c.id = a.category_id
      WHERE a.slug = ?
      LIMIT 1
      `,
      [req.params.slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Article not found." });
    }

    res.json(mapArticle(rows[0]));
  } catch {
    res.status(500).json({ message: "Could not load article." });
  }
});

app.post("/api/articles", async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const excerpt = String(req.body.excerpt || "").trim();
    const body = String(req.body.body || "").trim();
    const author = String(req.body.author || "").trim();
    const categorySlug = String(req.body.categorySlug || "").trim();
    const imageUrl = String(req.body.imageUrl || "").trim() || "/images/stagknight.jpg";

    if (!title || !excerpt || !body || !author || !categorySlug) {
      return res.status(400).json({ message: "Please fill every required field." });
    }

    if (!visibleCategorySlugs.includes(categorySlug)) {
      return res.status(400).json({ message: "Unknown category." });
    }

    const [categoryRows] = await db.query("SELECT id FROM news_categories WHERE slug = ? LIMIT 1", [categorySlug]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ message: "Category not found." });
    }

    const slug = makeSlug(title);

    await db.query(
      `
      INSERT INTO news_articles
        (slug, category_id, title, excerpt, body, author, image_url, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [slug, categoryRows[0].id, title, excerpt, body, author, imageUrl]
    );

    const [rows] = await db.query(
      `
      SELECT
        a.id,
        a.slug,
        a.category_id,
        a.title,
        a.excerpt,
        a.body,
        a.author,
        a.image_url,
        a.featured,
        a.published_at,
        c.slug AS category_slug,
        c.name AS category_name
      FROM news_articles a
      JOIN news_categories c ON c.id = a.category_id
      WHERE a.slug = ?
      LIMIT 1
      `,
      [slug]
    );

    res.status(201).json(mapArticle(rows[0]));
  } catch (error) {
    res.status(500).json({ message: "Could not save article.", error: error.message });
  }
});

app.use(express.static(publicPath));

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    res.sendFile(path.join(publicPath, "index.html"));
    return;
  }

  next();
});

initializeNews()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Tomujin Article running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not initialize news site:", error);
    process.exit(1);
  });
