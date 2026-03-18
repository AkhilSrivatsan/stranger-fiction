const REPO_OWNER = 'AkhilSrivatsan';
const REPO_NAME = 'stranger-fiction';
const BRANCH = 'main';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, title, category, subcategory, date, description, body, slug } = req.body;

  if (password !== process.env.CMS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (!title || !category || !slug) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Build frontmatter
  const fm = [`title: "${title.replace(/"/g, '\\"')}"`];
  if (date) fm.push(`date: ${date}`);
  if (subcategory) fm.push(`subcategory: ${subcategory}`);
  if (description) fm.push(`description: "${description.replace(/"/g, '\\"')}"`);

  const content = `---\n${fm.join('\n')}\n---\n\n${body || ''}\n`;
  const filePath = `content/_drafts/${category}/${slug}.md`;

  try {
    // Check if draft already exists (for updates)
    let sha = null;
    const getRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
    );
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    const putBody = {
      message: sha ? `Update draft: ${title}` : `Save draft: ${title}`,
      content: Buffer.from(content).toString('base64'),
      branch: BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(putBody),
      }
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      return res.status(500).json({ error: 'GitHub commit failed', details: err });
    }

    return res.status(200).json({ ok: true, path: filePath });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
