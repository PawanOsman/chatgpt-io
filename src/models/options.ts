import AccountType from "../enums/account-type.js";
import LogLevel from "../enums/log-level.js";

interface Options {
	name?: string;
	logLevel?: LogLevel;
	bypassNode?: string;
	accountType?: AccountType;
	configsDir?: string;
	saveInterval?: number;
}

export default Options;
