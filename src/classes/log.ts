import LogLevel from "src/enums/log-level";
import getCurrentTime from "src/helpers/getCurrentTime";

class Log {
    logLevel: LogLevel;

	constructor(logLevel: LogLevel) {
		this.logLevel = logLevel;
	}

	private isObject(a: any) {
		return !!a && a.constructor === Object;
	};

	private isArray(a: any) {
		return !!a && a.constructor === Array;
	};

	trace(message: any) {
		if (this.isArray(message) || this.isObject(message))
			message = JSON.stringify(message);
		if (this.logLevel >= LogLevel.Trace ) {
			console.log(`[TRACE] ${getCurrentTime()} ${message}`);
		}
	}

	debug(message: any) {
		if (this.isArray(message) || this.isObject(message))
			message = JSON.stringify(message);
		if (this.logLevel >= LogLevel.Debug ) {
			console.log(`[DEBUG] ${getCurrentTime()} ${message}`);
		}
	}

	info(message: any) {
		if (this.isArray(message) || this.isObject(message))
			message = JSON.stringify(message);
		if (this.logLevel >= LogLevel.Info ) {
			console.log(`[INFO] ${getCurrentTime()} ${message}`);
		}
	}

	warn(message: any) {
		if (this.isArray(message) || this.isObject(message))
			message = JSON.stringify(message);
		if (this.logLevel >= LogLevel.Warning ) {
			console.log(`[WARN] ${getCurrentTime()} ${message}`);
		}
	}

	error(message: any) {
		if (this.isArray(message) || this.isObject(message))
			message = JSON.stringify(message);
		if (this.logLevel >= LogLevel.Error ) {
			console.log(`[ERROR] ${getCurrentTime()} ${message}`);
		}
	}
}

export default Log;