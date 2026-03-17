/**
 * scrape.js — Fetches article content from Squarespace and Substack URLs
 * and writes it into the corresponding markdown files.
 *
 * Usage: node scrape.js
 *
 * Only processes files that have an `external:` URL and no body content yet.
 * Converts HTML article content to simple markdown.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const https = require('https');
const http = require('http');

const CONTENT_DIR = path.join(__dirname, 'content');

// ---------------------------------------------------------------------------
// HTML fetching
// ---------------------------------------------------------------------------

function fetch(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

// ---------------------------------------------------------------------------
// HTML → Markdown (simple, no deps)
// ---------------------------------------------------------------------------

function htmlToMarkdown(html) {
  let md = html;

  // Remove scripts, styles, nav, footer
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<nav[\s\S]*?<\/nav>/gi, '');

  // Headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const text = content.replace(/<\/?p[^>]*>/gi, '\n').trim();
    return '\n' + text.split('\n').map(l => '> ' + l.trim()).join('\n') + '\n';
  });

  // Bold, italic
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1');
  md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Paragraphs and breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>/gi, '');

  // Horizontal rules
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n');

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode common entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&#x27;/g, "'");
  md = md.replace(/&#x2F;/g, '/');
  md = md.replace(/&rsquo;/g, "\u2019");
  md = md.replace(/&lsquo;/g, "\u2018");
  md = md.replace(/&rdquo;/g, "\u201D");
  md = md.replace(/&ldquo;/g, "\u201C");
  md = md.replace(/&mdash;/g, "\u2014");
  md = md.replace(/&ndash;/g, "\u2013");
  md = md.replace(/&hellip;/g, "\u2026");

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

// ---------------------------------------------------------------------------
// Content extraction
// ---------------------------------------------------------------------------

function extractSquarespace(html) {
  // Squarespace stores text in sqs-html-content divs within text blocks
  // Collect all text block content
  const textBlocks = [];
  const regex = /<div[^>]*class="sqs-html-content"[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const content = m[1].trim();
    // Skip empty blocks and newsletter/form blocks
    if (content.length > 20 && !content.includes('newsletter-form')) {
      textBlocks.push(content);
    }
  }

  if (textBlocks.length > 0) {
    return htmlToMarkdown(textBlocks.join('\n\n'));
  }

  // Fallback: try article tag
  const match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  return match ? htmlToMarkdown(match[1]) : null;
}

function extractSubstack(html) {
  // Substack puts article content in div.body.markup or div.available-content
  // Use a greedy match that captures the full body markup div
  let match = html.match(/<div[^>]*class="[^"]*body markup[^"]*"[^>]*>([\s\S]*?)<div class="[^"]*subscription-widget/i);
  if (!match) match = html.match(/<div[^>]*class="[^"]*body markup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
  if (!match) match = html.match(/<div[^>]*class="[^"]*available-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
  if (!match) match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  return match ? htmlToMarkdown(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function scrapeAll() {
  const categories = fs.readdirSync(CONTENT_DIR).filter(f =>
    fs.statSync(path.join(CONTENT_DIR, f)).isDirectory()
  );

  let total = 0;
  let success = 0;
  let failed = [];

  for (const category of categories) {
    const dir = path.join(CONTENT_DIR, category);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);

      // Skip if no external URL or already has content
      if (!data.external || content.trim().length > 0) continue;

      total++;
      const url = data.external;
      console.log(`Fetching: ${data.title || file}`);
      console.log(`  URL: ${url}`);

      try {
        const html = await fetch(url);

        let markdown;
        if (url.includes('akhilsrivatsan.com') || url.includes('substack')) {
          markdown = extractSubstack(html);
        } else {
          markdown = extractSquarespace(html);
        }

        if (markdown && markdown.length > 50) {
          // Write back the file with content
          const newContent = matter.stringify('\n' + markdown + '\n', data);
          fs.writeFileSync(filePath, newContent);
          console.log(`  ✓ Saved (${markdown.length} chars)`);
          success++;
        } else {
          console.log(`  ✗ Could not extract meaningful content`);
          failed.push({ title: data.title, url, reason: 'extraction failed' });
        }
      } catch (err) {
        console.log(`  ✗ ${err.message}`);
        failed.push({ title: data.title, url, reason: err.message });
      }

      // Be polite — wait between requests
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total: ${total}, Success: ${success}, Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log('\nFailed:');
    for (const f of failed) {
      console.log(`  ${f.title}: ${f.reason}`);
    }
  }
}

scrapeAll().catch(console.error);
