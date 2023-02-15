interface MessageContent {
	content_type: string;
	parts: string[];
}

interface MessageMetadata {
	message_type: string;
	model_slug: string;
}

interface Message {
	id: string;
	role: string;
	user: any;
	create_time: any;
	update_time: any;
	content: MessageContent;
	end_turn: any;
	weight: number;
	metadata: MessageMetadata;
	recipient: string;
}

interface Conversation {
	message: Message;
	conversation_id: string;
	error: any;
}

export { Conversation };