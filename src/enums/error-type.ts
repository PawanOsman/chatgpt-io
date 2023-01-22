enum ErrorType {
	Timeout = 1,
	AccountRateLimitExceeded = 2,
	AnotherMessageInProgress = 3,
	SessionTokenExpired = 4,
	MessageTooLong = 5,
	UnknownError = 6,
}

export default ErrorType;