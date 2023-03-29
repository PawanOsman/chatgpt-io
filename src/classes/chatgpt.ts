import { randomUUID, createHash } from "node:crypto";
import LogLevel from "../enums/log-level.js";
import Log from "./log.js";
import ErrorType from "../enums/error-type.js";
import fs from "fs";
import Options from "../models/options.js";
import Conversation from "../models/conversation.js";
import wait from "../utils/wait.js";
import { sendMessage, getTokens, validateToken } from "../utils/chatgpt.js";

class ChatGPT {
	private options: Options;
	private path: string;
	public sessionToken: string;
	public conversations: Conversation[];
	public accessToken: string = null;
	private pauseTokenChecks: boolean;
	private log: Log;
	private signature: string;
	private intervalId: NodeJS.Timeout;
	public onError?(errorType: ErrorType, prompt?: string, conversationId?: string, parentId?: string): void;
	constructor(sessionToken: string, options?: Options) {
		this.options = {
			name: options?.name ?? "default",
			logLevel: options?.logLevel ?? LogLevel.Info,
			model: options?.model ?? "text-davinci-002-render-sha",
			saveInterval: options?.saveInterval ?? 1000 * 60,
			bypassNode: options?.bypassNode ?? "https://api.pawan.krd",
			configsDir: options?.configsDir ?? "configs",
		};

		this.path = `./${this.options.configsDir}/${this.options.name}-chatgpt-io.json`;
		this.log = new Log(this.options.logLevel);
		this.sessionToken = sessionToken;
		let [newSignature, newSessionToken] = this.getSignature();
		this.signature = newSignature;
		this.conversations = [];
		this.pauseTokenChecks = true;
		let targetDir = `./${this.options.configsDir}`;
		if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);
		this.load();
		setInterval(async () => {
			if (this.pauseTokenChecks) return;
			this.pauseTokenChecks = true;
			if (!this.accessToken) {
				await this.getTokens();
				this.pauseTokenChecks = false;
				return;
			}
			if (!this.accessToken || !validateToken(this.accessToken)) return await this.getTokens();
			this.pauseTokenChecks = false;
		}, 3000);
		setInterval(() => {
			const now = Date.now();
			this.conversations = this.conversations.filter((conversation) => {
				return now - conversation.lastActive < 1800000; // 2 minutes in milliseconds
			});
		}, 60000);
		this.intervalId = setInterval(() => {
			this.save();
		}, this.options.saveInterval);
		process.on("beforeExit", async () => {
			clearInterval(this.intervalId);
			await this.save();
		});
	}

	private getSignature(): [string, string] {
		let hash = createHash("md5");
		hash.update(this.sessionToken);
		return [hash.digest("hex"), this.sessionToken.toString()];
	}

	private async load() {
		this.pauseTokenChecks = true;
		if (!fs.existsSync(this.path)) {
			await wait(1000);
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
		await wait(1000);
		if (newSignature !== json["signature"]) {
			this.log.warn("Session token changed, re-authenticating the new session token...");
			this.accessToken = null;
			this.sessionToken = newSessionToken;
		}
		this.pauseTokenChecks = false;
	}

	public async save() {
		let result: any = {};
		for (let key in this) {
			if (key === "pauseTokenChecks") continue;
			if (key === "path") continue;
			if (key === "saveInterval") continue;
			if (key === "intervalId") continue;
			if (key === "log") continue;
			if (this[key] instanceof Array || this[key] instanceof Object || typeof this[key] === "string" || typeof this[key] === "number" || typeof this[key] === "boolean") {
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
		let conversation: Conversation = {
			id: id,
			conversationId: this.isUUID(id) ? id : null,
			parentId: this.isUUID(parentId) ? parentId : randomUUID(),
			lastActive: Date.now(),
		};
		this.conversations.push(conversation);
		this.save();
		return conversation;
	}

	private getConversationById(id: string, parentId?: string) {
		let conversation = this.conversations.find((conversation) => conversation.id === id);
		if (!conversation) {
			conversation = this.addConversation(id, parentId);
		} else {
			conversation.lastActive = Date.now();
		}
		return conversation;
	}

	public resetConversation(id: string = "default") {
		let conversation = this.conversations.find((conversation) => conversation.id === id);
		if (!conversation) return;
		conversation.conversationId = null;
	}

	public async send(callback: (arg0: string) => void, prompt: string, id: string = "default", parentId?: string) {
		if (!this.accessToken || !validateToken(this.accessToken)) await this.getTokens();
		let conversation = this.getConversationById(id, parentId);

		let result = await sendMessage(callback, this.options.bypassNode, this.accessToken, this.options.model, prompt, parentId ?? conversation.parentId, conversation.conversationId);

		if (!result.status) {
			this.log.error(result.error);
			if (this.onError) this.onError(result.errorType, prompt, conversation.conversationId, conversation.parentId);
			throw new Error(result.error);
		} else {
			conversation.parentId = result.data.messageId;
			conversation.conversationId = result.data.conversationId;
		}

		return result;
	}

	public async ask(prompt: string, id: string = "default", parentId?: string) {
		let result = await this.send((_) => {}, prompt, id, parentId);
		return result.data.answer;
	}

	public async askStream(callback: (arg0: string) => void, prompt: string, id: string = "default", parentId?: string) {
		let result = await this.send(callback, prompt, id, parentId);
		return result.data.answer;
	}

	private async getTokens() {
		await wait(1000);
		let result = await getTokens(this.options.bypassNode, this.sessionToken);
		if (!result.status) {
			this.log.error(result.error);
			if (this.onError) this.onError(result.errorType);
			throw new Error(result.error);
		}
		this.sessionToken = result.data.sessionToken;
		this.accessToken = result.data.auth;
		await this.save();
	}
}

export default ChatGPT;
