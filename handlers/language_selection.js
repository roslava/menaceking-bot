function handleLanguageSelection({ bot, steps, texts, Markup, errorHandler }) {
    bot.action(/lang_(.+)/, async (ctx) => {
        try {
            const lang = ctx.match[1];
            const validLanguages = ['en', 'ru', 'ua'];
            if (!validLanguages.includes(lang)) {
                throw new Error(`Invalid language: ${lang}`);
            }
            ctx.session.lang = lang;
            ctx.session.step = steps.CONTACT;
            ctx.session.data = { traffic: [], geo: [] };

            // Get the user's Telegram nickname
            const username = ctx.from.username ? `@${ctx.from.username}` : null;

            // Generate message and keyboard
            const contactMessage = texts.shareContact[lang];
            const keyboard = username
                ? Markup.inlineKeyboard([
                    Markup.button.callback(`Send ${username}`, 'send_username'),
                ])
                : null;

            await ctx.answerCbQuery();
            await ctx.editMessageText(contactMessage, { parse_mode: 'HTML', ...keyboard });
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleLanguageSelection;