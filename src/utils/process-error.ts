import ErrorType from "../enums/error-type.js";

function ProcessError(error: string): ErrorType {
	if (!error) {
		return ErrorType.UnknownError;
	}
	if (typeof error !== "string") {
		return ErrorType.UnknownError;
	}
	if (error.toLowerCase().includes("too many requests")) {
		return ErrorType.AccountRateLimitExceeded;
	}
	if (error.toLowerCase().includes("try refreshing your browser")) {
		return ErrorType.UnknownError;
	}
	if (error.toLowerCase().includes("too long")) {
		return ErrorType.MessageTooLong;
	}
	if (error.toLowerCase().includes("one message at a time")) {
		return ErrorType.AnotherMessageInProgress;
	}
	if (error.toLowerCase().includes("expired")) {
		return ErrorType.SessionTokenExpired;
	}
	if (error.toLowerCase().includes("conversation not found")) {
		return ErrorType.ConversationNotFound;
	}
	return ErrorType.UnknownError;
}

export default ProcessError;
