const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ──────────────────────────────────────────────
// Rate Limiter (still good practice even with generous limits)
// ──────────────────────────────────────────────
const rateLimiter = {
    lastRequestTime: 0,
    minInterval: 500,     // 2s between requests (Groq allows 30 RPM)
    retryAfter: 0,
};

const waitForSlot = () => {
    return new Promise((resolve) => {
        const now = Date.now();
        if (rateLimiter.retryAfter > now) {
            setTimeout(resolve, rateLimiter.retryAfter - now);
            return;
        }
        const elapsed = now - rateLimiter.lastRequestTime;
        if (elapsed < rateLimiter.minInterval) {
            setTimeout(resolve, rateLimiter.minInterval - elapsed);
            return;
        }
        resolve();
    });
};

const callAI = async (systemPrompt, userPrompt, maxRetries = 2) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        await waitForSlot();
        rateLimiter.lastRequestTime = Date.now();

        try {
            const response = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 150,
            });

            return response.choices[0]?.message?.content?.trim() || "";
        } catch (error) {
            if (error.status === 429) {
                const retryDelay = 10000; // 10s default
                rateLimiter.retryAfter = Date.now() + retryDelay;
                console.log(`Rate limited (attempt ${attempt + 1}). Retry in ${retryDelay / 1000}s`);

                if (attempt === maxRetries) throw new Error('RATE_LIMITED');
                await new Promise((r) => setTimeout(r, retryDelay));
            } else {
                throw error;
            }
        }
    }
};

// ──────────────────────────────────────────────
// Auto-Reply Cooldown
// ──────────────────────────────────────────────
const autoReplyCooldowns = {};
const AUTO_REPLY_COOLDOWN = 5000; // 15s (can be lower since Groq is generous)

// ✅ 1. Auto-Reply
router.post('/ai/auto-reply', async (req, res) => {
    try {
        const { incomingMessage, conversationHistory, userName, myName, senderId } = req.body;

        const lastReply = autoReplyCooldowns[senderId] || 0;
        if (Date.now() - lastReply < AUTO_REPLY_COOLDOWN) {
            const remaining = Math.ceil((AUTO_REPLY_COOLDOWN - (Date.now() - lastReply)) / 1000);
            return res.status(429).json({
                error: `Auto-reply cooldown. Try again in ${remaining}s`,
                cooldown: true,
                retryIn: remaining,
            });
        }

        const historyText = (conversationHistory || [])
            .slice(-10)
            .map(msg => {
                const sender = msg.sender?.name || 'Unknown';
                const text = msg.message?.text || '[media]';
                return `${sender}: ${text}`;
            })
            .join('\n');

        const systemPrompt = `You are replying on behalf of "${myName}" in a casual chat. Keep replies short (1-2 sentences), natural, and match the conversation tone. Never mention you are AI.`;

        const userPrompt = `Recent conversation:\n${historyText}\n\nLatest message from ${userName}: "${incomingMessage}"\n\nReply as ${myName}:`;

        const reply = await callAI(systemPrompt, userPrompt);
        autoReplyCooldowns[senderId] = Date.now();

        res.json({ reply });
    } catch (error) {
        if (error.message === 'RATE_LIMITED') {
            return res.status(429).json({ error: 'AI is busy. Please wait a moment.', rateLimited: true });
        }
        console.error('Auto-reply error:', error);
        res.status(500).json({ error: 'Failed to generate auto-reply' });
    }
});

// ✅ 2. Smart Suggestions
router.post('/ai/suggestions', async (req, res) => {
    try {
        const { conversationHistory, userName, myName } = req.body;

        const historyText = (conversationHistory || [])
            .slice(-8)
            .map(msg => {
                const sender = msg.sender?.name || 'Unknown';
                const text = msg.message?.text || '[media]';
                return `${sender}: ${text}`;
            })
            .join('\n');

        const systemPrompt = `You generate reply suggestions for chat conversations. Always return ONLY a JSON array of exactly 3 short strings. No explanation, no markdown, just the JSON array.`;

        const userPrompt = `Chat between ${myName} and ${userName}:\n${historyText}\n\nGenerate 3 short reply suggestions for ${myName}. Return ONLY: ["reply1", "reply2", "reply3"]`;

        let text = await callAI(systemPrompt, userPrompt);
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Handle cases where AI wraps in extra text
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            res.json({ suggestions: suggestions.slice(0, 3) });
        } else {
            res.json({ suggestions: ["Sounds good!", "Let me think about it", "Sure, why not?"] });
        }
    } catch (error) {
        if (error.message === 'RATE_LIMITED') {
            return res.status(429).json({ error: 'AI is busy. Please wait a moment.', rateLimited: true });
        }
        console.error('Suggestions error:', error);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

// ✅ 3. Message Enhancement
router.post('/ai/enhance', async (req, res) => {
    try {
        const { message, style } = req.body;

        const systemPrompt = `You rewrite chat messages in different tones. Return ONLY the rewritten message, nothing else. No quotes, no explanation.`;

        const userPrompt = `Rewrite this message in a "${style || 'friendly'}" tone:\n"${message}"`;

        const enhanced = await callAI(systemPrompt, userPrompt);
        res.json({ enhanced: enhanced || message });
    } catch (error) {
        if (error.message === 'RATE_LIMITED') {
            return res.status(429).json({ error: 'AI is busy. Please wait a moment.', rateLimited: true });
        }
        console.error('Enhance error:', error);
        res.status(500).json({ error: 'Failed to enhance message' });
    }
});

module.exports = router;