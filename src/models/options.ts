import LogLevel from "../enums/log-level.js";

interface Options {
	name?: string;
	logLevel?: LogLevel;
	bypassNode?: string;
	model?: string;
	configsDir?: string;
	saveInterval?: number;
}

export default Options;
