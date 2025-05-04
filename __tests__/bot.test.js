const request = require('supertest');
const express = require('express');
const startServer = require('../api/server');

// Мокаем Telegraf
jest.mock('telegraf', () => {
    const mockBot = {
        webhookCallback: jest.fn().mockImplementation(() => (req, res) => {
            res.status(200).json({ ok: true });
        }),
        launch: jest.fn().mockResolvedValue(),
        telegram: {
            setWebhook: jest.fn().mockResolvedValue(),
        },
    };
    return {
        Telegraf: jest.fn().mockImplementation(() => mockBot),
    };
});

describe('Bot Initialization', () => {
    let app;
    let botMock;

    beforeEach(() => {
        jest.clearAllMocks();

        // Инициализируем Express приложение
        app = express();
        app.use(express.json());

        // Создаем мок для бота
        botMock = {
            webhookCallback: jest.fn().mockImplementation(() => (req, res) => {
                res.status(200).json({ ok: true });
            }),
            launch: jest.fn().mockResolvedValue(),
            telegram: {
                setWebhook: jest.fn().mockResolvedValue(),
            },
        };

        // Устанавливаем окружение для тестов
        process.env.NODE_ENV = 'test';
        process.env.RENDER_EXTERNAL_HOSTNAME = 'test-hostname';

        // Запускаем сервер
        startServer({ app, bot: botMock });
    });

    afterEach(() => {
        // Очищаем переменные окружения
        delete process.env.NODE_ENV;
        delete process.env.RENDER_EXTERNAL_HOSTNAME;
    });

    it('should handle webhook callback correctly', async () => {
        const response = await request(app)
            .post('/bot')
            .send({ message: { text: '/start' } });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ ok: true });
        expect(botMock.webhookCallback).toHaveBeenCalledWith('/bot');
        // Проверяем, что setWebhook не вызывался, так как мы в режиме test
        expect(botMock.telegram.setWebhook).not.toHaveBeenCalled();
    });
});