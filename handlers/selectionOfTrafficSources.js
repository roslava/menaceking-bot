function handleSelectionOfTrafficSources({ bot, steps, texts, generateMultiButtons, geoOptions, trafficOptions, errorHandler }) {
    bot.action(/traffic_(.+)/, async (ctx) => {
        try {
            const payload = ctx.match[1];
            const lang = ctx.session.lang || 'en';
            ctx.session.data = ctx.session.data || { traffic: [], geo: [] };

            if (ctx.session.step !== steps.TRAFFIC) return ctx.answerCbQuery();

            if (payload === 'done') {
                if (!ctx.session.data.traffic.length) {
                    return ctx.answerCbQuery('Please select at least one traffic type.');
                }
                ctx.session.step = steps.GEO;
                return ctx.editMessageText(
                    texts.geo[lang],
                    generateMultiButtons(geoOptions, ctx.session.data.geo, 'geo')
                );
            }

            const label = trafficOptions.find(opt => opt.replace(/\s+/g, '_').toLowerCase() === payload);
            if (!label) return ctx.answerCbQuery();

            const arr = ctx.session.data.traffic;
            const index = arr.indexOf(label);
            index === -1 ? arr.push(label) : arr.splice(index, 1);

            await ctx.answerCbQuery();
            await ctx.editMessageReplyMarkup(
                generateMultiButtons(trafficOptions, arr, 'traffic').reply_markup
            );
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleSelectionOfTrafficSources;