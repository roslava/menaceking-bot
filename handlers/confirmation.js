const { saveToPostgres } = require('../postgres');

function handleConfirmation({ bot, texts, steps, errorHandler }) {
    bot.action('confirm_yes', async (ctx) => {
        try {
            const lang = ctx.session.lang || 'en';
            const userId = ctx.from.id;
            ctx.session.step = steps.DONE;
            const newData = {
                contact: ctx.session.data?.contact || 'N/A',
                company: ctx.session.data?.company || 'N/A',
                traffic: (ctx.session.data?.traffic?.length && Array.isArray(ctx.session.data.traffic))
                    ? ctx.session.data.traffic.join(', ')
                    : 'N/A',
                geo: (ctx.session.data?.geo?.length && Array.isArray(ctx.session.data.geo))
                    ? ctx.session.data.geo.join(', ')
                    : 'N/A',
                timestamp: new Date().toISOString(),
            };
            await saveToPostgres(userId, newData);
            await ctx.answerCbQuery();
            await ctx.reply(texts.thankYou[lang], { parse_mode: 'Markdown' });
            await ctx.deleteMessage().catch((err) => console.error('Error deleting message:', err));
        } catch (error) {
            await errorHandler(ctx, error, 'An error occurred. Nothing was sent. Please try again with /start.');
        }
    });
}

module.exports = handleConfirmation;