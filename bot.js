require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const express = require('express');
const texts = require('./texts');
const steps = require('./steps');
const { trafficOptions, geoOptions } = require('./helpers/data');
const { generateMultiButtons } = require('./helpers/buttons');
const { savePartner } = require('./firebase');

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

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

bot.action(/^lang_(.+)$/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        ctx.session.lang = lang;
        ctx.session.step = steps.CONTACT;
        await ctx.answerCbQuery();
        await ctx.editMessageText(texts.enterContact[lang]);
    } catch (error) {
        console.error('Error in language selection:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.on('text', async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        const text = escapeHTML(ctx.message.text);

        if (ctx.session.step === steps.CONTACT) {
            ctx.session.data = { contact: text };
            ctx.session.step = steps.COMPANY;
            await ctx.reply(texts.enterCompany[lang]);
        } else if (ctx.session.step === steps.COMPANY) {
            ctx.session.data.company = text;
            ctx.session.step = steps.TRAFFIC;
            await ctx.reply(
                texts.chooseTraffic[lang],
                generateMultiButtons(trafficOptions, 'traffic', lang)
            );
        }
    } catch (error) {
        console.error('Error in text handler:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action(/^traffic_(.+)$/, async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        const selectedTraffic = ctx.match[1];
        ctx.session.data.traffic = ctx.session.data.traffic || [];

        if (selectedTraffic === 'done') {
            if (!ctx.session.data.traffic.length) {
                await ctx.answerCbQuery('Please select at least one traffic type.');
                return;
            }
            ctx.session.step = steps.GEO;
            await ctx.editMessageText(
                texts.chooseGeo[lang],
                generateMultiButtons(geoOptions, 'geo', lang)
            );
        } else if (selectedTraffic === 'clear') {
            ctx.session.data.traffic = [];
            await ctx.editMessageReplyMarkup(
                generateMultiButtons(trafficOptions, 'traffic', lang).reply_markup
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
                generateMultiButtons(trafficOptions, 'traffic', lang, ctx.session.data.traffic)
                    .reply_markup
            );
        }
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in traffic selection:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action(/^geo_(.+)$/, async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        const selectedGeo = ctx.match[1];
        ctx.session.data.geo = ctx.session.data.geo || [];

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
                generateMultiButtons(geoOptions, 'geo', lang).reply_markup
            );
        } else {
            if (!ctx.session.data.geo.includes(selectedGeo)) {
                ctx.session.data.geo.push(selectedGeo);
            } else {
                ctx.session.data.geo = ctx.session.data.geo.filter((g) => g !== selectedGeo);
            }
            await ctx.editMessageReplyMarkup(
                generateMultiButtons(geoOptions, 'geo', lang, ctx.session.data.geo).reply_markup
            );
        }
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in geo selection:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action('confirm_yes', async (ctx) => {
    try {
        const lang = ctx.session.lang || 'en';
        ctx.session.step = steps.DONE;

        const newData = {
            contact: ctx.session.data.contact || 'N/A',
            company: ctx.session.data.company || 'N/A',
            traffic: ctx.session.data.traffic.length ? ctx.session.data.traffic.join(', ') : 'N/A',
            geo: ctx.session.data.geo.length ? ctx.session.data.geo.join(', ') : 'N/A',
            timestamp: new Date().toISOString()
        };
        await savePartner(newData);
        console.log('Data saved to Firebase:', newData);

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
        ctx.session.step = steps.CONTACT;
        await ctx.answerCbQuery();
        await ctx.editMessageText(texts.enterContact[ctx.session.lang || 'en']);
    } catch (error) {
        console.error('Error in confirm_edit:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

bot.action('restart', async (ctx) => {
    try {
        ctx.session = {};
        await ctx.answerCbQuery();
        await ctx.editMessageText(texts.welcome.en, joinButton);
    } catch (error) {
        console.error('Error in restart:', error);
        await ctx.reply('An error occurred. Please try again with /start.');
    }
});

// Запуск HTTP-сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    bot.telegram.setWebhook(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/bot`).then(() => {
        console.log('Webhook set');
    });
});