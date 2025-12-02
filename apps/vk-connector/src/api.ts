import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ChatwootClient } from '@chatwoot-connectors/chatwoot-client';
import type { ChatwootClient as IChatwootClient } from '@chatwoot-connectors/shared-types';

const router = express.Router();

// Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate random string
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get existing configuration
router.get('/config', (req, res) => {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    
    if (!fs.existsSync(envPath)) {
      return res.json({ error: '.env file not found' });
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const config: Record<string, string> = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        config[key.trim()] = value.trim();
      }
    });

    // Remove sensitive values for security
    const safeConfig = { ...config };
    delete safeConfig.VK_ACCESS_TOKEN;
    delete safeConfig.VK_SECRET;
    delete safeConfig.CHATWOOT_API_ACCESS_TOKEN;

    res.json(safeConfig);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Generate webhook URLs
router.post('/webhook', (req, res) => {
  try {
    const { vk_callback_id, chatwoot_webhook_id_vk, port } = req.body;
    
    if (!vk_callback_id || !chatwoot_webhook_id_vk) {
      return res.status(400).json({ 
        error: 'vk_callback_id and chatwoot_webhook_id_vk are required' 
      });
    }

    const baseUrl = 'https://your-domain.com'; // This would be dynamically determined
    
    const webhookUrls = {
      vk_callback: `${baseUrl}/vk/callback/${vk_callback_id}`,
      chatwoot_webhook: `${baseUrl}/chatwoot/webhook/${chatwoot_webhook_id_vk}`
    };

    res.json(webhookUrls);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Start ngrok tunnel
router.post('/tunnel', async (req, res) => {
  try {
    const { port = '3000' } = req.body;
    
    const ngrok = spawn('ngrok', ['http', port], {
      stdio: 'pipe'
    });

    let output = '';
    
    ngrok.stdout.on('data', (data) => {
      output += data.toString();
    });

    ngrok.stderr.on('data', (data) => {
      console.error('Ngrok error:', data.toString());
    });

    ngrok.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ 
          error: 'Ngrok process failed',
          code 
        });
      }

      const match = output.match(/Forwarding\s+(https:\/\/[^[\s]]+)/);
      
      if (match) {
        res.json({ 
          url: match[1],
          success: true 
        });
      } else {
        res.status(500).json({ 
          error: 'Could not extract ngrok URL from output',
          output 
        });
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      ngrok.kill();
      res.status(500).json({ 
        error: 'Ngrok timeout' 
      });
    }, 30000);

    ngrok.on('error', (error) => {
      res.status(500).json({ 
        error: (error as Error).message
      });
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Save configuration
router.post('/save', (req, res) => {
  try {
    const config = req.body;
    const envPath = path.join(__dirname, '..', '.env');
    
    const envContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    fs.writeFileSync(envPath, envContent);
    
    res.json({ 
      success: true,
      message: 'Configuration saved successfully' 
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Test Chatwoot connection
router.post('/test-chatwoot', async (req, res) => {
  try {
    const { baseUrl, apiToken, accountId } = req.body;
    
    if (!baseUrl || !apiToken || !accountId) {
      return res.status(400).json({
        error: 'baseUrl, apiToken, and accountId are required'
      });
    }

    const chatwootClient = new ChatwootClient(apiToken, accountId, baseUrl);
    
    try {
      // Test connection by searching for contacts (this will verify API access)
      await chatwootClient.searchContacts('');
      res.json({
        success: true,
        message: 'Connection successful'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: `Connection failed: ${(error as Error).message}`
      });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Auto setup
router.post('/auto-setup', async (req, res) => {
  try {
    const {
      chatwoot_base_url,
      chatwoot_api_access_token,
      chatwoot_account_id,
      vk_access_token,
      vk_group_id,
      vk_confirmation,
      port = '3000'
    } = req.body;
    
    if (!chatwoot_base_url || !chatwoot_api_access_token || !chatwoot_account_id ||
        !vk_access_token || !vk_group_id || !vk_confirmation) {
      return res.status(400).json({
        error: 'All fields are required for auto setup'
      });
    }

    // Generate automatic parameters
    const autoGenerated = {
      VK_CALLBACK_ID: generateUUID(),
      VK_SECRET: generateRandomString(32),
      CHATWOOT_WEBHOOK_ID_VK: generateUUID(),
      VK_API_VERSION: '5.199',
      HOST: '0.0.0.0',
      PORT: port
    };

    // Combine user input and auto-generated parameters
    const config = {
      CHATWOOT_BASE_URL: chatwoot_base_url,
      CHATWOOT_API_ACCESS_TOKEN: chatwoot_api_access_token,
      CHATWOOT_ACCOUNT_ID: chatwoot_account_id,
      VK_ACCESS_TOKEN: vk_access_token,
      VK_GROUP_ID: vk_group_id,
      VK_CONFIRMATION: vk_confirmation,
      ...autoGenerated
    };

    // Test Chatwoot connection
    const chatwootClient: IChatwootClient = new ChatwootClient(
      chatwoot_api_access_token,
      chatwoot_account_id,
      chatwoot_base_url
    );

    try {
      // Test connection by searching for contacts
      await chatwootClient.searchContacts('');
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Chatwoot connection failed: ${(error as Error).message}`
      });
    }

    // Create webhook in Chatwoot
    try {
      const webhookUrl = `http://localhost:${port}/chatwoot/webhook/${config.CHATWOOT_WEBHOOK_ID_VK}`;
      await chatwootClient.createWebhook({
        webhook_url: webhookUrl,
        subscriptions: ['message_created', 'conversation_status_changed']
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Failed to create webhook: ${(error as Error).message}`
      });
    }

    // Save configuration
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = Object.entries(config)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    fs.writeFileSync(envPath, envContent);

    // Generate webhook URLs
    const baseUrl = `http://localhost:${port}`;
    const vkCallbackUrl = `${baseUrl}/vk/callback/${config.VK_CALLBACK_ID}`;
    const chatwootWebhookUrl = `${baseUrl}/chatwoot/webhook/${config.CHATWOOT_WEBHOOK_ID_VK}`;

    // Generate instructions
    const instructions = `🚀 Запустите коннектор:
npm run install:vk && npm run start:vk

🔧 Настройте VK Callback API:
URL: ${vkCallbackUrl}
Секретный ключ: ${config.VK_SECRET}
Строка подтверждения: ${config.VK_CONFIRMATION}
Версия API: ${config.VK_API_VERSION}

💡 Где найти строку подтверждения VK:
1. Зайдите в управление сообществом VK → Управление → Работа с API
2. Перейдите в раздел "Callback API"
3. В настройках сервера вы увидите поле "Строка" - это и есть строка подтверждения
4. Скопируйте эту строку и вставьте в конфигурацию

🌐 Для внешнего доступа (если необходимо):
npm run tunnel

📡 После запуска туннеля обновите URL в настройках VK:
Используйте URL от ngrok вместо localhost

✅ Проверьте работу:
Отправьте тестовое сообщение в группу VK`;

    res.json({
      success: true,
      config,
      webhooks: {
        vkCallback: vkCallbackUrl,
        chatwootWebhook: chatwootWebhookUrl
      },
      instructions
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;