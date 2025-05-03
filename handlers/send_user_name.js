function handleSendUserName({ bot, steps, texts, errorHandler }) {
    bot.action('send_username', async (ctx) => {
        try {
            const lang = ctx.session.lang || 'en';
            const username = ctx.from.username ? `@${ctx.from.username}` : null;
            if (!username) {
                await ctx.answerCbQuery('No username available. Please enter your contact manually.');
                return;
            }
            ctx.session.data = ctx.session.data || { traffic: [], geo: [] };
            ctx.session.data.contact = username;
            ctx.session.step = steps.COMPANY;
            await ctx.answerCbQuery();
            await ctx.reply(username); // Send nickname to chat to simulate input
            await ctx.reply(texts.companyName[lang]); // Proceed to the next step
            await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleSendUserName;