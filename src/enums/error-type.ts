enum ErrorType {
    ApiServerError = 0,
    OpenAIServerError = 1,
    AccountRateLimitExceeded = 2,
    AnotherMessageInProgress = 3,
    SessionTokenExpired = 4,
    UnknownError = 5,
}

export default ErrorType;