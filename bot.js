require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const LocalSession = require('telegraf-session-local');
const texts = require('./texts');
const steps = require('./steps');
const { trafficOptions, geoOptions } = require('./helpers/data');
const { generateMultiButtons } = require('./helpers/buttons');
const { savePartner } = require('./firebase');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Настройка локального хранилища сессий
const session = new LocalSession({
    database: 'sessions.json', // Файл для хранения сессий
    storage: LocalSession.storageFileSync, // Синхронное чтение/запись
});
bot.use(session.middleware());

// Логирование сессий
bot.use(async (ctx, next) => {
    console.log('Session before middleware:', JSON.stringify(ctx.session));
    await next();
    console.log('Session after middleware:', JSON.stringify(ctx.session));
});

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
        ctx.session = { step: steps.LANGUAGE }; // Сбрасываем сессию
        await ctx.reply(texts.welcome.en, joinButton);
        console.log('Sent welcome message');
    } catch (error) {
        console.error('Error in /start handler:', error);
        await ctx.reply('An error occurred. Please try again later or contact support.');
    }
});

// Обработчик выбора языка
bot.action(/^lang_(.+)$/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        const validLanguages = ['en', 'ru', 'ua'];
        if (!validLanguages.includes(lang)) {
            throw new Error(`Invalid language: ${lang}`);
        }
        ctx.session.lang = lang;
        ctx.session.step = steps.CONTACT;
        ctx.session.data = { traffic: [], geo: [] };
        await ctx.answerCbQuery();
        await ctx.editMessageText(texts.shareContact[lang]);
    } catch (error) {
        console.error('Error in language selection:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик текста
bot.on('text', async (ctx) => {
    try {
        console.log('Received text:', ctx.message.text, 'Lang:', ctx.session.lang, 'Step:', ctx.session.step);
        const validLanguages = ['en', 'ru', 'ua'];
        const lang = ctx.session.lang && validLanguages.includes(ctx.session.lang) ? ctx.session.lang : 'en';
        const text = escapeHTML(ctx.message.text);

        if (!ctx.session.step) {
            ctx.session = { step: steps.LANGUAGE };
            return ctx.reply('Please start with /start.');
        }

        if (ctx.session.step === steps.CONTACT) {
            ctx.session.data = ctx.session.data || { traffic: [], geo: [] };
            ctx.session.data.contact = text;
            ctx.session.step = steps.COMPANY;
            await ctx.reply(texts.companyName[lang]);
        } else if (ctx.session.step === steps.COMPANY) {
            ctx.session.data.company = text;
            ctx.session.step = steps.TRAFFIC;
            await ctx.reply(
                texts.trafficSource[lang],
                generateMultiButtons(trafficOptions, ctx.session.data.traffic, 'traffic')
            );
        } else {
            await ctx.reply('Please use the buttons or start over with /start.');
        }
    } catch (error) {
        console.error('Error in text handler:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик выбора источников трафика
bot.action(/^traffic_(.+)$/, async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        const selectedTraffic = ctx.match[1];
        ctx.session.data = ctx.session.data || { traffic: [], geo: [] };

        if (selectedTraffic === 'done') {
            if (!ctx.session.data.traffic.length) {
                await ctx.answerCbQuery('Please select at least one traffic type.');
                return;
            }
            ctx.session.step = steps.GEO;
            await ctx.editMessageText(
                texts.geo[lang],
                generateMultiButtons(geoOptions, ctx.session.data.geo, 'geo')
            );
        } else if (selectedTraffic === 'clear') {
            ctx.session.data.traffic = [];
            await ctx.editMessageReplyMarkup(
                generateMultiButtons(trafficOptions, ctx.session.data.traffic, 'traffic').reply_markup
            );
        } else {
            if (!ctx.session.data.traffic.includes(selectedTraffic)) {
                ctx.session.data.traffic.push(selectedTraffic);
            } else {
                ctx.session.data.traffic = ctx.session.data.traffic.filter(
                    (t) => t !== selectedTraffic
                );
            }
            await ctx.editMessageReplyMarkup(
                generateMultiButtons(trafficOptions, ctx.session.data.traffic, 'traffic').reply_markup
            );
        }
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in traffic selection:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик выбора гео
bot.action(/^geo_(.+)$/, async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        const selectedGeo = ctx.match[1];
        ctx.session.data = ctx.session.data || { traffic: [], geo: [] };

        if (selectedGeo === 'done') {
            if (!ctx.session.data.geo.length) {
                await ctx.answerCbQuery('Please select at least one GEO.');
                return;
            }
            ctx.session.step = steps.CONFIRM;
            await ctx.editMessageText(
                texts.confirm[lang]
                    .replace('{contact}', ctx.session.data.contact || 'N/A')
                    .replace('{company}', ctx.session.data.company || 'N/A')
                    .replace('{traffic}', ctx.session.data.traffic.join(', ') || 'N/A')
                    .replace('{geo}', ctx.session.data.geo.join(', ') || 'N/A'),
                Markup.inlineKeyboard([
                    Markup.button.callback('✅ Confirm', 'confirm_yes'),
                    Markup.button.callback('✏️ Edit', 'confirm_edit'),
                    Markup.button.callback('🔄 Restart', 'restart'),
                ])
            );
        } else if (selectedGeo === 'clear') {
            ctx.session.data.geo = [];
            await ctx.editMessageReplyMarkup(
                generateMultiButtons(geoOptions, ctx.session.data.geo, 'geo').reply_markup
            );
        } else {
            if (!ctx.session.data.geo.includes(selectedGeo)) {
                ctx.session.data.geo.push(selectedGeo);
            } else {
                ctx.session.data.geo = ctx.session.data.traffic.filter((g) => g !== selectedGeo);
            }
            await ctx.editMessageReplyMarkup(
                generateMultiButtons(geoOptions, ctx.session.data.geo, 'geo').reply_markup
            );
        }
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in geo selection:', error);
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
        await savePartner(newData);
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
        await ctx.editMessageText(texts.shareContact[lang]);
    } catch (error) {
        console.error('Error in confirm_edit:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Обработчик перезапуска
bot.action('restart', async (ctx) => {
    try {
        ctx.session = { step: steps.LANGUAGE };
        await ctx.answerCbQuery();
        await ctx.editMessageText(texts.welcome.en, joinButton);
    } catch (error) {
        console.error('Error in restart:', error);
        ctx.session = { step: steps.LANGUAGE };
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    bot.telegram.setWebhook(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/bot`).then(() => {
        console.log('Webhook set');
    }).catch(err => {
        console.error('Failed to set webhook:', err);
    });
});