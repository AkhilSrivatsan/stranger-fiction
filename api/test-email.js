module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, title, body } = req.body;

  if (password !== process.env.CMS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body required' });
  }

  if (!process.env.BUTTONDOWN_API_KEY) {
    return res.status(500).json({ error: 'BUTTONDOWN_API_KEY not configured' });
  }

  try {
    // Create email as draft in Buttondown
    const bdRes = await fetch('https://api.buttondown.com/v1/emails', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: `[TEST] ${title}`,
        body: body,
        status: 'draft',
      }),
    });

    const bdData = await bdRes.json();

    if (!bdRes.ok) {
      const errMsg = typeof bdData.detail === 'string' ? bdData.detail : JSON.stringify(bdData);
      return res.status(500).json({ error: `Buttondown: ${errMsg}` });
    }

    // Send draft to yourself as a test
    const emailId = bdData.id;
    const sendRes = await fetch(`https://api.buttondown.com/v1/emails/${emailId}/send-draft`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: ['self'],
      }),
    });

    if (!sendRes.ok) {
      // Try to parse as JSON, fall back to text
      let errMsg;
      const contentType = sendRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const sendData = await sendRes.json();
        errMsg = typeof sendData.detail === 'string' ? sendData.detail : JSON.stringify(sendData);
      } else {
        errMsg = `HTTP ${sendRes.status}`;
      }
      return res.status(500).json({ error: `Test send failed: ${errMsg}` });
    }

    return res.status(200).json({ ok: true, note: 'Draft created and sent to you. Check your inbox. Delete it from Buttondown when done.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
