import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";
import getCurrentTime from "../helpers/getCurrentTime.js";
import LogLevel from "../enums/log-level.js";
import Log from "./log.js";
import ErrorType from "../enums/error-type.js";

class ChatGPT {
  private ready: boolean;
  private socket: any;
  sessionToken: string;
  conversations: any[];
  private auth: any;
  private expires: number;
  private pauseTokenChecks: boolean;
  private log: Log;
  public onReady?(): void;
  public onConnected?(): void;
  public onDisconnected?(): void;
  public onError?(errorType: ErrorType): void;
  constructor(
    sessionToken: string,
    options: {
      reconnection: boolean;
      forceNew: boolean;
      logLevel: LogLevel;
      bypassNode: string;
    } = {
      reconnection: true,
      forceNew: false,
      logLevel: LogLevel.Info,
      bypassNode: "https://gpt.pawan.krd",
    }
  ) {
    var { reconnection, forceNew, logLevel } = options;
    this.log = new Log(logLevel ?? LogLevel.Info);
    this.ready = false;
    this.socket = io(options.bypassNode ?? "https://gpt.pawan.krd", {
      query: {
        client: "nodejs",
        version: "1.0.7",
        versionCode: "107",
      },
      transportOptions: {
        websocket: {
          pingInterval: 10000,
          pingTimeout: 5000,
        },
      },
      reconnection: reconnection ?? true,
      reconnectionAttempts: 100,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ["websocket", "polling"],
      upgrade: false,
      forceNew: forceNew ?? false,
    });
    this.sessionToken = sessionToken;
    this.conversations = [];
    this.auth = null;
    this.expires = Date.now();
    this.pauseTokenChecks = false;
    this.socket.on("connect", () => {
      if (this.onConnected) this.onConnected();
      this.log.info("Connected to server");
    });
    this.socket.on("disconnect", () => {
      if (this.onDisconnected) this.onDisconnected();
      this.log.info("Disconnected from server");
    });
    this.socket.on("serverMessage", (data: any) => {
      console.log(`[SERVER MESSAGE] ${getCurrentTime()} ${data}`);
    });
    setInterval(async () => {
      if (this.pauseTokenChecks) return;
      this.pauseTokenChecks = true;
      const now = Date.now();
      const offset = 2 * 60 * 1000;
      if (this.expires < now - offset || !this.auth) {
        await this.getTokens();
      }
      this.pauseTokenChecks = false;
    }, 500);
    setInterval(() => {
      const now = Date.now();
      this.conversations = this.conversations.filter((conversation) => {
        return now - conversation.lastActive < 1800000; // 2 minutes in milliseconds
      });
    }, 60000);
  }

  private addConversation(id: string) {
    let conversation = {
      id: id,
      conversationId: null,
      parentId: randomUUID(),
      lastActive: Date.now(),
    };
    this.conversations.push(conversation);
    return conversation;
  }

  private getConversationById(id: string) {
    let conversation = this.conversations.find(
      (conversation) => conversation.id === id
    );
    if (!conversation) {
      conversation = this.addConversation(id);
    } else {
      conversation.lastActive = Date.now();
    }
    return conversation;
  }

  public resetConversation(id: string = "default") {
    let conversation = this.conversations.find(
      (conversation) => conversation.id === id
    );
    if (!conversation) return;
    conversation.conversationId = null;
  }

  public wait(time: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

  public async waitForReady() {
    while (!this.ready) await this.wait(25);
    if (this.onReady) this.onReady();
    this.log.info("Ready!");
  }

  public async ask(prompt: string, id: string = "default") {
    if (!this.auth || !this.validateToken(this.auth)) await this.getTokens();
    let conversation = this.getConversationById(id);
    let data: any = await new Promise((resolve) => {
      this.socket.emit(
        "askQuestion",
        {
          prompt: prompt,
          parentId: conversation.parentId,
          conversationId: conversation.conversationId,
          auth: this.auth,
        },
        (data: any) => {
          resolve(data);
        }
      );
    });

    if (data.error) {
      this.log.error(data.error);
      this.processError(data.error);
      throw new Error(data.error);
    }

    conversation.parentId = data.messageId;
    conversation.conversationId = data.conversationId;

    return data.answer;
  }

  private processError(error: any): void {
    if (!error) {
      if (this.onError) this.onError(ErrorType.UnknownError);
      return;
    }
    if (typeof error !== "string") {
      if (this.onError) this.onError(ErrorType.UnknownError);
      return;
    }
    if (error.toLowerCase().includes("too many requests")) {
      if (this.onError) this.onError(ErrorType.AccountRateLimitExceeded);
    }
    // TODO: Add more error types
  }

  private validateToken(token: string) {
    if (!token) return false;
    const parsed = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );

    return Date.now() <= parsed.exp * 1000;
  }

  private async getTokens() {
    await this.wait(1000);
    let data: any = await new Promise((resolve) => {
      this.socket.emit("getSession", this.sessionToken, (data: any) => {
        resolve(data);
      });
    });
    if (data.error) {
      this.log.error(data.error);
      this.processError(data.error);
      throw new Error(data.error);
    }
    this.sessionToken = data.sessionToken;
    this.auth = data.auth;
    this.expires = data.expires;
    this.ready = true;
  }
  public async disconnect() {
    return await this.socket.disconnect(true);
  }
}

export default ChatGPT;
