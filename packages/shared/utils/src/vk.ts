import { VKUserProfile, VKApiResponse } from '@chatwoot-connectors/shared-types';

/**
 * Fetch minimal VK profile data needed for enrichment:
 * - first_name, last_name (for contact.name)
 * - bdate (for custom attribute vk_bdate)
 */
export async function fetchVkProfile(
  accessToken: string, 
  apiVersion: string, 
  userId: string
): Promise<VKUserProfile> {
  const url = 'https://api.vk.com/method/users.get';
  // Request all available public profile fields
  const fields = [
    'photo_50', 'photo_100', 'photo_200_orig', 'photo_max',
    'online', 'online_mobile', 'verified',
    'sex', 'bdate', 'city', 'country',
    'home_town', 'screen_name',
    'has_photo', 'has_mobile',
    'status',
    'last_seen',
    'relation',
    'universities', 'schools',
    'occupation',
    'site', 'facebook', 'twitter', 'instagram',
    'timezone'
  ].join(',');
  
  const params = new URLSearchParams({
    user_ids: userId,
    fields: fields,
    access_token: accessToken,
    v: apiVersion,
  });

  try {
    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as VKApiResponse<VKUserProfile[]>;
    
    if (data.error) {
      const err = data.error;
      console.error(`[vk] API error ${err.error_code}: ${err.error_msg}`);
      throw new Error(`VK API error ${err.error_code}: ${err.error_msg}`);
    }

    return data.response?.[0] || {} as VKUserProfile;
  } catch (e) {
    console.warn(`[vk] users.get failed:`, e);
    return {} as VKUserProfile;
  }
}

/**
 * Safe dict traversal utility
 */
export function dig(src: any, ...path: string[]): any {
  let cur: any = src;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null || !(key in cur)) {
      return undefined;
    }
    cur = cur[key];
  }
  return cur;
}

/**
 * Generate random ID for VK API calls
 */
export function generateRandomId(): number {
  return Math.floor(Math.random() * 2**31);
}

/**
 * Extract city name from VK profile
 */
export function extractCityName(cityInfo: any): string | undefined {
  if (typeof cityInfo === 'object' && cityInfo !== null) {
    return (cityInfo.title || '').trim() || undefined;
  }
  if (typeof cityInfo === 'string') {
    return cityInfo.trim() || undefined;
  }
  return undefined;
}

/**
 * Format VK user name
 */
export function formatVkName(firstName: string, lastName: string, screenName?: string): string {
  const name = `${firstName || ''} ${lastName || ''}`.trim();
  return name || screenName || '';
}