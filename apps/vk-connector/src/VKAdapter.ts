import fetch from 'node-fetch';
import { 
  MessengerAdapter, 
  UnifiedMessage, 
  TextContent, 
  OnMessage,
  AdapterCapabilities,
  VKCallbackPayload,
  VKMessage
} from '@chatwoot-connectors/shared-types';
import { VKConfig } from '@chatwoot-connectors/shared-types';
import { generateRandomId } from '@chatwoot-connectors/shared-utils';

export class VKAdapter implements MessengerAdapter {
  private readonly config: VKConfig;
  private onMessageCallback?: OnMessage;
  private http?: typeof fetch;

  constructor(config: VKConfig) {
    this.config = config;
  }

  onMessage(cb: OnMessage): void {
    this.onMessageCallback = cb;
  }

  async start(): Promise<void> {
    // Initialize HTTP client
    this.http = fetch;
    console.log('[vk] adapter started (callback API, text only)');
  }

  async stop(): Promise<void> {
    this.onMessageCallback = undefined;
    console.log('[vk] adapter stopped');
  }

  async sendText(recipientId: string, content: TextContent): Promise<void> {
    const text = content.text || '';
    if (!text) {
      console.info('[vk] skip send: empty text');
      return;
    }

    try {
      const randomId = generateRandomId();
      const params = new URLSearchParams({
        peer_id: recipientId,
        message: text,
        random_id: randomId.toString(),
        access_token: this.config.access_token,
        v: this.config.api_version,
        group_id: this.config.group_id.toString(),
      });

      const response = await this.http!(`https://api.vk.com/method/messages.send?${params}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (data.error) {
        const err = data.error;
        console.error(`[vk] API error ${err.error_code}: ${err.error_msg}`);
        throw new Error(`VK API error ${err.error_code}: ${err.error_msg}`);
      }

      // Success: VK returns message ID or an array
      console.info(`[vk] SENT: peer_id=${recipientId} message_id=${data.response}`);
    } catch (e) {
      console.error(`[vk] Failed to send text to ${recipientId}:`, e);
    }
  }

  async handleCallback(payload: VKCallbackPayload): Promise<string> {
    const eventType = payload.type;
    const groupId = payload.group_id;
    const secret = payload.secret;

    console.info(`[vk] event received: type=${eventType} group_id=${groupId}`);

    // Handle confirmation (no secret required)
    if (eventType === 'confirmation') {
      if (groupId !== this.config.group_id) {
        throw new Error('Invalid group_id');
      }
      return this.config.confirmation;
    }

    // For all other events, verify secret and group_id
    if (secret !== this.config.secret) {
      throw new Error('Invalid secret');
    }
    if (groupId !== this.config.group_id) {
      throw new Error('Invalid group_id');
    }

    if (eventType === 'message_new') {
      await this.handleMessageNew(payload);
    } else {
      // Acknowledge other events to prevent VK retries
      console.info(`[vk] ignored event type: ${eventType}`);
    }

    // VK requires literal 'ok' to acknowledge processing
    return 'ok';
  }

  private async handleMessageNew(payload: VKCallbackPayload): Promise<void> {
    if (!this.onMessageCallback || !payload.object?.message) {
      return;
    }

    const message = payload.object.message;
    const text = (message.text || '').trim();
    const peerId = message.peer_id?.toString() || '';
    const fromId = message.from_id?.toString() || peerId;
    const messageId = message.id?.toString();

    if (!peerId) {
      console.debug('[vk] skip incoming: missing peer_id');
      return;
    }

    const content: TextContent = { type: 'text', text };
    const unifiedMessage: UnifiedMessage = {
      channel: 'vk',
      sender_id: fromId,
      recipient_id: peerId,
      content,
      raw: payload,
    };

    await this.onMessageCallback(unifiedMessage);
  }

  capabilities(): AdapterCapabilities {
    return new Set(['text']);
  }
}