function startServer({ app, bot }) {
    const PORT = process.env.PORT || 3000;

    // В тестах не запускать listen
    if (process.env.NODE_ENV === 'test') {
        app.use('/bot', bot.webhookCallback('/bot'));
        return { app };
    }

    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        // Running on Render: Set webhook
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            bot.telegram.setWebhook(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/bot`).then(() => {
                console.log('Webhook set');
            }).catch((err) => console.error('Failed to set webhook:', err));
        });
    } else {
        // Running locally: Use polling
        bot.launch().then(() => {
            console.log('Bot started with polling');
        }).catch((err) => console.error('Failed to start bot:', err));
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} (polling mode)`);
        });
    }

    return { app };
}

module.exports = startServer;