import dotenv from 'dotenv';
import { VKConfig } from '@chatwoot-connectors/shared-types';

// Load environment variables
dotenv.config();

export interface AppConfig {
  vk: VKConfig;
  chatwoot: {
    api_access_token: string;
    account_id: number;
    base_url: string;
    webhook_id: string;
  };
  server: {
    port: number;
    host: string;
    domain: string;
  };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

export function loadConfig(): AppConfig {
  return {
    vk: {
      callback_id: getRequiredEnv('VK_CALLBACK_ID'),
      group_id: parseInt(getRequiredEnv('VK_GROUP_ID')),
      access_token: getRequiredEnv('VK_ACCESS_TOKEN'),
      secret: getRequiredEnv('VK_SECRET'),
      confirmation: getRequiredEnv('VK_CONFIRMATION'),
      api_version: getOptionalEnv('VK_API_VERSION', '5.199'),
      inbox_id: parseInt(getRequiredEnv('VK_INBOX_ID')),
    },
    chatwoot: {
      api_access_token: getRequiredEnv('CHATWOOT_API_ACCESS_TOKEN'),
      account_id: parseInt(getRequiredEnv('CHATWOOT_ACCOUNT_ID')),
      base_url: getRequiredEnv('CHATWOOT_BASE_URL'),
      webhook_id: getRequiredEnv('CHATWOOT_WEBHOOK_ID_VK'),
    },
    server: {
      port: parseInt(getOptionalEnv('PORT', '3000')),
      host: getOptionalEnv('HOST', '0.0.0.0'),
      domain: getOptionalEnv('DOMAIN', 'localhost'),
    },
  };
}