import ChatGPT from "../dist/index.js";
import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let bot = new ChatGPT("<SESSION_TOKEN>");

while (true) {
    let prompt = await new Promise((resolve) => {
        rl.question("You: ", (answer) => {
            resolve(answer);
        });
    });

    process.stdout.write("ChatGPT: ");
    await bot.askStream(chunk => {
        process.stdout.write(chunk);
    }, prompt);
    console.log();
}