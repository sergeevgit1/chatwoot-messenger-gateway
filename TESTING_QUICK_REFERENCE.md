# Быстрая справка по тестированию интеграции

## Ключевые URL

### Ngrok туннель
```
https://e6971db700b6.ngrok-free.app
```

### VK Callback URL
```
https://e6971db700b6.ngrok-free.app/vk/callback/53e85b47-5d5a-4aa2-aa11-3eb3a439c360
```

### Chatwoot Webhook URL
```
https://e6971db700b6.ngrok-free.app/chatwoot/webhook/379fbd80-246d-40b3-bbf5-8e8d9482bbe2
```

## Ключевые параметры

### VK Сообщество
- ID: 214842547
- Секретный ключ: `i8aeI57acgqMDtawdCysHfNfUG1UQmvm`
- Код подтверждения: `629ff1ea`

### Chatwoot
- URL: https://chat.zaruba-ds.ru
- Inbox ID: 2
- Account ID: 1

## Полезные команды

```bash
# Статус контейнера
docker ps

# Логи в реальном времени
docker logs -f vk-connector

# Проверка health
curl http://localhost:3000/health

# Перезапуск
docker-compose restart
```

## Ожидаемые логи при успешной интеграции

### VK → Chatwoot
```
[vk] event received: type=message_new group_id=214842547
[server] Created conversation in Chatwoot
[server] Sent message to Chatwoot
```

### Chatwoot → VK
```
[server] Chatwoot webhook: event=message_created type=outgoing
[server] Sent message to VK: recipient=<user_id> content="<message>"
```

## Тестовый сценарий

1. **Отправить сообщение в VK сообщество**
2. **Проверить появление в Chatwoot**
3. **Ответить из Chatwoot**
4. **Проверить получение в VK**

## Диагностика проблем

Проверить переменные окружения:
```bash
docker exec vk-connector env | grep -E "(VK|CHATWOOT)"