const handleSendUserName = require('../../handlers/sendUserName.js');

describe('handleSendUserName', () => {
    let ctx;
    let bot;
    let steps;
    let texts;
    let errorHandler;

    beforeEach(() => {
        // Мокаем console.log и console.error
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock Telegraf context
        ctx = {
            from: { id: 123, username: 'testuser' },
            session: {
                lang: 'en',
                data: { traffic: [], geo: [] },
                step: 'contact',
            },
            answerCbQuery: jest.fn().mockResolvedValue(),
            reply: jest.fn().mockResolvedValue(),
            deleteMessage: jest.fn().mockResolvedValue(),
        };

        // Mock bot
        bot = {
            action: jest.fn().mockImplementation((action, handler) => {
                bot._handler = handler;
            }),
            _handler: null,
        };

        // Mock dependencies
        steps = {
            CONTACT: 'contact',
            COMPANY: 'company',
        };
        texts = {
            companyName: {
                en: 'Please enter your company name:',
                ru: 'Пожалуйста, введите название вашей компании:',
                ua: 'Будь ласка, введіть назву вашої компанії:',
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

    it('should send username, update session, and proceed to company step', async () => {
        await handleSendUserName({ bot, steps, texts, errorHandler });
        await bot._handler(ctx);

        expect(bot.action).toHaveBeenCalledWith('send_username', expect.any(Function));
        expect(ctx.session).toEqual({
            lang: 'en',
            step: steps.COMPANY,
            data: { traffic: [], geo: [], contact: '@testuser' },
        });
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenNthCalledWith(1, '@testuser');
        expect(ctx.reply).toHaveBeenNthCalledWith(2, texts.companyName.en);
        expect(ctx.deleteMessage).toHaveBeenCalled();
    });

    it('should handle missing username and show error message', async () => {
        ctx.from.username = null;

        await handleSendUserName({ bot, steps, texts, errorHandler });
        await bot._handler(ctx);

        expect(bot.action).toHaveBeenCalledWith('send_username', expect.any(Function));
        expect(ctx.answerCbQuery).toHaveBeenCalledWith('No username available. Please enter your contact manually.');
        expect(ctx.session.data).toEqual({ traffic: [], geo: [] });
        expect(ctx.session.step).toEqual(steps.CONTACT);
        expect(ctx.reply).not.toHaveBeenCalled();
        expect(ctx.deleteMessage).not.toHaveBeenCalled();
    });

    it('should handle errors and call errorHandler', async () => {
        const error = new Error('Reply error');
        ctx.reply.mockRejectedValue(error);

        await handleSendUserName({ bot, steps, texts, errorHandler });
        await bot._handler(ctx);

        expect(bot.action).toHaveBeenCalledWith('send_username', expect.any(Function));
        expect(ctx.session).toEqual({
            lang: 'en',
            step: steps.COMPANY,
            data: { traffic: [], geo: [], contact: '@testuser' },
        });
        expect(errorHandler).toHaveBeenCalledWith(ctx, error);
        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Error: Reply error');
        expect(ctx.reply).toHaveBeenCalled();
    });

    it('should handle deleteMessage error and log it', async () => {
        const deleteError = new Error('Delete message error');
        ctx.deleteMessage.mockRejectedValue(deleteError);

        await handleSendUserName({ bot, steps, texts, errorHandler });
        await bot._handler(ctx);

        expect(bot.action).toHaveBeenCalledWith('send_username', expect.any(Function));
        expect(ctx.session).toEqual({
            lang: 'en',
            step: steps.COMPANY,
            data: { traffic: [], geo: [], contact: '@testuser' },
        });
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenNthCalledWith(1, '@testuser');
        expect(ctx.reply).toHaveBeenNthCalledWith(2, texts.companyName.en);
        expect(ctx.deleteMessage).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('Error deleting message:', deleteError);
        expect(errorHandler).not.toHaveBeenCalled();
    });
});