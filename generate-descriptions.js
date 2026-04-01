/**
 * generate-descriptions.js
 *
 * Reads all content .md files missing a `description` frontmatter field,
 * calls Claude to generate one, and writes it back into the file.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node generate-descriptions.js
 *
 * Safe to re-run — skips files that already have a description.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const CONTENT_DIR = path.join(__dirname, 'content');
const CATEGORIES = ['fiction', 'music', 'essays', 'reviews', 'journal'];
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set.');
  console.error('Run as: ANTHROPIC_API_KEY=sk-ant-... node generate-descriptions.js');
  process.exit(1);
}

async function generateDescription(title, body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Write a 1-2 sentence description of this piece of writing. Write it for a human reader — capture what the piece is actually about or the specific angle it takes. Max 150 characters total. Reply with just the description, nothing else.\n\nTitle: ${title}\n\n${body.substring(0, 3000)}`,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.content[0].text.trim().replace(/^["']|["']$/g, '').substring(0, 155);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  let total = 0;
  let skipped = 0;
  let generated = 0;
  let errors = 0;

  for (const category of CATEGORIES) {
    const dir = path.join(CONTENT_DIR, category);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      total++;
      const filepath = path.join(dir, file);
      const raw = fs.readFileSync(filepath, 'utf8');
      const { data, content } = matter(raw);

      // Skip if already has a description or no body to work from
      if (data.description || !content.trim()) {
        skipped++;
        continue;
      }

      const title = data.title || path.basename(file, '.md');

      try {
        process.stdout.write(`  [${category}] ${file} ... `);
        const description = await generateDescription(title, content);

        data.description = description;
        const updated = matter.stringify(content, data);
        fs.writeFileSync(filepath, updated, 'utf8');

        console.log('✓');
        console.log(`    "${description}"`);
        generated++;

        // Brief pause to stay well within rate limits
        await sleep(300);
      } catch (err) {
        console.log(`✗  ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\nDone.`);
  console.log(`  Total files:       ${total}`);
  console.log(`  Already had desc:  ${skipped}`);
  console.log(`  Generated:         ${generated}`);
  console.log(`  Errors:            ${errors}`);

  if (generated > 0) {
    console.log(`\nCommit with:`);
    console.log(`  git add content/ && git commit -m "Add auto-generated descriptions to ${generated} posts"`);
  }
}

main().catch(console.error);
