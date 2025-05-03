function handleJoin({ bot, steps, texts, languageButtons, errorHandler }) {
    bot.action('join', async (ctx) => {
        try {
            console.log('Handling join action for user:', ctx.from.id, 'Session:', JSON.stringify(ctx.session));
            ctx.session.step = steps.LANGUAGE;
            await ctx.answerCbQuery();
            await ctx.editMessageText(texts.chooseLanguage.en, languageButtons);
            console.log('Updated session after join:', JSON.stringify(ctx.session));
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleJoin;