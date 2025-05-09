function startServer({ app, bot }) {
    const PORT = process.env.PORT || 8080;

    if (process.env.NODE_ENV === 'test') {
        app.use('/bot', bot.webhookCallback('/bot'));
        return { app };
    }

    if (process.env.NEW_HOSTNAME) {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT} (webhook mode)`);
            bot.telegram.setWebhook(`https://${process.env.NEW_HOSTNAME}/bot`).then(() => {
                console.log('Webhook set');
            }).catch((err) => console.error('Failed to set webhook:', err));
        });
    } else {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT} (polling mode)`);
            bot.launch().then(() => {
                console.log('Bot started with polling');
            }).catch((err) => console.error('Failed to start bot:', err));
        });
    }

    return { app };
}

module.exports = startServer;