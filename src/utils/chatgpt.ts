import axios from "axios";
import { randomUUID } from "crypto";
import AskResponse from "src/models/ask-response.js";
import Result from "src/models/result.js";
import ErrorType from "../enums/error-type.js";
import isObject from "./is-object.js";
import processError from "../utils/process-error.js";
import SessionResponse from "../models/session-response.js";

async function* chunksToLines(chunksAsync: any) {
	let previous = "";
	for await (const chunk of chunksAsync) {
		const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		previous += bufferChunk;
		let eolIndex: number;
		while ((eolIndex = previous.indexOf("\n")) >= 0) {
			// line includes the EOL
			const line = previous.slice(0, eolIndex + 1).trimEnd();
			if (line === "data: [DONE]") break;
			if (line.startsWith("data: ")) yield line;
			previous = previous.slice(eolIndex + 1);
		}
	}
}

async function* linesToMessages(linesAsync: AsyncGenerator<string, void, unknown>) {
	for await (const line of linesAsync) {
		const message = line.substring("data :".length);
		yield message;
	}
}

async function* streamCompletion(data: any) {
	yield* linesToMessages(chunksToLines(data));
}

async function sendMessage(callback: (arg0: string) => void, bypassNode: string, accessToken: string, model: string, prompt: string, parentMessageId: string, conversationId?: string): Promise<Result<AskResponse>> {
	let data = {
		action: "next",
		messages: [
			{
				id: randomUUID(),
				role: "user",
				content: {
					content_type: "text",
					parts: [prompt],
				},
			},
		],
		conversation_id: conversationId,
		parent_message_id: parentMessageId,
		model: model,
	};

	if (!conversationId) delete data.conversation_id;

	let result: Result<AskResponse> = {
		data: {
			answer: "",
			conversationId: "",
			messageId: "",
		},
		error: "",
		errorType: ErrorType.UnknownError,
		status: true,
	};

	try {
		let response = await axios.post(`${bypassNode}/backend-api/conversation`, data, {
			responseType: "stream",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${accessToken}`,
			},
		});

		let dataToReturn: any;

		if (response.headers["content-type"] === "application/json") {
			let dataCollected = await new Promise<string>((resolve) => {
				let dataChunks = "";
				response.data.on("data", (chunk: any) => {
					dataChunks += chunk;
				});
				response.data.on("end", () => {
					dataToReturn = JSON.parse(dataChunks);
					resolve(dataToReturn);
				});
			});
			dataToReturn = dataCollected;
		} else {
			let dataToReturnString = "";
			for await (const message of streamCompletion(response.data)) {
				try {
					const parsed = JSON.parse(message);
					let text = parsed.message.content.parts[0];
					dataToReturn = parsed;
					callback(text.replace(dataToReturnString, ""));
					dataToReturnString = text;
				} catch (error) {
					console.error("Could not JSON parse stream message", message, error);
				}
			}
		}

		dataToReturn = dataToReturn || response.data;

		result.data.answer = dataToReturn.message?.content.parts[0] ?? "";
		result.data.messageId = dataToReturn.message?.id ?? "";
		result.data.conversationId = dataToReturn.conversation_id;

		if (dataToReturn.detail) {
			if (isObject(dataToReturn.detail)) {
				if (dataToReturn.detail.message) {
					result.status = false;
					result.errorType = processError(dataToReturn.detail.message);
					result.error = dataToReturn.detail.message;
				}
			} else {
				result.status = false;
				result.errorType = processError(dataToReturn.detail);
				result.error = dataToReturn.detail;
			}
		} else if (dataToReturn.details) {
			if (isObject(dataToReturn.details)) {
				if (dataToReturn.details.message) {
					result.status = false;
					result.errorType = processError(dataToReturn.details.message);
					result.error = dataToReturn.details.message;
				}
			} else {
				result.status = false;
				result.errorType = processError(dataToReturn.details);
				result.error = dataToReturn.details;
			}
		} else {
			if (result.data.answer === "") {
				result.status = false;
				result.errorType = ErrorType.UnknownError;
				result.error = "Failed to get response. ensure your session token is valid and isn't expired.";
			}
		}
	} catch (err: any) {
		let dataToReturn = err.response?.data;
		if (dataToReturn?.detail) {
			if (isObject(dataToReturn?.detail)) {
				if (dataToReturn?.detail?.message) {
					result.status = false;
					result.errorType = processError(dataToReturn?.detail?.message);
					result.error = dataToReturn?.detail?.message;
				}
			} else {
				result.status = false;
				result.errorType = processError(dataToReturn?.detail);
				result.error = dataToReturn?.detail;
			}
		} else if (dataToReturn?.details) {
			if (isObject(dataToReturn?.details)) {
				if (dataToReturn?.details?.message) {
					result.status = false;
					result.errorType = processError(dataToReturn?.details?.message);
					result.error = dataToReturn?.details?.message;
				}
			} else {
				result.status = false;
				result.errorType = processError(dataToReturn?.details);
				result.error = dataToReturn?.details;
			}
		} else {
			if (result.data.answer === "") {
				result.status = false;
				result.errorType = ErrorType.UnknownError;
				result.error = "Failed to get response. ensure your session token is valid and isn't expired.";
			} else {
				result.status = false;
				result.errorType = ErrorType.UnknownError;
				result.error = err.toString();
			}
		}
	}

	return result;
}

function validateToken(token: string): boolean {
	if (!token) return false;
	const parsed = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
	return Date.now() <= parsed.exp * 1000;
}

async function getTokens(bypassNode: string, sessionToken: string): Promise<Result<SessionResponse>> {
	if (!sessionToken) {
		throw new Error("No session token provided");
	}

	let result: Result<SessionResponse> = {
		data: {
			auth: "",
			expires: "",
			sessionToken: "",
		},
		error: null,
		errorType: ErrorType.AccountRateLimitExceeded,
		status: false,
	};

	try {
		const response = await axios.request({
			method: "GET",
			url: `${bypassNode}/api/auth/session`,
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0",
				Cookie: `__Secure-next-auth.session-token=${sessionToken}`,
			},
		});
		const cookies = response.headers["set-cookie"];
		const sessionCookie = cookies.find((cookie) => cookie.startsWith("__Secure-next-auth.session-token"));
		result.data.auth = response.data.accessToken;
		result.data.expires = response.data.expires;
		result.data.sessionToken = sessionCookie.split("=")[1];
	} catch (err: any) {
		throw new Error(`Could not find or parse actual response text due to: ${err}`);
	}

	return result;
}

export { sendMessage, validateToken, getTokens };
