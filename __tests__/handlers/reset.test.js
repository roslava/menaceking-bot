const handleReset = require('../../handlers/reset.js');

describe('handleReset', () => {
    let ctx;
    let bot;
    let steps;
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
                lang: 'en',
            },
            reply: jest.fn().mockResolvedValue(),
        };

        // Mock bot
        bot = {
            command: jest.fn().mockImplementation(async (cmd, handler) => {
                if (cmd === 'reset') {
                    await handler(ctx);
                }
            }),
        };

        // Mock dependencies
        steps = {
            LANGUAGE: 'language',
        };
        errorHandler = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
        jest.spyOn(console, 'log').mockRestore();
        jest.spyOn(console, 'error').mockRestore();
    });

    it('should reset session and send message', async () => {
        // Call handler
        await handleReset({ bot, steps, errorHandler });

        // Check that bot.command was registered
        expect(bot.command).toHaveBeenCalledWith('reset', expect.any(Function));

        // Check that session is reset
        expect(ctx.session).toEqual({ step: steps.LANGUAGE });

        // Check that confirmation message was sent
        expect(ctx.reply).toHaveBeenCalledWith('Session reset. Start over with /start.');

        // Check logs
        expect(console.log).toHaveBeenCalledWith('Handling /reset command for user:', 123);
        expect(console.log).toHaveBeenCalledWith('Sent reset confirmation');
    });

    it('should handle errors and call errorHandler', async () => {
        // Mock reply error
        const error = new Error('Reply error');
        ctx.reply.mockRejectedValue(error);

        // Call handler
        await handleReset({ bot, steps, errorHandler });

        // Check that bot.command was registered
        expect(bot.command).toHaveBeenCalledWith('reset', expect.any(Function));

        // Check that session is reset
        expect(ctx.session).toEqual({ step: steps.LANGUAGE });

        // Check that errorHandler was called
        expect(errorHandler).toHaveBeenCalledWith(ctx, error);

        // Check that reply was attempted
        expect(ctx.reply).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('Handling /reset command for user:', 123);
        expect(console.log).not.toHaveBeenCalledWith('Sent reset confirmation');
    });
});
