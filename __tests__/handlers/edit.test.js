const handleEdit = require('../../handlers/edit.js');

describe('handleEdit', () => {
    let ctx;
    let bot;
    let texts;
    let steps;
    let errorHandler;

    beforeEach(() => {
        // Mock console.log and console.error
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock Telegraf context
        ctx = {
            session: {
                lang: 'en',
                step: 'some_step',
                data: { some: 'data' },
            },
            answerCbQuery: jest.fn().mockResolvedValue(),
            reply: jest.fn().mockResolvedValue(),
            deleteMessage: jest.fn().mockResolvedValue(),
        };

        // Mock bot
        bot = {
            action: jest.fn().mockImplementation(async (action, handler) => {
                if (action === 'confirm_edit') {
                    await handler(ctx);
                }
            }),
        };

        // Mock dependencies
        texts = {
            shareContact: {
                en: 'Please share your contact information.',
                ru: 'Пожалуйста, поделитесь вашей контактной информацией.',
                ua: 'Будь ласка, поділіться вашою контактною інформацією.',
            },
        };
        steps = {
            CONTACT: 'contact',
        };
        errorHandler = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
        // Restore console mocks
        jest.spyOn(console, 'log').mockRestore();
        jest.spyOn(console, 'error').mockRestore();
    });

    it('should handle confirm_edit action and reset session', async () => {
        // Call the handler
        await handleEdit({ bot, steps, texts, errorHandler });

        // Manually invoke bot.action handler for testing
        const handler = bot.action.mock.calls[0][1];
        await handler(ctx);

        // Check if bot.action was registered
        expect(bot.action).toHaveBeenCalledWith('confirm_edit', expect.any(Function));

        // Check if session.step is set to CONTACT
        expect(ctx.session.step).toBe(steps.CONTACT);

        // Check if session.data is reset
        expect(ctx.session.data).toEqual({ traffic: [], geo: [] });

        // Check if responses were sent
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalledWith(texts.shareContact.en, { parse_mode: 'HTML' });
        expect(ctx.deleteMessage).toHaveBeenCalled();
    });

    it('should use default language (en) for invalid or missing language', async () => {
        // Set an unsupported language
        ctx.session.lang = 'fr'; // Unsupported language

        // Call the handler
        await handleEdit({ bot, steps, texts, errorHandler });

        // Manually invoke bot.action handler
        const handler = bot.action.mock.calls[0][1];
        await handler(ctx);

        // Check if session.step is set
        expect(ctx.session.step).toBe(steps.CONTACT);

        // Check if session.data is reset
        expect(ctx.session.data).toEqual({ traffic: [], geo: [] });

        // Check that English text is used
        expect(ctx.reply).toHaveBeenCalledWith(texts.shareContact.en, { parse_mode: 'HTML' });
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.deleteMessage).toHaveBeenCalled();
    });

    it('should handle errors and call errorHandler', async () => {
        // Mock an error in reply
        const error = new Error('Reply error');
        ctx.reply.mockRejectedValue(error);

        // Call the handler
        await handleEdit({ bot, steps, texts, errorHandler });

        // Manually invoke bot.action handler
        const handler = bot.action.mock.calls[0][1];
        await handler(ctx);

        // Check if errorHandler was called
        expect(errorHandler).toHaveBeenCalledWith(ctx, error);

        // Check that answerCbQuery was called before the error
        expect(ctx.answerCbQuery).toHaveBeenCalled();

        // Check that deleteMessage was not called (error occurred before that)
        expect(ctx.deleteMessage).not.toHaveBeenCalled();
    });
});
