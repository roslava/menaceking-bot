function handleStart({ bot, texts, steps, Markup, errorHandler }) {
    bot.start(async (ctx) => {
        try {
            console.log('Handling /start command for user:', ctx.from.id);
            ctx.session = { step: steps.LANGUAGE };
            await ctx.reply(texts.welcome.en, Markup.inlineKeyboard([
                Markup.button.callback('Join', 'join'),
            ]));
            console.log('Sent welcome message');
        } catch (error) {
            await errorHandler(ctx, error, 'An error occurred. Please try again later or contact support.');
        }
    });
}

module.exports = handleStart;