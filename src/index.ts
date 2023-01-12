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
  constructor(
    sessionToken: string,
    bypassNode: string = "https://gpt.pawan.krd"
  ) {
    this.ready = false;
    this.socket = io(bypassNode, {
      query: {
        client: "nodejs",
        version: "1.0.5",
        versionCode: "105",
      },
      transportOptions: {
        websocket: {
          pingInterval: 10000,
          pingTimeout: 5000,
        },
      },
      reconnection: true,
      reconnectionAttempts: 1000,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ["websocket", "polling"],
      upgrade: false,
      forceNew: true,
    });
    this.sessionToken = sessionToken;
    this.conversations = [];
    this.auth = null;
    this.expires = Date.now();
    this.pauseTokenChecks = false;
    this.socket.on("connect", () => {
      console.log("Connected to server");
    });
    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
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

  addConversation(id) {
    let conversation = {
      id: id,
      conversationId: null,
      parentId: randomUUID(),
      lastActive: Date.now(),
    };
    this.conversations.push(conversation);
    return conversation;
  }

  getConversationById(id) {
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

  resetConversation(id = "default") {
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
    console.log("Ready!!");
  }

  async ask(prompt, id = "default") {
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
        (data) => {
          resolve(data);
        }
      );
    });

    if (data.error) console.log(`Error: ${data.error}`);

    conversation.parentId = data.messageId;
    conversation.conversationId = data.conversationId;

    return data.answer;
  }

  validateToken(token) {
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
      if (!this.auth) {
        // The provided token is invalid, throw error
        throw new Error(data.error);
      }
      console.log(`Error: ${data.error}`);
    }
    this.sessionToken = data.sessionToken;
    this.auth = data.auth;
    this.expires = data.expires;
    this.ready = true;
  }
}

module.exports = ChatGPT;
