const fastify = require("fastify");
const chatGPT = require("../src/index");

const app = fastify();

// Initialize chatbot with a session token
const bot = new chatGPT(process.env.CHATGPT_SESSION_TOKEN);

// Wait for chatbot to be ready
bot.waitForReady().then(() => {
    console.log("Chatbot is ready!");
});

// API route for asking the chatbot a question
app.post("/ask", async (req, res) => {
    // Get question and conversation_id from body parameters
    const { message, conversation_id } = req.body;

    // Return an error if the chatbot is not yet ready
    if (!bot.ready) {
        res.status(503).send({
            error: "Chatbot is not ready yet"
        });
        return;
    }

    // Use conversation_id if provided, otherwise use default conversation
    let response;
    if (conversation_id) {
        response = await bot.ask(message, conversation_id);
    } else {
        response = await bot.ask(message);
    }

    // Send response as JSON
    res.send({
        response: response
    });
});

const port = process.env.CHATGPT_PORT || 3000;
app.listen(port, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`API listening on port ${port}`);
});
