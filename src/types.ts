/** Configuration for the Telegram channel reader */
export interface TelegramReaderConfig {
  /** Telegram API ID from https://my.telegram.org */
  apiId: number;
  /** Telegram API Hash from https://my.telegram.org */
  apiHash: string;
  /** Session string for persistent auth (saved after first login) */
  session?: string;
  /** Channel username (without @) or numeric ID */
  channel: string;
}

/** A single post from a Telegram channel */
export interface TelegramPost {
  /** Telegram message ID */
  id: number;
  /** Unix timestamp */
  date: number;
  /** Message text content */
  text: string;
  /** URLs found in the message */
  urls: string[];
  /** Channel username or ID */
  channelId: string;
  /** Channel display title */
  channelTitle?: string;
  /** View count */
  views?: number;
  /** Forward count */
  forwards?: number;
}

/** Result of a channel fetch operation */
export interface FetchResult {
  /** Retrieved posts */
  posts: TelegramPost[];
  /** Latest message ID (use as offset for next fetch) */
  lastId: number;
  /** Channel title */
  channelTitle: string;
}
