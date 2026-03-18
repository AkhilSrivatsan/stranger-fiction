const REPO_OWNER = 'AkhilSrivatsan';
const REPO_NAME = 'stranger-fiction';
const BRANCH = 'main';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, slug, filename, data } = req.body;

  if (password !== process.env.CMS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (!slug || !filename || !data) {
    return res.status(400).json({ error: 'Missing required fields (slug, filename, data)' });
  }

  // data should be base64-encoded file content
  const filePath = `content/images/${slug}/${filename}`;

  try {
    // Check if image already exists
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
      message: `Upload image: ${filename} for ${slug}`,
      content: data,
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

    // Return the markdown-friendly path for the image
    const markdownPath = `../images/${slug}/${filename}`;
    return res.status(200).json({ ok: true, path: filePath, markdownPath });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
