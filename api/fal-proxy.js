// Vercel Serverless Function - Fal.ai Proxy (Queue-based)

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

        // 1. Queue'ya submit et
        const submitResponse = await fetch(`https://queue.fal.run/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${FAL_API_KEY}`
            },
            body: JSON.stringify(payload || {})
        });

        const submitText = await submitResponse.text();
        console.log(`[FAL Proxy] Submit status: ${submitResponse.status}`);
        console.log(`[FAL Proxy] Submit response: ${submitText.substring(0, 300)}`);

        let submitData;
        try {
            submitData = JSON.parse(submitText);
        } catch (e) {
            return res.status(500).json({
                error: 'Invalid JSON from queue submit',
                raw: submitText.substring(0, 500)
            });
        }

        if (!submitResponse.ok) {
            return res.status(submitResponse.status).json({
                error: submitData.detail || submitData.message || 'Fal.ai queue submit error',
                details: submitData
            });
        }

        const requestId = submitData.request_id;
        if (!requestId) {
            return res.status(500).json({
                error: 'No request_id received from queue',
                details: submitData
            });
        }

        console.log(`[FAL Proxy] Request ID: ${requestId}`);

        // 2. Sonucu bekle (polling - aynı URL hem status hem result döndürür)
        const maxAttempts = 60; // 60 saniye max
        const pollInterval = 1000; // 1 saniye

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            const statusResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Key ${FAL_API_KEY}`
                }
            });

            const statusText = await statusResponse.text();
            let statusData;
            try {
                statusData = JSON.parse(statusText);
            } catch (e) {
                continue; // Retry on parse error
            }

            console.log(`[FAL Proxy] Status check ${attempt + 1}: ${statusData.status}`);

            if (statusData.status === 'COMPLETED') {
                console.log(`[FAL Proxy] Success! Result keys: ${Object.keys(statusData).join(', ')}`);
                return res.status(200).json(statusData);
            }

            if (statusData.status === 'FAILED') {
                return res.status(500).json({
                    error: 'Fal.ai processing failed',
                    details: statusData
                });
            }

            // IN_QUEUE veya IN_PROGRESS - devam et
        }

        return res.status(504).json({ error: 'Timeout waiting for Fal.ai result' });

    } catch (error) {
        console.error('[FAL Proxy] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
