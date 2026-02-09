// Vercel Serverless Function - Fal.ai Proxy
// fal-ai/image-apps-v2/product-photography API için proxy (queue-based)

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

        // Fal.ai API key from environment
        const FAL_API_KEY = process.env.FAL_API_KEY;
        if (!FAL_API_KEY) {
            return res.status(500).json({ error: 'FAL_API_KEY not configured on server' });
        }

        console.log(`[FAL Proxy] Calling endpoint: ${endpoint}`);

        // Queue'ya gönder
        const queueResponse = await fetch(`https://queue.fal.run/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${FAL_API_KEY}`
            },
            body: JSON.stringify(payload || {})
        });

        if (!queueResponse.ok) {
            const errorText = await queueResponse.text();
            console.error('[FAL Proxy] Queue error:', errorText);
            return res.status(queueResponse.status).json({
                error: 'Failed to submit to queue',
                details: errorText
            });
        }

        const queueData = await queueResponse.json();
        const requestId = queueData.request_id;

        console.log(`[FAL Proxy] Request ID: ${requestId}`);

        // Sonucu bekle (polling)
        let result = null;
        let attempts = 0;
        const maxAttempts = 60; // 60 saniye max

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle

            const statusResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, {
                headers: {
                    'Authorization': `Key ${FAL_API_KEY}`
                }
            });

            if (!statusResponse.ok) {
                attempts++;
                continue;
            }

            const statusData = await statusResponse.json();
            console.log(`[FAL Proxy] Status: ${statusData.status}`);

            if (statusData.status === 'COMPLETED') {
                // Sonucu al
                const resultResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, {
                    headers: {
                        'Authorization': `Key ${FAL_API_KEY}`
                    }
                });

                if (resultResponse.ok) {
                    result = await resultResponse.json();
                    break;
                }
            } else if (statusData.status === 'FAILED') {
                return res.status(500).json({
                    error: 'Generation failed',
                    details: statusData
                });
            }

            attempts++;
        }

        if (!result) {
            return res.status(504).json({ error: 'Request timed out' });
        }

        console.log('[FAL Proxy] Success');
        return res.status(200).json(result);

    } catch (error) {
        console.error('[FAL Proxy] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}
