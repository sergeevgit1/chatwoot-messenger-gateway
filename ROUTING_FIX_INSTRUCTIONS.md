# Инструкции по исправлению проблемы с маршрутизацией

## Что было исправлено:

1. **Исправлена переменная DOMAIN в файле .env**
   - Было: `DOMAIN=your-domain.com`
   - Стало: `DOMAIN=https://mail.zaruba-ds.ru`

2. **Обновлен docker-compose.yml**
   - Добавлены метки Traefik для правильной маршрутизации
   - Указан порт 3000 для load balancer
   - Добавлена сеть traefik-network

3. **Улучшена обработка домена в server.ts**
   - Добавлено удаление порта из URL при работе через Traefik
   - Улучшено логирование для отладки

## Как применить изменения:

1. **Перезапустите сервисы:**
   ```bash
   ./restart-services.sh
   ```
   Или выполните команды вручную:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

2. **Проверьте статус контейнера:**
   ```bash
   docker-compose ps
   ```

3. **Проверьте логи:**
   ```bash
   docker-compose logs vk-connector
   ```

4. **Проверьте доступность приложения:**
   - Health check: `https://mail.zaruba-ds.ru/health`
   - Основной endpoint: `https://mail.zaruba-ds.ru/`

## Что должно работать после исправлений:

1. Traefik должен корректно маршрутизировать запросы к контейнеру
2. Health check должен быть доступен по адресу `https://mail.zaruba-ds.ru/health`
3. VK callback endpoint должен быть доступен по адресу `https://mail.zaruba-ds.ru/vk/callback/{CALLBACK_ID}`
4. Chatwoot webhook endpoint должен быть доступен по адресу `https://mail.zaruba-ds.ru/chatwoot/webhook/{WEBHOOK_ID}`

## Если проблема осталась:

1. Проверьте, что сеть traefik-network существует:
   ```bash
   docker network ls | grep traefik
   ```

2. Если сети нет, создайте её:
   ```bash
   docker network create traefik-network
   ```

3. Проверьте логи Traefik на предмет ошибок маршрутизации

4. Убедитесь, что DNS для домена mail.zaruba-ds.ru указывает на сервер с Traefik