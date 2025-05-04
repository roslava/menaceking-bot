const handleConfirmation = require('../../handlers/confirmation.js');

describe('handleConfirmation', () => {
    let ctx;
    let bot;
    let texts;
    let steps;
    let saveToFirebase;
    let errorHandler;

    beforeEach(() => {
        // Mock console.log and console.error
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock Telegraf context
        ctx = {
            session: {
                lang: 'en',
                data: {
                    contact: 'test@example.com',
                    company: 'Test Corp',
                    traffic: ['social', 'ads'],
                    geo: ['US', 'UK'],
                },
            },
            answerCbQuery: jest.fn().mockResolvedValue(),
            reply: jest.fn().mockResolvedValue(),
            deleteMessage: jest.fn().mockResolvedValue(),
        };

        // Mock bot
        bot = {
            action: jest.fn().mockImplementation(async (action, handler) => {
                if (action === 'confirm_yes') {
                    await handler(ctx);
                }
            }),
        };

        // Mock dependencies
        texts = {
            thankYou: {
                en: 'Thank you for your submission!',
                ru: 'Спасибо за вашу заявку!',
            },
        };
        steps = {
            DONE: 'done',
        };
        saveToFirebase = jest.fn().mockResolvedValue();
        errorHandler = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
        // Restore console mocks
        jest.spyOn(console, 'log').mockRestore();
        jest.spyOn(console, 'error').mockRestore();
    });

    it('should handle confirm_yes action and save data', async () => {
        await handleConfirmation({ bot, texts, steps, saveToFirebase, errorHandler });

        const handler = bot.action.mock.calls[0][1];
        await handler(ctx);

        expect(bot.action).toHaveBeenCalledWith('confirm_yes', expect.any(Function));
        expect(ctx.session.step).toBe(steps.DONE);

        const expectedData = {
            contact: 'test@example.com',
            company: 'Test Corp',
            traffic: 'social, ads',
            geo: 'US, UK',
            timestamp: expect.any(String),
        };
        expect(saveToFirebase).toHaveBeenCalledWith(expectedData);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalledWith(texts.thankYou.en, { parse_mode: 'Markdown' });
        expect(ctx.deleteMessage).toHaveBeenCalled();
    });

    it('should handle missing session data gracefully', async () => {
        ctx.session.data = {};

        await handleConfirmation({ bot, texts, steps, saveToFirebase, errorHandler });

        const handler = bot.action.mock.calls[0][1];
        await handler(ctx);

        const expectedData = {
            contact: 'N/A',
            company: 'N/A',
            traffic: 'N/A',
            geo: 'N/A',
            timestamp: expect.any(String),
        };
        expect(saveToFirebase).toHaveBeenCalledWith(expectedData);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalledWith(texts.thankYou.en, { parse_mode: 'Markdown' });
        expect(ctx.deleteMessage).toHaveBeenCalled();
    });

    it('should handle errors and call errorHandler', async () => {
        const error = new Error('Firebase error');
        saveToFirebase.mockRejectedValue(error);

        await handleConfirmation({ bot, texts, steps, saveToFirebase, errorHandler });

        const handler = bot.action.mock.calls[0][1];
        await handler(ctx);

        expect(errorHandler).toHaveBeenCalledWith(
            ctx,
            error,
            'An error occurred. Nothing was sent. Please try again with /start.'
        );

        expect(ctx.answerCbQuery).not.toHaveBeenCalled();
        expect(ctx.reply).not.toHaveBeenCalled();
        expect(ctx.deleteMessage).not.toHaveBeenCalled();
    });
});