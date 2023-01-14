import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";

class ChatGPT {
  ready: boolean;
  socket: any;
  sessionToken: string;
  conversations: any[];
  auth: any;
  expires: number;
  pauseTokenChecks: boolean;
  logs: boolean;
  on: any;
  constructor(
    sessionToken: string,
    bypassNode: string = "https://gpt.pawan.krd",
    options: {
      reconnection: boolean;
      forceNew: boolean;
      logs: boolean;
    } = {
      reconnection: true,
      forceNew: true,
      logs: true,
    }
  ) {
    var { reconnection, forceNew, logs } = options;
    this.ready = false;
    this.socket = io(bypassNode, {
      query: {
        client: "nodejs",
        version: "1.0.6",
        versionCode: "106",
      },
      transportOptions: {
        websocket: {
          pingInterval: 10000,
          pingTimeout: 5000,
        },
      },
      reconnection: reconnection,
      reconnectionAttempts: 100,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ["websocket", "polling"],
      upgrade: false,
      forceNew: forceNew,
    });
    this.sessionToken = sessionToken;
    this.conversations = [];
    this.auth = null;
    this.expires = Date.now();
    this.pauseTokenChecks = false;
    this.logs = logs;
    this.on = this.socket.on;
    this.socket.on("connect", () => {
      if (logs) {
        console.log("Connected to server");
      }
    });
    this.socket.on("disconnect", () => {
      if (logs) {
        console.log("Disconnected from server");
      }
    });
    this.socket.on("serverMessage", console.log);
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

  addConversation(id: string) {
    let conversation = {
      id: id,
      conversationId: null,
      parentId: randomUUID(),
      lastActive: Date.now(),
    };
    this.conversations.push(conversation);
    return conversation;
  }

  getConversationById(id: string) {
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

  resetConversation(id: string = "default") {
    let conversation = this.conversations.find(
      (conversation) => conversation.id === id
    );
    if (!conversation) return;
    conversation.conversationId = null;
  }

  wait(time) {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

  async waitForReady() {
    while (!this.ready) await this.wait(25);
    if (this.logs) {
      console.log("Ready!!");
    }
  }

  async ask(prompt: string, id: string = "default") {
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

    if (data.error) throw new Error(data.error);

    conversation.parentId = data.messageId;
    conversation.conversationId = data.conversationId;

    return data.answer;
  }

  validateToken(token: string) {
    if (!token) return false;
    const parsed = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );

    return Date.now() <= parsed.exp * 1000;
  }

  async getTokens() {
    await this.wait(1000);
    let data: any = await new Promise((resolve) => {
      this.socket.emit("getSession", this.sessionToken, (data) => {
        resolve(data);
      });
    });
    if (data.error) {
      throw new Error(data.error);
    }
    this.sessionToken = data.sessionToken;
    this.auth = data.auth;
    this.expires = data.expires;
    this.ready = true;
  }
}

export default ChatGPT;
