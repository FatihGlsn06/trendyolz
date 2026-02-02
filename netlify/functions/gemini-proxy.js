// Gemini AI Proxy Function
// API key'i environment variable'dan alır, kullanıcıya göstermez

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Gemini API key not configured on server' })
    };
  }

  try {
    // Request body validation
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Empty request body' })
      };
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { model, requestBody } = body;

    // Sadece izin verilen modellere izin ver
    const allowedModels = [
      'gemini-3-flash-preview',
      'gemini-2.5-flash-preview',
      'gemini-2.5-flash-image',
      'gemini-2.5-flash',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash'
    ];

    if (!model || !allowedModels.includes(model)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or missing model' })
      };
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Safe JSON parsing for response
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Gemini API returned non-JSON:', responseText.substring(0, 200));
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Gemini API returned invalid response', details: responseText.substring(0, 200) })
      };
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.error || 'Gemini API error', details: data })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Gemini Proxy Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
