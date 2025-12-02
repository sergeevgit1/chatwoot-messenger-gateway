# Диагностика проблемы с данными контакта

## Проблема

В Chatwoot контакты создаются только с базовыми данными (имя и identifier), но без дополнительных атрибутов из VK (город, фото, статус и т.д.).

## Добавлено детальное логирование

Для диагностики добавлены логи на каждом этапе:

### 1. Получение данных из VK API

```typescript
console.info('[vk] fetchVkProfile response for user', fromId, ':', JSON.stringify(profile, null, 2));
```

**Что проверить:** Приходят ли данные из VK API? Есть ли поля `city`, `photo_100`, `status` и т.д.?

### 2. Обогащение данных

```typescript
console.info('[vk] enrichVkContact result:', JSON.stringify(result, null, 2));
console.info('[vk] additional_attributes count:', Object.keys(additionalAttributes).length);
```

**Что проверить:** Сколько полей в `additional_attributes`? Должно быть 20+.

### 3. Создание контакта в Chatwoot

```typescript
console.info('[chatwoot] Creating contact with params:', JSON.stringify(createParams, null, 2));
```

**Что проверить:** Передаются ли `additional_attributes` в API запрос?

### 4. Обновление контакта

```typescript
console.info('[chatwoot] Updating contact with params:', JSON.stringify(updateParams, null, 2));
console.info('[chatwoot] Update contact response:', JSON.stringify(updated, null, 2));
```

**Что проверить:** Обновляются ли атрибуты? Что возвращает API?

## Как проверить

### Шаг 1: Развернуть обновления

```bash
cd /home/ubuntu/chatwoot-messenger-gateway
git pull origin main
npm run build
docker-compose restart vk-connector
```

### Шаг 2: Отправить тестовое сообщение

Отправьте сообщение от VK пользователя боту.

### Шаг 3: Проверить логи

```bash
docker-compose logs vk-connector | grep -A 50 "fetchVkProfile response"
```

**Ожидаемый вывод:**
```json
[vk] fetchVkProfile response for user 78202273 : {
  "id": 78202273,
  "first_name": "Дмитрий",
  "last_name": "Сергеев",
  "screen_name": "sergeevdmitrii",
  "photo_100": "https://...",
  "photo_200_orig": "https://...",
  "city": {
    "id": 1,
    "title": "Москва"
  },
  "bdate": "1.1.1990",
  "sex": 2,
  "online": 1,
  ...
}
```

### Шаг 4: Проверить обогащенные данные

```bash
docker-compose logs vk-connector | grep "enrichVkContact result" -A 50
```

**Ожидаемый вывод:**
```json
[vk] enrichVkContact result: {
  "name": "Дмитрий Сергеев",
  "custom_attributes": {
    "vk_user_id": "78202273",
    "vk_bdate": "1.1.1990",
    "vk_screen_name": "sergeevdmitrii"
  },
  "additional_attributes": {
    "city": "Москва",
    "vk_profile_url": "https://vk.com/sergeevdmitrii",
    "vk_photo_100": "https://...",
    "vk_photo_200": "https://...",
    "vk_sex": "Male",
    "vk_online": "Yes",
    ...
  }
}

[vk] additional_attributes count: 24
```

### Шаг 5: Проверить отправку в Chatwoot

```bash
docker-compose logs vk-connector | grep "Creating contact with params" -A 30
```

**Ожидаемый вывод:**
```json
[chatwoot] Creating contact with params: {
  "inbox_id": 1,
  "name": "Дмитрий Сергеев",
  "identifier": "vk:78202273",
  "custom_attributes": {
    "vk_user_id": "78202273",
    "vk_bdate": "1.1.1990",
    "vk_screen_name": "sergeevdmitrii"
  },
  "additional_attributes": {
    "city": "Москва",
    "vk_profile_url": "https://vk.com/sergeevdmitrii",
    ...
  }
}
```

## Возможные проблемы и решения

### Проблема 1: VK API не возвращает данные

**Симптом:**
```json
[vk] fetchVkProfile response for user 78202273 : {
  "id": 78202273,
  "first_name": "Дмитрий",
  "last_name": "Сергеев"
}
```

**Причина:** Недостаточно прав доступа или неправильные поля в запросе.

**Решение:** Проверить `fetchVkProfile` в `packages/shared/utils/src/vk.ts`:

