const steps = require('../steps');

module.exports = async (ctx, error, message = 'An error occurred. Please try again with /start.') => {
    console.error('Error:', error);
    ctx.session = { step: steps.LANGUAGE };
    await ctx.reply(message);
};