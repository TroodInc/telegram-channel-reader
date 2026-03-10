import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/index.js";
import type { TelegramReaderConfig, TelegramPost, FetchResult } from "./types.js";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;

/** Extract URLs from message text and entities */
function extractUrls(message: Api.Message): string[] {
  const urls = new Set<string>();

  // Extract from text
  const textMatches = (message.message || "").match(URL_REGEX);
  if (textMatches) {
    for (const url of textMatches) urls.add(url);
  }

  // Extract from entities (MessageEntityUrl, MessageEntityTextUrl)
  if (message.entities) {
    for (const entity of message.entities) {
      if (entity.className === "MessageEntityTextUrl" && "url" in entity) {
        urls.add(entity.url as string);
      }
      if (entity.className === "MessageEntityUrl") {
        const urlText = (message.message || "").slice(
          entity.offset,
          entity.offset + entity.length
        );
        urls.add(urlText.startsWith("http") ? urlText : `https://${urlText}`);
      }
    }
  }

  return [...urls];
}

/**
 * Reads posts from a Telegram channel using the MTProto API (GramJS).
 *
 * Requires a Telegram API ID and Hash from https://my.telegram.org.
 * On first use, interactive authentication is required. The resulting
 * session string should be saved for subsequent runs.
 */
export class TelegramChannelReader {
  private client: TelegramClient;
  private config: TelegramReaderConfig;
  private connected = false;

  constructor(config: TelegramReaderConfig) {
    this.config = config;
    const session = new StringSession(config.session || "");
    this.client = new TelegramClient(session, config.apiId, config.apiHash, {
      connectionRetries: 3,
    });
  }

  /** Connect and authenticate. Interactive on first run. */
  async connect(): Promise<void> {
    if (this.connected) return;
    await this.client.start({
      phoneNumber: async () => {
        const input = await import("input");
        return input.default.text("Enter your phone number: ");
      },
      phoneCode: async () => {
        const input = await import("input");
        return input.default.text("Enter the code you received: ");
      },
      password: async () => {
        const input = await import("input");
        return input.default.text("Enter your 2FA password: ");
      },
      onError: (err: Error) => console.error("Auth error:", err),
    });
    this.connected = true;
  }

  /** Get the session string for persistence */
  getSession(): string {
    return (this.client.session as StringSession).save();
  }

  /**
   * Fetch posts from the configured channel.
   *
   * @param afterId - Only fetch messages with ID > afterId (incremental)
   * @param limit - Maximum number of messages to fetch (default 100)
   */
  async fetchPosts(afterId = 0, limit = 100): Promise<FetchResult> {
    if (!this.connected) await this.connect();

    const channel = await this.client.getEntity(this.config.channel);
    const channelTitle =
      "title" in channel ? (channel.title as string) : this.config.channel;

    const messages = await this.client.getMessages(channel, {
      limit,
      minId: afterId,
    });

    const posts: TelegramPost[] = messages
      .filter((msg): msg is Api.Message => msg instanceof Api.Message)
      .map((msg) => ({
        id: msg.id,
        date: msg.date,
        text: msg.message || "",
        urls: extractUrls(msg),
        channelId: this.config.channel,
        channelTitle,
        views: msg.views ?? undefined,
        forwards: msg.forwards ?? undefined,
      }))
      .sort((a, b) => a.id - b.id);

    const lastId = posts.length > 0 ? posts[posts.length - 1].id : afterId;

    return { posts, lastId, channelTitle };
  }

  /** Disconnect from Telegram */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }
}
