function handleReset({ bot, steps, errorHandler }) {
    bot.command('reset', async (ctx) => {
        try {
            console.log('Handling /reset command for user:', ctx.from.id);
            ctx.session = { step: steps.LANGUAGE };
            await ctx.reply('Session reset. Start over with /start.');
            console.log('Sent reset confirmation');
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleReset;