const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SITE_TITLE = 'Akhil Srivatsan';
const SITE_URL = 'https://www.akhilsrivatsan.com';
const SITE_DESCRIPTION = 'Writer, musician, business owner, international Mumbaikar. Interests: business as a creative endeavour, art as a commercial endeavour, the subjective vs. the objective nature of existence, music, books, bad jokes. (AI AI AI AI)';
const CONTENT_DIR = path.join(__dirname, 'content');
const TEMPLATE_DIR = path.join(__dirname, 'templates');
const OUT_DIR = path.join(__dirname, 'site');

// Categories and their display config
const CATEGORIES = {
  fiction: {
    title: 'Fiction',
    description: 'Fiction by Akhil Srivatsan, including After Forever — a 7-part serialised sci-fi novelette — and short stories.',
    subcategories: ['After Forever', 'Stories'],
  },
  music: {
    title: 'Music',
    description: 'Original music by Akhil Srivatsan — releases, covers, and Sonic Pi coding experiments.',
    subcategories: ['Releases', 'Sonic Pi experiments'],
  },
  essays: {
    title: 'Essays',
    description: 'Personal essays by Akhil Srivatsan on creativity, technology, alienation, and the practice of writing.',
    subcategories: null,
  },
  reviews: {
    title: 'Reviews',
    description: 'Essays on music, film, and new media — using albums, films, and games as lenses for personal and philosophical exploration.',
    subcategories: ['Music', 'Cinema & TV', 'New Media'],
  },
  journal: {
    title: 'Journal',
    description: 'Journal entries by Akhil Srivatsan.',
    subcategories: null,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
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
  // If the date is just "Mon DD" (no year), return it as-is
  if (/^[A-Z][a-z]{2}\s+\d{1,2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d)) return s;
  if (d.getUTCFullYear() <= 2001) return s;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Strip markdown syntax to plain text, truncated to ~155 chars for meta descriptions. */
function stripMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')       // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // links → text
    .replace(/```[\s\S]*?```/g, '')                // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')                   // inline code
    .replace(/^#{1,6}\s+/gm, '')                   // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')             // bold
    .replace(/\*([^*]+)\*/g, '$1')                 // italic
    .replace(/^\s*[-*+]\s+/gm, '')                 // list bullets
    .replace(/^\s*>\s+/gm, '')                     // blockquotes
    .replace(/\n+/g, ' ')                          // newlines → spaces
    .replace(/\s+/g, ' ')                          // collapse whitespace
    .trim()
    .substring(0, 155);
}

/** Wrap a date string in a semantic <time datetime="..."> element. */
function timeElement(dateStr) {
  if (!dateStr) return '';
  const display = formatDate(dateStr);
  if (!display) return '';
  const d = parseDateSafe(String(dateStr).trim());
  if (!d) return `<time>${display}</time>`;
  const iso = d.toISOString().split('T')[0];
  return `<time datetime="${iso}">${display}</time>`;
}

/** Escape a string for use in an HTML attribute value (double-quoted). */
function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/** The <head> block shared by all pages.
 *  @param {string} title        - Page <title> content
 *  @param {string} pathPrefix   - '' for root pages, '../' for category subdirectory pages
 *  @param {Object} options      - { description, canonical, type, extraHeadHtml }
 */
function htmlHead(title, pathPrefix = '', options = {}) {
  const {
    description = '',
    canonical = '',
    type = 'website',      // 'website' or 'article'
    extraHeadHtml = '',    // additional tags injected before </head> (e.g. JSON-LD)
  } = options;

  const metas = [
    `    <meta name="author" content="Akhil Srivatsan">`,
  ];

  if (description) {
    metas.push(`    <meta name="description" content="${escAttr(description)}">`);
  }
  if (canonical) {
    metas.push(`    <link rel="canonical" href="${escAttr(canonical)}">`);
  }

  // Open Graph
  metas.push(`    <meta property="og:site_name" content="${escAttr(SITE_TITLE)}">`);
  metas.push(`    <meta property="og:type" content="${type}">`);
  metas.push(`    <meta property="og:title" content="${escAttr(title)}">`);
  if (description) {
    metas.push(`    <meta property="og:description" content="${escAttr(description)}">`);
  }
  if (canonical) {
    metas.push(`    <meta property="og:url" content="${escAttr(canonical)}">`);
  }

  // Twitter card
  metas.push(`    <meta name="twitter:card" content="summary">`);
  metas.push(`    <meta name="twitter:title" content="${escAttr(title)}">`);
  if (description) {
    metas.push(`    <meta name="twitter:description" content="${escAttr(description)}">`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
${metas.join('\n')}${extraHeadHtml}
    <link rel="icon" type="image/jpeg" href="${pathPrefix}favicon.jpg">
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
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZPQVLTB3DM"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-ZPQVLTB3DM');
    </script>
</head>`;
}

function footer() {
  return `        <footer>
            <p><a href="mailto:editor@akhilsrivatsan.com">Email</a> · <a href="#" onclick="(function(e){e.preventDefault();var f=document.getElementById('subscribe-form');f.style.display=f.style.display==='none'?'block':'none'})(event);return false">Subscribe</a></p>
            <form id="subscribe-form" style="display:none;margin-top:0.75em" onsubmit="(function(e){e.preventDefault();var em=document.getElementById('sub-email').value;if(!em)return;var btn=document.getElementById('sub-btn');btn.disabled=true;btn.textContent='...';fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em})}).then(function(r){return r.json()}).then(function(d){if(d.ok){document.getElementById('sub-msg').textContent='Subscribed!';document.getElementById('sub-email').value=''}else{document.getElementById('sub-msg').textContent=d.error||'Error'}btn.disabled=false;btn.textContent='Subscribe'}).catch(function(){document.getElementById('sub-msg').textContent='Error';btn.disabled=false;btn.textContent='Subscribe'})})(event);return false">
                <input type="email" id="sub-email" placeholder="your@email.com" style="font-family:inherit;font-size:inherit;padding:4px 8px;border:1px solid #ccc;background:inherit;color:inherit">
                <button type="submit" id="sub-btn" style="font-family:inherit;font-size:inherit;padding:4px 8px;cursor:pointer">Subscribe</button>
                <span id="sub-msg" style="margin-left:0.5em;color:#888"></span>
            </form>
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
// JSON-LD structured data
// ---------------------------------------------------------------------------

function websiteJsonLd() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_TITLE,
    url: SITE_URL,
    author: { '@type': 'Person', name: 'Akhil Srivatsan' },
  }, null, 2);
}

function articleJsonLd(post) {
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    url: `${SITE_URL}/${post.category}/${post.slug}`,
    author: { '@type': 'Person', name: 'Akhil Srivatsan', url: SITE_URL },
    publisher: { '@type': 'Person', name: 'Akhil Srivatsan', url: SITE_URL },
  };
  if (post.date) {
    const isoDate = post.date.toISOString().split('T')[0];
    obj.datePublished = isoDate;
    obj.dateModified = isoDate;
  }
  if (post.description) obj.description = post.description;
  return JSON.stringify(obj, null, 2);
}

function breadcrumbJsonLd(post) {
  const categoryConfig = CATEGORIES[post.category];
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_TITLE, item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: categoryConfig.title, item: `${SITE_URL}/${post.category}` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/${post.category}/${post.slug}` },
    ],
  }, null, 2);
}

// ---------------------------------------------------------------------------
// Page generators
// ---------------------------------------------------------------------------

function buildIndex() {
  const extraHeadHtml = `
    <script type="application/ld+json">
${websiteJsonLd()}
    </script>`;

  const html = `${htmlHead(SITE_TITLE, '', {
    description: SITE_DESCRIPTION,
    canonical: `${SITE_URL}/`,
    type: 'website',
    extraHeadHtml,
  })}
<body>
    <main>
        <header>
            <div class="header-row"><h1><a href="/">${SITE_TITLE}</a></h1>${themeToggle()}</div>
            <p class="intro">${SITE_DESCRIPTION}</p>
        </header>

        <nav>
            <ul>
                <li><a href="fiction">Fiction</a></li>
                <li><a href="music">Music</a></li>
                <li><a href="essays">Essays</a></li>
                <li><a href="reviews">Reviews</a></li>
                <li><a href="journal">Journal</a></li>
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
  const canonical = `${SITE_URL}/${category}`;

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
        const href = post.external || `${category}/${post.slug}`;
        const dataAttr = category === 'reviews' ? ` data-subcategory="${sub}"` : '';
        body += `            <li${dataAttr}><a href="${href}">${post.title}</a> <span class="date">${timeElement(post.dateDisplay)}</span></li>\n`;
      }
      body += '        </ul>\n\n';
    }
  } else {
    // Flat list
    body += '        <ul class="entries">\n';
    for (const post of posts) {
      const href = post.external || `${category}/${post.slug}`;
      body += `            <li><a href="${href}">${post.title}</a> <span class="date">${timeElement(post.dateDisplay)}</span></li>\n`;
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

  function rebuildFilters() {
    var container = document.querySelector('.filters');
    container.innerHTML = '';
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
      container.appendChild(document.createTextNode(' \u00b7 '));
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

  document.querySelector('.filters').querySelectorAll('a').forEach(function(a){
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

  const html = `${htmlHead(`${config.title} — ${SITE_TITLE}`, '', {
    description: config.description || SITE_DESCRIPTION,
    canonical,
    type: 'website',
  })}
<body>
    <main>
        <div class="header-row"><a href="/" class="back">← ${SITE_TITLE}</a>${themeToggle()}</div>
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

/** Build an individual article page.
 *  @param {Object} post           - The post object
 *  @param {Array}  categoryPosts  - All local posts in the same category, sorted newest-first
 */
function buildArticlePage(post, categoryPosts) {
  if (!post.html || post.external) return;

  const categoryConfig = CATEGORIES[post.category];
  const canonical = `${SITE_URL}/${post.category}/${post.slug}`;

  // Auto-generate description from body if not in frontmatter
  const description = post.description || stripMarkdown(post.body);

  // Next (newer) / prev (older) within category — categoryPosts is newest-first
  const idx = categoryPosts.findIndex(p => p.slug === post.slug);
  const olderPost = idx < categoryPosts.length - 1 ? categoryPosts[idx + 1] : null;
  const newerPost = idx > 0 ? categoryPosts[idx - 1] : null;

  // Up to 4 other posts from same category for "More from" section
  const morePosts = categoryPosts.filter(p => p.slug !== post.slug).slice(0, 4);

  // JSON-LD for article + breadcrumb
  const extraHeadHtml = `
    <script type="application/ld+json">
${articleJsonLd(post)}
    </script>
    <script type="application/ld+json">
${breadcrumbJsonLd(post)}
    </script>`;

  // Next/prev navigation
  let navHtml = '';
  if (olderPost || newerPost) {
    navHtml = `
        <nav class="article-nav" aria-label="Article navigation">
            <div>${olderPost ? `<a href="../${post.category}/${olderPost.slug}" class="nav-prev">← ${olderPost.title}</a>` : ''}</div>
            <div>${newerPost ? `<a href="../${post.category}/${newerPost.slug}" class="nav-next">${newerPost.title} →</a>` : ''}</div>
        </nav>`;
  }

  // More from category
  let moreHtml = '';
  if (morePosts.length > 0) {
    const items = morePosts.map(p =>
      `                <li><a href="../${post.category}/${p.slug}">${p.title}</a> <span class="date">${timeElement(p.dateDisplay)}</span></li>`
    ).join('\n');
    moreHtml = `
        <section class="more-from-category">
            <h3>More from ${categoryConfig.title}</h3>
            <ul class="entries">
${items}
            </ul>
        </section>`;
  }

  // Subscribe nudge
  const subscribeCTA = `
        <div class="subscribe-nudge">
            <p>Get new pieces in your inbox \u2014 <a href="#" onclick="var f=document.getElementById('subscribe-form');f.style.display=f.style.display==='none'?'block':'none';return false">subscribe</a>.</p>
        </div>`;

  const html = `${htmlHead(`${post.title} — ${SITE_TITLE}`, '../', {
    description,
    canonical,
    type: 'article',
    extraHeadHtml,
  })}
<body>
    <main>
        <div class="header-row">
            <nav class="breadcrumb" aria-label="Breadcrumb">
                <a href="../${post.category}" class="back">← ${categoryConfig.title}</a>
            </nav>
            ${themeToggle()}
        </div>

        <article>
            <header class="article-header">
                <h2>${post.title}</h2>
                <p class="article-date">${timeElement(post.dateDisplay)}</p>
            </header>

            <div class="article-body">
                ${post.html}
            </div>
        </article>
${navHtml}${moreHtml}${subscribeCTA}
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
  const feedPosts = allPosts
    .filter(p => p.html && !p.external)
    .sort((a, b) => (b.date || 0) - (a.date || 0))
    .slice(0, 20);

  const now = new Date().toUTCString();

  let items = '';
  for (const post of feedPosts) {
    const link = `${SITE_URL}/${post.category}/${post.slug}`;
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
// Sitemap
// ---------------------------------------------------------------------------

function buildSitemap(allPosts) {
  const buildDate = new Date().toISOString().split('T')[0];

  let urls = '';

  // Index
  urls += `  <url>\n    <loc>${SITE_URL}/</loc>\n    <lastmod>${buildDate}</lastmod>\n  </url>\n`;

  // Category pages — lastmod = newest post date in that category
  for (const cat of Object.keys(CATEGORIES)) {
    const catPosts = allPosts.filter(p => p.category === cat && p.date);
    const newestDate = catPosts.length > 0
      ? catPosts.sort((a, b) => b.date - a.date)[0].date.toISOString().split('T')[0]
      : buildDate;
    urls += `  <url>\n    <loc>${SITE_URL}/${cat}</loc>\n    <lastmod>${newestDate}</lastmod>\n  </url>\n`;
  }

  // Article pages (local content only, not external links)
  for (const post of allPosts) {
    if (!post.html || post.external) continue;
    const lastmod = post.date ? post.date.toISOString().split('T')[0] : buildDate;
    urls += `  <url>\n    <loc>${SITE_URL}/${post.category}/${post.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>
`;

  fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml);
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

function buildRobots() {
  const content = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), content);
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------

function build404() {
  const html = `${htmlHead('Page not found — ' + SITE_TITLE, '', {
    description: 'This page could not be found.',
    canonical: SITE_URL + '/',
  })}
<body>
    <main>
        <div class="header-row"><a href="/" class="back">← ${SITE_TITLE}</a>${themeToggle()}</div>
        <h2>Page not found</h2>
        <p style="margin-bottom:2rem;color:var(--muted)">This page doesn't exist. Maybe it moved, maybe it never did.</p>
        <nav>
            <ul>
                <li><a href="fiction">Fiction</a></li>
                <li><a href="music">Music</a></li>
                <li><a href="essays">Essays</a></li>
                <li><a href="reviews">Reviews</a></li>
                <li><a href="journal">Journal</a></li>
            </ul>
        </nav>
${footer()}
    </main>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_DIR, '404.html'), html);
}

function build() {
  console.log('Building site...');

  // Clean and create output dir
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }
  ensureDir(OUT_DIR);

  // Copy static assets
  fs.copyFileSync(path.join(__dirname, 'style.css'), path.join(OUT_DIR, 'style.css'));
  if (fs.existsSync(path.join(__dirname, 'favicon.jpg'))) {
    fs.copyFileSync(path.join(__dirname, 'favicon.jpg'), path.join(OUT_DIR, 'favicon.jpg'));
  }

  // Copy CMS editor files
  const cmsDir = path.join(__dirname, 'cms');
  if (fs.existsSync(cmsDir)) {
    const outCms = path.join(OUT_DIR, 'write');
    ensureDir(outCms);
    for (const f of fs.readdirSync(cmsDir)) {
      fs.copyFileSync(path.join(cmsDir, f), path.join(outCms, f));
    }
    console.log('  write/ (CMS)');
  }

  // Copy content images (uploaded via CMS)
  const imagesDir = path.join(CONTENT_DIR, 'images');
  if (fs.existsSync(imagesDir)) {
    copyDirRecursive(imagesDir, path.join(OUT_DIR, 'images'));
    console.log('  images/');
  }

  // CNAME for GitHub Pages custom domain (harmless on Vercel)
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

    // Build individual article pages (pass local posts for next/prev context)
    const localPosts = posts.filter(p => p.html && !p.external);
    let articleCount = 0;
    for (const post of localPosts) {
      buildArticlePage(post, localPosts);
      articleCount++;
    }
    if (articleCount > 0) {
      console.log(`    → ${articleCount} article pages`);
    }
  }

  // Build RSS feed
  buildRSS(allPosts);
  console.log('  feed.xml');

  // Build sitemap
  buildSitemap(allPosts);
  console.log('  sitemap.xml');

  // Build robots.txt
  buildRobots();
  console.log('  robots.txt');

  // Build 404 page
  build404();
  console.log('  404.html');

  console.log(`\nDone. Output in ${OUT_DIR}`);
}

build();
