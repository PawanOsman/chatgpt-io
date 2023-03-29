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
				author: {
					role: "user",
				},
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

		let dataToReturnString = "";
		for await (const message of streamCompletion(response.data)) {
			try {
				const parsed = JSON.parse(message);
				let text = parsed.message.content.parts[0];
				dataToReturn = parsed;
				if (text && text !== "") callback(text.replace(dataToReturnString, ""));
				dataToReturnString = text;
			} catch (error) {
				console.error("Could not JSON parse stream message", message, error);
			}
		}

		dataToReturn = dataToReturn || response.data;

		result.data.answer = dataToReturn.message?.content.parts[0] ?? "";
		result.data.messageId = dataToReturn.message?.id ?? "";
		result.data.conversationId = dataToReturn.conversation_id;
	} catch (error: any) {
		try {
			result.status = false;
			if (error.response && error.response.data) {
				let errorResponseStr = "";

				for await (const message of error.response.data) {
					errorResponseStr += message;
				}

				const errorResponseJson = JSON.parse(errorResponseStr);

				if (errorResponseJson.error) {
					result.error = errorResponseJson.error;
					result.errorType = processError(errorResponseJson.error);
				} else if (errorResponseJson.detail) {
					if (isObject(errorResponseJson.detail)) {
						result.error = errorResponseJson.detail.message;
						result.errorType = processError(errorResponseJson.detail.message);
					} else {
						result.error = errorResponseJson.detail;
						result.errorType = processError(errorResponseJson.detail);
					}
				} else if (errorResponseJson.details) {
					if (isObject(errorResponseJson.details)) {
						result.error = errorResponseJson.details.message;
						result.errorType = processError(errorResponseJson.details.message);
					} else {
						result.error = errorResponseJson.details;
						result.errorType = processError(errorResponseJson.details);
					}
				} else {
					result.error = error.message;
					result.errorType = processError(error.message);
				}
			} else {
				result.error = error.message;
				result.errorType = processError(error.message);
			}
		} catch (e) {
			console.log(e);
			result.status = false;
			result.error = error.message;
			result.errorType = processError(error.message);
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
		errorType: ErrorType.UnknownError,
		status: true,
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
		result.status = false;
		if (err.response && err.response.data) {
			if (err.response.data.error) {
				result.error = err.response.data.error;
				result.errorType = processError(err.response.data.error);
			} else if (err.response.data.detail) {
				if (isObject(err.response.data.detail)) {
					result.error = err.response.data.detail.message;
					result.errorType = processError(err.response.data.detail.message);
				} else {
					result.error = err.response.data.detail;
					result.errorType = processError(err.response.data.detail);
				}
			} else if (err.response.data.details) {
				if (isObject(err.response.data.details)) {
					result.error = err.response.data.details.message;
					result.errorType = processError(err.response.data.details.message);
				} else {
					result.error = err.response.data.details;
					result.errorType = processError(err.response.data.details);
				}
			} else {
				result.error = err.message;
				result.errorType = processError(err.message);
			}
		} else {
			result.error = err.message;
			result.errorType = processError(err.message);
		}
	}

	return result;
}

export { sendMessage, validateToken, getTokens };