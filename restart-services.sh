#!/bin/bash

echo "Перезапуск VK Connector с новыми настройками..."

# Остановка и удаление контейнера
docker-compose down

# Сборка и запуск контейнера с новыми настройками
docker-compose up -d --build

echo "Сервисы перезапущены. Проверяем статус..."
sleep 5

# Проверка статуса контейнера
docker-compose ps

echo "Проверяем логи контейнера..."
docker-compose logs vk-connector