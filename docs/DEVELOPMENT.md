# Разработка в Chatwoot Connectors

## Архитектура проекта

Проект использует монорепозиторий Turborepo с следующей структурой:

```
turborepo-chatwoot-connectors/
├── apps/
│   └── vk-connector/          # Коннектор для ВКонтакте
├── packages/
│   ├── shared/types/          # Общие типы и модели
│   ├── shared/utils/          # Утилиты
│   └── shared/chatwoot-client/ # Клиент для Chatwoot API
├── docs/                     # Документация
├── package.json              # Корневой package.json
└── turbo.json               # Конфигурация Turborepo
```

## Принципы разработки

### 1. Модульность

Каждый коннектор - независимое приложение в `apps/`. Общие компоненты вынесены в `packages/shared/`.

### 2. Типизация

Все типы определены в `@chatwoot-connectors/shared-types`. Используются TypeScript интерфейсы для строгой типизации.

### 3. Версионирование

Пакеты используют workspace зависимости с семантическим версионированием.

## Добавление нового коннектора

### 1. Создание приложения

```bash
mkdir apps/new-connector
cd apps/new-connector
npm init -y
```

### 2. Настройка package.json

```json
{
  "name": "@chatwoot-connectors/new-connector",
  "version": "1.0.0",
  "dependencies": {
    "@chatwoot-connectors/shared-types": "workspace:*",
    "@chatwoot-connectors/shared-utils": "workspace:*",
    "@chatwoot-connectors/chatwoot-client": "workspace:*"
  }
}
```

### 3. Реализация адаптера

Реализуйте интерфейс `MessengerAdapter` из `shared-types`:

```typescript
import { MessengerAdapter, UnifiedMessage, TextContent } from '@chatwoot-connectors/shared-types';

export class NewConnectorAdapter implements MessengerAdapter {
  onMessage(cb: OnMessage): void { /* ... */ }
  start(): Promise<void> { /* ... */ }
  stop(): Promise<void> { /* ... */ }
  sendText(recipientId: string, content: TextContent): Promise<void> { /* ... */ }
  capabilities(): AdapterCapabilities { /* ... */ }
}
```

### 4. Интеграция с Chatwoot

Используйте `ChatwootClient` и `ChatwootService` для интеграции:

```typescript
import { ChatwootClient } from '@chatwoot-connectors/chatwoot-client';
import { ChatwootService } from '@chatwoot-connectors/shared-types';

const client = new ChatwootClient(token, accountId, baseUrl);
const service = new ChatwootService(client, config);
```

## Сборка и разработка

### Установка зависимостей

```bash
npm install
```

### Разработка

```bash
npm run dev
```

### Сборка всех пакетов

```bash
npm run build
```

### Линтинг

```bash
npm run lint
```

### Тесты

```bash
npm run test
```

### Очистка

```bash
npm run clean
```

## Структура общего кода

### Shared Types (`packages/shared/types`)

- `message.ts` - Типы сообщений и адаптеров
- `chatwoot.ts` - Типы Chatwoot API и вебхуков
- `vk.ts` - Типы VK API
- `index.ts` - Экспорт всех типов

### Shared Utils (`packages/shared/utils`)

- `vk.ts` - Утилиты для VK API
- Индексный файл для экспорта

### Shared Chatwoot Client (`packages/shared/chatwoot-client`)

- `ChatwootClient.ts` - HTTP клиент для Chatwoot API
- `index.ts` - Экспорт клиента

## Конвенции

### 1. Логирование

Используйте префиксы в логах:
- `[vk]` - операции с VK API
- `[chatwoot]` - операции с Chatwoot API
- `[server]` - операции HTTP сервера
- `[telegram]` - операции с Telegram API
- `[whatsapp]` - операции с WhatsApp API

### 2. Обработка ошибок

Все асинхронные операции должны обрабатывать ошибки:

```typescript
try {
  await someOperation();
} catch (error) {
  console.error('[prefix] Operation failed:', error);
  // Дополнительная обработка
}
```

### 3. Валидация

Входящие данные должны валидироваться:

```typescript
if (!payload.required_field) {
  throw new Error('Missing required field');
}
```

## Деплой

### 1. Сборка

```bash
npm run build
```

### 2. Docker (опционально)

Создайте Dockerfile в директории приложения:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

### 3. Переменные окружения

Используйте `.env.example` как шаблон для переменных окружения.

## Мониторинг

### Health Checks

Каждое приложение должно предоставлять `/health` эндпоинт:

```typescript
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'connector-name',
    timestamp: new Date().toISOString(),
  });
});
```

### Метрики

Рекомендуется добавлять базовые метрики производительности и ошибок.

## Тестирование

### Unit тесты

```bash
# В директории пакета
npm test
```

### Интеграционные тесты

```bash
# Из корня
npm run test:integration
```

### E2E тесты

```bash
# Из корня
npm run test:e2e
```

## Релиз

### 1. Версионирование

Используйте семантическое версионирование:
- `MAJOR.MINOR.PATCH`
- `1.0.0` - первый релиз
- `1.1.0` - новые функции
- `1.0.1` - исправления

### 2. Changelog

Ведите CHANGELOG.md с изменениями:
- Added - новые функции
- Changed - изменения в существующих функциях
- Fixed - исправления ошибок
- Deprecated - устаревшие функции

### 3. Git workflow

```bash
git add .
git commit -m "feat: add new connector"
git tag v1.0.0
git push origin main --tags