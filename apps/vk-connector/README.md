# VK Connector for Chatwoot

Коннектор для интеграции Chatwoot с ВКонтакте через Callback API.

## Возможности

- Прием входящих сообщений из ВКонтакте
- Отправка исходящих сообщений в ВКонтакте
- Автоматическое обогащение контактов данными из профиля ВК
- Двусторонняя синхронизация с Chatwoot

## Установка и настройка

### 1. Клонирование и установка зависимостей

```bash
cd apps/vk-connector
npm install
```

### 2. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

Обязательные переменные:
- `VK_CALLBACK_ID` - Уникальный ID для вебхука
- `VK_GROUP_ID` - ID группы ВКонтакте
- `VK_ACCESS_TOKEN` - Токен доступа сообщества
- `VK_SECRET` - Секретный ключ для вебхука
- `VK_CONFIRMATION` - Строка подтверждения Callback API
- `VK_INBOX_ID` - ID инбокса в Chatwoot
- `CHATWOOT_API_ACCESS_TOKEN` - API токен Chatwoot
- `CHATWOOT_ACCOUNT_ID` - ID аккаунта Chatwoot
- `CHATWOOT_BASE_URL` - URL Chatwoot инстанса
- `CHATWOOT_WEBHOOK_ID_VK` - ID вебхука для ВК

### 3. Настройка ВКонтакте

1. Создайте сообщество ВКонтакте
2. В настройках → Работа с API → Ключи доступа создайте токен
3. В настройках → Управление → Callback API настройте сервер:
   - URL: `https://your-domain.com/vk/callback/{VK_CALLBACK_ID}`
   - Секретный ключ: `VK_SECRET`
   - Строка подтверждения: `VK_CONFIRMATION`
4. Включите события: `message_new`

### 4. Настройка Chatwoot

1. Создайте инбокс для ВК
2. В настройках → Интеграции → Вебхуки создайте вебхук:
   - URL: `https://your-domain.com/chatwoot/webhook/{CHATWOOT_WEBHOOK_ID_VK}`
   - События: `message_created`

## Запуск

### Разработка

```bash
npm run dev
```

### Продакшн

```bash
npm run build
npm start
```

## API эндпоинты

### Health Check
```
GET /health
```

### VK Callback
```
POST /vk/callback/{VK_CALLBACK_ID}
```

### Chatwoot Webhook
```
POST /chatwoot/webhook/{CHATWOOT_WEBHOOK_ID_VK}
```

## Архитектура

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   ВКонтакте │────▶│   VK Connector    │────▶│  Chatwoot   │
│             │     │                  │     │             │
└─────────────┘     └──────────────────────┘     └─────────────┘
```

Компоненты:
- **VKAdapter** - Работа с VK Callback API
- **ChatwootService** - Бизнес-логика интеграции с Chatwoot
- **ChatwootClient** - HTTP клиент для Chatwoot API

## Разработка

### Сборка

```bash
npm run build
```

### Линтинг

```bash
npm run lint
```

### Очистка

```bash
npm run clean
```

## Тестирование

Для тестирования можно использовать ngrok для локального туннелирования:

```bash
ngrok http 3000
```

И использовать полученный URL для настройки вебхуков.

## Логирование

Коннектор использует структурированное логирование:
- `[vk]` - операции с VK API
- `[chatwoot]` - операции с Chatwoot API
- `[server]` - операции HTTP сервера

## Поддерживаемые типы сообщений

- **Текстовые сообщения** - Полная поддержка
- **Медиа** - Пока не поддерживается
- **Стикеры** - Пока не поддерживаются
- **Контакты** - Пока не поддерживаются
- **Локация** - Пока не поддерживается

## Безопасность

- Валидация callback_id в URL пути
- Проверка секретного ключа VK
- Проверка group_id
- Валидация вебхуков Chatwoot

## Лицензия

MIT