interface Conversation {
	id: string;
	conversationId?: string;
	parentId: string;
	lastActive: number;
}

export default Conversation;