```typescript
const fields = [
  'photo_100', 'photo_200_orig', 'photo_max',
  'city', 'country', 'home_town',
  'bdate', 'sex', 'relation',
  'screen_name', 'status', 'online', 'online_mobile',
  'last_seen', 'verified', 'timezone',
  'universities', 'occupation',
  'site', 'facebook', 'twitter', 'instagram'
].join(',');
```

### Проблема 2: additional_attributes пустой

**Симптом:**
```
[vk] additional_attributes count: 0
```

**Причина:** Данные не извлекаются из профиля VK.

**Решение:** Проверить логику в `enrichVkContact` - возможно, поля имеют другую структуру.

### Проблема 3: Chatwoot не сохраняет additional_attributes

**Симптом:** Данные отправляются, но в UI Chatwoot не отображаются.

**Причина:** В Chatwoot `additional_attributes` - это свободные поля, которые не требуют предварительного определения. Но они могут не отображаться в стандартном UI.

**Решение:** 

#### Вариант А: Использовать custom_attributes вместо additional_attributes

Custom attributes нужно сначала создать в Chatwoot:
1. Settings → Custom Attributes
2. Add Custom Attribute
3. Type: Contact
4. Attribute Key: `city`, `vk_photo_100`, и т.д.

Затем изменить код, чтобы использовать `custom_attributes` вместо `additional_attributes`.

#### Вариант Б: Проверить отображение через API

```bash
curl -X GET "https://your-chatwoot.com/api/v1/accounts/1/contacts/CONTACT_ID" \
  -H "api_access_token: YOUR_TOKEN"
```

Проверить, есть ли `additional_attributes` в ответе.

### Проблема 4: Контакт уже существует и не обновляется

**Симптом:** Новые атрибуты не появляются у существующих контактов.

**Причина:** Контакт был создан ранее без атрибутов, и обновление не срабатывает.

**Решение:**

1. **Удалить тестовый контакт** в Chatwoot UI
2. **Отправить новое сообщение** от VK пользователя
3. **Проверить логи** создания контакта

Или принудительно обновить:

```typescript
// В ensureContact, после нахождения контакта
if (contacts.length > 0) {
  contact = contacts[0];
  const contactId = parseInt(String(contact.id));
  
  // ВСЕГДА обновлять атрибуты
  try {
    await this.client.updateContact({
      contact_id: contactId,
      identifier: vkIdentifier,
      custom_attributes: params.custom_attributes,
      additional_attributes: params.additional_attributes,
    });
  } catch (e) {
    console.warn('[chatwoot] update_contact failed:', e);
  }
}
```

## Рекомендуемое решение

### Использовать custom_attributes для важных полей

Chatwoot лучше работает с `custom_attributes`, которые:
- Отображаются в UI по умолчанию
- Можно использовать в фильтрах и поиске
- Можно использовать в автоматизациях

**Изменить код:**

```typescript
// В enrichVkContact
const customAttributes: Record<string, any> = { 
  vk_user_id: fromId,
  // Добавить важные поля в custom_attributes
  vk_screen_name: profile.screen_name,
  vk_bdate: profile.bdate,
  city: extractCityName(profile.city),
  vk_photo_100: profile.photo_100,
  vk_online: profile.online === 1 ? 'Yes' : 'No',
  vk_sex: sexMap[profile.sex],
};

// Остальные поля в additional_attributes
const additionalAttributes: Record<string, any> = {
  country: profile.country?.title,
  home_town: profile.home_town,
  vk_photo_200: profile.photo_200_orig,
  vk_photo_max: profile.photo_max,
  vk_status: profile.status,
  // ...
};
```

**Создать custom attributes в Chatwoot:**

1. Settings → Custom Attributes → Add Custom Attribute
2. Создать для каждого важного поля:
   - `city` (Text)
   - `vk_photo_100` (Link)
   - `vk_online` (List: Yes/No)
   - `vk_sex` (List: Male/Female/Unknown)
   - `vk_screen_name` (Text)
   - `vk_bdate` (Text)

## Следующие шаги

1. ✅ Развернуть обновления с логированием
2. ⬜ Отправить тестовое сообщение
3. ⬜ Проверить логи на каждом этапе
4. ⬜ Определить, на каком этапе теряются данные
5. ⬜ Применить соответствующее решение
6. ⬜ Создать custom attributes в Chatwoot (если нужно)
7. ⬜ Протестировать с новым контактом

---

**Дата:** 3 декабря 2024  
**Статус:** Диагностика
