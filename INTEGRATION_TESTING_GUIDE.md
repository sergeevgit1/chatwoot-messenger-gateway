# Руководство по тестированию интеграции VK + Chatwoot + VK Connector

## Текущий статус системы

✅ **Приложение готово к тестированию:**
- Docker-контейнер запущен и работает
- Health check проходит успешно
- VK callback эндпоинт доступен и отвечает правильно
- Chatwoot webhook эндпоинт доступен и обрабатывает запросы
- Ngrok туннель активен: `https://e6971db700b6.ngrok-free.app`

## URL эндпоинтов для настройки

### VK Callback URL
```
https://e6971db700b6.ngrok-free.app/vk/callback/53e85b47-5d5a-4aa2-aa11-3eb3a439c360
```

### Chatwoot Webhook URL
```
https://e6971db700b6.ngrok-free.app/chatwoot/webhook/379fbd80-246d-40b3-bbf5-8e8d9482bbe2
```

## Мониторинг логов

Логи контейнера отслеживаются в реальном времени. Для наблюдения за процессом интеграции используйте:
```bash
docker logs -f vk-connector
```

## Шаги по тестированию

### 1. Настройка VK Сообщества

1. Перейдите в управление сообществом VK (ID: 214842547)
2. Настройте Callback API:
   - URL: `https://e6971db700b6.ngrok-free.app/vk/callback/53e85b47-5d5a-4aa2-aa11-3eb3a439c360`
   - Секретный ключ: `i8aeI57acgqMDtawdCysHfNfUG1UQmvm`
   - Код подтверждения: `629ff1ea`
   - Версия API: 5.199

3. Включите типы событий:
   - Сообщения (`message_new`)
   - Подписчики (`group_join`, `group_leave`)

### 2. Настройка Chatwoot

1. Перейдите в настройки Chatwoot: `https://chat.zaruba-ds.ru`
2. Создайте новый канал VK или настройте существующий:
   - Inbox ID: 2
   - Webhook URL: `https://e6971db700b6.ngrok-free.app/chatwoot/webhook/379fbd80-246d-40b3-bbf5-8e8d9482bbe2`

### 3. Тестирование сценариев

#### Сценарий 1: VK → Chatwoot
1. Напишите тестовое сообщение в сообщество VK
2. Ожидаемый результат в логах:
   ```
   [vk] event received: type=message_new group_id=214842547
   [server] Created conversation in Chatwoot
   [server] Sent message to Chatwoot
   ```
3. Проверьте, что сообщение появилось в Chatwoot

#### Сценарий 2: Chatwoot → VK
1. Создайте новую беседу в Chatwoot для VK-канала
2. Отправьте исходящее сообщение из Chatwoot
3. Ожидаемый результат в логах:
   ```
   [server] Chatwoot webhook: event=message_created type=outgoing
   [server] Sent message to VK: recipient=<user_id> content="<message>"
   ```
4. Проверьте, что сообщение доставлено в VK

## На что обращать внимание в логах

### Успешные операции:
- `[vk] event received:` - получен вебхук от VK
- `[server] Created conversation in Chatwoot` - создана беседа в Chatwoot
- `[server] Sent message to Chatwoot` - сообщение отправлено в Chatwoot
- `[server] Chatwoot webhook:` - получен вебхук от Chatwoot
- `[server] Sent message to VK:` - сообщение отправлено в VK

### Возможные ошибки:
- `VK callback error:` - ошибка обработки вебхука VK
- `Chatwoot webhook error:` - ошибка обработки вебхука Chatwoot
- `Failed to send message to VK:` - ошибка отправки в VK
- `Missing VK recipient_id` - отсутствует ID получателя VK

## Проверка успешности интеграции

### Критерии успеха:
1. ✅ Сообщения из VK появляются в Chatwoot
2. ✅ Сообщения из Chatwoot доставляются в VK
3. ✅ Создаются корректные беседы в Chatwoot
4. ✅ Нет ошибок в логах контейнера
5. ✅ Health check продолжает проходить успешно

## Команды для диагностики

```bash
# Проверить статус контейнера
docker ps

# Проверить логи в реальном времени
docker logs -f vk-connector

# Проверить доступность эндпоинтов
curl -i http://localhost:3000/health
curl -i -X POST http://localhost:3000/vk/callback/53e85b47-5d5a-4aa2-aa11-3eb3a439c360 \
  -H "Content-Type: application/json" \
  -d '{"type":"confirmation","group_id":214842547}'

# Проверить переменные окружения в контейнере
docker exec vk-connector env | grep -E "(VK|CHATWOOT)"
```

## Важные замечания

1. Ngrok URL может измениться при перезапуске. В этом случае обновите URL в настройках VK и Chatwoot
2. Убедитесь, что токены доступа актуальны и имеют необходимые права
3. Для продакшена используйте постоянный домен вместо ngrok
4. Все логи сохраняются в директории `./logs` на хост-машине

## Экстренные действия

Если что-то работает некорректно:
1. Перезапустите контейнер: `docker-compose restart`
2. Проверьте конфигурацию в `.env` файле
3. Убедитесь, что URL вебхуков в VK и Chatwoot актуальны
4. Проверьте права доступа токенов