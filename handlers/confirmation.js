function handleConfirmation({ bot, texts, steps, saveToFirebase, errorHandler }) {
    bot.action('confirm_yes', async (ctx) => {
        try {
            const lang = ctx.session.lang || 'en';
            ctx.session.step = steps.DONE;
            const newData = {
                contact: ctx.session.data.contact || 'N/A',
                company: ctx.session.data.company || 'N/A',
                traffic: ctx.session.data.traffic.length ? ctx.session.data.traffic.join(', ') : 'N/A',
                geo: ctx.session.data.geo.length ? ctx.session.data.geo.join(', ') : 'N/A',
                timestamp: new Date().toISOString(),
            };
            await saveToFirebase(newData);
            console.log('Data saved to Firebase:', newData);
            await ctx.answerCbQuery();
            await ctx.reply(texts.thankYou[lang], { parse_mode: 'Markdown' });
            await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
        } catch (error) {
            await errorHandler(ctx, error, 'An error occurred. Nothing was sent. Please try again with /start.');
        }
    });
}

module.exports = handleConfirmation;