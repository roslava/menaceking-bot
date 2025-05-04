// __tests__/start.test.js
const handleStart = require('../../handlers/start');

describe('handleStart', () => {
    let ctx;
    let bot;
    let texts;
    let steps;
    let Markup;
    let errorHandler;

    beforeEach(() => {
        // Мокаем console.log
        jest.spyOn(console, 'log').mockImplementation(() => {});

        ctx = {
            from: { id: 123 },
            session: {},
            reply: jest.fn().mockResolvedValue(),
        };

        bot = {
            start: jest.fn(async (handler) => {
                await handler(ctx);
            }),
        };

        texts = {
            welcome: {
                en: 'Welcome to the bot!',
            },
        };
        steps = {
            LANGUAGE: 'language',
        };
        Markup = {
            inlineKeyboard: jest.fn().mockReturnValue({
                inlineKeyboard: 'mocked-keyboard',
            }),
            button: {
                callback: jest.fn().mockReturnValue('mocked-button'),
            },
        };
        errorHandler = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
        jest.spyOn(console, 'log').mockRestore();
    });

    it('should set session step and send welcome message', async () => {
        await handleStart({ bot, texts, steps, Markup, errorHandler });

        expect(bot.start).toHaveBeenCalled();
        expect(ctx.session.step).toBe(steps.LANGUAGE);
        expect(ctx.reply).toHaveBeenCalledWith(
            texts.welcome.en,
            { inlineKeyboard: 'mocked-keyboard' }
        );
        expect(Markup.inlineKeyboard).toHaveBeenCalledWith([
            'mocked-button',
        ]);
        expect(Markup.button.callback).toHaveBeenCalledWith('Join', 'join');
    });

    it('should handle errors and call errorHandler', async () => {
        const error = new Error('Reply error');
        ctx.reply.mockRejectedValue(error);

        await handleStart({ bot, texts, steps, Markup, errorHandler });

        await new Promise(process.nextTick);

        expect(errorHandler).toHaveBeenCalledWith(
            ctx,
            error,
            'An error occurred. Please try again later or contact support.'
        );
    });
});