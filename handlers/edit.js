function handleEdit({ bot, steps, texts, errorHandler }) {
    bot.action('confirm_edit', async (ctx) => {
        try {
            const validLanguages = ['en', 'ru', 'ua'];
            const lang = ctx.session.lang && validLanguages.includes(ctx.session.lang) ? ctx.session.lang : 'en';
            ctx.session.step = steps.CONTACT;
            ctx.session.data = { traffic: [], geo: [] };
            await ctx.answerCbQuery();
            await ctx.reply(texts.shareContact[lang], { parse_mode: 'HTML' });
            await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleEdit;