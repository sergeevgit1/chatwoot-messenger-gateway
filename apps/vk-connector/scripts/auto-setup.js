#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Проверяем версию Node.js и используем встроенный fetch или node-fetch
let fetch;
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion >= 18) {
  // Node.js 18+ имеет встроенный fetch
  console.log(`📌 Используем встроенный fetch (Node.js ${nodeVersion})`);
  fetch = globalThis.fetch;
} else {
  // Для старых версий Node.js используем node-fetch
  console.log(`📌 Используем node-fetch (Node.js ${nodeVersion})`);
  try {
    fetch = require('node-fetch');
  } catch (error) {
    console.error('❌ Ошибка: node-fetch не установлен. Пожалуйста, установите его:');
    console.error('   npm install node-fetch@2');
    process.exit(1);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 VK Connector Auto Setup Wizard');
console.log('==================================\n');

// Утилиты для генерации случайных значений
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Валидаторы
function validateURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function validateNumber(value) {
  return !isNaN(parseInt(value)) && parseInt(value) > 0;
}

function validateVKToken(token) {
  // Базовая проверка формата токена VK
  return token.startsWith('vk1.') && token.length > 20;
}

// Класс для работы с Chatwoot API
class ChatwootAPI {
  constructor(baseUrl, apiToken, accountId) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.headers = {
      'Content-Type': 'application/json',
      'api_access_token': apiToken,
      'Authorization': `Bearer ${apiToken}`,
    };
  }

  async testConnection() {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/inboxes`;
    console.log(`🔍 Тестирование подключения к: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: this.headers
      });
      
      console.log(`📡 Ответ сервера: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ошибка сервера: ${errorText}`);
        
        // Пытаемся распарсить ошибку для получения более детальной информации
        let errorDetails = '';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.message || errorJson.error || '';
        } catch (e) {
          // Если не удалось распарсить JSON, используем текст ошибки
          errorDetails = errorText;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorDetails}`);
      }
      
      const data = await response.json();
      console.log(`✅ Подключение успешно, получено данных: ${JSON.stringify(data).length} символов`);
      return data;
    } catch (error) {
      console.error(`❌ Ошибка подключения к Chatwoot: ${error.message}`);
      if (error.code === 'ENOTFOUND') {
        throw new Error(`Не удалось разрешить имя хоста. Проверьте URL: ${this.baseUrl}`);
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(`Соединение отклонено. Проверьте, что сервер Chatwoot запущен и доступен.`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(`Таймаут подключения. Проверьте сетевое соединение.`);
      }
      throw new Error(`Ошибка подключения к Chatwoot: ${error.message}`);
    }
  }

  async getInboxes() {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/inboxes`;
    console.log(`📋 Получение списка инбоксов: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: this.headers
      });
      
      console.log(`📡 Ответ сервера: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ошибка получения инбоксов: ${errorText}`);
        
        // Пытаемся распарсить ошибку для получения более детальной информации
        let errorDetails = '';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.message || errorJson.error || '';
        } catch (e) {
          // Если не удалось распарсить JSON, используем текст ошибки
          errorDetails = errorText;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorDetails}`);
      }
      
      const data = await response.json();
      const inboxes = data.payload || [];
      console.log(`✅ Получено инбоксов: ${inboxes.length}`);
      return inboxes;
    } catch (error) {
      console.error(`❌ Ошибка получения инбоксов: ${error.message}`);
      throw new Error(`Ошибка получения инбоксов: ${error.message}`);
    }
  }

  async createVKInbox() {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/inboxes`;
    // Используем правильную структуру для API инбокса
    const inboxData = {
      name: 'VK Connector',
      channel_type: 'Channel::Api',
      // Для API инбокса нужны дополнительные параметры
      medium: 'vk',
      // Пустой webhook_url будет установлен позже
      webhook_url: ''
    };
    
    console.log(`🔧 Создание VK инбокса: ${url}`);
    console.log(`📤 Данные: ${JSON.stringify(inboxData)}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(inboxData)
      });
      
      console.log(`📡 Ответ сервера: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ошибка создания инбокса: ${errorText}`);
        
        // Улучшенный парсинг ошибок 500
        let errorDetails = '';
        let recommendations = [];
        
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.message || errorJson.error || '';
          
          // Анализируем типичные ошибки и даём рекомендации
          if (errorDetails.includes('channel_type')) {
            recommendations.push('• Убедитесь, что используете правильный channel_type: "Channel::Api"');
          }
          if (errorDetails.includes('name') || errorDetails.includes('blank')) {
            recommendations.push('• Проверьте, что поле name не пустое');
          }
          if (errorDetails.includes('permission') || errorDetails.includes('unauthorized')) {
            recommendations.push('• Проверьте права доступа API токена');
          }
          if (response.status === 500) {
            recommendations.push('• Проверьте версию Chatwoot - возможно формат API изменился');
            recommendations.push('• Попробуйте создать инбокс вручную через веб-интерфейс');
          }
        } catch (e) {
          // Если не удалось распарсить JSON, используем текст ошибки
          errorDetails = errorText;
          if (response.status === 500) {
            recommendations.push('• Внутренняя ошибка сервера Chatwoot');
            recommendations.push('• Попробуйте создать инбокс вручную через веб-интерфейс');
          }
        }
        
        const errorMessage = `HTTP ${response.status}: ${response.statusText}. ${errorDetails}`;
        const fullError = new Error(errorMessage);
        fullError.recommendations = recommendations;
        fullError.status = response.status;
        throw fullError;
      }
      
      const data = await response.json();
      const inbox = data.payload || data;
      console.log(`✅ Инбокс создан с ID: ${inbox.id}`);
      return inbox;
    } catch (error) {
      console.error(`❌ Ошибка создания инбокса: ${error.message}`);
      
      // Добавляем рекомендации, если они есть
      if (error.recommendations && error.recommendations.length > 0) {
        console.log('\n💡 Рекомендации по исправлению:');
        error.recommendations.forEach(rec => console.log(rec));
      }
      
      throw new Error(`Ошибка создания инбокса: ${error.message}`);
    }
  }

  async createWebhook(webhookUrl) {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/webhooks`;
    const webhookData = {
      webhook_url: webhookUrl,
      subscriptions: ['message_created', 'conversation_status_changed']
    };
    
    console.log(`🔗 Создание вебхука для аккаунта: ${url}`);
    console.log(`📤 URL вебхука: ${webhookUrl}`);
    console.log(`📤 Подписки: ${webhookData.subscriptions.join(', ')}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(webhookData)
      });
      
      console.log(`📡 Ответ сервера: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ошибка создания вебхука: ${errorText}`);
        
        // Пытаемся распарсить ошибку для получения более детальной информации
        let errorDetails = '';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.message || errorJson.error || '';
        } catch (e) {
          // Если не удалось распарсить JSON, используем текст ошибки
          errorDetails = errorText;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorDetails}`);
      }
      
      const data = await response.json();
      const webhook = data.payload || data;
      console.log(`✅ Вебхук создан с ID: ${webhook.id}`);
      return webhook;
    } catch (error) {
      console.error(`❌ Ошибка создания вебхука: ${error.message}`);
      throw new Error(`Ошибка создания вебхука: ${error.message}`);
    }
  }
}

// Основные вопросы для пользователя
const questions = [
  {
    key: 'CHATWOOT_BASE_URL',
    prompt: 'Chatwoot Base URL (например, https://your-chatwoot.com): ',
    required: true,
    validate: (value) => validateURL(value) || 'Некорректный URL'
  },
  {
    key: 'CHATWOOT_API_ACCESS_TOKEN',
    prompt: 'Chatwoot API Access Token: ',
    required: true,
    validate: (value) => value.length > 10 || 'Токен слишком короткий'
  },
  {
    key: 'CHATWOOT_ACCOUNT_ID',
    prompt: 'Chatwoot Account ID: ',
    required: true,
    validate: (value) => validateNumber(value) || 'Должно быть положительным числом'
  },
  {
    key: 'VK_ACCESS_TOKEN',
    prompt: 'VK Access Token (токен доступа сообщества): ',
    required: true,
    validate: (value) => validateVKToken(value) || 'Некорректный формат токена VK'
  },
  {
    key: 'VK_GROUP_ID',
    prompt: 'VK Group ID (ID группы ВКонтакте): ',
    required: true,
    validate: (value) => validateNumber(value) || 'Должно быть положительным числом'
  },
  {
    key: 'VK_CONFIRMATION',
    prompt: 'VK Confirmation String (строка подтверждения из настроек Callback API): ',
    required: true,
    validate: (value) => value.length > 0 || 'Строка подтверждения не может быть пустой'
  },
  {
    key: 'PORT',
    prompt: 'Server Port (порт сервера, по умолчанию 3000): ',
    default: '3000',
    validate: (value) => validateNumber(value) || 'Должно быть положительным числом'
  }
];

const answers = {};
let currentQuestion = 0;

// Функции для сохранения и загрузки прогресса
function saveProgress() {
  const progressData = {
    answers,
    currentQuestion,
    timestamp: new Date().toISOString()
  };
  
  const progressPath = path.join(__dirname, '..', '.setup-progress.json');
  
  try {
    fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2));
    console.log('💾 Прогресс сохранен');
  } catch (error) {
    console.error('⚠️ Не удалось сохранить прогресс:', error.message);
  }
}

function loadProgress() {
  const progressPath = path.join(__dirname, '..', '.setup-progress.json');
  
  if (!fs.existsSync(progressPath)) {
    return null;
  }
  
  try {
    const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    return progressData;
  } catch (error) {
    console.error('⚠️ Не удалось загрузить прогресс:', error.message);
    return null;
  }
}

function clearProgress() {
  const progressPath = path.join(__dirname, '..', '.setup-progress.json');
  
  try {
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
      console.log('🗑️ Прогресс очищен');
    }
  } catch (error) {
    console.error('⚠️ Не удалось очистить прогресс:', error.message);
  }
}

function askToContinueFromProgress(progressData) {
  return new Promise((resolve) => {
    const date = new Date(progressData.timestamp);
    const formattedDate = date.toLocaleString('ru-RU');
    
    console.log(`\n📋 Найден сохраненный прогресс от ${formattedDate}`);
    console.log(`📍 Текущий шаг: ${progressData.currentQuestion + 1} из ${questions.length}`);
    
    rl.question('Хотите продолжить с сохраненного места? (y/n): ', (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'да');
    });
  });
}

async function askQuestion() {
  if (currentQuestion >= questions.length) {
    rl.close();
    processSetup();
    return;
  }

  const question = questions[currentQuestion];
  
  rl.question(question.prompt, async (answer) => {
    const value = answer || question.default;
    
    if (question.validate) {
      const validation = question.validate(value);
      if (validation !== true) {
        console.log(`❌ Ошибка: ${validation}`);
        console.log('Попробуйте снова:\n');
        return askQuestion();
      }
    }

    answers[question.key] = value;
    currentQuestion++;
    console.log('');
    
    // Сохраняем прогресс после каждого ответа
    saveProgress();
    
    askQuestion();
  });
}

async function startSetup() {
  // Проверяем наличие сохраненного прогресса
  const progressData = loadProgress();
  
  if (progressData) {
    const shouldContinue = await askToContinueFromProgress(progressData);
    
    if (shouldContinue) {
      // Восстанавливаем состояние
      Object.assign(answers, progressData.answers);
      currentQuestion = progressData.currentQuestion;
      
      console.log('\n✅ Прогресс восстановлен\n');
    } else {
      // Очищаем старый прогресс и начинаем заново
      clearProgress();
      console.log('\n🔄 Начинаем настройку заново\n');
    }
  }
  
  askQuestion();
}

async function processSetup() {
  console.log('🔧 Обработка настроек...\n');
  
  try {
    // Генерируем автоматические параметры
    const autoGenerated = {
      VK_CALLBACK_ID: generateUUID(),
      VK_SECRET: generateRandomString(32),
      CHATWOOT_WEBHOOK_ID_VK: generateUUID(),
      VK_API_VERSION: '5.199',
      HOST: '0.0.0.0'
    };
    
    // Объединяем ответы пользователя и сгенерированные параметры
    const config = { ...answers, ...autoGenerated };
    
    console.log('✅ Автоматические параметры сгенерированы:');
    console.log(`   VK_CALLBACK_ID: ${config.VK_CALLBACK_ID}`);
    console.log(`   VK_SECRET: ${config.VK_SECRET}`);
    console.log(`   CHATWOOT_WEBHOOK_ID_VK: ${config.CHATWOOT_WEBHOOK_ID_VK}`);
    console.log('');
    
    // Проверяем подключение к Chatwoot
    console.log('🔍 Проверка подключения к Chatwoot...');
    const chatwootAPI = new ChatwootAPI(
      config.CHATWOOT_BASE_URL,
      config.CHATWOOT_API_ACCESS_TOKEN,
      config.CHATWOOT_ACCOUNT_ID
    );
    
    await chatwootAPI.testConnection();
    console.log('✅ Подключение к Chatwoot успешно установлено\n');
    
    // Получаем список инбоксов
    console.log('📋 Получение списка инбоксов...');
    const inboxes = await chatwootAPI.getInboxes();
    console.log(`✅ Найдено инбоксов: ${inboxes.length}\n`);
    
    // Ищем существующий VK инбокс
    let vkInbox = inboxes.find(inbox => 
      inbox.name && (inbox.name.toLowerCase().includes('vk') || inbox.name.toLowerCase().includes('vkontakte'))
    );
    
    if (!vkInbox) {
      console.log('🔧 Создание нового инбокса для VK...');
      
      try {
        vkInbox = await chatwootAPI.createVKInbox();
        console.log(`✅ Инбокс создан с ID: ${vkInbox.id}\n`);
        config.VK_INBOX_ID = vkInbox.id;
      } catch (inboxError) {
        console.error(`❌ Не удалось создать инбокс автоматически: ${inboxError.message}`);
        
        // Предлагаем fallback режим
        console.log('\n🔄 Fallback режим: создание инбокса вручную');
        console.log('Вы можете создать инбокс вручную и продолжить настройку.\n');
        
        const shouldContinue = await new Promise((resolve) => {
          rl.question('Продолжить настройку с ручным созданием инбокса? (y/n): ', (answer) => {
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'да');
          });
        });
        
        if (!shouldContinue) {
          console.log('\n❌ Настройка прервана. Вы можете попробовать позже.');
          process.exit(1);
        }
        
        // Показываем инструкцию по созданию инбокса вручную
        showManualInboxInstructions(config.CHATWOOT_BASE_URL);
        
        // Запрашиваем ID созданного инбокса
        const inboxId = await new Promise((resolve) => {
          rl.question('\nВведите ID созданного инбокса: ', (answer) => {
            const id = parseInt(answer);
            if (isNaN(id) || id <= 0) {
              console.log('❌ Некорректный ID. Должно быть положительное число.');
              process.exit(1);
            }
            resolve(id);
          });
        });
        
        config.VK_INBOX_ID = inboxId;
        console.log(`✅ Используем инбокс с ID: ${config.VK_INBOX_ID}\n`);
      }
    } else {
      console.log(`✅ Найден существующий VK инбокс с ID: ${vkInbox.id}\n`);
      config.VK_INBOX_ID = vkInbox.id;
    }
    
    // Генерируем URL для вебхуков
    const baseUrl = `http://localhost:${config.PORT}`;
    const vkCallbackUrl = `${baseUrl}/vk/callback/${config.VK_CALLBACK_ID}`;
    const chatwootWebhookUrl = `${baseUrl}/chatwoot/webhook/${config.CHATWOOT_WEBHOOK_ID_VK}`;
    
    console.log('🔗 Создание вебхука в Chatwoot...');
    try {
      await chatwootAPI.createWebhook(chatwootWebhookUrl);
      console.log('✅ Вебхук успешно создан\n');
    } catch (webhookError) {
      console.error(`⚠️ Предупреждение: не удалось создать вебхук автоматически: ${webhookError.message}`);
      console.log('💡 Вы можете настроить вебхук вручную после завершения настройки\n');
    }
    
    // Сохраняем конфигурацию
    saveEnvFile(config);
    
    // Очищаем прогресс после успешной настройки
    clearProgress();
    
    // Показываем итоговую инструкцию
    showFinalInstructions(config, vkCallbackUrl, chatwootWebhookUrl);
    
  } catch (error) {
    console.error(`❌ Критическая ошибка: ${error.message}`);
    console.log('\n💡 Прогресс настройки сохранен. Вы можете продолжить позже.');
    process.exit(1);
  }
}

function saveEnvFile(config) {
  const envContent = Object.entries(config)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const envPath = path.join(__dirname, '..', '.env');
  
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Файл .env успешно создан!');
    console.log(`📁 Путь: ${envPath}\n`);
  } catch (error) {
    console.error('❌ Ошибка при сохранении файла .env:', error.message);
    process.exit(1);
  }
}

function showFinalInstructions(config, vkCallbackUrl, chatwootWebhookUrl) {
  console.log('🎉 Настройка завершена успешно!\n');
  
  console.log('📋 Следующие шаги:\n');
  
  console.log('1. 🚀 Запустите коннектор:');
  console.log('   npm run install:vk && npm run start:vk\n');
  
  console.log('2. 🔧 Настройте VK Callback API:');
  console.log(`   URL: ${vkCallbackUrl}`);
  console.log(`   Секретный ключ: ${config.VK_SECRET}`);
  console.log(`   Строка подтверждения: ${config.VK_CONFIRMATION}`);
  console.log(`   Версия API: ${config.VK_API_VERSION}\n`);
  
  console.log('💡 Где найти строку подтверждения VK:');
  console.log('   1. Зайдите в управление сообществом VK → Управление → Работа с API');
  console.log('   2. Перейдите в раздел "Callback API"');
  console.log('   3. В настройках сервера вы увидите поле "Строка" - это и есть строка подтверждения');
  console.log('   4. Скопируйте эту строку и вставьте в конфигурацию\n');
  
  console.log('3. 🌐 Для внешнего доступа (если необходимо):');
  console.log('   npm run tunnel\n');
  
  console.log('4. 📡 После запуска туннеля обновите URL в настройках VK:');
  console.log('   Используйте URL от ngrok вместо localhost\n');
  
  console.log('5. ✅ Проверьте работу:');
  console.log('   Отправьте тестовое сообщение в группу VK\n');
  
  console.log('🔗 Готовые URL для вебхуков:');
function showManualInboxInstructions(baseUrl) {
  console.log('\n📋 Инструкция по созданию инбокса вручную:\n');
  
  console.log('1. 🔐 Войдите в вашу панель Chatwoot');
  console.log(`   URL: ${baseUrl}\n`);
  
  console.log('2. 📂 Перейдите в "Settings" → "Inboxes"');
  console.log('   (Настройки → Инбоксы)\n');
  
  console.log('3. ➕ Нажмите "Add Inbox"');
  console.log('   (Добавить инбокс)\n');
  
  console.log('4. 📡 Выберите тип "API Platform"');
  console.log('   (Платформа API)\n');
  
  console.log('5. 📝 Заполните поля:');
  console.log('   • Name: VK Connector');
  console.log('   • Channel Type: API');
  console.log('   • Medium: vk');
  console.log('   • Webhook URL: (оставьте пустым, настроим позже)\n');
  
  console.log('6. ✅ Нажмите "Create" для создания инбокса');
  console.log('   (Создать)\n');
  
  console.log('7. 📋 После создания скопируйте ID инбокса');
  console.log('   (обычно отображается в URL или в свойствах инбокса)\n');
}
  console.log(`   VK Callback: ${vkCallbackUrl}`);
  console.log(`   Chatwoot: ${chatwootWebhookUrl}\n`);
}

