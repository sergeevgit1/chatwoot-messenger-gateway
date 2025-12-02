import express from 'express';
import { loadConfig } from './config';
import { VKAdapter } from './VKAdapter';
import { ChatwootService } from './ChatwootService';
import { ChatwootClient } from '@chatwoot-connectors/chatwoot-client';
import { VKCallbackPayload } from '@chatwoot-connectors/shared-types';
import apiRouter from './api';
import path from 'path';

// Load configuration
const config = loadConfig();

// Initialize Express app
const app = express();

// Initialize components
const chatwootClient = new ChatwootClient(
  config.chatwoot.api_access_token,
  config.chatwoot.account_id,
  config.chatwoot.base_url
);

const chatwootService = new ChatwootService(chatwootClient, config.vk);
const vkAdapter = new VKAdapter(config.vk);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (req: any, res: any) => {
  res.json({
    ok: true,
    service: 'vk-connector',
    timestamp: new Date().toISOString(),
  });
});

// Root route - redirect to health check or show info
app.get('/', (req: any, res: any) => {
  res.json({
    service: 'VK Connector for Chatwoot',
    status: 'running',
    endpoints: {
      health: '/health',
      vk_callback: `/vk/callback/${config.vk.callback_id}`,
      chatwoot_webhook: `/chatwoot/webhook/${config.chatwoot.webhook_id}`,
      api: '/api'
    },
    timestamp: new Date().toISOString(),
  });
});

// VK Callback endpoint
app.post(`/vk/callback/${config.vk.callback_id}`, async (req: any, res: any) => {
  try {
    const payload: VKCallbackPayload = req.body;
    const response = await vkAdapter.handleCallback(payload);
    
    // VK expects plain text response
    res.type('text/plain').send(response);
  } catch (error) {
    console.error('[server] VK callback error:', error);
    res.status(500).type('text/plain').send('error');
  }
});

// Chatwoot webhook endpoint
app.post(`/chatwoot/webhook/${config.chatwoot.webhook_id}`, async (req: any, res: any) => {
  try {
    const payload = req.body;
    const event = payload.event;
    const messageType = payload.message_type;

    console.info(
      `[server] Chatwoot webhook: event=${event} type=${messageType}`
    );

    if (event === 'message_created' && messageType === 'outgoing') {
      await handleChatwootOutgoing(payload);
    }

    res.json({ status: 'received' });
  } catch (error) {
    console.error('[server] Chatwoot webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleChatwootOutgoing(payload: any): Promise<void> {
  try {
    const content = payload.content || '';
    const conversation = payload.conversation || {};
    const meta = conversation.meta || {};
    const sender = meta.sender || {};
    const channel = meta.channel;

    if (channel !== 'vk') {
      console.info(`[server] Ignoring non-VK message: channel=${channel}`);
      return;
    }

    // Extract recipient_id from Chatwoot contact
    const recipientId = 
      sender.custom_attributes?.vk_peer_id ||
      sender.custom_attributes?.vk_user_id;

    if (!recipientId) {
      console.warn('[server] Missing VK recipient_id in Chatwoot webhook');
      return;
    }

    await vkAdapter.sendText(String(recipientId), { type: 'text', text: content });
    
    console.info(
      `[server] Sent message to VK: recipient=${recipientId} content="${content}"`
    );
  } catch (error) {
    console.error('[server] Failed to send message to VK:', error);
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    await vkAdapter.start();
    
    app.listen(config.server.port, config.server.node_env === 'production' ? '0.0.0.0' : config.server.host, () => {
      console.log(`[server] VK Connector started on ${config.server.host}:${config.server.port}`);
      console.log(`[server] VK Group ID: ${config.vk.group_id}`);
      console.log(`[server] Chatwoot Account ID: ${config.chatwoot.account_id}`);
      
      // Вывод информации о вебхуках
      let domain = config.server.domain;
      
      // Если домен уже содержит протокол, используем его как есть
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        console.log(`[server] VK Callback URL: ${domain}/vk/callback/${config.vk.callback_id}`);
        console.log(`[server] Chatwoot Webhook URL: ${domain}/chatwoot/webhook/${config.chatwoot.webhook_id}`);
      } else {
        // Для production через Traefik используем HTTPS без порта
        // Для разработки добавляем порт если он не стандартный
        if (config.server.node_env === 'production') {
          console.log(`[server] VK Callback URL: https://${domain}/vk/callback/${config.vk.callback_id}`);
          console.log(`[server] Chatwoot Webhook URL: https://${domain}/chatwoot/webhook/${config.chatwoot.webhook_id}`);
        } else {
          const protocol = config.server.port === 443 ? 'https' : 'http';
          const port = config.server.port !== 80 && config.server.port !== 443 ? `:${config.server.port}` : '';
          
          console.log(`[server] VK Callback URL: ${protocol}://${domain}${port}/vk/callback/${config.vk.callback_id}`);
          console.log(`[server] Chatwoot Webhook URL: ${protocol}://${domain}${port}/chatwoot/webhook/${config.chatwoot.webhook_id}`);
        }
      }
    });
  } catch (error) {
    console.error('[server] Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[server] Received SIGTERM, shutting down gracefully');
  await vkAdapter.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[server] Received SIGINT, shutting down gracefully');
  await vkAdapter.stop();
  process.exit(0);
});

// Start the application
if (require.main === module) {
  startServer().catch(error => {
    console.error('[server] Failed to start application:', error);
    process.exit(1);
  });
}

export { app, startServer };