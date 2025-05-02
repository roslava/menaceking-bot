require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const express = require('express');
const texts = require('./texts');
const steps = require('./steps');
const { trafficOptions, geoOptions } = require('./helpers/data');
const { generateMultiButtons } = require('./helpers/buttons');
const { saveToFirebase } = require('./firebase');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Настройка локального хранилища сессий
const session = new LocalSession({
    database: 'sessions.json',
    storage: LocalSession.storageFileSync,
});
bot.use(session.middleware());

// Логирование сессий
bot.use(async (ctx, next) => {
    console.log('Session before middleware:', JSON.stringify(ctx.session));
    await next();
    console.log('Session after middleware:', JSON.stringify(ctx.session));
});

// Инициализация Express
const app = express();
app.use(express.json());
app.use(bot.webhookCallback('/bot'));

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

// Обработчик /start
bot.start(async (ctx) => {
    try {
        console.log('Handling /start command for user:', ctx.from.id);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply(texts.welcome.en, joinButton);
        console.log('Sent welcome message');
    } catch (error) {
        console.error('Error in /start handler:', error);
        await ctx.reply('An error occurred. Please try again later or contact support.');
    }
});

// Обработчик /reset
bot.command('reset', async (ctx) => {
    try {
        console.log('Handling /reset command for user:', ctx.from.id);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('Session reset. Start over with /start.');
        console.log('Sent reset confirmation');
    } catch (error) {
        console.error('Error in reset command:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик Join
bot.action('join', async (ctx) => {
    try {
        console.log('Handling join action for user:', ctx.from.id, 'Session:', JSON.stringify(ctx.session));
        ctx.session.step = steps.LANGUAGE;
        await ctx.answerCbQuery();
        await ctx.editMessageText(texts.chooseLanguage.en, languageButtons);
        console.log('Updated session after join:', JSON.stringify(ctx.session));
    } catch (error) {
        console.error('Error in join action:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик выбора языка
bot.action(/lang_(.+)/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        const validLanguages = ['en', 'ru', 'ua'];
        if (!validLanguages.includes(lang)) {
            throw new Error(`Invalid language: ${lang}`);
        }
        ctx.session.lang = lang;
        ctx.session.step = steps.CONTACT;
        ctx.session.data = { traffic: [], geo: [] };

        // Получаем Telegram-ник пользователя
        const username = ctx.from.username ? `@${ctx.from.username}` : null;

        // Формируем сообщение и клавиатуру
        const contactMessage = texts.shareContact[lang];
        const keyboard = username
            ? Markup.inlineKeyboard([
                Markup.button.callback(`Send ${username}`, 'send_username'),
            ])
            : null;

        await ctx.answerCbQuery();
        await ctx.editMessageText(contactMessage, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
        console.error('Error in lang action:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик кнопки "Send username"
bot.action('send_username', async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        const username = ctx.from.username ? `@${ctx.from.username}` : null;
        if (!username) {
            await ctx.answerCbQuery('No username available. Please enter your contact manually.');
            return;
        }
        ctx.session.data = ctx.session.data || { traffic: [], geo: [] };
        ctx.session.data.contact = username;
        ctx.session.step = steps.COMPANY;
        await ctx.answerCbQuery();
        await ctx.reply(username); // Отправляем ник в чат для имитации ввода
        await ctx.reply(texts.companyName[lang]); // Переходим к следующему шагу
        await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
    } catch (error) {
        console.error('Error in send_username:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик текста
bot.on('text', async (ctx) => {
    try {
        console.log('Received text:', ctx.message.text, 'Lang:', ctx.session.lang, 'Step:', ctx.session.step);
        const step = ctx.session.step;
        const validLanguages = ['en', 'ru', 'ua'];
        const lang = ctx.session.lang && validLanguages.includes(ctx.session.lang) ? ctx.session.lang : 'en';
        const text = escapeHTML(ctx.message.text);

        if (!step) {
            ctx.session = { step: steps.LANGUAGE };
            return ctx.reply('Please press /start to begin.');
        }

        switch (step) {
            case steps.CONTACT:
                ctx.session.data = ctx.session.data || { traffic: [], geo: [] };
                ctx.session.data.contact = text;
                ctx.session.step = steps.COMPANY;
                return ctx.reply(texts.companyName[lang]);

            case steps.COMPANY:
                ctx.session.data.company = text;
                ctx.session.step = steps.TRAFFIC;
                return ctx.reply(
                    texts.trafficSource[lang],
                    generateMultiButtons(trafficOptions, ctx.session.data.traffic, 'traffic')
                );

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

// Обработчик выбора источников трафика
bot.action(/traffic_(.+)/, async (ctx) => {
    try {
        const payload = ctx.match[1];
        const lang = ctx.session.lang || 'en';
        ctx.session.data = ctx.session.data || { traffic: [], geo: [] };

        if (ctx.session.step !== steps.TRAFFIC) return ctx.answerCbQuery();

        if (payload === 'done') {
            if (!ctx.session.data.traffic.length) {
                return ctx.answerCbQuery('Please select at least one traffic type.');
            }
            ctx.session.step = steps.GEO;
            return ctx.editMessageText(
                texts.geo[lang],
                generateMultiButtons(geoOptions, ctx.session.data.geo, 'geo')
            );
        }

        const label = trafficOptions.find(opt => opt.replace(/\s+/g, '_').toLowerCase() === payload);
        if (!label) return ctx.answerCbQuery();

        const arr = ctx.session.data.traffic;
        const index = arr.indexOf(label);
        index === -1 ? arr.push(label) : arr.splice(index, 1);

        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup(
            generateMultiButtons(trafficOptions, arr, 'traffic').reply_markup
        );
    } catch (error) {
        console.error('Error in traffic action:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик выбора гео
bot.action(/geo_(.+)/, async (ctx) => {
    try {
        const payload = ctx.match[1];
        const lang = ctx.session.lang || 'en';
        ctx.session.data = ctx.session.data || { traffic: [], geo: [] };

        if (ctx.session.step !== steps.GEO) return ctx.answerCbQuery();

        if (payload === 'done') {
            if (!ctx.session.data.geo.length) {
                return ctx.answerCbQuery('Please select at least one GEO.');
            }
            ctx.session.step = steps.CONFIRM;
            const d = ctx.session.data;
            const summary = `
<b>Contact:</b> ${escapeHTML(d.contact || 'N/A')}
<b>Company:</b> ${escapeHTML(d.company || 'N/A')}
<b>Traffic Sources:</b> ${escapeHTML(d.traffic.join(', ') || 'N/A')}
<b>GEOs:</b> ${escapeHTML(d.geo.join(', ') || 'N/A')}
            `;

            if (summary.length > 4096) {
                await ctx.reply('Your data is too long. Please shorten it and try again.');
                return;
            }

            await ctx.answerCbQuery();
            await ctx.replyWithHTML(`${texts.confirm[lang]}\n\n${summary}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Confirm', callback_data: 'confirm_yes' }],
                        [{ text: '✏️ Edit', callback_data: 'confirm_edit' }],
                    ],
                },
            });
            await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
            return;
        }

        const label = geoOptions.find(opt => opt.replace(/\s+/g, '_').toLowerCase() === payload);
        if (!label) return ctx.answerCbQuery();

        const arr = ctx.session.data.geo;
        const index = arr.indexOf(label);
        index === -1 ? arr.push(label) : arr.splice(index, 1);

        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup(
            generateMultiButtons(geoOptions, arr, 'geo').reply_markup
        );
    } catch (error) {
        console.error('Error in geo action:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик подтверждения
bot.action('confirm_yes', async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        ctx.session.step = steps.DONE;
        const newData = {
            contact: ctx.session.data.contact || 'N/A',
            company: ctx.session.data.company || 'N/A',
            traffic: ctx.session.data.traffic.length ? ctx.session.data.traffic.join(', ') : 'N/A',
            geo: ctx.session.data.geo.length ? ctx.session.data.geo.join(', ') : 'N/A',
            timestamp: new Date().toISOString(),
        };
        await saveToFirebase(newData);
        console.log('Data saved to Firebase:', newData);
        await ctx.answerCbQuery();
        await ctx.reply(texts.thankYou[lang], { parse_mode: 'Markdown' });
        await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
    } catch (error) {
        console.error('Error in confirm_yes:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Nothing was sent. Please try again with /start.');
    }
});

// Обработчик редактирования
bot.action('confirm_edit', async (ctx) => {
    try {
        const validLanguages = ['en', 'ru', 'ua'];
        const lang = ctx.session.lang && validLanguages.includes(ctx.session.lang) ? ctx.session.lang : 'en';
        ctx.session.step = steps.CONTACT;
        ctx.session.data = { traffic: [], geo: [] };
        await ctx.answerCbQuery();
        await ctx.reply(texts.shareContact[lang], { parse_mode: 'HTML' });
        await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
    } catch (error) {
        console.error('Error in confirm_edit:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Nothing was sent. Please try again with /start.');
    }
});

// Запуск HTTP-сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    bot.telegram.setWebhook(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/bot`).then(() => {
        console.log('Webhook set');
    }).catch((err) => console.error('Failed to set webhook:', err));
});