import ErrorType from "../enums/error-type.js";

interface Result<Type> {
	status: boolean;
	data: Type;
	errorType: ErrorType;
	error: string;
}

export default Result;
