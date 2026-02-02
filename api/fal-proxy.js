// FAL AI Proxy Function for Vercel
// API key'i environment variable'dan alır, kullanıcıya göstermez

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const FAL_API_KEY = process.env.FAL_API_KEY;

  if (!FAL_API_KEY) {
    return res.status(500).json({ error: 'FAL API key not configured on server' });
  }

  try {
    const { endpoint, ...params } = req.body;

    // Sadece izin verilen endpoint'lere izin ver
    const allowedEndpoints = [
      'fal-ai/birefnet',
      'fal-ai/clarity-upscaler'
    ];

    if (!endpoint || !allowedEndpoints.includes(endpoint)) {
      return res.status(400).json({ error: 'Invalid or missing endpoint' });
    }

    const falUrl = `https://fal.run/${endpoint}`;

    const response = await fetch(falUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_API_KEY}`
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error || 'FAL API error',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('FAL Proxy Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
