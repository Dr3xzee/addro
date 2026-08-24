/**
 * generate-blog-static.js
 * -------------------------------------------------------------
 * Pulls every published post from Firestore and writes a REAL static
 * HTML file for each one, plus a sitemap.xml.
 *
 * WHY THIS EXISTS:
 * post.html (the client-rendered version) sets meta tags with JS —
 * that's fine for Google, but WhatsApp/Twitter/Facebook/LinkedIn link
 * previews do NOT execute JavaScript, so they'd always show the generic
 * fallback title/image instead of the real post. This script bakes the
 * actual title, description, image, and content straight into the HTML
 * so every crawler (search engine or social) sees the real thing.
 *
 * RUN THIS:
 *   - once after you set up Firebase, to backfill existing posts
 *   - again every time you publish/edit a post (or on a schedule — see
 *     the note at the bottom about wiring this to a Cloud Function)
 *
 * SETUP:
 *   1. npm init -y && npm install firebase-admin
 *   2. In Firebase console → Project settings → Service accounts →
 *      Generate new private key. Save the JSON file as
 *      `serviceAccountKey.json` next to this script (DO NOT commit it —
 *      add it to .gitignore, it's a real credential).
 *   3. Update SITE_URL below to your real domain.
 *   4. node generate-blog-static.js
 *
 * OUTPUT:
 *   /blog/[slug]/index.html   — one real static page per post
 *   /sitemap.xml              — every published post + core pages
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const SITE_URL = "https://addrotech.com.ng"; // <-- set your real domain
const OUTPUT_DIR = path.join(__dirname, "blog");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});
const db = admin.firestore();

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function readingTime(html) {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function toISO(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString();
}

function renderPostHTML(post) {
  const title = `${post.title} | Addro Blog`;
  const description = post.excerpt || stripHtml(post.content).slice(0, 155);
  const url = `${SITE_URL}/blog/${post.slug}/`;
  const image = post.coverImage || `${SITE_URL}/logo.jpg`;
  const author = post.author || "Addro Team";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description,
    image,
    author: { "@type": "Person", name: author },
    publisher: {
      "@type": "Organization",
      name: "Addro",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.jpg` },
    },
    datePublished: toISO(post.publishedAt),
    dateModified: toISO(post.updatedAt || post.publishedAt),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/jpeg" href="${SITE_URL}/logo.jpg">

<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">

<script type="application/ld+json">${JSON.stringify(schema)}</script>

<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { font-family: 'Inter', sans-serif; }
  .prose-addro h1 { font-weight:900; font-size:2rem; letter-spacing:-1px; margin:36px 0 14px; }
  .prose-addro h2 { font-weight:900; font-size:1.6rem; letter-spacing:-0.5px; margin:32px 0 12px; }
  .prose-addro h3 { font-weight:800; font-size:1.35rem; margin:28px 0 10px; }
  .prose-addro p { font-size:1.08rem; line-height:1.85; color:#222; margin-bottom:20px; }
  .prose-addro mark { background:#fff176; padding:0 2px; border-radius:3px; }
  .prose-addro img { max-width:100%; border-radius:16px; margin:28px 0; }
  .prose-addro blockquote { border-left:3px solid #000; padding:6px 0 6px 20px; margin:28px 0; font-style:italic; color:#444; font-size:1.15rem; }
  .prose-addro hr.section-break { border:none; height:2px; background:#eee; margin:48px 0; }
  .prose-addro a { color:#5e17eb; text-decoration:underline; }
</style>
</head>
<body class="bg-white text-black">

  <header class="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
    <div class="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="${SITE_URL}/index.html" class="text-2xl font-black tracking-tighter">ADDRO</a>
      <a href="${SITE_URL}/blog.html" class="text-sm font-bold hover:opacity-60">&larr; All Articles</a>
    </div>
  </header>

  <main class="max-w-3xl mx-auto px-6 pt-32 pb-24">
    <div class="flex flex-wrap items-center gap-4 mb-6 text-sm text-black/50">
      <span class="bg-neutral-100 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-black/70">${escapeHtml(post.category || "")}</span>
      <span>${formatDate(post.publishedAt)}</span>
      <span>&bull;</span>
      <span>${readingTime(post.content)}</span>
    </div>
    <h1 class="text-4xl md:text-5xl font-black tracking-tighter mb-6 leading-tight">${escapeHtml(post.title)}</h1>
    <p class="text-xl text-black/60 leading-relaxed mb-8">${escapeHtml(post.excerpt || "")}</p>
    <div class="flex items-center gap-3 mb-10 pb-10 border-b border-black/10">
      <div class="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold">${escapeHtml(author.charAt(0).toUpperCase())}</div>
      <div>
        <p class="font-bold text-sm">${escapeHtml(author)}</p>
        <p class="text-black/40 text-xs">Addro</p>
      </div>
    </div>
    ${post.coverImage ? `<img src="${post.coverImage}" alt="${escapeHtml(post.title)}" class="w-full rounded-2xl mb-10">` : ""}
    <div class="prose-addro">${post.content || ""}</div>

    <div class="mt-16 pt-10 border-t border-black/10 text-center">
      <p class="text-black/50 mb-4">Need something built like this?</p>
      <a href="${SITE_URL}/works/websitework.html" class="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full font-bold hover:scale-105 transition-transform">
        Need a digital boost? &rarr;
      </a>
    </div>
  </main>

  <footer class="bg-black text-white py-12 px-6 text-center">
    <p class="text-white/40 text-sm">&copy; ${new Date().getFullYear()} Addro. All rights reserved.</p>
  </footer>

</body>
</html>`;
}

async function main() {
  console.log("Fetching published posts...");
  const snap = await db.collection("posts").where("status", "==", "published").get();
  const posts = snap.docs.map((d) => d.data());
  console.log(`Found ${posts.length} published post(s).`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const post of posts) {
    if (!post.slug) { console.warn(`Skipping "${post.title}" — no slug set.`); continue; }
    const postDir = path.join(OUTPUT_DIR, post.slug);
    fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(path.join(postDir, "index.html"), renderPostHTML(post));
    console.log(`  wrote /blog/${post.slug}/index.html`);
  }

  // ---- sitemap.xml ----
  const staticPages = ["", "about.html", "blog.html", "works/websitework.html", "academy/academy.html"];
  const urls = [
    ...staticPages.map((p) => `${SITE_URL}/${p}`),
    ...posts.filter((p) => p.slug).map((p) => `${SITE_URL}/blog/${p.slug}/`),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
  fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap);
  console.log(`Wrote sitemap.xml with ${urls.length} URLs.`);

  console.log("\nDone. Deploy the /blog/ folder and sitemap.xml alongside your site.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * AUTOMATING THIS (optional, do later):
 * Right now this is a manual script — run it whenever you publish something.
 * To automate: wrap this same logic in a Firebase Cloud Function triggered
 * on Firestore writes to `posts` (onCreate/onUpdate), so static pages
 * regenerate automatically the moment you hit Publish in the editor.
 * That needs the Blaze (pay-as-you-go) plan for Cloud Functions — worth it
 * once you're publishing regularly, not needed to get started.
 */
