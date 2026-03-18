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

    // Now send it as a test to yourself using the email's ID
    const emailId = bdData.id;
    const sendRes = await fetch(`https://api.buttondown.com/v1/emails/${emailId}/send-test`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sendRes.ok) {
      const sendData = await sendRes.json();
      const errMsg = typeof sendData.detail === 'string' ? sendData.detail : JSON.stringify(sendData);
      return res.status(500).json({ error: `Test send failed: ${errMsg}` });
    }

    // Clean up — delete the draft so it doesn't clutter Buttondown
    await fetch(`https://api.buttondown.com/v1/emails/${emailId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
      },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
