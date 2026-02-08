// Vercel Serverless Function - Gemini API Proxy
// SEO ve analiz için Gemini API proxy (görsel analiz destekli)

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
        const { prompt, model, image, requestBody } = req.body;

        // Gemini API key from environment
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
        }

        const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        const modelName = model || 'gemini-2.0-flash';
        const url = `${baseUrl}/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        console.log(`[Gemini Proxy] Calling model: ${modelName}`);

        let body;

        // Eski format: requestBody doğrudan gönderilir
        if (requestBody) {
            body = requestBody;
        }
        // Yeni format: prompt ve opsiyonel image
        else if (prompt) {
            const parts = [{ text: prompt }];

            // Görsel varsa ekle (base64 formatında)
            if (image) {
                parts.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: image
                    }
                });
            }

            body = {
                contents: [{
                    parts: parts
                }],
                generationConfig: {
                    temperature: 0.3
                }
            };
        } else {
            return res.status(400).json({ error: 'Either prompt or requestBody is required' });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const responseText = await response.text();
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Gemini Proxy] Non-JSON response:', responseText.substring(0, 200));
            return res.status(500).json({
                error: 'Invalid response from Gemini API',
                details: responseText.substring(0, 200)
            });
        }

        if (!response.ok) {
            console.error('[Gemini Proxy] API error:', data);

            // Model not found - return 404 for fallback handling
            if (response.status === 404) {
                return res.status(404).json({
                    error: `Model ${modelName} not found`,
                    details: data
                });
            }

            return res.status(response.status).json({
                error: data.error?.message || 'Gemini API error',
                details: data
            });
        }

        console.log('[Gemini Proxy] Success');
        return res.status(200).json(data);

    } catch (error) {
        console.error('[Gemini Proxy] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}
