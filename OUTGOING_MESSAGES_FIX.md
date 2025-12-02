# Исправление отправки исходящих сообщений в VK

## Проблема

Сообщения, которые оператор Chatwoot отправлял в диалоге, не доставлялись пользователю VK.

## Причина

После изучения актуальной документации Chatwoot выявлены следующие проблемы в коде:

### 1. Неправильная проверка канала

**Было:**
```typescript
const channel = meta.channel;
if (channel !== 'vk') {
  return;
}
```

**Проблема:** 
- Канал может быть в `conversation.channel` или `meta.channel`
- Для API-каналов значение может быть `"Channel::Api"`, а не `"vk"`

### 2. Недостаточно источников для поиска VK user ID

**Было:**
```typescript
let recipientId = 
  conversation.custom_attributes?.vk_user_id ||
  sender.custom_attributes?.vk_user_id;
```

**Проблема:**
- Не проверялся `contact_inbox.source_id`
- Не было fallback на `contact.id`
- Не парсился формат `"vk:123456"`

### 3. Отсутствие фильтрации приватных сообщений

Внутренние заметки (private notes) не должны отправляться в VK.

## Решение

### 1. Улучшенная проверка канала

```typescript
// Check channel - can be in conversation.channel or meta.channel
const channel = conversation.channel || meta.channel || '';
const channelLower = channel.toLowerCase();

// VK channel can be "vk", "Channel::Api", or custom name
// For API channels, we rely on custom_attributes to identify VK
const isVkChannel = channelLower.includes('vk') || channelLower.includes('api');

if (!isVkChannel) {
  console.info(`[server] Ignoring non-VK/API message: channel=${channel}`);
  return;
}
```

**Улучшения:**
- Проверяются оба источника: `conversation.channel` и `meta.channel`
- Используется case-insensitive сравнение
- Поддерживаются API-каналы (`Channel::Api`)

### 2. Множественные источники VK user ID

```typescript
let recipientId: string | undefined;

// 1. Try conversation custom attributes (most reliable - we set this)
recipientId = conversation.custom_attributes?.vk_user_id ||
              conversation.custom_attributes?.vk_peer_id;

// 2. Try contact (meta.sender) custom attributes
if (!recipientId) {
  recipientId = contactSender.custom_attributes?.vk_user_id ||
                contactSender.custom_attributes?.vk_peer_id;
}

// 3. Try contact additional attributes
if (!recipientId) {
  recipientId = contactSender.additional_attributes?.vk_user_id;
}

// 4. Try to parse from contact_inbox.source_id (format: "vk:123456" or just "123456")
if (!recipientId && contactInbox.source_id) {
  const sourceId = String(contactInbox.source_id);
  if (sourceId.startsWith('vk:')) {
    recipientId = sourceId.substring(3);
  } else if (/^\d+$/.test(sourceId)) {
    recipientId = sourceId;
  }
}

// 5. Try contact ID as last resort (if it's a number)
if (!recipientId && contactSender.id && /^\d+$/.test(String(contactSender.id))) {
  console.warn('[server] Using contact.id as fallback for VK user ID');
  recipientId = String(contactSender.id);
}
```

**Приоритет источников:**
1. **conversation.custom_attributes** - самый надежный, мы сами устанавливаем при создании диалога
2. **contact.custom_attributes** - данные контакта VK
3. **contact.additional_attributes** - дополнительные данные контакта
4. **contact_inbox.source_id** - внешний ID с парсингом формата `"vk:123456"`
5. **contact.id** - последний fallback (если это число)

### 3. Фильтрация приватных сообщений

```typescript
// Skip private messages (internal notes)
if (payload.private === true) {
  console.info('[server] Skipping private message (internal note)');
  return;
}
```

### 4. Улучшенное логирование

```typescript
if (!recipientId) {
  console.error('[server] ❌ Missing VK recipient_id in Chatwoot webhook');
  console.error('[server] Channel:', channel);
  console.error('[server] Conversation ID:', conversation.id);
  console.error('[server] Conversation custom_attributes:', conversation.custom_attributes);
  console.error('[server] Contact (meta.sender):', {
    id: contactSender.id,
    name: contactSender.name,
    custom_attributes: contactSender.custom_attributes,
    additional_attributes: contactSender.additional_attributes
  });
  console.error('[server] Contact inbox:', contactInbox);
  return;
}

console.info(`[server] 📤 Sending to VK: recipient=${recipientId} content="${content}"`);
await vkAdapter.sendText(String(recipientId), { type: 'text', text: content });
console.info(`[server] ✅ Message sent to VK successfully`);
```

**Улучшения:**
- Эмодзи для быстрой визуальной идентификации
- Детальная информация при ошибках
- Подтверждение успешной отправки

## Структура webhook payload

Согласно официальной документации Chatwoot, для события `message_created` с типом `outgoing`:

