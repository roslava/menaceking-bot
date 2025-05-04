const handleSelectionOfTrafficSources = require('../../handlers/selectionOfTrafficSources.js');

describe('handleSelectionOfTrafficSources', () => {
    let ctx;
    let bot;
    let steps;
    let texts;
    let generateMultiButtons;
    let geoOptions;
    let trafficOptions;
    let errorHandler;

    beforeEach(() => {
        // Mock console.log and console.error
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock Telegraf context
        ctx = {
            match: ['traffic_social', 'social'],
            session: {
                step: 'traffic',
                lang: 'en',
                data: { traffic: [], geo: [] },
            },
            answerCbQuery: jest.fn().mockResolvedValue(),
            editMessageText: jest.fn().mockResolvedValue(),
            editMessageReplyMarkup: jest.fn().mockResolvedValue(),
        };

        // Mock bot
        bot = {
            action: jest.fn().mockImplementation((regex, handler) => {
                bot._handler = handler;
            }),
            _handler: null,
        };

        // Mock dependencies
        steps = {
            TRAFFIC: 'traffic',
            GEO: 'geo',
        };
        texts = {
            geo: {
                en: 'Please select geo:',
                ru: 'Пожалуйста, выберите гео:',
                ua: 'Будь ласка, виберіть гео:',
            },
        };
        geoOptions = ['USA', 'Europe', 'Asia'];
        trafficOptions = ['Social', 'Search', 'Display'];
        generateMultiButtons = jest.fn().mockImplementation((options, selected, prefix) => {
            const buttons = options.map(opt => ({
                text: selected.includes(opt) ? `✅ ${opt}` : opt,
                callback_data: `${prefix}_${opt.replace(/\s+/g, '_').toLowerCase()}`,
            }));
            buttons.push({ text: 'Done', callback_data: `${prefix}_done` });
            return { reply_markup: { inline_keyboard: [buttons] } };
        });
        errorHandler = jest.fn().mockImplementation(async (ctx, error) => {
            await ctx.answerCbQuery(`Error: ${error.message}`);
        });
    });

    afterEach(() => {
        jest.spyOn(console, 'log').mockRestore();
        jest.spyOn(console, 'error').mockRestore();
    });

    it('should add traffic source to session data if not selected', async () => {
        await handleSelectionOfTrafficSources({ bot, steps, texts, generateMultiButtons, geoOptions, trafficOptions, errorHandler });
        await bot._handler({ ...ctx, match: ['traffic_social', 'social'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session.data.traffic).toEqual(['Social']);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(generateMultiButtons).toHaveBeenCalledWith(trafficOptions, ['Social'], 'traffic');
        expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({
            inline_keyboard: [[
                { text: '✅ Social', callback_data: 'traffic_social' },
                { text: 'Search', callback_data: 'traffic_search' },
                { text: 'Display', callback_data: 'traffic_display' },
                { text: 'Done', callback_data: 'traffic_done' },
            ]]
        });
    });

    it('should remove traffic source from session data if already selected', async () => {
        ctx.session.data.traffic = ['Social'];
        await handleSelectionOfTrafficSources({ bot, steps, texts, generateMultiButtons, geoOptions, trafficOptions, errorHandler });
        await bot._handler({ ...ctx, match: ['traffic_social', 'social'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session.data.traffic).toEqual([]);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(generateMultiButtons).toHaveBeenCalledWith(trafficOptions, [], 'traffic');
        expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({
            inline_keyboard: [[
                { text: 'Social', callback_data: 'traffic_social' },
                { text: 'Search', callback_data: 'traffic_search' },
                { text: 'Display', callback_data: 'traffic_display' },
                { text: 'Done', callback_data: 'traffic_done' },
            ]]
        });
    });

    it('should transition to geo step when done and traffic sources are selected', async () => {
        ctx.session.data.traffic = ['Social', 'Search'];
        await handleSelectionOfTrafficSources({ bot, steps, texts, generateMultiButtons, geoOptions, trafficOptions, errorHandler });
        await bot._handler({ ...ctx, match: ['traffic_done', 'done'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session.step).toEqual(steps.GEO);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(generateMultiButtons).toHaveBeenCalledWith(geoOptions, [], 'geo');
        expect(ctx.editMessageText).toHaveBeenCalledWith(
            texts.geo.en,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'USA', callback_data: 'geo_usa' },
                        { text: 'Europe', callback_data: 'geo_europe' },
                        { text: 'Asia', callback_data: 'geo_asia' },
                        { text: 'Done', callback_data: 'geo_done' },
                    ]]
                }
            }
        );
    });

    it('should show error when done and no traffic sources selected', async () => {
        ctx.session.data.traffic = [];
        await handleSelectionOfTrafficSources({ bot, steps, texts, generateMultiButtons, geoOptions, trafficOptions, errorHandler });
        await bot._handler({ ...ctx, match: ['traffic_done', 'done'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session.step).toEqual(steps.TRAFFIC);
        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Please select at least one traffic type.');
        expect(ctx.editMessageText).not.toHaveBeenCalled();
        expect(generateMultiButtons).not.toHaveBeenCalled();
    });

    it('should ignore action if step is not TRAFFIC', async () => {
        ctx.session.step = 'contact';
        await handleSelectionOfTrafficSources({ bot, steps, texts, generateMultiButtons, geoOptions, trafficOptions, errorHandler });
        await bot._handler({ ...ctx, match: ['traffic_social', 'social'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session.data.traffic).toEqual([]);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(generateMultiButtons).not.toHaveBeenCalled();
        expect(ctx.editMessageReplyMarkup).not.toHaveBeenCalled();
    });

    it('should ignore invalid traffic payload', async () => {
        await handleSelectionOfTrafficSources({ bot, steps, texts, generateMultiButtons, geoOptions, trafficOptions, errorHandler });
        await bot._handler({ ...ctx, match: ['traffic_invalid', 'invalid'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session.data.traffic).toEqual([]);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(generateMultiButtons).not.toHaveBeenCalled();
        expect(ctx.editMessageReplyMarkup).not.toHaveBeenCalled();
    });

    it('should handle errors and call errorHandler', async () => {
        const error = new Error('Edit message error');
        ctx.editMessageReplyMarkup.mockRejectedValue(error);
        await handleSelectionOfTrafficSources({ bot, steps, texts, generateMultiButtons, geoOptions, trafficOptions, errorHandler });
        await bot._handler({ ...ctx, match: ['traffic_social', 'social'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session.data.traffic).toEqual(['Social']);
        expect(errorHandler).toHaveBeenCalledWith(ctx, error);
        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Error: Edit message error');
        expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
    });
});
