enum ErrorType {
	Timeout = 1,
	AccountRateLimitExceeded = 2,
	AnotherMessageInProgress = 3,
	SessionTokenExpired = 4,
	MessageTooLong = 5,
	ConversationNotFound = 6,
	UnknownError = 7,
}

export default ErrorType;
