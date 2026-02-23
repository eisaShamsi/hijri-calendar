/**
 * Claude API — وحدة التواصل مع Anthropic
 */
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `أنت عالم إسلامي متخصص في التقويم الهجري والفقه والتاريخ الإسلامي والفلك العربي.
مهمتك تقديم محتوى إسلامي يومي دقيق وموثوق يناسب سياق اليوم.

القواعد:
- اكتب بالعربية الفصحى الواضحة
- الآيات القرآنية يجب أن تكون دقيقة حرفياً مع ذكر اسم السورة ورقم الآية
- الأحاديث النبوية يجب أن تكون صحيحة أو حسنة مع ذكر المصدر (البخاري، مسلم، إلخ)
- الأحداث التاريخية يجب أن تكون موثقة
- اربط المحتوى بسياق اليوم (مناسبة، فصل، حالة القمر، إلخ)
- كن موجزاً ومؤثراً — لا إطالة`;

/**
 * توليد المحتوى اليومي
 */
async function generateDailyContent(context) {
    const prompt = buildDailyPrompt(context);

    const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    return parseDailyResponse(text);
}

/**
 * توليد تنبيهات ذكية
 */
async function generateSmartNotifications(days) {
    const prompt = buildNotificationsPrompt(days);

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    return parseNotificationsResponse(text);
}

function buildDailyPrompt(ctx) {
    return `أعطني محتوى يومي لهذا اليوم:

📅 التاريخ الهجري: ${ctx.hijriDay} ${ctx.hijriMonthName} ${ctx.hijriYear} هـ
📆 الميلادي: ${ctx.gregDay} ${ctx.gregMonthName} ${ctx.gregYear} م
📌 اليوم: ${ctx.dayOfWeek}
${ctx.islamicEvent ? `🎉 المناسبة: ${ctx.islamicEvent}` : ''}
🌙 القمر: ${ctx.moonPhase}
⭐ النوء: ${ctx.anwaMansion} — ${ctx.anwaSeason}
📍 الموقع: ${ctx.locationCity || 'غير محدد'}

أجب بصيغة JSON فقط:
{
  "verse": { "text": "نص الآية", "surah": "اسم السورة", "number": "رقم الآية" },
  "reflection": "تأمل قصير (2-3 جمل) يربط الآية بسياق اليوم",
  "hadith": { "text": "نص الحديث", "source": "المصدر" },
  "wisdom": "حكمة أو فائدة من التراث الإسلامي",
  "historicalEvent": "حدث تاريخي وقع في مثل هذا اليوم الهجري (أو قريباً منه)"
}`;
}

function buildNotificationsPrompt(days) {
    let prompt = 'أعطني تنبيهات ذكية للأيام التالية. لكل يوم أعطِ 1-3 تنبيهات مناسبة.\n\n';

    for (const day of days) {
        prompt += `- ${day.dayOfWeek} ${day.hijriDay} ${day.hijriMonthName}: `;
        if (day.islamicEvent) prompt += `(${day.islamicEvent}) `;
        prompt += `القمر: ${day.moonPhase}`;
        if (day.isNewMoon) prompt += ' [هلال جديد]';
        prompt += '\n';
    }

    prompt += `\nأجب بصيغة JSON:
[
  {
    "date": "YYYY-MM-DD",
    "notifications": [
      { "time": "fajr|sunrise|dhuhr|asr|maghrib|isha|morning|evening", "text": "نص التنبيه" }
    ]
  }
]`;

    return prompt;
}

function parseDailyResponse(text) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
        console.error('Failed to parse daily response:', e.message);
    }
    return {
        verse: { text: '', surah: '', number: '' },
        reflection: text.substring(0, 200),
        hadith: { text: '', source: '' },
        wisdom: '',
        historicalEvent: ''
    };
}

function parseNotificationsResponse(text) {
    try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
        console.error('Failed to parse notifications response:', e.message);
    }
    return [];
}

module.exports = { generateDailyContent, generateSmartNotifications };
