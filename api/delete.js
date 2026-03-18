const REPO_OWNER = 'AkhilSrivatsan';
const REPO_NAME = 'stranger-fiction';
const BRANCH = 'main';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, filePath } = req.body;

  if (password !== process.env.CMS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (!filePath) {
    return res.status(400).json({ error: 'Missing filePath' });
  }

  // Safety: only allow deleting from content/ directories
  if (!filePath.startsWith('content/')) {
    return res.status(400).json({ error: 'Can only delete content files' });
  }

  try {
    // Get the file's SHA (required for deletion)
    const getRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
    );

    if (!getRes.ok) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileData = await getRes.json();

    const delRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Delete: ${filePath}`,
          sha: fileData.sha,
          branch: BRANCH,
        }),
      }
    );

    if (!delRes.ok) {
      const err = await delRes.json();
      return res.status(500).json({ error: 'GitHub delete failed', details: err });
    }

    return res.status(200).json({ ok: true, deleted: filePath });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
