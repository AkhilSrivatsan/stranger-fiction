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

/** Parse a date string only if it contains a year; returns null for "Mon DD" formats. */
function parseDateSafe(dateStr) {
  const s = String(dateStr).trim();
  // "Mar 26", "Jan 11" etc. — no year, don't parse
  if (/^[A-Z][a-z]{2}\s+\d{1,2}$/.test(s)) return null;
  const d = new Date(s);
  if (isNaN(d) || d.getUTCFullYear() <= 2001) return null;
  return d;
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
        date: data.date ? parseDateSafe(data.date) : null,
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
  const s = String(dateStr).trim();
  // If the date is just "Mon DD" (no year), return it as-is rather than letting
  // Date parse it into year 2001.
  if (/^[A-Z][a-z]{2}\s+\d{1,2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d)) return s;
  // Avoid displaying year 2001 for dates that were clearly mis-parsed
  if (d.getUTCFullYear() <= 2001) return s;
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
    <script>
      (function(){
        var t = localStorage.getItem('theme');
        if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', t);
        var s = localStorage.getItem('size');
        if (s) document.documentElement.setAttribute('data-size', s);
      })();
    </script>
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

function themeToggle() {
  return `<span class="toggles"><a href="#" class="size-toggle" onclick="(function(e){e.preventDefault();var sizes=['small','medium','large'];var cur=document.documentElement.getAttribute('data-size')||'small';var i=(sizes.indexOf(cur)+1)%sizes.length;document.documentElement.setAttribute('data-size',sizes[i]);localStorage.setItem('size',sizes[i]);document.querySelector('.size-toggle').textContent=sizes[i]})(event);return false">small</a> · <a href="#" class="theme-toggle" onclick="(function(e){e.preventDefault();var t=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',t);localStorage.setItem('theme',t);document.querySelector('.theme-toggle').textContent=t==='dark'?'light':'dark'})(event);return false">dark</a></span>
<script>
document.querySelector('.theme-toggle').textContent=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
var s=localStorage.getItem('size')||'small';document.documentElement.setAttribute('data-size',s);document.querySelector('.size-toggle').textContent=s;
</script>`;
}

// ---------------------------------------------------------------------------
// Page generators
// ---------------------------------------------------------------------------

function buildIndex() {
  const html = `${htmlHead(SITE_TITLE)}
<body>
    <main>
        <header>
            <div class="header-row"><h1><a href="index.html">${SITE_TITLE}</a></h1>${themeToggle()}</div>
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
        const dataAttr = category === 'reviews' ? ` data-subcategory="${sub}"` : '';
        body += `            <li${dataAttr}><a href="${href}">${post.title}</a> <span class="date">${formatDate(post.dateDisplay)}</span></li>\n`;
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

  // Reviews page gets filter UI + script
  let filterUI = '';
  let filterScript = '';
  if (category === 'reviews' && config.subcategories) {
    const subs = config.subcategories;
    const links = subs.map(s => `<a href="#" data-filter="${s}">${s.toLowerCase()}</a>`).join(' · ');
    filterUI = `        <div class="filters"><span class="filter-active">all</span> · ${links}</div>\n`;
    filterUI += `        <input type="text" class="search-input" placeholder="search">\n`;

    filterScript = `
<script>
(function(){
  var items = document.querySelectorAll('.entries li[data-subcategory]');
  var headers = document.querySelectorAll('h3');
  var links = document.querySelectorAll('.filters a');
  var active = document.querySelector('.filters .filter-active');
  var search = document.querySelector('.search-input');
  var current = 'all';

  function apply() {
    var q = search.value.toLowerCase();
    var headerMap = {};
    headers.forEach(function(h){ headerMap[h.textContent] = 0; });
    items.forEach(function(li){
      var sub = li.getAttribute('data-subcategory');
      var title = li.textContent.toLowerCase();
      var show = (current === 'all' || sub === current) && (!q || title.indexOf(q) !== -1);
      li.style.display = show ? '' : 'none';
      if (show && headerMap.hasOwnProperty(sub)) headerMap[sub]++;
    });
    headers.forEach(function(h){
      var next = h.nextElementSibling;
      h.style.display = headerMap[h.textContent] > 0 ? '' : 'none';
      if (next && next.classList.contains('entries')) {
        next.style.display = headerMap[h.textContent] > 0 ? '' : 'none';
      }
    });
  }

  function setFilter(name, el) {
    current = name;
    active.textContent = name === 'all' ? 'all' : '';
    if (name !== 'all') active.style.display = 'none';
    else active.style.display = '';
    links.forEach(function(a){
      var f = a.getAttribute('data-filter');
      if (f === name) {
        var span = document.createElement('span');
        span.className = 'filter-active';
        span.textContent = f.toLowerCase();
        span.setAttribute('data-filter', f);
        a.parentNode.replaceChild(span, a);
      }
    });
    document.querySelectorAll('.filters .filter-active').forEach(function(s){
      if (s !== active || name === 'all') {
        // noop for 'all' active
      }
    });
    // Simpler approach: rebuild the filter row
    rebuildFilters();
    apply();
  }

  function rebuildFilters() {
    var container = document.querySelector('.filters');
    container.innerHTML = '';
    // 'all' link or active
    if (current === 'all') {
      var s = document.createElement('span');
      s.className = 'filter-active';
      s.textContent = 'all';
      container.appendChild(s);
    } else {
      var a = document.createElement('a');
      a.href = '#';
      a.setAttribute('data-filter', 'all');
      a.textContent = 'all';
      container.appendChild(a);
    }
    ${JSON.stringify(subs)}.forEach(function(sub){
      container.appendChild(document.createTextNode(' \\u00b7 '));
      if (sub === current) {
        var s = document.createElement('span');
        s.className = 'filter-active';
        s.textContent = sub.toLowerCase();
        container.appendChild(s);
      } else {
        var a = document.createElement('a');
        a.href = '#';
        a.setAttribute('data-filter', sub);
        a.textContent = sub.toLowerCase();
        container.appendChild(a);
      }
    });
    container.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var f = this.getAttribute('data-filter');
        current = f === 'all' ? 'all' : f;
        rebuildFilters();
        apply();
      });
    });
  }

  container = document.querySelector('.filters');
  container.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      current = this.getAttribute('data-filter');
      rebuildFilters();
      apply();
    });
  });

  search.addEventListener('input', apply);
})();
</script>`;
  }

  const html = `${htmlHead(`${config.title} — ${SITE_TITLE}`)}
<body>
    <main>
        <div class="header-row"><a href="index.html" class="back">← ${SITE_TITLE}</a>${themeToggle()}</div>
        <h2>${config.title}</h2>

${filterUI}${body}
${filterScript}
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
        <div class="header-row"><a href="../${post.category}.html" class="back">← ${categoryConfig.title}</a>${themeToggle()}</div>

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
