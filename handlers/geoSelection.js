function handleGeoSelection({ bot, steps, htmlEscaping, texts, geoOptions, generateMultiButtons, errorHandler }) {
    bot.action(/geo_(.+)/, async (ctx) => {
        try {
            const payload = ctx.match[1];
            const lang = ctx.session.lang || 'en';
            ctx.session.data = ctx.session.data || { traffic: [], geo: [] };

            if (ctx.session.step !== steps.GEO) return ctx.answerCbQuery();

            if (payload === 'done') {
                if (!ctx.session.data.geo.length) {
                    return ctx.answerCbQuery(texts.geoError?.[lang] || 'Please select at least one GEO.');
                }
                ctx.session.step = steps.CONFIRM;
                const d = ctx.session.data;
                const summary = `
<b>Contact:</b> ${htmlEscaping(d.contact || 'N/A')}
<b>Company:</b> ${htmlEscaping(d.company || 'N/A')}
<b>Traffic Sources:</b> ${htmlEscaping(d.traffic.join(', ') || 'N/A')}
<b>GEOs:</b> ${htmlEscaping(d.geo.join(', ') || 'N/A')}
                `.trim();

                if (summary.length > 4096) {
                    await ctx.reply(texts.summaryTooLong?.[lang] || 'Your data is too long. Please shorten it and try again.');
                    return;
                }

                await ctx.answerCbQuery();
                await ctx.replyWithHTML(`${texts.confirm[lang]}\n\n${summary}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: texts.confirmButton[lang], callback_data: 'confirm_yes' }],
                            [{ text: texts.editButton[lang], callback_data: 'confirm_edit' }],
                        ],
                    },
                });
                await ctx.deleteMessage().catch((err) => console.error('Ошибка удаления сообщения:', err));
                return;
            }

            // Поиск региона с учётом регистра
            const label = geoOptions.find(opt => opt.replace(/\s+/g, '_').toLowerCase() === payload.toLowerCase());
            if (!label) return ctx.answerCbQuery();

            const arr = ctx.session.data.geo;
            const index = arr.indexOf(label);
            index === -1 ? arr.push(label) : arr.splice(index, 1);

            await ctx.answerCbQuery();
            await ctx.editMessageReplyMarkup(
                generateMultiButtons(geoOptions, arr, 'geo').reply_markup
            );
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleGeoSelection;