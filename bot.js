require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const express = require('express');
const rateLimit = require('express-rate-limit');
const handleStart = require('./handlers/start');
const handleReset = require('./handlers/reset');
const handleJoin = require('./handlers/join');
const handleLanguageSelection = require('./handlers/languageSelection');
const handleSendUserName = require('./handlers/sendUserName');
const handleTextProcessor = require('./handlers/textProcessor');
const handleSelectionOfTrafficSources = require('./handlers/selectionOfTrafficSources');
const handleGeoSelection = require('./handlers/geoSelection');
const handleConfirmation = require('./handlers/confirmation');
const handleEdit = require('./handlers/edit');
const startServer = require('./api/server');
const {generateMultiButtons} = require("./helpers/buttons");
const htmlEscaping = require("./utils/html_escaping");
const {saveToFirebase} = require("./firebase");
const texts = require('./texts');
const steps = require('./steps');
const {geoOptions, trafficOptions} = require("./helpers/data");
const bot = new Telegraf(process.env.BOT_TOKEN);
const errorHandler = require('./utils/errorHandler');

// Configure local session storage
const session = new LocalSession({
    database: 'sessions.json',
    storage: LocalSession.storageFileSync,
});
bot.use(session.middleware());

// Session logging (kept commented out, as in original)
// bot.use(async (ctx, next) => {
//     console.log('Session before middleware:', JSON.stringify(ctx.session));
//     await next();
//     console.log('Session after middleware:', JSON.stringify(ctx.session));
// });

// Initialize Express
const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Apply rate limiting to the webhook endpoint
app.use('/bot', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Maximum 1000 requests
    message: 'Too many requests, please try again later.',
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable old X-RateLimit headers
}));

app.use(bot.webhookCallback('/bot'));

const languageButtons = Markup.inlineKeyboard([
    Markup.button.callback('English', 'lang_en'),
    Markup.button.callback('Русский', 'lang_ru'),
    Markup.button.callback('Українська', 'lang_ua'),
]);

// Handlers
handleStart({ bot, texts, steps, Markup, errorHandler });
handleReset({bot, steps, errorHandler});
handleJoin({bot, steps, texts, languageButtons, errorHandler});
handleLanguageSelection({bot, texts, steps, Markup, errorHandler});
handleSendUserName({bot, steps, texts, errorHandler});
handleTextProcessor({bot, texts, steps, htmlEscaping, generateMultiButtons, trafficOptions, errorHandler});
handleSelectionOfTrafficSources({bot, generateMultiButtons, geoOptions, steps, texts, trafficOptions, errorHandler});
handleGeoSelection({bot, texts, steps, htmlEscaping, geoOptions, generateMultiButtons, errorHandler});
handleConfirmation({bot, texts, steps, saveToFirebase, errorHandler});
handleEdit({bot, steps, texts, errorHandler});

// Start HTTP server
startServer({app, bot});