const REPO_OWNER = 'AkhilSrivatsan';
const REPO_NAME = 'stranger-fiction';
const BRANCH = 'main';

const CATEGORIES = ['fiction', 'music', 'essays', 'reviews', 'journal'];

async function ghFetch(path) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`,
    { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

function parseFrontmatter(base64Content) {
  const text = Buffer.from(base64Content, 'base64').toString('utf-8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };

  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return { frontmatter: fm, body: match[2].trim() };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const password = req.headers['x-cms-password'] || req.query.password;
  if (password !== process.env.CMS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // If a specific file is requested, return its full content
  const { file } = req.query;
  if (file) {
    try {
      const data = await ghFetch(file);
      if (!data) return res.status(404).json({ error: 'File not found' });
      const { frontmatter, body } = parseFrontmatter(data.content);
      return res.status(200).json({ path: file, sha: data.sha, frontmatter, body });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Otherwise, list all posts and drafts
  try {
    const results = { published: [], drafts: [] };

    for (const cat of CATEGORIES) {
      // Published posts
      const files = await ghFetch(`content/${cat}`);
      if (Array.isArray(files)) {
        for (const f of files) {
          if (!f.name.endsWith('.md')) continue;
          results.published.push({
            path: f.path,
            slug: f.name.replace('.md', ''),
            category: cat,
            name: f.name,
          });
        }
      }

      // Drafts
      const drafts = await ghFetch(`content/_drafts/${cat}`);
      if (Array.isArray(drafts)) {
        for (const f of drafts) {
          if (!f.name.endsWith('.md')) continue;
          results.drafts.push({
            path: f.path,
            slug: f.name.replace('.md', ''),
            category: cat,
            name: f.name,
          });
        }
      }
    }

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
