function handleLanguageSelection({ bot, steps, texts, Markup, errorHandler }) {
    bot.action(/lang_(.+)/, async (ctx) => {
        try {
            const lang = ctx.match[1];
            const validLanguages = ['en', 'ru', 'ua'];
            if (!validLanguages.includes(lang)) {
                throw new Error(`Недопустимый язык: ${lang}`);
            }
            ctx.session.lang = lang;
            ctx.session.step = steps.CONTACT;
            ctx.session.data = { traffic: [], geo: [] };

            const username = ctx.from.username ? `@${ctx.from.username}` : null;

            const contactMessage = texts.shareContact[lang];
            const keyboard = username
                ? Markup.inlineKeyboard([
                    Markup.button.callback(
                        texts.sendUsernameButton[lang].replace('{username}', username),
                        'send_username'
                    ),
                ])
                : null;

            await ctx.answerCbQuery();
            await ctx.editMessageText(contactMessage, { parse_mode: 'HTML', reply_markup: keyboard?.reply_markup });
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleLanguageSelection;