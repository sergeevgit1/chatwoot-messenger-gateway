import { 
  ChatwootService as IChatwootService,
  ChatwootClient,
  ChatwootContact
} from '@chatwoot-connectors/shared-types';
import { fetchVkProfile, formatVkName, extractCityName } from '@chatwoot-connectors/shared-utils';
import { VKConfig } from '@chatwoot-connectors/shared-types';

export class ChatwootService implements IChatwootService {
  private readonly client: ChatwootClient;
  private readonly vkConfig: VKConfig;

  constructor(client: ChatwootClient, vkConfig: VKConfig) {
    this.client = client;
    this.vkConfig = vkConfig;
  }

  async ensureContact(params: {
    inbox_id: number;
    search_key: string;
    name?: string;
    phone?: string;
    email?: string;
    custom_attributes: Record<string, any>;
    additional_attributes?: Record<string, any>;
  }): Promise<{ id: number; source_id: string; vk_user_id?: string }> {
    /**
     * Upsert contact and return {'id', 'source_id'}.
     * Strategy:
     * - If custom_attributes contain platform user ids (vk_user_id), FIRST try /contacts/filter.
     * - Else try /contacts/search with search_key (e.g., phone for WhatsApp).
     * - If found -> update attributes (best effort).
     * - If not found -> create with inbox_id + attributes.
     */
    let contacts = [];

    const vkUserId = params.custom_attributes?.vk_user_id;
    const vkIdentifier = vkUserId ? `vk:${vkUserId}` : undefined;

    // 1) Attribute-based lookup
    const attrLookupKeys = [
      'vk_user_id',
      'telegram_user_id'
    ].filter(key => key in (params.custom_attributes || {}));

    if (attrLookupKeys.length > 0) {
      try {
        const filterParams = Object.fromEntries(
          attrLookupKeys.map(key => [key, params.custom_attributes[key]])
        );
        console.log('[chatwoot] filterContacts called with params:', JSON.stringify(filterParams, null, 2));
        const res = await this.client.filterContacts(filterParams);
        contacts = (res || {}).payload || [];
      } catch (e) {
        // Улучшенная обработка ошибки 422 - не прерываем процесс
        console.warn('[chatwoot] filter_contacts failed:', e);
        
        // Если это ошибка 422, логируем детали и продолжаем с searchContacts
        if (e instanceof Error && e.message.includes('status: 422')) {
          console.warn('[chatwoot] filter_contacts returned 422, falling back to search_contacts');
        } else {
          // Для других ошибок тоже продолжаем, но логируем
          console.warn('[chatwoot] filter_contacts error, falling back to search_contacts');
        }
      }
    }

    // 2) Fallback search
    if (contacts.length === 0) {
      try {
        const res = await this.client.searchContacts(params.search_key);
        contacts = (res || {}).payload || [];
      } catch (e) {
        console.warn('[chatwoot] search_contacts failed:', e);
      }
    }

    // 3) Update or create
    let contact: ChatwootContact;
    if (contacts.length > 0) {
      contact = contacts[0];
      const contactId = parseInt(String(contact.id));
      
      // Update attributes only if provided
      if (params.custom_attributes || params.additional_attributes !== undefined) {
        try {
          const updateParams = {
            contact_id: contactId,
            name: undefined,
            phone_number: undefined,
            email: undefined,
            identifier: vkIdentifier,
            custom_attributes: params.custom_attributes,
            additional_attributes: params.additional_attributes,
          };
          
          console.info('[chatwoot] Updating contact with params:', JSON.stringify(updateParams, null, 2));
          const updated = await this.client.updateContact(updateParams);
          console.info('[chatwoot] Update contact response:', JSON.stringify(updated, null, 2));
        } catch (e) {
          console.warn('[chatwoot] update_contact skipped:', e);
        }
      }

      // Optionally set name if empty
      if (params.name && !(contact.name || '').trim()) {
        try {
          await this.client.updateContact({
            contact_id: contactId,
            name: params.name,
          });
        } catch (e) {
          console.warn('[chatwoot] update name skipped:', e);
        }
      }
    } else {
      const createParams = {
        inbox_id: params.inbox_id,
        name: params.name || params.search_key,
        phone_number: params.phone,
        email: params.email,
        identifier: vkIdentifier,
        custom_attributes: params.custom_attributes || {},
        additional_attributes: params.additional_attributes || {},
      };
      
      console.info('[chatwoot] Creating contact with params:', JSON.stringify(createParams, null, 2));
      const created = await this.client.createContact(createParams);
      
      const payload = (created || {}).payload || {};
      contact = payload.contact || (created as any).contact || {};
      
      if (!contact && 'id' in (created || {})) {
        contact = created as any;
      }
    }

    // 4) Extract source_id and vk_user_id
    const sourceId = this.extractSourceIdForInbox(contact, params.inbox_id) || params.search_key;
    const extractedVkUserId = params.custom_attributes?.vk_user_id;
    console.info(
      `[chatwoot] ensure_contact ok id=${contact.id} inbox=${params.inbox_id} source_id=${sourceId} vk_user_id=${extractedVkUserId}`
    );
    
    return { 
      id: parseInt(String(contact.id)), 
      source_id: sourceId,
      vk_user_id: extractedVkUserId
    };
  }

  async ensureConversation(params: {
    inbox_id: number;
    contact_id: number;
    source_id: string;
    vk_user_id?: string;
    custom_attributes?: Record<string, any>;
  }): Promise<number> {
    const res = await this.client.listConversations(params.contact_id);
    const conversations = (res || {}).payload || [];

    // Find existing open/pending conversation for this VK user
    for (const conv of conversations) {
      if (conv.status !== 'open' && conv.status !== 'pending') {
        continue;
      }
      
      // Check if conversation belongs to the same inbox
      if (conv.inbox_id && parseInt(String(conv.inbox_id)) !== params.inbox_id) {
        continue;
      }
      
      // For VK conversations, match by vk_user_id in custom_attributes
      const convVkUserId = conv.custom_attributes?.vk_user_id;
      if (params.vk_user_id && convVkUserId === params.vk_user_id) {
        console.info(`[chatwoot] reuse conversation id=${conv.id} for vk_user_id=${params.vk_user_id}`);
        return parseInt(String(conv.id));
      }
      
      // Fallback: match by source_id
      const nestedSourceId = conv.source_id;
      if (nestedSourceId === params.source_id) {
        console.info(`[chatwoot] reuse conversation id=${conv.id} by source_id=${params.source_id}`);
        return parseInt(String(conv.id));
      }
    }

    const extra: Record<string, any> = {};
    const customAttrs = { ...(params.custom_attributes || {}) };
    
    // Always store vk_user_id in conversation custom_attributes for future matching
    if (params.vk_user_id) {
      customAttrs.vk_user_id = params.vk_user_id;
    }
    
    if (Object.keys(customAttrs).length > 0) {
      extra.custom_attributes = customAttrs;
    }

    const created = await this.client.createConversation({
      inbox_id: params.inbox_id,
      source_id: params.source_id,
      contact_id: params.contact_id,
      ...extra,
    });
    
    const convId = (created || {}).id || (
      (created || {}).payload || {}
    ).id;
    
    console.info(`[chatwoot] create conversation id=${convId} inbox=${params.inbox_id}`);
    return parseInt(String(convId));
  }

  async createMessage(params: {
    conversation_id: number;
    content: string;
    direction: 'incoming' | 'outgoing';
  }): Promise<number> {
    const messageType = params.direction === 'incoming' ? 'incoming' : 'outgoing';
    const res = await this.client.sendMessage({
      conversation_id: params.conversation_id,
      content: params.content || '',
      message_type: messageType,
    });
    
    const msgId = (res || {}).id || ((res || {}).payload || {}).id;
    console.info(`[chatwoot] create_message id=${msgId} type=${messageType}`);
    return parseInt(String(msgId));
  }

  async enrichVkContact(fromId: string): Promise<{
    name?: string;
    custom_attributes: Record<string, any>;
    additional_attributes: Record<string, any>;
  }> {
    let vkName: string | undefined;
    const customAttributes: Record<string, any> = { vk_user_id: fromId };
    const additionalAttributes: Record<string, any> = {};

    try {
      const profile = await fetchVkProfile(
        this.vkConfig.access_token,
        this.vkConfig.api_version,
        fromId
      );
      console.info('[vk] fetchVkProfile response for user', fromId, ':', JSON.stringify(profile, null, 2));
      
      const firstName = (profile.first_name || '').trim();
      const lastName = (profile.last_name || '').trim();
      const screenName = (profile.screen_name || '').trim();
      
      vkName = formatVkName(firstName, lastName, screenName);

      // Basic info
      if (profile.bdate) customAttributes.vk_bdate = profile.bdate;
      if (profile.screen_name) customAttributes.vk_screen_name = profile.screen_name;
      if (screenName) additionalAttributes.vk_profile_url = `https://vk.com/${screenName}`;
      
      // Location
      const cityName = extractCityName(profile.city);
      if (cityName) additionalAttributes.city = cityName;
      if (profile.country && typeof profile.country === 'object') {
        additionalAttributes.country = profile.country.title;
      }
      if (profile.home_town) additionalAttributes.home_town = profile.home_town;
      
      // Photos
      if (profile.photo_100) additionalAttributes.vk_photo_100 = profile.photo_100;
      if (profile.photo_200_orig) additionalAttributes.vk_photo_200 = profile.photo_200_orig;
      if (profile.photo_max) additionalAttributes.vk_photo_max = profile.photo_max;
      
      // Status and activity
      if (profile.status) additionalAttributes.vk_status = profile.status;
      if (profile.online !== undefined) {
        additionalAttributes.vk_online = profile.online === 1 ? 'Yes' : 'No';
        if (profile.online_mobile === 1) {
          additionalAttributes.vk_online_device = 'Mobile';
        }
      }
      if (profile.verified === 1) additionalAttributes.vk_verified = 'Yes';
      
      // Last seen
      if (profile.last_seen?.time) {
        const lastSeenDate = new Date(profile.last_seen.time * 1000);
        additionalAttributes.vk_last_seen = lastSeenDate.toISOString();
      }
      
      // Demographics
      if (profile.sex !== undefined) {
        const sexMap: Record<number, string> = { 0: 'Unknown', 1: 'Female', 2: 'Male' };
        additionalAttributes.vk_sex = sexMap[profile.sex] || 'Unknown';
      }
      if (profile.relation !== undefined) {
        const relationMap: Record<number, string> = {
          0: 'Not specified', 1: 'Single', 2: 'In a relationship',
          3: 'Engaged', 4: 'Married', 5: 'Complicated',
          6: 'Actively searching', 7: 'In love', 8: 'In a civil union'
        };
        additionalAttributes.vk_relation = relationMap[profile.relation] || 'Not specified';
      }
      
      // Education
      if (profile.universities && profile.universities.length > 0) {
        const uni = profile.universities[0];
        if (uni.name) additionalAttributes.vk_university = uni.name;
        if (uni.faculty_name) additionalAttributes.vk_faculty = uni.faculty_name;
        if (uni.graduation) additionalAttributes.vk_graduation_year = uni.graduation.toString();
      }
      
      // Occupation
      if (profile.occupation) {
        if (profile.occupation.name) additionalAttributes.vk_occupation = profile.occupation.name;
        if (profile.occupation.type) additionalAttributes.vk_occupation_type = profile.occupation.type;
      }
      
      // Social networks
      if (profile.site) additionalAttributes.website = profile.site;
      if (profile.facebook) additionalAttributes.facebook = profile.facebook;
      if (profile.twitter) additionalAttributes.twitter = profile.twitter;
      if (profile.instagram) additionalAttributes.instagram = profile.instagram;
      
      // Timezone
      if (profile.timezone !== undefined) {
        additionalAttributes.vk_timezone = `UTC${profile.timezone >= 0 ? '+' : ''}${profile.timezone}`;
      }
      
    } catch (e) {
      console.warn('[vk] Failed to fetch profile:', e);
    }

    const result = {
      name: vkName || fromId,
      custom_attributes: customAttributes,
      additional_attributes: additionalAttributes,
    };
    
    console.info('[vk] enrichVkContact result:', JSON.stringify(result, null, 2));
    console.info('[vk] additional_attributes count:', Object.keys(additionalAttributes).length);
    
    return result;
  }

  private extractSourceIdForInbox(
    contact: ChatwootContact, 
    inboxId: number
  ): string | undefined {
    /** Find source_id for a specific inbox in contact_inboxes. */
    for (const ci of (contact.contact_inboxes || [])) {
      const inbox = (ci || {}).inbox || {};
      if (parseInt(String(inbox.id || 0)) === inboxId) {
        const sid = ci.source_id;
        if (sid) {
          return sid;
        }
      }
    }
    return undefined;
  }
}