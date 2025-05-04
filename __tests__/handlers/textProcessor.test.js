const handleTextProcessor = require('../../handlers/textProcessor.js');

describe('handleTextProcessor', () => {
    let ctx;
    let bot;
    let steps;
    let texts;
    let generateMultiButtons;
    let htmlEscaping;
    let errorHandler;
    let trafficOptions;

    beforeEach(() => {
        // Мокаем console.log и console.error
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock Telegraf context
        ctx = {
            message: { text: 'Test input' },
            session: {
                step: 'contact',
                lang: 'en',
                data: { traffic: [], geo: [] },
            },
            reply: jest.fn().mockResolvedValue(),
            answerCbQuery: jest.fn().mockResolvedValue(),
        };

        // Mock bot
        bot = {
            on: jest.fn().mockImplementation((event, handler) => {
                bot._handler = handler;
            }),
            _handler: null,
        };

        // Mock dependencies
        steps = {
            LANGUAGE: 'language',
            CONTACT: 'contact',
            COMPANY: 'company',
            TRAFFIC: 'traffic',
            GEO: 'geo',
            CONFIRM: 'confirm',
        };
        texts = {
            companyName: {
                en: 'Please enter your company name:',
                ru: 'Пожалуйста, введите название вашей компании:',
                ua: 'Будь ласка, введіть назву вашої компанії:',
            },
            trafficSource: {
                en: 'Please select traffic sources:',
                ru: 'Пожалуйста, выберите источники трафика:',
                ua: 'Будь ласка, виберіть джерела трафіку:',
            },
        };
        trafficOptions = ['Social', 'Search', 'Display'];
        generateMultiButtons = jest.fn().mockImplementation((options, selected, prefix) => {
            const buttons = options.map(opt => ({
                text: selected.includes(opt) ? `✅ ${opt}` : opt,
                callback_data: `${prefix}_${opt.replace(/\s+/g, '_').toLowerCase()}`,
            }));
            buttons.push({ text: 'Done', callback_data: `${prefix}_done` });
            return { reply_markup: { inline_keyboard: [buttons] } };
        });
        htmlEscaping = jest.fn().mockImplementation(text => text);
        errorHandler = jest.fn().mockImplementation(async (ctx, error) => {
            await ctx.answerCbQuery(`Error: ${error.message}`);
        });
    });

    afterEach(() => {
        jest.spyOn(console, 'log').mockRestore();
        jest.spyOn(console, 'error').mockRestore();
    });

    it('should process contact input and proceed to company step', async () => {
        await handleTextProcessor({ bot, steps, texts, generateMultiButtons, htmlEscaping, errorHandler, trafficOptions });
        await bot._handler(ctx);

        expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
        expect(htmlEscaping).toHaveBeenCalledWith('Test input');
        expect(ctx.session).toEqual({
            step: steps.COMPANY,
            lang: 'en',
            data: { traffic: [], geo: [], contact: 'Test input' },
        });
        expect(ctx.reply).toHaveBeenCalledWith(texts.companyName.en);
    });

    it('should process company input and proceed to traffic step', async () => {
        ctx.session.step = steps.COMPANY;

        await handleTextProcessor({ bot, steps, texts, generateMultiButtons, htmlEscaping, errorHandler, trafficOptions });
        await bot._handler(ctx);

        expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
        expect(htmlEscaping).toHaveBeenCalledWith('Test input');
        expect(ctx.session).toEqual({
            step: steps.TRAFFIC,
            lang: 'en',
            data: { traffic: [], geo: [], company: 'Test input' },
        });
        expect(generateMultiButtons).toHaveBeenCalledWith(trafficOptions, [], 'traffic');
        expect(ctx.reply).toHaveBeenCalledWith(
            texts.trafficSource.en,
            { reply_markup: { inline_keyboard: [[
                        { text: 'Social', callback_data: 'traffic_social' },
                        { text: 'Search', callback_data: 'traffic_search' },
                        { text: 'Display', callback_data: 'traffic_display' },
                        { text: 'Done', callback_data: 'traffic_done' },
                    ]] } }
        );
    });

    it('should reject input longer than 150 characters on contact step', async () => {
        ctx.message.text = 'x'.repeat(151);
        ctx.session.step = steps.CONTACT;

        await handleTextProcessor({ bot, steps, texts, generateMultiButtons, htmlEscaping, errorHandler, trafficOptions });
        await bot._handler(ctx);

        expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
        expect(htmlEscaping).toHaveBeenCalledWith('x'.repeat(151));
        expect(ctx.session).toEqual({
            step: steps.CONTACT,
            lang: 'en',
            data: { traffic: [], geo: [] },
        });
        expect(ctx.reply).toHaveBeenCalledWith(
            'Input is too long. Please shorten it to 150 characters or less and try again.'
        );
    });

    it('should reject input longer than 150 characters on company step', async () => {
        ctx.message.text = 'x'.repeat(151);
        ctx.session.step = steps.COMPANY;

        await handleTextProcessor({ bot, steps, texts, generateMultiButtons, htmlEscaping, errorHandler, trafficOptions });
        await bot._handler(ctx);

        expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
        expect(htmlEscaping).toHaveBeenCalledWith('x'.repeat(151));
        expect(ctx.session).toEqual({
            step: steps.COMPANY,
            lang: 'en',
            data: { traffic: [], geo: [] },
        });
        expect(ctx.reply).toHaveBeenCalledWith(
            'Input is too long. Please shorten it to 150 characters or less and try again.'
        );
    });

    it('should handle missing step and prompt to start', async () => {
        ctx.session.step = null;

        await handleTextProcessor({ bot, steps, texts, generateMultiButtons, htmlEscaping, errorHandler, trafficOptions });
        await bot._handler(ctx);

        expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
        expect(ctx.session).toEqual({ step: steps.LANGUAGE });
        expect(ctx.reply).toHaveBeenCalledWith('Please press /start to begin.');
    });

    it('should prompt to use buttons on traffic, geo, or confirm steps', async () => {
        const stepsToTest = [steps.TRAFFIC, steps.GEO, steps.CONFIRM];
        for (const step of stepsToTest) {
            ctx.session.step = step;

            await handleTextProcessor({ bot, steps, texts, generateMultiButtons, htmlEscaping, errorHandler, trafficOptions });
            await bot._handler(ctx);

            expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
            expect(ctx.reply).toHaveBeenCalledWith('Please use the buttons or start over with /start.');
            expect(ctx.session.step).toEqual(step);
        }
    });

    it('should use default language if lang is invalid', async () => {
        ctx.session.lang = 'invalid';
        ctx.session.step = steps.CONTACT;

        await handleTextProcessor({ bot, steps, texts, generateMultiButtons, htmlEscaping, errorHandler, trafficOptions });
        await bot._handler(ctx);

        expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
        expect(htmlEscaping).toHaveBeenCalledWith('Test input');
        expect(ctx.session).toEqual({
            step: steps.COMPANY,
            lang: 'invalid',
            data: { traffic: [], geo: [], contact: 'Test input' },
        });
        expect(ctx.reply).toHaveBeenCalledWith(texts.companyName.en);
    });

    it('should handle errors and call errorHandler', async () => {
        const error = new Error('Escaping error');
        htmlEscaping.mockImplementation(() => { throw error; });

        await handleTextProcessor({ bot, steps, texts, generateMultiButtons, htmlEscaping, errorHandler, trafficOptions });
        await bot._handler(ctx);

        expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
        expect(errorHandler).toHaveBeenCalledWith(ctx, error);
        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Error: Escaping error');
    });
});