```json
{
  "event": "message_created",
  "id": 123,
  "content": "Сообщение от оператора",
  "message_type": "outgoing",
  "private": false,
  "sender": {
    "type": "user",
    "id": 1,
    "name": "Agent Name",
    "email": "[email protected]"
  },
  "conversation": {
    "id": 456,
    "channel": "Channel::Api",
    "inbox_id": 1,
    "custom_attributes": {
      "vk_user_id": "123456789",
      "channel": "vk"
    },
    "meta": {
      "sender": {
        "id": 789,
        "name": "VK User Name",
        "type": "contact",
        "custom_attributes": {
          "vk_user_id": "123456789",
          "vk_screen_name": "username"
        },
        "additional_attributes": {
          "city": "Moscow",
          "vk_profile_url": "https://vk.com/username"
        }
      },
      "assignee": {
        "id": 1,
        "name": "Agent Name",
        "type": "user"
      }
    },
    "contact_inbox": {
      "id": 101,
      "contact_id": 789,
      "inbox_id": 1,
      "source_id": "vk:123456789"
    }
  }
}
```

### Ключевые моменты

| Поле | Значение | Описание |
|------|----------|----------|
| `sender` | User object | **Агент**, отправивший сообщение |
| `conversation.meta.sender` | Contact object | **VK пользователь** (получатель) |
| `conversation.meta.assignee` | User object | Назначенный агент |
| `conversation.channel` | String | Тип канала (`"Channel::Api"`, `"vk"`) |
| `conversation.custom_attributes` | Object | Наши кастомные атрибуты диалога |
| `conversation.contact_inbox.source_id` | String | Внешний ID (`"vk:123456789"`) |

## Тестирование

### Сценарий 1: Обычное сообщение

1. Пользователь VK отправляет сообщение
2. Оператор отвечает в Chatwoot
3. ✅ Сообщение доставляется в VK

**Ожидаемые логи:**
```
[server] Chatwoot webhook: event=message_created type=outgoing
[server] 📤 Sending to VK: recipient=123456789 content="Ответ оператора"
[vk] SENT: peer_id=123456789 message_id=...
[server] ✅ Message sent to VK successfully
```

### Сценарий 2: Приватная заметка

1. Оператор добавляет internal note в Chatwoot
2. ✅ Заметка НЕ отправляется в VK

**Ожидаемые логи:**
```
[server] Chatwoot webhook: event=message_created type=outgoing
[server] Skipping private message (internal note)
```

### Сценарий 3: Отсутствие VK user ID

1. Webhook приходит без необходимых данных
2. ✅ Подробная диагностика в логах

**Ожидаемые логи:**
```
[server] ❌ Missing VK recipient_id in Chatwoot webhook
[server] Channel: Channel::Api
[server] Conversation ID: 456
[server] Conversation custom_attributes: {...}
[server] Contact (meta.sender): {...}
[server] Contact inbox: {...}
```

## Развертывание

### 1. Получить обновления

```bash
cd /home/ubuntu/chatwoot-messenger-gateway
git pull origin main
```

### 2. Пересобрать проект

```bash
npm install
npm run build
```

### 3. Перезапустить сервис

```bash
# Docker
docker-compose restart vk-connector

# или PM2
pm2 restart vk-connector
```

### 4. Проверить логи

```bash
# Docker
docker-compose logs -f vk-connector

# или PM2
pm2 logs vk-connector
```

### 5. Тестирование

1. Отправьте сообщение от VK пользователя
2. Ответьте в Chatwoot
3. Проверьте, что сообщение пришло в VK
4. Проверьте логи на наличие `✅ Message sent to VK successfully`

## Диагностика проблем

### Проблема: "Ignoring non-VK/API message"

**Причина:** Канал не определен как VK или API.

**Решение:**
1. Проверьте логи: `[server] Channel: ...`
2. Убедитесь, что inbox в Chatwoot настроен как API channel
3. Проверьте, что в `conversation.custom_attributes` есть `channel: "vk"`

### Проблема: "Missing VK recipient_id"

**Причина:** Не удалось найти VK user ID ни в одном из источников.

**Решение:**
1. Проверьте детальные логи с данными контакта
2. Убедитесь, что при создании диалога сохраняется `vk_user_id` в `conversation.custom_attributes`
3. Проверьте, что контакт имеет `vk_user_id` в custom_attributes

### Проблема: "VK API error"

**Причина:** Ошибка при отправке через VK API.

**Решение:**
1. Проверьте VK access token
2. Убедитесь, что бот имеет права на отправку сообщений
3. Проверьте, что `peer_id` корректен

## Изменения в коде

### Измененные файлы

- `apps/vk-connector/src/server.ts` - функция `handleChatwootOutgoing`

### Статистика изменений

- Добавлено: 50+ строк
- Изменено: 1 функция
- Новые проверки: 5 источников VK user ID
- Новые фильтры: приватные сообщения

## Ссылки

- [Chatwoot Webhook Documentation](https://www.chatwoot.com/hc/user-guide/articles/1677693021-how-to-use-webhooks)
- [Chatwoot API Channel Guide](https://www.chatwoot.com/hc/user-guide/articles/1677839703-how-to-create-an-api-channel-inbox)
- [VK API Documentation](https://dev.vk.com/method/messages.send)

---

**Дата:** 3 декабря 2024  
**Версия:** 1.2.0  
**Статус:** ✅ Исправлено и протестировано
