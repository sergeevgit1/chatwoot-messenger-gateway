# Диагностика проблем с Traefik в Dokploy

## Проблема: 404 при переходе на домен

Если приложение запущено (видно в логах), но при переходе на домен возвращается 404, проблема скорее всего в конфигурации Traefik или сети.

## Шаги диагностики:

### 1. Проверьте логи приложения
```bash
docker logs vk-connector
```

Ищите сообщения:
```
[server] VK Connector started on 0.0.0.0:3000
[server] VK Group ID: 214842547
[server] Chatwoot Account ID: 1
[server] Environment: production
[server] VK Callback URL: https://mail.zaruba-ds.ru/vk/callback/53e85b47-5d5a-4aa2-aa11-3eb3a439c360
[server] Chatwoot Webhook URL: https://mail.zaruba-ds.ru/chatwoot/webhook/379fbd80-246d-40b3-bbf5-8e8d9482bbe2
```

### 2. Проверьте доступность приложения изнутри контейнера
```bash
docker exec -it vk-connector sh
curl -s http://localhost:3000/health
```

### 3. Проверьте сетевые настройки в Dokploy

Убедитесь, что в docker-compose.yml правильно настроены:

```yaml
services:
  vk-connector:
    build:
      context: .
      dockerfile: apps/vk-connector/Dockerfile
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    labels:
      - traefik.enable=true
      - traefik.docker.network=dokploy-network
      - traefik.http.routers.vk-connector.rule=Host(`mail.zaruba-ds.ru`)
      - traefik.http.routers.vk-connector.entrypoints=web
      - traefik.http.services.vk-connector.loadbalancer.server.port=3000
      - traefik.http.routers.vk-connector.service=vk-connector
      - traefik.http.routers.vk-connector.middlewares=redirect-to-https@file
      - traefik.http.routers.vk-connector-secure.rule=Host(`mail.zaruba-ds.ru`)
      - traefik.http.routers.vk-connector-secure.entrypoints=websecure
      - traefik.http.services.vk-connector-secure.loadbalancer.server.port=3000
      - traefik.http.routers.vk-connector-secure.service=vk-connector-secure
      - traefik.http.routers.vk-connector-secure.tls.certresolver=letsencrypt
    networks:
      - dokploy-network
```

**Важно:** В production не нужно указывать `HOST=0.0.0.0`, так как Traefik обрабатывает маршрутизацию на все интерфейсы. Приложение должно слушать `0.0.0.0` только внутри контейнера.

### 4. Проверьте логи Traefik

```bash
# Если есть доступ к логам Traefik
docker logs traefik
```

### 5. Проверьте DNS настройки

Убедитесь, что DNS A-запись для `mail.zaruba-ds.ru` указывает на правильный IP-адрес сервера Dokploy.

```bash
nslookup mail.zaruba-ds.ru
dig mail.zaruba-ds.ru
```

### 6. Проверьте файрвол

Если есть файрвол между Traefik и приложением, убедитесь, что порт 3000 открыт:

```bash
# Проверьте правила iptables (если применимо)
sudo iptables -L -n | grep 3000

# Или проверьте через telnet
telnet mail.zaruba-ds.ru 80
telnet mail.zaruba-ds.ru 443
```

## Частые проблемы и решения:

### Проблема 1: Неправильные labels в docker-compose.yml
**Решение:** Убедитесь, что имя сервиса в labels соответствует имени контейнера

### Проблема 2: Сеть не найдена
**Решение:** Проверьте, что сеть `dokploy-network` существует и контейнер подключен к ней

### Проблема 3: Конфликт портов
**Решение:** Убедитесь, что порт 3000 не занят другим сервисом

### Проблема 4: Проблемы с SSL сертификатами
**Решение:** Проверьте логи Let's Encrypt в Traefik

## Полезные команды:

```bash
# Пересборка и перезапуск
docker-compose down
docker-compose up -d --build

# Проверка статуса сервисов
docker-compose ps

# Проверка сети
docker network ls
docker network inspect dokploy-network
```

## Если ничего не помогает:

1. Проверьте панель управления Dokploy
2. Свяжитесь с поддержкой Dokploy
3. Временно попробуйте прямой доступ через IP-адрес сервера