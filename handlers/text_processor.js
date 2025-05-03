function handleTextProcessor({ bot, steps, texts, generateMultiButtons, trafficOptions, htmlEscaping, errorHandler }) {
    bot.on('text', async (ctx) => {
        try {
            console.log('Received text:', ctx.message.text, 'Lang:', ctx.session.lang, 'Step:', ctx.session.step);
            const step = ctx.session.step;
            const validLanguages = ['en', 'ru', 'ua'];
            const lang = ctx.session.lang && validLanguages.includes(ctx.session.lang) ? ctx.session.lang : 'en';
            const text = htmlEscaping(ctx.message.text);

            // text length validation
            if ((step === steps.CONTACT || step === steps.COMPANY) && text.length > 150) {
                const errorMessages = {
                    en: 'Input is too long. Please shorten it to 150 characters or less and try again.',
                    ru: 'Введенный текст слишком длинный. Пожалуйста, сократите до 150 символов или меньше и попробуйте снова.',
                    ua: 'Введений текст занадто довгий. Будь ласка, скоротіть до 150 символів або менше і спробуйте ще раз.'
                };
                return ctx.reply(errorMessages[lang]);
            }

            if (!step) {
                ctx.session = { step: steps.LANGUAGE };
                return ctx.reply('Please press /start to begin.');
            }

            switch (step) {
                case steps.CONTACT:
                    ctx.session.data = ctx.session.data || { traffic: [], geo: [] };
                    ctx.session.data.contact = text;
                    ctx.session.step = steps.COMPANY;
                    return ctx.reply(texts.companyName[lang]);

                case steps.COMPANY:
                    ctx.session.data.company = text;
                    ctx.session.step = steps.TRAFFIC;
                    return ctx.reply(
                        texts.trafficSource[lang],
                        generateMultiButtons(trafficOptions, ctx.session.data.traffic, 'traffic')
                    );

                case steps.TRAFFIC:
                case steps.GEO:
                case steps.CONFIRM:
                    return ctx.reply('Please use the buttons or start over with /start.');
            }
        } catch (error) {
            await errorHandler(ctx, error);
        }
    });
}

module.exports = handleTextProcessor;