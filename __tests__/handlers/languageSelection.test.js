const handleLanguageSelection = require('../../handlers/languageSelection.js');

describe('handleLanguageSelection', () => {
    let ctx;
    let bot;
    let steps;
    let texts;
    let Markup;
    let errorHandler;

    beforeEach(() => {
        // Mock console.log and console.error
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock Telegraf context
        ctx = {
            from: { id: 123, username: 'testuser' },
            match: ['lang_en', 'en'],
            session: {
                step: 'language',
                lang: null,
                data: null,
            },
            answerCbQuery: jest.fn().mockResolvedValue(),
            editMessageText: jest.fn().mockResolvedValue(),
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
            LANGUAGE: 'language',
            CONTACT: 'contact',
        };
        texts = {
            shareContact: {
                en: 'Please share your contact:',
                ru: 'Пожалуйста, поделитесь вашим контактом:',
                ua: 'Будь ласка, поділіться вашим контактом:',
            },
        };
        Markup = {
            inlineKeyboard: jest.fn().mockImplementation((buttons) => {
                process.stderr.write(`DEBUG: Mock inlineKeyboard called with: ${JSON.stringify(buttons, null, 2)}\n`);
                // Wrap buttons into an array to get [[...]]
                const wrappedButtons = [buttons];
                return { reply_markup: { inline_keyboard: wrappedButtons } };
            }),
            button: {
                callback: jest.fn().mockReturnValue({
                    text: 'Send @testuser',
                    callback_data: 'send_username',
                }),
            },
        };
        errorHandler = jest.fn().mockImplementation(async (ctx, error) => {
            await ctx.answerCbQuery(`Error: ${error.message}`);
        });
    });

    afterEach(() => {
        jest.spyOn(console, 'log').mockRestore();
        jest.spyOn(console, 'error').mockRestore();
    });

    it('should set language, update session, and send contact message with username button', async () => {
        process.stderr.write(`DEBUG: Before handler - ctx: ${JSON.stringify(ctx, null, 2)}\n`);
        process.stderr.write(`DEBUG: Before handler - Markup: ${JSON.stringify(Markup, null, 2)}\n`);
        process.stderr.write(`DEBUG: Markup.button.callback mock: ${JSON.stringify(Markup.button.callback, null, 2)}\n`);

        await handleLanguageSelection({ bot, steps, texts, Markup, errorHandler });

        process.stderr.write(`DEBUG: After handleLanguageSelection - bot.action calls: ${JSON.stringify(bot.action.mock.calls, null, 2)}\n`);

        process.stderr.write(`DEBUG: Calling bot._handler with match: ${JSON.stringify(ctx.match, null, 2)}\n`);
        await bot._handler({ ...ctx, match: ['lang_en', 'en'] });

        process.stderr.write(`DEBUG: After handler - Markup.button.callback calls: ${JSON.stringify(Markup.button.callback.mock.calls, null, 2)}\n`);
        process.stderr.write(`DEBUG: After handler - Markup.inlineKeyboard calls: ${JSON.stringify(Markup.inlineKeyboard.mock.calls, null, 2)}\n`);

        if (Markup.button.callback.mock.calls.length === 0) {
            process.stderr.write('ERROR: Markup.button.callback was not called\n');
        } else {
            process.stderr.write(`DEBUG: Markup.button.callback was called with: ${JSON.stringify(Markup.button.callback.mock.calls, null, 2)}\n`);
        }

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session).toEqual({
            step: steps.CONTACT,
            lang: 'en',
            data: { traffic: [], geo: [] },
        });

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(Markup.button.callback).toHaveBeenCalledWith('Send @testuser', 'send_username');
        expect(Markup.inlineKeyboard).toHaveBeenCalledWith(
            [{ text: 'Send @testuser', callback_data: 'send_username' }]
        );
        expect(ctx.editMessageText).toHaveBeenCalledWith(texts.shareContact.en, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: 'Send @testuser', callback_data: 'send_username' }]],
            },
        });
    });

    it('should handle language selection without username', async () => {
        ctx.from.username = null;

        await handleLanguageSelection({ bot, steps, texts, Markup, errorHandler });

        await bot._handler({ ...ctx, match: ['lang_ru', 'ru'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session).toEqual({
            step: steps.CONTACT,
            lang: 'ru',
            data: { traffic: [], geo: [] },
        });

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(Markup.inlineKeyboard).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith(texts.shareContact.ru, {
            parse_mode: 'HTML',
        });
    });

    it('should handle invalid language and call errorHandler', async () => {
        ctx.match = ['lang_fr', 'fr'];

        await handleLanguageSelection({ bot, steps, texts, Markup, errorHandler });

        await bot._handler({ ...ctx, match: ['lang_fr', 'fr'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session).toEqual({
            step: 'language',
            lang: null,
            data: null,
        });

        expect(errorHandler).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ message: 'Invalid language: fr' })
        );
        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Error: Invalid language: fr');
        expect(ctx.editMessageText).not.toHaveBeenCalled();
    });

    it('should handle errors and call errorHandler', async () => {
        const error = new Error('Edit message error');
        ctx.editMessageText.mockRejectedValue(error);

        await handleLanguageSelection({ bot, steps, texts, Markup, errorHandler });

        await bot._handler({ ...ctx, match: ['lang_en', 'en'] });

        expect(bot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
        expect(ctx.session).toEqual({
            step: steps.CONTACT,
            lang: 'en',
            data: { traffic: [], geo: [] },
        });

        expect(errorHandler).toHaveBeenCalledWith(ctx, error);
        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Error: Edit message error');
        expect(ctx.editMessageText).toHaveBeenCalled();
    });
});
