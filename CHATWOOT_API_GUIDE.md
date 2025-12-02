# 📚 Руководство по Chatwoot API: Создание и управление инбоксами

Это подробное руководство по работе с Chatwoot API для создания инбоксов, управления контактами, разговорами и сообщениями.

## 📋 Содержание

1. [Обзор Chatwoot API](#обзор-chatwoot-api)
2. [Аутентификация](#аутентификация)
3. [Эндпоинты API](#эндпоинты-api)
4. [Создание инбоксов](#создание-инбоксов)
5. [Работа с контактами](#работа-с-контактами)
6. [Управление разговорами](#управление-разговорами)
7. [Отправка сообщений](#отправка-сообщений)
8. [Настройка вебхуков](#настройка-вебхуков)
9. [Типичные ошибки и решения](#типичные-ошибки-и-решения)
10. [Примеры реализации на JavaScript](#примеры-реализации-на-javascript)

---

## 🔑 Обзор Chatwoot API

Chatwoot API предоставляет RESTful интерфейс для интеграции с платформой Chatwoot. API позволяет управлять инбоксами, контактами, разговорами и сообщениями программным способом.

### Базовый URL

```
https://your-chatwoot.com/api/v1/accounts/{ACCOUNT_ID}
```

Где:
- `your-chatwoot.com` - ваш домен Chatwoot
- `ACCOUNT_ID` - ID вашего аккаунта в Chatwoot

---

## 🔐 Аутентификация

Chatwoot API использует два метода аутентификации:

### 1. Через API Access Token

```javascript
const headers = {
  'Content-Type': 'application/json',
  'api_access_token': 'YOUR_API_ACCESS_TOKEN'
};
```

### 2. Через Bearer Token

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_API_ACCESS_TOKEN'
};
```

> 💡 **Рекомендация**: Используйте оба заголовка для максимальной совместимости

---

## 🛠️ Эндпоинты API

### Инбоксы

| Метод | Эндпоинт | Описание |
|------|----------|----------|
| `GET` | `/inboxes` | Получение списка инбоксов |
| `POST` | `/inboxes` | Создание нового инбокса |
| `GET` | `/inboxes/{id}` | Получение информации об инбоксе |
| `PUT` | `/inboxes/{id}` | Обновление инбокса |
| `DELETE` | `/inboxes/{id}` | Удаление инбокса |

### Контакты

| Метод | Эндпоинт | Описание |
|------|----------|----------|
| `GET` | `/contacts` | Получение списка контактов |
| `POST` | `/contacts` | Создание нового контакта |
| `GET` | `/contacts/search` | Поиск контактов |
| `POST` | `/contacts/filter` | Фильтрация контактов |
| `GET` | `/contacts/{id}` | Получение информации о контакте |
| `PATCH` | `/contacts/{id}` | Обновление контакта |

### Разговоры

| Метод | Эндпоинт | Описание |
|------|----------|----------|
| `GET` | `/conversations` | Получение списка разговоров |
| `POST` | `/conversations` | Создание нового разговора |
| `GET` | `/conversations/{id}` | Получение информации о разговоре |
| `PATCH` | `/conversations/{id}` | Обновление разговора |

### Сообщения

| Метод | Эндпоинт | Описание |
|------|----------|----------|
| `GET` | `/conversations/{id}/messages` | Получение сообщений разговора |
| `POST` | `/conversations/{id}/messages` | Отправка сообщения |

### Вебхуки

| Метод | Эндпоинт | Описание |
|------|----------|----------|
| `GET` | `/webhooks` | Получение списка вебхуков |
| `POST` | `/webhooks` | Создание нового вебхука |
| `DELETE` | `/webhooks/{id}` | Удаление вебхука |

---

## 📮 Создание инбоксов

### Структура данных для создания инбокса

```javascript
const inboxData = {
  name: "VK Connector",           // Название инбокса
  channel_type: "Channel::Api",   // Тип канала
  medium: "vk",                   // Идентификатор платформы
  webhook_url: ""                 // URL вебхука (можно установить позже)
};
```

### Пример запроса на создание инбокса

```javascript
const createInbox = async () => {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/inboxes`;
  
  const inboxData = {
    name: "VK Connector",
    channel_type: "Channel::Api",
    medium: "vk",
    webhook_url: ""
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': apiToken,
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(inboxData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.payload || data;
  } catch (error) {
    console.error('Ошибка создания инбокса:', error.message);
    throw error;
  }
};
```

### Пример ответа при успешном создании

```json
{
  "id": 12345,
  "name": "VK Connector",
  "channel_type": "Channel::Api",
  "medium": "vk",
  "webhook_url": "",
  "account_id": 1,
  "enabled": true,
  "created_at": "2023-12-01T10:00:00Z",
  "updated_at": "2023-12-01T10:00:00Z"
}
```

---

## 👥 Работа с контактами

### Создание контакта

```javascript
const createContact = async (inboxId, contactData) => {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/contacts`;
  
  const payload = {
    inbox_id: inboxId,
    name: contactData.name,
    phone_number: contactData.phone,
    email: contactData.email,
    identifier: contactData.identifier,
    custom_attributes: contactData.customAttributes || {},
    additional_attributes: contactData.additionalAttributes || {}
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка создания контакта:', error.message);
    throw error;
  }
};
```

### Поиск контактов

```javascript
const searchContacts = async (query) => {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/contacts/search`;
  const params = new URLSearchParams({ q: query });
  
  try {
    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка поиска контактов:', error.message);
    throw error;
  }
};
```

### Фильтрация контактов по атрибутам

```javascript
const filterContacts = async (attributes) => {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/contacts/filter`;
  
  const filters = Object.entries(attributes).map(([key, value]) => ({
    attribute_key: key,
    filter_operator: 'equal_to',
    values: [String(value)]
  }));
  
  const payload = { payload: filters };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка фильтрации контактов:', error.message);
    throw error;
  }
};
```

---

## 💬 Управление разговорами

### Создание разговора

```javascript
const createConversation = async (inboxId, sourceId, contactId = null) => {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations`;
  
  const payload = {
    inbox_id: inboxId,
    source_id: sourceId,
    contact_id: contactId,
    custom_attributes: {}
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка создания разговора:', error.message);
    throw error;
  }
};
```

### Получение разговоров контакта

```javascript
const getContactConversations = async (contactId) => {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка получения разговоров:', error.message);
    throw error;
  }
};
```

---

## 📨 Отправка сообщений

### Отправка сообщения в разговор

```javascript
const sendMessage = async (conversationId, content, messageType = 'outgoing') => {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
  
  const payload = {
    content: content,
    message_type: messageType  // 'incoming' или 'outgoing'
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error.message);
    throw error;
  }
};
```

---

## 🔗 Настройка вебхуков

### Создание вебхука

```javascript
const createWebhook = async (webhookUrl) => {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/webhooks`;
  
  const webhookData = {
    webhook_url: webhookUrl,
    subscriptions: [
      'message_created',
      'conversation_status_changed',
      'contact_created'
    ]
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(webhookData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка создания вебхука:', error.message);
    throw error;
  }
};
```

### Доступные события для подписки

- `message_created` - Создание нового сообщения
- `conversation_created` - Создание нового разговора
- `conversation_status_changed` - Изменение статуса разговора
- `contact_created` - Создание нового контакта
- `contact_updated` - Обновление контакта

---

## ⚠️ Типичные ошибки и решения

### 1. Ошибка аутентификации (401)

**Проблема**: `HTTP 401: Unauthorized`

**Решение**:
- Проверьте правильность API токена
- Убедитесь, что токен имеет необходимые права доступа
- Используйте оба заголовка аутентификации

```javascript
const headers = {
  'Content-Type': 'application/json',
  'api_access_token': apiToken,
  'Authorization': `Bearer ${apiToken}`
};
```

### 2. Ошибка доступа (403)

**Проблема**: `HTTP 403: Forbidden`

**Решение**:
- Проверьте права доступа API токена
- Убедитесь, что токен имеет права на управление инбоксами
- Обратитесь к администратору Chatwoot для получения необходимых прав

### 3. Ошибка создания инбокса (422)

**Проблема**: `HTTP 422: Unprocessable Entity`

**Решение**:
- Проверьте структуру данных для создания инбокса
- Убедитесь, что все обязательные поля заполнены
- Проверьте правильность значения `channel_type`

```javascript
const inboxData = {
  name: "VK Connector",
  channel_type: "Channel::Api",  // Правильное значение
  medium: "vk",
  webhook_url: ""
};
```

### 4. Внутренняя ошибка сервера (500)

**Проблема**: `HTTP 500: Internal Server Error`

**Решение**:
- Проверьте версию Chatwoot - возможно формат API изменился
- Попробуйте создать инбокс вручную через веб-интерфейс
- Проверьте логи сервера Chatwoot для детальной диагностики

### 5. Ошибка сети

**Проблема**: `ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`

**Решение**:
- Проверьте правильность URL Chatwoot
- Убедитесь, что сервер Chatwoot доступен
- Проверьте сетевое соединение и настройки файрвола

---

## 💻 Примеры реализации на JavaScript

### Класс для работы с Chatwoot API

```javascript
class ChatwootAPI {
  constructor(baseUrl, apiToken, accountId) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.headers = {
      'Content-Type': 'application/json',
      'api_access_token': apiToken,
      'Authorization': `Bearer ${apiToken}`
    };
  }

  // Тестирование подключения
  async testConnection() {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/inboxes`;
    
    try {
      const response = await fetch(url, { headers: this.headers });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      throw new Error(`Ошибка подключения: ${error.message}`);
    }
  }

  // Получение списка инбоксов
  async getInboxes() {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/inboxes`;
    
    try {
      const response = await fetch(url, { headers: this.headers });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.payload || [];
    } catch (error) {
      throw new Error(`Ошибка получения инбоксов: ${error.message}`);
    }
  }

  // Создание VK инбокса
  async createVKInbox() {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/inboxes`;
    
    const inboxData = {
      name: 'VK Connector',
      channel_type: 'Channel::Api',
      medium: 'vk',
      webhook_url: ''
    };
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(inboxData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      return data.payload || data;
    } catch (error) {
      throw new Error(`Ошибка создания инбокса: ${error.message}`);
    }
  }

  // Создание вебхука
  async createWebhook(webhookUrl) {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/webhooks`;
    
    const webhookData = {
      webhook_url: webhookUrl,
      subscriptions: ['message_created', 'conversation_status_changed']
    };
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(webhookData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      return data.payload || data;
    } catch (error) {
      throw new Error(`Ошибка создания вебхука: ${error.message}`);
    }
  }

  // Создание или поиск контакта
  async ensureContact(inboxId, searchKey, name = null, phone = null, email = null) {
    // Сначала ищем контакт по custom_attributes
    try {
      const filterResponse = await this.filterContacts({ vk_user_id: searchKey });
      const contacts = filterResponse.payload || [];
      
      if (contacts.length > 0) {
        return { id: contacts[0].id, source_id: searchKey };
      }
    } catch (error) {
      // Если фильтрация не удалась, продолжаем с созданием
      console.warn('Фильтрация контактов не удалась, создаем новый:', error.message);
    }
    
    // Создаем новый контакт
    const contactData = {
      inbox_id: inboxId,
      name: name,
      phone_number: phone,
      email: email,
      identifier: searchKey,
      custom_attributes: { vk_user_id: searchKey }
    };
    
    try {
      const response = await this.createContact(contactData);
      const contact = response.payload || response;
      return { id: contact.id, source_id: searchKey };
    } catch (error) {
      throw new Error(`Ошибка создания контакта: ${error.message}`);
    }
  }

  // Вспомогательные методы
  async createContact(contactData) {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/contacts`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(contactData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  }

  async filterContacts(attributes) {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/contacts/filter`;
    
    const filters = Object.entries(attributes).map(([key, value]) => ({
      attribute_key: key,
      filter_operator: 'equal_to',
      values: [String(value)]
    }));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ payload: filters })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  }
}
```

### Пример использования класса

```javascript
// Инициализация API клиента
const chatwootAPI = new ChatwootAPI(
  'https://your-chatwoot.com',
  'your_api_token',
  1  // Account ID
);

// Основная функция настройки
async function setupVKConnector() {
  try {
    // 1. Тестирование подключения
    console.log('🔍 Тестирование подключения...');
    await chatwootAPI.testConnection();
    console.log('✅ Подключение успешно установлено');
    
    // 2. Получение списка инбоксов
    console.log('📋 Получение списка инбоксов...');
    const inboxes = await chatwootAPI.getInboxes();
    console.log(`✅ Найдено инбоксов: ${inboxes.length}`);
    
    // 3. Поиск существующего VK инбокса
    let vkInbox = inboxes.find(inbox => 
      inbox.name && inbox.name.toLowerCase().includes('vk')
    );
    
    if (!vkInbox) {
      // 4. Создание нового VK инбокса
      console.log('🔧 Создание нового VK инбокса...');
      vkInbox = await chatwootAPI.createVKInbox();
      console.log(`✅ Инбокс создан с ID: ${vkInbox.id}`);
    } else {
      console.log(`✅ Найден существующий VK инбокс с ID: ${vkInbox.id}`);
    }
    
    // 5. Создание вебхука
    const webhookUrl = 'https://your-server.com/chatwoot/webhook/webhook-id';
    console.log('🔗 Создание вебхука...');
    const webhook = await chatwootAPI.createWebhook(webhookUrl);
    console.log(`✅ Вебхук создан с ID: ${webhook.id}`);
    
    // 6. Создание тестового контакта
    console.log('👤 Создание тестового контакта...');
    const contact = await chatwootAPI.ensureContact(
      vkInbox.id,
      '12345678',  // VK User ID
      'Test User',
      '+1234567890',
      'test@example.com'
    );
    console.log(`✅ Контакт создан с ID: ${contact.id}`);
    
    return {
      inboxId: vkInbox.id,
      webhookId: webhook.id,
      contactId: contact.id
    };
    
  } catch (error) {
    console.error('❌ Ошибка настройки:', error.message);
    throw error;
  }
}

// Запуск настройки
setupVKConnector()
  .then(result => {
    console.log('🎉 Настройка завершена успешно:', result);
  })
  .catch(error => {
    console.error('❌ Критическая ошибка:', error.message);
  });
```

---

## 📚 Дополнительные ресурсы

- [Официальная документация Chatwoot API](https://www.chatwoot.com/docs/product/channels/api)
- [Примеры интеграций](https://github.com/chatwoot/chatwoot/tree/develop/app/channels/api)
- [Сообщество Chatwoot](https://community.chatwoot.com/)

---

## 🤝 Вклад в проект

Если вы нашли ошибку или хотите улучшить этот гайд, пожалуйста:
1. Создайте issue с описанием проблемы
2. Отправьте pull request с исправлениями
3. Поделитесь своим опытом использования API

---

**Версия**: 1.0  
**Последнее обновление**: Декабрь 2023  
**Совместимость**: Chatwoot API v1