const functions = require('firebase-functions');
const { Telegraf, Markup, session } = require('telegraf');
const admin = require('firebase-admin');

const texts = require('./texts');
const steps = require('./steps');
const { trafficOptions, geoOptions } = require('./helpers/data');
const { generateMultiButtons } = require('./helpers/buttons');

// Инициализация Firebase
admin.initializeApp();
const db = admin.database();

// Инициализация бота
const bot = new Telegraf(functions.config().bot.token);
bot.use(session());

// Функция для экранирования HTML
function escapeHTML(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '\''
        }[m] || m;
    });
}

// Определение кнопок
const joinButton = Markup.inlineKeyboard([
    Markup.button.callback('Join', 'join'),
]);

const languageButtons = Markup.inlineKeyboard([
    Markup.button.callback('English', 'lang_en'),
    Markup.button.callback('Русский', 'lang_ru'),
    Markup.button.callback('Українська', 'lang_ua'),
]);

// Обработчики бота
bot.start(async (ctx) => {
    try {
        console.log('Handling /start command for user:', ctx.from.id);
        ctx.session = {};
        await ctx.reply(texts.welcome.en, joinButton);
        console.log('Sent welcome message');
    } catch (error) {
        console.error('Error in /start handler:', error);
        await ctx.reply('An error occurred. Please try again later or contact support.');
    }
});

