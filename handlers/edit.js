// handlers/edit.js
function handleEdit({ bot, steps, texts, Markup, errorHandler }) {
    bot.action('confirm_edit', async (ctx) => {
        try {
            const validLanguages = ['en', 'ru', 'ua'];
            const lang = ctx.session.lang && validLanguages.includes(ctx.session.lang) ? ctx.session.lang : 'en';
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
            await ctx.reply(contactMessage, { parse_mode: 'HTML', ...keyboard });
            await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleEdit;