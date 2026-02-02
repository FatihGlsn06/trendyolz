// Gemini AI Proxy Function for Vercel
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

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  try {
    const { model, requestBody } = req.body;

    // Sadece izin verilen modellere izin ver
    const allowedModels = [
      'gemini-3-flash-preview',
      'gemini-2.5-flash-image',
      'gemini-2.5-flash',
      'gemini-2.0-flash-exp'
    ];

    if (!model || !allowedModels.includes(model)) {
      return res.status(400).json({ error: 'Invalid or missing model' });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error || 'Gemini API error',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Gemini Proxy Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
