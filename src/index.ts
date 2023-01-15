import ChatGPT from "./classes/chatgpt.js";
import Log from "./classes/log.js";
import ErrorType from "./enums/error-type.js";
import LogLevel from "./enums/log-level.js";
import getCurrentTime from "./helpers/getCurrentTime.js";

export default ChatGPT;
export { getCurrentTime, ErrorType, Log, LogLevel };
