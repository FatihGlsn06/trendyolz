// Vercel Serverless Function - Fal.ai Proxy
// Supports: sync (fal.run), queue submit, status check, result fetch

export const config = {
    maxDuration: 60
};

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
        return res.status(500).json({ error: 'FAL_API_KEY not configured on server' });
    }

    try {
        const { endpoint, payload, action, requestId, ...restParams } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint is required' });
        }

        // Support both payload formats
        const actualPayload = payload || (Object.keys(restParams).length > 0 ? restParams : {});

        // ACTION: submit - Queue'ya gönder, request_id döndür
        if (action === 'submit') {
            console.log(`[FAL Proxy] Queue submit: ${endpoint}`);
            const queueResponse = await fetch(`https://queue.fal.run/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Key ${FAL_API_KEY}`
                },
                body: JSON.stringify(actualPayload)
            });

            if (!queueResponse.ok) {
                const errorText = await queueResponse.text();
                console.error('[FAL Proxy] Queue submit error:', errorText);
                return res.status(queueResponse.status).json({ error: 'Queue submit failed', details: errorText });
            }

            const queueData = await queueResponse.json();
            console.log(`[FAL Proxy] Queue submitted, ID: ${queueData.request_id}`);
            return res.status(200).json({ request_id: queueData.request_id });
        }

        // ACTION: status - Queue durumunu kontrol et
        if (action === 'status' && requestId) {
            const statusResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, {
                headers: { 'Authorization': `Key ${FAL_API_KEY}` }
            });

            if (!statusResponse.ok) {
                return res.status(statusResponse.status).json({ error: 'Status check failed' });
            }

            return res.status(200).json(await statusResponse.json());
        }

        // ACTION: result - Queue sonucunu al
        if (action === 'result' && requestId) {
            const resultResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, {
                headers: { 'Authorization': `Key ${FAL_API_KEY}` }
            });

            if (!resultResponse.ok) {
                return res.status(resultResponse.status).json({ error: 'Result fetch failed' });
            }

            return res.status(200).json(await resultResponse.json());
        }

        // DEFAULT: Synchronous call via fal.run (hızlı işlemler için)
        console.log(`[FAL Proxy] Sync call: ${endpoint}`);
        const response = await fetch(`https://fal.run/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${FAL_API_KEY}`
            },
            body: JSON.stringify(actualPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[FAL Proxy] Sync error:', errorText);
            return res.status(response.status).json({ error: 'Fal API error', details: errorText });
        }

        const result = await response.json();
        console.log('[FAL Proxy] Sync success');
        return res.status(200).json(result);

    } catch (error) {
        console.error('[FAL Proxy] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}
