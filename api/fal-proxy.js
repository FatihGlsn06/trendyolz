// Vercel Serverless Function - Fal.ai Proxy
// fal-ai/image-apps-v2/product-photography API için proxy

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

    try {
        const { endpoint, ...params } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint is required' });
        }

        // Fal.ai API key from environment
        const FAL_API_KEY = process.env.FAL_API_KEY;
        if (!FAL_API_KEY) {
            return res.status(500).json({ error: 'FAL_API_KEY not configured on server' });
        }

        console.log(`[FAL Proxy] Calling endpoint: ${endpoint}`);

        const response = await fetch(`https://fal.run/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${FAL_API_KEY}`
            },
            body: JSON.stringify(params)
        });

        const responseText = await response.text();
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[FAL Proxy] Non-JSON response:', responseText.substring(0, 200));
            return res.status(500).json({
                error: 'Invalid response from Fal.ai',
                details: responseText.substring(0, 200)
            });
        }

        if (!response.ok) {
            console.error('[FAL Proxy] API error:', data);
            return res.status(response.status).json({
                error: data.detail || data.error || 'Fal.ai API error',
                details: data
            });
        }

        console.log('[FAL Proxy] Success');
        return res.status(200).json(data);

    } catch (error) {
        console.error('[FAL Proxy] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}
