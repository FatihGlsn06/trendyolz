// FAL AI Proxy Function
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

  const FAL_API_KEY = process.env.FAL_API_KEY;

  if (!FAL_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'FAL API key not configured on server' })
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

    const { endpoint, ...params } = body;

    // Sadece izin verilen endpoint'lere izin ver
    const allowedEndpoints = [
      'fal-ai/birefnet',
      'fal-ai/clarity-upscaler',
      'fal-ai/flux/dev',
      'fal-ai/flux-pro/v1.1-ultra'
    ];

    if (!endpoint || !allowedEndpoints.includes(endpoint)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or missing endpoint' })
      };
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

    // Safe JSON parsing for response
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('FAL API returned non-JSON:', responseText.substring(0, 200));
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'FAL API returned invalid response', details: responseText.substring(0, 200) })
      };
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.error || data.detail || 'FAL API error', details: data })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('FAL Proxy Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
