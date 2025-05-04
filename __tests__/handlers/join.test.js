const handleJoin = require('../../handlers/join.js');

describe('handleJoin', () => {
    let ctx;
    let bot;
    let steps;
    let texts;
    let languageButtons;
    let errorHandler;

    beforeEach(() => {
        // Mock console.log and console.error
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock Telegraf context
        ctx = {
            from: { id: 123 },
            session: {
                step: 'some_step',
                data: { some: 'data' },
            },
            answerCbQuery: jest.fn().mockResolvedValue(),
            editMessageText: jest.fn().mockResolvedValue(),
        };

        // Mock bot
        bot = {
            action: jest.fn().mockImplementation((action, handler) => {
                // Store the handler for manual invocation in tests
                bot._handler = handler;
            }),
            _handler: null,
        };

        // Mock dependencies
        steps = {
            LANGUAGE: 'language',
        };
        texts = {
            chooseLanguage: {
                en: 'Please choose your language:',
            },
        };
        languageButtons = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'English', callback_data: 'lang_en' }],
                    [{ text: 'Русский', callback_data: 'lang_ru' }],
                ],
            },
        };
        errorHandler = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
        jest.spyOn(console, 'log').mockRestore();
        jest.spyOn(console, 'error').mockRestore();
    });

    it('should handle join action, set language step, and send language selection message', async () => {
        // Save the initial session for logging check
        const initialSession = JSON.stringify({ step: 'some_step', data: { some: 'data' } });

        // Register handler
        await handleJoin({ bot, steps, texts, languageButtons, errorHandler });

        // Manually trigger the handler
        await bot._handler(ctx);

        // Check that bot.action was registered
        expect(bot.action).toHaveBeenCalledWith('join', expect.any(Function));

        // Check that session is updated
        expect(ctx.session).toEqual({
            step: steps.LANGUAGE,
            data: { some: 'data' },
        });

        // Check expected method calls
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith(texts.chooseLanguage.en, languageButtons);

        // Check logs
        expect(console.log).toHaveBeenCalledWith('Handling join action for user:', 123, 'Session:', initialSession);
        expect(console.log).toHaveBeenCalledWith(
            'Updated session after join:',
            JSON.stringify({ step: steps.LANGUAGE, data: { some: 'data' } })
        );
    });

    it('should handle errors and call errorHandler', async () => {
        // Simulate error in editMessageText
        const error = new Error('Edit message error');
        ctx.editMessageText.mockRejectedValue(error);

        // Save the initial session for logging check
        const initialSession = JSON.stringify({ step: 'some_step', data: { some: 'data' } });

        // Register handler
        await handleJoin({ bot, steps, texts, languageButtons, errorHandler });

        // Manually trigger the handler
        await bot._handler(ctx);

        // Check that bot.action was registered
        expect(bot.action).toHaveBeenCalledWith('join', expect.any(Function));

        // Check that session is updated
        expect(ctx.session).toEqual({
            step: steps.LANGUAGE,
            data: { some: 'data' },
        });

        // Check that errorHandler was called
        expect(errorHandler).toHaveBeenCalledWith(ctx, error);

        // Check that answerCbQuery was still called
        expect(ctx.answerCbQuery).toHaveBeenCalled();

        // Check logs
        expect(console.log).toHaveBeenCalledWith('Handling join action for user:', 123, 'Session:', initialSession);
        expect(console.log).not.toHaveBeenCalledWith('Updated session after join:', expect.any(String));
    });
});
