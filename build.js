const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SITE_TITLE = 'Akhil Srivatsan';
const SITE_URL = 'https://akhilsrivatsan.com';
const SITE_DESCRIPTION = 'Writer, musician, international Mumbaikar.';
const CONTENT_DIR = path.join(__dirname, 'content');
const TEMPLATE_DIR = path.join(__dirname, 'templates');
const OUT_DIR = path.join(__dirname, 'site');

// Categories and their display config
const CATEGORIES = {
  fiction: {
    title: 'Fiction',
    // Subcategories are defined via frontmatter `subcategory` field
    subcategories: ['After Forever', 'Stories'],
  },
  music: {
    title: 'Music',
    subcategories: ['Releases', 'Sonic Pi experiments'],
  },
  essays: {
    title: 'Essays',
    subcategories: null, // flat list
  },
  reviews: {
    title: 'Reviews',
    subcategories: ['Music', 'Cinema & TV', 'New Media'],
  },
  journal: {
    title: 'Journal',
    subcategories: null,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf-8');
}

/** Parse all markdown files in a category folder. */
function loadCategory(category) {
  const dir = path.join(CONTENT_DIR, category);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { data, content } = matter(raw);
      const slug = path.basename(f, '.md');
      return {
        slug,
        category,
        title: data.title || slug,
        date: data.date ? new Date(data.date) : null,
        dateDisplay: data.date || '',
        subcategory: data.subcategory || null,
        description: data.description || null,
        external: data.external || null, // URL if content lives elsewhere
        body: content,
        html: content.trim() ? marked(content) : null,
      };
    })
    .sort((a, b) => {
      // Newest first
      if (a.date && b.date) return b.date - a.date;
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });
}

/** Format a date as "Mon YYYY" for display. */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The <head> block shared by all pages. pathPrefix is '' for root, '../' for subdirs. */
function htmlHead(title, pathPrefix = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${pathPrefix}style.css">
    <link rel="alternate" type="application/rss+xml" title="${SITE_TITLE}" href="${SITE_URL}/feed.xml">
</head>`;
}

function footer() {
  return `        <footer>
            <p><a href="mailto:akhil@milktoastsolutions.com">Email</a></p>
        </footer>`;
}

// ---------------------------------------------------------------------------
// Page generators
// ---------------------------------------------------------------------------

function buildIndex() {
  const html = `${htmlHead(SITE_TITLE)}
<body>
    <main>
        <header>
            <h1><a href="index.html">${SITE_TITLE}</a></h1>
            <p class="intro">${SITE_DESCRIPTION}</p>
        </header>

        <nav>
            <ul>
                <li><a href="fiction.html">Fiction</a></li>
                <li><a href="music.html">Music</a></li>
                <li><a href="essays.html">Essays</a></li>
                <li><a href="reviews.html">Reviews</a></li>
                <li><a href="journal.html">Journal</a></li>
            </ul>
        </nav>

${footer()}
    </main>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
}

/** Build a directory listing page for a category. */
function buildCategoryPage(category) {
  const config = CATEGORIES[category];
  const posts = loadCategory(category);

  let body = '';

  if (posts.length === 0) {
    body = '        <p class="empty">Nothing here yet.</p>\n';
  } else if (config.subcategories) {
    // Group by subcategory
    for (const sub of config.subcategories) {
      const items = posts.filter(p => p.subcategory === sub);
      if (items.length === 0) continue;

      body += `        <h3>${sub}</h3>\n`;

      // Special case: After Forever gets a description
      if (category === 'fiction' && sub === 'After Forever') {
        const desc = 'A serialised sci-fi novelette set in a post-apocalyptic world where humans exist only as stored consciousnesses.';
        body += `        <p class="desc">${desc}</p>\n`;
      }

      body += '        <ul class="entries">\n';
      for (const post of items) {
        const href = post.external || `${category}/${post.slug}.html`;
        body += `            <li><a href="${href}">${post.title}</a> <span class="date">${formatDate(post.dateDisplay)}</span></li>\n`;
      }
      body += '        </ul>\n\n';
    }
  } else {
    // Flat list
    body += '        <ul class="entries">\n';
    for (const post of posts) {
      const href = post.external || `${category}/${post.slug}.html`;
      body += `            <li><a href="${href}">${post.title}</a> <span class="date">${formatDate(post.dateDisplay)}</span></li>\n`;
    }
    body += '        </ul>\n';
  }

  const html = `${htmlHead(`${config.title} — ${SITE_TITLE}`)}
<body>
    <main>
        <a href="index.html" class="back">← ${SITE_TITLE}</a>
        <h2>${config.title}</h2>

${body}
${footer()}
    </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(OUT_DIR, `${category}.html`), html);
}

/** Build an individual article page for a post with local content. */
function buildArticlePage(post) {
  if (!post.html || post.external) return; // skip external-only entries

  const categoryConfig = CATEGORIES[post.category];
  const html = `${htmlHead(`${post.title} — ${SITE_TITLE}`, '../')}
<body>
    <main>
        <a href="../${post.category}.html" class="back">← ${categoryConfig.title}</a>

        <article>
            <header class="article-header">
                <h2>${post.title}</h2>
                <p class="article-date">${formatDate(post.dateDisplay)}</p>
            </header>

            <div class="article-body">
                ${post.html}
            </div>
        </article>

${footer()}
    </main>
</body>
</html>
`;

  const outDir = path.join(OUT_DIR, post.category);
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, `${post.slug}.html`), html);
}

// ---------------------------------------------------------------------------
// RSS Feed
// ---------------------------------------------------------------------------

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildRSS(allPosts) {
  // Only include posts that have local content (not external-only links)
  const feedPosts = allPosts
    .filter(p => p.html && !p.external)
    .sort((a, b) => (b.date || 0) - (a.date || 0))
    .slice(0, 20);

  const now = new Date().toUTCString();

  let items = '';
  for (const post of feedPosts) {
    const link = `${SITE_URL}/${post.category}/${post.slug}.html`;
    const pubDate = post.date ? post.date.toUTCString() : now;
    items += `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.html)}</description>
    </item>\n`;
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}  </channel>
</rss>
`;

  fs.writeFileSync(path.join(OUT_DIR, 'feed.xml'), rss);
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------

function build() {
  console.log('Building site...');

  // Clean and create output dir
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }
  ensureDir(OUT_DIR);

  // Copy static assets
  fs.copyFileSync(path.join(__dirname, 'style.css'), path.join(OUT_DIR, 'style.css'));

  // CNAME for GitHub Pages custom domain
  fs.writeFileSync(path.join(OUT_DIR, 'CNAME'), 'akhilsrivatsan.com\n');

  // Build index
  buildIndex();
  console.log('  index.html');

  // Build each category
  const allPosts = [];
  for (const category of Object.keys(CATEGORIES)) {
    const posts = loadCategory(category);
    allPosts.push(...posts);

    buildCategoryPage(category);
    console.log(`  ${category}.html (${posts.length} entries)`);

    // Build individual article pages
    let articleCount = 0;
    for (const post of posts) {
      if (post.html && !post.external) {
        buildArticlePage(post);
        articleCount++;
      }
    }
    if (articleCount > 0) {
      console.log(`    → ${articleCount} article pages`);
    }
  }

  // Build RSS feed
  buildRSS(allPosts);
  console.log('  feed.xml');

  console.log(`\nDone. Output in ${OUT_DIR}`);
}

build();