// Функция для создания туннеля через ngrok (npm API)
async function createTunnel(port, authtoken) {
  console.log('\n🌐 Создание туннеля через ngrok...');
  try {
    const ngrokLib = require('ngrok');
    const url = await ngrokLib.connect({ addr: parseInt(port, 10), authtoken });
    console.log(`✅ Туннель создан: ${url}`);
    return url;
  } catch (e) {
    throw new Error(`Ngrok процесс завершился с ошибкой: ${e.message}`);
  }
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);

if (args.includes('--tunnel')) {
  // Читаем текущие настройки для создания туннеля
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Файл .env не найден. Сначала запустите:');
    console.error('   node scripts/auto-setup.js');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key] = value;
    }
  });

  const port = envVars.PORT || '3000';
  const ngrokToken = process.env.NGROK_AUTHTOKEN || envVars.NGROK_AUTHTOKEN;
  
  createTunnel(port, ngrokToken)
    .then(url => {
      const vkCallbackId = envVars.VK_CALLBACK_ID;
      const chatwootWebhookId = envVars.CHATWOOT_WEBHOOK_ID_VK;
      
      console.log('\n📋 Обновленные URL для настройки:');
      console.log(`\nVK Callback API:`);
      console.log(`   URL: ${url}/vk/callback/${vkCallbackId}`);
      console.log(`   Секрет: ${envVars.VK_SECRET}`);
      console.log(`   Подтверждение: ${envVars.VK_CONFIRMATION}`);
      console.log('\n💡 Если строка подтверждения не установлена, найдите её в настройках Callback API VK');
      console.log(`\nChatwoot Webhook:`);
      console.log(`   URL: ${url}/chatwoot/webhook/${chatwootWebhookId}`);
      
      // Оставляем ngrok работать
      console.log('\n🔄 Туннель активен. Нажмите Ctrl+C для остановки.');
    })
    .catch(error => {
      console.error('❌ Ошибка при создании туннеля:', error.message);
      process.exit(1);
    });
} else {
  // Интерактивная настройка
  startSetup();
}
