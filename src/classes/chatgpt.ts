import { randomUUID, createHash } from "node:crypto";
import { io } from "socket.io-client";
import getCurrentTime from "../helpers/getCurrentTime.js";
import LogLevel from "../enums/log-level.js";
import Log from "./log.js";
import ErrorType from "../enums/error-type.js";
import fs from "fs";
import path from "path";

class ChatGPT {
  private name: string = "default";
  private path: string;
  private ready: boolean;
  private socket: any;
  public sessionToken: string;
  public conversations: any[];
  public auth: any;
  private expires: number;
  private pauseTokenChecks: boolean;
  private log: Log;
  private signature: string;
  private proAccount: boolean = false;
  private intervalId: NodeJS.Timeout;
  private saveInterval: number = 1000 * 60; // 1 minute
  public onReady?(): void;
  public onConnected?(): void;
  public onDisconnected?(): void;
  public onError?(
    errorType: ErrorType,
    prompt: string,
    conversationId: string,
    parentId: string
  ): void;
  private configMovesDone: boolean = false;
  constructor(
    sessionToken: string,
    options: {
      name?: string;
      reconnection?: boolean;
      forceNew?: boolean;
      logLevel?: LogLevel;
      bypassNode?: string;
      proAccount?: boolean;
      configsDir?: string;
      saveInterval?: number;
    } = {
      name: "default",
      reconnection: true,
      forceNew: false,
      logLevel: LogLevel.Info,
      bypassNode: "https://gpt.pawan.krd",
      proAccount: false,
      configsDir: "configs",
      saveInterval: 1000 * 60,
    }
  ) {
    var { reconnection, forceNew, logLevel, proAccount, name, configsDir, saveInterval } =
    options;
    if (saveInterval) this.saveInterval = saveInterval;
    this.name = name ?? "default";
    this.path = `./${configsDir ?? "configs"}/${this.name}-chatgpt-io.json`;
    this.proAccount = proAccount;
    this.log = new Log(logLevel ?? LogLevel.Info);
    this.ready = false;
    this.sessionToken = sessionToken;
    let [newSignature, newSessionToken] = this.getSignature();
    this.signature = newSignature;
    this.socket = io(options.bypassNode ?? "https://gpt.pawan.krd", {
      query: {
        client: "nodejs",
        version: "1.1.1",
        versionCode: "111",
        signature: this.signature,
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
    this.conversations = [];
    this.auth = null;
    this.expires = Date.now();
    this.pauseTokenChecks = true;
    let targetDir = `./${configsDir ?? "configs"}`;
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);
    fs.readdir('./', (err, files) => {
      if (err) throw err;
      files.forEach(file => {
        if (file.endsWith('-chatgpt-io.json')) {
          fs.rename(file, path.join(targetDir, file), err => {
            if (err) throw err;
            console.log(`Moved ${file} to ${targetDir}`);
          });
        }
      });
      this.configMovesDone = true;
    });
    this.load();
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
      if (!this.auth) {
        await this.getTokens();
        this.pauseTokenChecks = false;
        return;
      }
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
    this.intervalId = setInterval(() => {
      this.save();
    }, this.saveInterval);
    process.on("beforeExit", async () => {
      clearInterval(this.intervalId);
      if (this.ready) await this.save();
    });
  }

  private getSignature(): [string, string]{
    let hash = createHash("md5");
    hash.update(this.sessionToken);
    return [hash.digest("hex"), this.sessionToken.toString()];
  }

  private async load() {
    while (!this.configMovesDone) {
      await this.wait(25);
    }
    this.pauseTokenChecks = true;
    if (!fs.existsSync(this.path)) {
      await this.wait(1000);
      this.pauseTokenChecks = false;
      return;
    }
    let [newSignature, newSessionToken] = this.getSignature();
    let data = await fs.promises.readFile(this.path, "utf8");
    let json = JSON.parse(data);
    for (let key in json) {
      if (key === "signature") continue;
      this[key] = json[key];
    }
    await this.wait(1000);
    if (newSignature !== json["signature"]) {
      this.log.warn("Session token changed, re-authenticating the new session token...");
      this.auth = null;
      this.sessionToken = newSessionToken;
    }
    if (this.auth) this.ready = true;
    this.pauseTokenChecks = false;
  }

  public async save() {
    let result: any = {};
    for (let key in this) {
      if (key === "pauseTokenChecks") continue;
      if (key === "ready") continue;
      if (key === "name") continue;
      if (key === "path") continue;
      if (key === "saveInterval") continue;
      if (key === "configMovesDone") continue;
      if (
        this[key] instanceof Array ||
        typeof this[key] === "string" ||
        typeof this[key] === "number" ||
        typeof this[key] === "boolean"
      ) {
        result[key] = this[key];
      }
    }
    await fs.promises.writeFile(this.path, JSON.stringify(result, null, 4));
  }

  private isUUID(str: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  private addConversation(id: string, parentId?: string) {
    let conversation = {
      id: id,
      conversationId: this.isUUID(id) ? id : null,
      parentId: parentId ?? randomUUID(),
      lastActive: Date.now(),
    };
    this.conversations.push(conversation);
    this.save();
    return conversation;
  }

  private getConversationById(id: string, parentId?: string) {
    let conversation = this.conversations.find(
      (conversation) => conversation.id === id
    );
    if (!conversation) {
      conversation = this.addConversation(id, parentId);
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

  public async send(prompt: string, id: string = "default", parentId?: string){
    if (!this.auth || !this.validateToken(this.auth)) await this.getTokens();
    let conversation = this.getConversationById(id, parentId);
    let data: any = await new Promise((resolve) => {
      this.socket.emit(
        this.proAccount ? "askQuestionPro" : "askQuestion",
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
      this.processError(data.error, prompt, id, parentId);
      throw new Error(data.error);
    }
    else{
      conversation.parentId = data.messageId;
      conversation.conversationId = data.conversationId;
    }

    return data;
  }

  public async ask(prompt: string, id: string = "default", parentId?: string) {
    let data = await this.send(prompt, id, parentId);
    return data.answer;
  }

  private processError(
    error: any,
    prompt: string = null,
    conversationId: string = null,
    parentId: string = null
  ): void {
    let errorType = ErrorType.UnknownError;
    if (!error) {
      errorType = ErrorType.UnknownError;
    }
    if (typeof error !== "string") {
      errorType = ErrorType.UnknownError;
    }
    if (error.toLowerCase().includes("too many requests")) {
      errorType = ErrorType.AccountRateLimitExceeded;
    }
    if (error.toLowerCase().includes("try refreshing your browser")) {
      errorType = ErrorType.UnknownError;
    }
    if (error.toLowerCase().includes("too long")) {
      errorType = ErrorType.MessageTooLong;
    }
    if (error.toLowerCase().includes("one message at a time")) {
      errorType = ErrorType.AnotherMessageInProgress;
    }
    if (error.toLowerCase().includes("expired")) {
      errorType = ErrorType.SessionTokenExpired;
    }

    if (this.onError) this.onError(errorType, prompt, conversationId, parentId);
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
    await this.save();
  }

  public async disconnect() {
    clearInterval(this.intervalId);
    await this.save();
    return await this.socket.disconnect(true);
  }
}

export default ChatGPT;
