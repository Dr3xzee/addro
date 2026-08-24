# Addro Blog — Setup & SEO Notes

## What's here
- `blog.html` — the public blog index. Fetches published posts live from Firestore, category filter + search work, pagination is real (8 posts/page).
- `blog/post.html` — client-rendered single-post page (`?slug=your-post-slug`). Good enough for a quick live view, and Google can index it.
- `generate-blog-static.js` — a Node script that generates **real static HTML files** per post plus a `sitemap.xml`. Read the "Why two versions" section below — this is the one that actually matters for search + social sharing.

## 1. Fill in your Firebase config
Same config object as `admin/login.html` / `admin/editor.html`. Paste it into `blog.html` and `blog/post.html` where you see `YOUR_API_KEY` etc.

## 2. Why two versions of the post page exist
`blog/post.html` sets the title/description/image with JavaScript **after** the page loads. That's fine for Google — it runs JS and will index it correctly, eventually. But it's a problem for the exact channels you actually use to push traffic:

- WhatsApp, Twitter/X, Facebook, LinkedIn link previews **do not execute JavaScript**. When someone pastes your blog link in a WhatsApp broadcast, these platforms grab whatever is in the raw HTML `<head>` — before any JS runs. Without a fix, every single post you share would show the same generic Addro logo and title, not the actual article.

`generate-blog-static.js` fixes this by writing the real, final HTML — real title, real image, real content — directly into a static file per post. No JS required for a crawler or a link preview to see it correctly.

**Bottom line: `blog/post.html` is your live/dev view. The static files from the script are what you actually deploy and share links to.**

## 3. Running the static generator
```
npm init -y
npm install firebase-admin
```
Get a service account key: Firebase console → Project settings → Service accounts → Generate new private key. Save it as `serviceAccountKey.json` in the same folder as the script — **never commit this file**, it's a real credential (add it to `.gitignore`).

Update `SITE_URL` at the top of the script to your real domain, then:
```
node generate-blog-static.js
```
This writes:
- `/blog/[slug]/index.html` for every published post
- `/sitemap.xml` listing every post + your core pages

Run it again every time you publish or edit a post. (There's a note at the bottom of the script on automating this with a Cloud Function later, once you're on Firebase's paid Blaze plan — not needed to get started.)

## 4. Getting indexed by Google
1. Deploy the site (with the freshly generated `/blog/` folder and `sitemap.xml` at the root).
2. Go to [Google Search Console](https://search.google.com/search-console), add your domain.
3. Submit your sitemap: Search Console → Sitemaps → enter `sitemap.xml` → Submit.
4. For a brand-new post you want indexed fast, use "Request Indexing" on the specific URL under the URL Inspection tool — don't rely only on the sitemap for urgent posts.

## 5. Firestore rules reminder
Same rules from the admin README apply here — `posts` should be readable by anyone when `status == "published"`, writable only by approved admins. If you haven't added those rules yet, do that before you publish anything real.

## 6. Optional: track "Most Read"
The sidebar's "Most Read" currently falls back to most recent since there's no view-count yet. To make it real, increment a `views` field on each post doc when `blog/post.html` loads it successfully — a few lines of Firestore `updateDoc` with `increment(1)`. Didn't wire this by default since it adds a write on every page load (small cost, but worth deciding on purpose rather than by default).

## What's still missing
- The newsletter signup (you said you'll handle that later — inputs are disabled/marked "Coming soon" for now).
- Automatic static regeneration on publish (currently manual — run the script yourself after publishing).
- View-count tracking for a real "Most Read" widget (see #6 above).
