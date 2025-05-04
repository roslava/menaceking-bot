const handleGeoSelection = require('../../handlers/geoSelection.js');

describe('handleGeoSelection', () => {
    let ctx;
    let bot;
    let steps;
    let htmlEscaping;
    let texts;
    let geoOptions;
    let generateMultiButtons;
    let errorHandler;

    beforeEach(() => {
        // Mock console logging
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock Telegraf context
        ctx = {
            match: ['geo_us', 'us'],
            session: {
                lang: 'en',
                step: 'geo',
                data: {
                    contact: 'test@example.com',
                    company: 'Test Corp',
                    traffic: ['social', 'ads'],
                    geo: [],
                },
            },
            answerCbQuery: jest.fn().mockResolvedValue(),
            reply: jest.fn().mockResolvedValue(),
            replyWithHTML: jest.fn().mockResolvedValue(),
            editMessageReplyMarkup: jest.fn().mockResolvedValue(),
            deleteMessage: jest.fn().mockResolvedValue(),
        };

        // Mock bot with action handler registration
        bot = {
            action: jest.fn().mockImplementation((regex, handler) => {
                // Store the handler for manual invocation in tests
                bot._handler = handler;
            }),
            _handler: null, // Storage for the handler
        };

        steps = {
            GEO: 'geo',
            CONFIRM: 'confirm',
        };
        htmlEscaping = jest.fn((str) => str);
        texts = {
            confirm: {
                en: 'Please confirm your data:',
                ru: 'Пожалуйста, подтвердите ваши данные:',
            },
        };
        geoOptions = ['US', 'UK', 'CA'];
        generateMultiButtons = jest.fn().mockReturnValue({
            reply_markup: { inline_keyboard: [['mocked_button']] },
        });
        errorHandler = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
        // Restore console mocks
        jest.spyOn(console, 'log').mockRestore();
        jest.spyOn(console, 'error').mockRestore();
    });

    it('should toggle geo selection and update buttons', async () => {
        ctx.match = ['geo_us', 'us'];

        await handleGeoSelection({ bot, steps, htmlEscaping, texts, geoOptions, generateMultiButtons, errorHandler });

        await bot._handler({ ...ctx, match: ['geo_us', 'us'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session.data.geo).toEqual(['US']);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [['mocked_button']] });
        expect(generateMultiButtons).toHaveBeenCalledWith(geoOptions, ['US'], 'geo');
    });

    it('should remove geo if already selected', async () => {
        ctx.session.data.geo = ['US'];
        ctx.match = ['geo_us', 'us'];

        await handleGeoSelection({ bot, steps, htmlEscaping, texts, geoOptions, generateMultiButtons, errorHandler });

        await bot._handler({ ...ctx, match: ['geo_us', 'us'] });

        expect(ctx.session.data.geo).toEqual([]);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [['mocked_button']] });
        expect(generateMultiButtons).toHaveBeenCalledWith(geoOptions, [], 'geo');
    });

    it('should handle geo_done and send summary', async () => {
        ctx.session.data.geo = ['US', 'UK'];
        ctx.match = ['geo_done', 'done'];

        await handleGeoSelection({ bot, steps, htmlEscaping, texts, geoOptions, generateMultiButtons, errorHandler });

        await bot._handler({ ...ctx, match: ['geo_done', 'done'] });

        expect(ctx.session.step).toBe(steps.CONFIRM);

        const expectedSummary = `<b>Contact:</b> test@example.com\n<b>Company:</b> Test Corp\n<b>Traffic Sources:</b> social, ads\n<b>GEOs:</b> US, UK`;
        expect(ctx.replyWithHTML).toHaveBeenCalledWith(
            `${texts.confirm.en}\n\n${expectedSummary}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Confirm', callback_data: 'confirm_yes' }],
                        [{ text: '✏️ Edit', callback_data: 'confirm_edit' }],
                    ],
                },
            }
        );

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.deleteMessage).toHaveBeenCalled();
    });

    it('should reject geo_done if no geo selected', async () => {
        ctx.session.data.geo = [];
        ctx.match = ['geo_done', 'done'];

        await handleGeoSelection({ bot, steps, htmlEscaping, texts, geoOptions, generateMultiButtons, errorHandler });

        await bot._handler({ ...ctx, match: ['geo_done', 'done'] });

        expect(ctx.session.step).toBe(steps.GEO);

        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Please select at least one GEO.');
        expect(ctx.replyWithHTML).not.toHaveBeenCalled();
        expect(ctx.deleteMessage).not.toHaveBeenCalled();
    });

    it('should ignore action if step is not GEO', async () => {
        ctx.session.step = 'contact';
        ctx.match = ['geo_us', 'us'];

        await handleGeoSelection({ bot, steps, htmlEscaping, texts, geoOptions, generateMultiButtons, errorHandler });

        await bot._handler({ ...ctx, match: ['geo_us', 'us'] });

        expect(ctx.session.data.geo).toEqual([]);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.editMessageReplyMarkup).not.toHaveBeenCalled();
        expect(ctx.replyWithHTML).not.toHaveBeenCalled();
        expect(ctx.deleteMessage).not.toHaveBeenCalled();
    });

    it('should handle invalid geo payload', async () => {
        ctx.match = ['geo_invalid', 'invalid'];

        await handleGeoSelection({ bot, steps, htmlEscaping, texts, geoOptions, generateMultiButtons, errorHandler });

        await bot._handler({ ...ctx, match: ['geo_invalid', 'invalid'] });

        expect(ctx.session.data.geo).toEqual([]);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.editMessageReplyMarkup).not.toHaveBeenCalled();
        expect(ctx.replyWithHTML).not.toHaveBeenCalled();
        expect(ctx.deleteMessage).not.toHaveBeenCalled();
    });

    it('should handle errors and call errorHandler', async () => {
        const error = new Error('Reply error');
        ctx.replyWithHTML.mockRejectedValue(error);
        ctx.match = ['geo_done', 'done'];
        ctx.session.data.geo = ['US'];

        await handleGeoSelection({ bot, steps, htmlEscaping, texts, geoOptions, generateMultiButtons, errorHandler });

        await bot._handler({ ...ctx, match: ['geo_done', 'done'] });

        expect(errorHandler).toHaveBeenCalledWith({ ...ctx, match: ['geo_done', 'done'] }, error);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.deleteMessage).not.toHaveBeenCalled();
    });
});
