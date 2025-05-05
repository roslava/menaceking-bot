// handlers/edit.js
function handleEdit({ bot, steps, texts, Markup, errorHandler }) {
    bot.action('confirm_edit', async (ctx) => {
        try {
            const validLanguages = ['en', 'ru', 'ua'];
            const lang = ctx.session.lang && validLanguages.includes(ctx.session.lang) ? ctx.session.lang : 'en';
            ctx.session.step = steps.CONTACT;
            ctx.session.data = { traffic: [], geo: [] };

            const username = ctx.from.username ? `@${ctx.from.username}` : null;

            const contactMessage = texts.shareContact[lang];
            const options = { parse_mode: 'HTML' };
            if (username) {
                options.reply_markup = {
                    inline_keyboard: [
                        [{
                            text: texts.sendUsernameButton[lang].replace('{username}', username),
                            callback_data: 'send_username'
                        }],
                    ],
                };
            }

            await ctx.answerCbQuery();
            await ctx.reply(contactMessage, options);
            await ctx.deleteMessage().catch((err) => console.error('Ошибка удаления сообщения:', err));
        } catch (error) {
            console.error('Ошибка в handleEdit:', error);
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleEdit;