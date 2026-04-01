const REPO_OWNER = 'AkhilSrivatsan';
const REPO_NAME = 'stranger-fiction';
const BRANCH = 'main';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, title, category, subcategory, date, description, body, slug, email } = req.body;

  if (password !== process.env.CMS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (!title || !category || !body || !slug) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Auto-generate description via Claude if not provided
  let finalDescription = description;
  if (!finalDescription && process.env.ANTHROPIC_API_KEY) {
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
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
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        finalDescription = aiData.content[0].text.trim().replace(/^["']|["']$/g, '').substring(0, 155);
      }
    } catch (e) {
      // fail silently — build.js has a body-truncation fallback
    }
  }

  // Build frontmatter
  const fm = [`title: "${title.replace(/"/g, '\\"')}"`];
  if (date) fm.push(`date: ${date}`);
  if (subcategory) fm.push(`subcategory: ${subcategory}`);
  if (finalDescription) fm.push(`description: "${finalDescription.replace(/"/g, '\\"')}"`);

  const content = `---\n${fm.join('\n')}\n---\n\n${body}\n`;
  const filePath = `content/${category}/${slug}.md`;

  try {
    // Check if file already exists (for updates)
    let sha = null;
    const getRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
    );
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    // Commit the file
    const putBody = {
      message: sha ? `Update: ${title}` : `Publish: ${title}`,
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

    // If publishing from drafts, delete the draft file
    const draftPath = `content/_drafts/${category}/${slug}.md`;
    const draftCheck = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${draftPath}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
    );
    if (draftCheck.ok) {
      const draftData = await draftCheck.json();
      await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${draftPath}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Remove draft: ${title}`,
            sha: draftData.sha,
            branch: BRANCH,
          }),
        }
      );
    }

    // Send email via Buttondown API
    if (email && process.env.BUTTONDOWN_API_KEY) {
      try {
        const siteUrl = 'https://www.akhilsrivatsan.com';
        const articleUrl = `${siteUrl}/${category}/${slug}`;
        const emailBody = `${body}\n\n---\n\n[Read on the site](${articleUrl})`;

        const bdRes = await fetch('https://api.buttondown.com/v1/emails', {
          method: 'POST',
          headers: {
            Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Buttondown-Live-Dangerously': 'true',
          },
          body: JSON.stringify({
            subject: title,
            body: emailBody,
            status: 'about_to_send',
          }),
        });

        if (!bdRes.ok) {
          const bdErr = await bdRes.json();
          console.error('Buttondown error:', bdErr);
          // Don't fail the publish — article is already committed
          return res.status(200).json({ ok: true, path: filePath, emailError: bdErr });
        }
      } catch (bdErr) {
        console.error('Buttondown send failed:', bdErr.message);
        return res.status(200).json({ ok: true, path: filePath, emailError: bdErr.message });
      }
    }

    return res.status(200).json({ ok: true, path: filePath });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
