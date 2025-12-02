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
app.use((req, res, next) => {
  console.info(`[server] ${req.method} ${req.url} - Headers:`, JSON.stringify(req.headers, null, 2));
  next();
});
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
    console.info('[server] VK callback received:', JSON.stringify(req.body, null, 2));
    const payload: VKCallbackPayload = req.body;
    const response = await vkAdapter.handleCallback(payload);
    
    console.info('[server] VK callback response:', response);
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
    console.info('[server] Chatwoot outgoing webhook payload:', JSON.stringify(payload, null, 2));
    
    // Skip private messages (internal notes)
    if (payload.private === true) {
      console.info('[server] Skipping private message (internal note)');
      return;
    }
    
    const content = payload.content || '';
    const conversation = payload.conversation || {};
    const meta = conversation.meta || {};
    const contactSender = meta.sender || {}; // This is the CONTACT (VK user), not the agent
    const contactInbox = conversation.contact_inbox || {};
    
    // Check channel - can be in conversation.channel or meta.channel
    const channel = conversation.channel || meta.channel || '';
    const channelLower = channel.toLowerCase();
    
    // VK channel can be "vk", "Channel::Api", or custom name
    // For API channels, we rely on custom_attributes to identify VK
    const isVkChannel = channelLower.includes('vk') || channelLower.includes('api');
    
    if (!isVkChannel) {
      console.info(`[server] Ignoring non-VK/API message: channel=${channel}`);
      return;
    }

    // Extract recipient_id from multiple possible locations
    let recipientId: string | undefined;
    
    // 1. Try conversation custom attributes (most reliable - we set this)
    recipientId = conversation.custom_attributes?.vk_user_id ||
                  conversation.custom_attributes?.vk_peer_id;
    
    // 2. Try contact (meta.sender) custom attributes
    if (!recipientId) {
      recipientId = contactSender.custom_attributes?.vk_user_id ||
                    contactSender.custom_attributes?.vk_peer_id;
    }
    
    // 3. Try contact additional attributes
    if (!recipientId) {
      recipientId = contactSender.additional_attributes?.vk_user_id;
    }
    
    // 4. Try to parse from contact_inbox.source_id (format: "vk:123456" or just "123456")
    if (!recipientId && contactInbox.source_id) {
      const sourceId = String(contactInbox.source_id);
      if (sourceId.startsWith('vk:')) {
        recipientId = sourceId.substring(3);
      } else if (/^\d+$/.test(sourceId)) {
        // If it's just digits, assume it's VK user ID
        recipientId = sourceId;
      }
    }
    
    // 5. Try contact ID as last resort (if it's a number)
    if (!recipientId && contactSender.id && /^\d+$/.test(String(contactSender.id))) {
      console.warn('[server] Using contact.id as fallback for VK user ID');
      recipientId = String(contactSender.id);
    }

    if (!recipientId) {
      console.error('[server] ❌ Missing VK recipient_id in Chatwoot webhook');
      console.error('[server] Channel:', channel);
      console.error('[server] Conversation ID:', conversation.id);
      console.error('[server] Conversation custom_attributes:', conversation.custom_attributes);
      console.error('[server] Contact (meta.sender):', {
        id: contactSender.id,
        name: contactSender.name,
        custom_attributes: contactSender.custom_attributes,
        additional_attributes: contactSender.additional_attributes
      });
      console.error('[server] Contact inbox:', contactInbox);
      return;
    }

    console.info(`[server] 📤 Sending to VK: recipient=${recipientId} content="${content}"`);
    await vkAdapter.sendText(String(recipientId), { type: 'text', text: content });
    
    console.info(`[server] ✅ Message sent to VK successfully`);
  } catch (error) {
    console.error('[server] ❌ Failed to send message to VK:', error);
    if (error instanceof Error) {
      console.error('[server] Error details:', error.message);
      console.error('[server] Stack trace:', error.stack);
    }
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Устанавливаем связь между VKAdapter и ChatwootService
    vkAdapter.onMessage(async (message) => {
      try {
        console.info('[server] Processing VK message:', JSON.stringify(message, null, 2));
        
        // Обогащаем контакт данными из VK
        const vkProfile = await chatwootService.enrichVkContact(message.sender_id || message.recipient_id);
        
        // Обеспечиваем наличие контакта в Chatwoot
        const contact = await chatwootService.ensureContact({
          inbox_id: config.vk.inbox_id,
          search_key: message.sender_id || message.recipient_id,
          name: vkProfile.name,
          custom_attributes: {
            ...vkProfile.custom_attributes,
            vk_peer_id: message.recipient_id
          },
          additional_attributes: vkProfile.additional_attributes
        });
        
        console.info('[server] Contact ensured:', contact);
        
        // Обеспечиваем наличие беседы
        const conversationId = await chatwootService.ensureConversation({
          inbox_id: config.vk.inbox_id,
          contact_id: contact.id,
          source_id: contact.source_id,
          vk_user_id: contact.vk_user_id,
          custom_attributes: {
            channel: 'vk',
            vk_peer_id: message.recipient_id
          }
        });
        
        console.info('[server] Conversation ensured:', conversationId);
        
        // Создаем сообщение в Chatwoot
        const messageId = await chatwootService.createMessage({
          conversation_id: conversationId,
          content: message.content.type === 'text' ? message.content.text : '',
          direction: 'incoming'
        });
        
        console.info('[server] Message created in Chatwoot:', messageId);
      } catch (error) {
        console.error('[server] Failed to process VK message:', error);
      }
    });
    
    await vkAdapter.start();
    
    app.listen(config.server.port, config.server.node_env === 'production' ? '0.0.0.0' : config.server.host, () => {
      console.log(`[server] VK Connector started on ${config.server.node_env === 'production' ? '0.0.0.0' : config.server.host}:${config.server.port}`);
      console.log(`[server] VK Group ID: ${config.vk.group_id}`);
      console.log(`[server] Chatwoot Account ID: ${config.chatwoot.account_id}`);
      
      // Вывод информации о вебхуках
      let domain = config.server.domain;
      
      // Если домен уже содержит протокол, используем его как есть
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        // Убираем порт из URL, если он есть, так как Traefik будет работать на стандартных портах
        const domainWithoutPort = domain.replace(/:\d+$/, '');
        console.log(`[server] VK Callback URL: ${domainWithoutPort}/vk/callback/${config.vk.callback_id}`);
        console.log(`[server] Chatwoot Webhook URL: ${domainWithoutPort}/chatwoot/webhook/${config.chatwoot.webhook_id}`);
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