bot.command('reset', async (ctx) => {
    try {
        console.log('Handling /reset command for user:', ctx.from.id);
        ctx.session = {};
        await ctx.reply('Session reset. Start over with /start.');
        console.log('Sent reset confirmation');
    } catch (error) {
        console.error('Error in reset command:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action('join', async (ctx) => {
    try {
        ctx.session.step = steps.LANGUAGE;
        await ctx.answerCbQuery();
        await ctx.editMessageText(texts.chooseLanguage.en, languageButtons);
    } catch (error) {
        console.error('Error in join action:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action(/lang_(.+)/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        ctx.session.lang = lang;
        ctx.session.step = steps.CONTACT;
        ctx.session.data = { traffic: [], geo: [] };
        await ctx.answerCbQuery();
        await ctx.editMessageText(texts.shareContact[lang]);
    } catch (error) {
        console.error('Error in lang action:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.on('text', async (ctx) => {
    try {
        const step = ctx.session.step;
        const lang = ctx.session.lang || 'en';

        if (!step) return ctx.reply('Please press /start to begin.');

        switch (step) {
            case steps.CONTACT:
                ctx.session.data.contact = ctx.message.text;
                ctx.session.step = steps.COMPANY;
                return ctx.reply(texts.companyName[lang]);

            case steps.COMPANY:
                ctx.session.data.company = ctx.message.text;
                ctx.session.step = steps.TRAFFIC;
                return ctx.reply(texts.trafficSource[lang], generateMultiButtons(trafficOptions, [], 'traffic'));

            case steps.TRAFFIC:
            case steps.GEO:
            case steps.CONFIRM:
                return ctx.reply('Please use the buttons or start over with /start.');
        }
    } catch (error) {
        console.error('Error in text handler:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action(/traffic_(.+)/, async (ctx) => {
    try {
        const payload = ctx.match[1];
        const lang = ctx.session.lang || 'en';
        if (ctx.session.step !== steps.TRAFFIC) return ctx.answerCbQuery();

        if (payload === 'done') {
            if (!ctx.session.data.traffic.length)
                return ctx.answerCbQuery('Please select at least one.');
            ctx.session.step = steps.GEO;
            return ctx.editMessageText(texts.geo[lang], generateMultiButtons(geoOptions, ctx.session.data.geo, 'geo'));
        }

        const label = trafficOptions.find(opt => opt.replace(/\s+/g, '_').toLowerCase() === payload);
        if (!label) return ctx.answerCbQuery();

        const arr = ctx.session.data.traffic;
        const index = arr.indexOf(label);
        index === -1 ? arr.push(label) : arr.splice(index, 1);

        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup(generateMultiButtons(trafficOptions, arr, 'traffic').reply_markup);
    } catch (error) {
        console.error('Error in traffic action:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action(/geo_(.+)/, async (ctx) => {
    try {
        const payload = ctx.match[1];
        const lang = ctx.session.lang || 'en';

        if (ctx.session.step !== steps.GEO) return ctx.answerCbQuery();

        if (payload === 'done') {
            if (!ctx.session.data.geo.length)
                return ctx.answerCbQuery('Please select at least one GEO.');

            ctx.session.step = steps.CONFIRM;
            const d = ctx.session.data;

            const summary = `
<b>Contact:</b> ${escapeHTML(d.contact)}
<b>Company:</b> ${escapeHTML(d.company)}
<b>Traffic Sources:</b> ${escapeHTML(d.traffic.join(', '))}
<b>GEOs:</b> ${escapeHTML(d.geo.join(', '))}
            `;

            if (summary.length > 4096) {
                await ctx.reply('Your data is too long. Please shorten it and try again.');
                return;
            }

            const confirmKeyboard = {
                inline_keyboard: [
                    [{ text: '✅ Confirm', callback_data: 'confirm_yes' }],
                    [{ text: '✏️ Edit', callback_data: 'confirm_edit' }],
                ],
            };

            console.log('Sending confirm message with keyboard:', JSON.stringify({
                text: `${texts.confirm[lang]}\n\n${summary}`,
                parse_mode: 'HTML',
                reply_markup: confirmKeyboard,
            }, null, 2));

            await ctx.answerCbQuery();
            const result = await ctx.replyWithHTML(`${texts.confirm[lang]}\n\n${summary}`, {
                reply_markup: confirmKeyboard,
            });
            console.log('Reply result:', JSON.stringify(result, null, 2));
            await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
            return;
        }

        const label = geoOptions.find(opt => opt.replace(/\s+/g, '_').toLowerCase() === payload);
        if (!label) return ctx.answerCbQuery();

        const arr = ctx.session.data.geo;
        const index = arr.indexOf(label);
        index === -1 ? arr.push(label) : arr.splice(index, 1);

        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup(generateMultiButtons(geoOptions, arr, 'geo').reply_markup);
    } catch (error) {
        console.error('Error in geo action:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action('confirm_yes', async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        ctx.session.step = steps.DONE;

        // Сохранение в Firebase
        const ref = db.ref('partners');
        const newData = {
            contact: ctx.session.data.contact || 'N/A',
            company: ctx.session.data.company || 'N/A',
            traffic: ctx.session.data.traffic.length ? ctx.session.data.traffic.join(', ') : 'N/A',
            geo: ctx.session.data.geo.length ? ctx.session.data.geo.join(', ') : 'N/A',
            timestamp: new Date().toISOString()
        };
        const newRef = await ref.push(newData);
        console.log('Data saved to Firebase:', newData, 'Key:', newRef.key);

        await ctx.answerCbQuery();
        await ctx.reply(texts.thankYou[lang], { parse_mode: 'Markdown' });
        await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
    } catch (error) {
        console.error('Error in confirm_yes:', error);
        await ctx.reply('An error occurred. Nothing was sent. Please try again with /start.');
    }
});

bot.action('confirm_edit', async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        ctx.session.step = steps.CONTACT;
        ctx.session.data = { traffic: [], geo: [] };
        await ctx.answerCbQuery();
        await ctx.reply(texts.shareContact[lang], { parse_mode: 'HTML' });
        await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
    } catch (error) {
        console.error('Error in confirm_edit:', error);
        await ctx.reply('An error occurred. Nothing was sent. Please try again with /start.');
    }
});

bot.action('restart', async (ctx) => {
    try {
        ctx.session = {};
        await ctx.answerCbQuery();
        await ctx.reply(texts.welcome[ctx.session.lang || 'en'], joinButton);
    } catch (error) {
        console.error('Error in restart action:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Экспорт функции для Cloud Functions
exports.bot = functions.https.onRequest(async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling update:', error);
        res.status(500).send('Error');
    }
});