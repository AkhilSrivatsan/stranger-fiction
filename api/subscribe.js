module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const bdRes = await fetch('https://api.buttondown.com/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await bdRes.json();

    if (bdRes.ok || bdRes.status === 201) {
      return res.status(200).json({ ok: true });
    } else {
      // Common case: already subscribed
      return res.status(400).json({ error: data.detail || data[0] || 'Subscription failed' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
