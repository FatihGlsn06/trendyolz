// Vercel Serverless Function - Fal.ai Proxy

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
        const { endpoint, payload } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint is required' });
        }

        const FAL_API_KEY = process.env.FAL_API_KEY;
        if (!FAL_API_KEY) {
            return res.status(500).json({ error: 'FAL_API_KEY not configured' });
        }

        console.log(`[FAL Proxy] Endpoint: ${endpoint}`);
        console.log(`[FAL Proxy] Payload keys: ${Object.keys(payload || {}).join(', ')}`);

        // Direkt fal.run çağrısı (eski çalışan yöntem)
        const response = await fetch(`https://fal.run/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${FAL_API_KEY}`
            },
            body: JSON.stringify(payload || {})
        });

        const responseText = await response.text();
        console.log(`[FAL Proxy] Response status: ${response.status}`);
        console.log(`[FAL Proxy] Response preview: ${responseText.substring(0, 300)}`);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            return res.status(500).json({
                error: 'Invalid JSON response',
                raw: responseText.substring(0, 500)
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.detail || data.message || 'Fal.ai error',
                details: data
            });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('[FAL Proxy] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
