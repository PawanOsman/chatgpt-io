import chatGPT from "../dist/index.js";
import { createInterface } from "readline";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});
const readLineAsync = msg => {
  return new Promise(resolve => {
    readline.question(msg, userRes => {
      resolve(userRes);
    });
  });
}

(async () => {
  try {
    let bot = new chatGPT("<SESSION_TOKEN>");

    while (true) {
      let input = await readLineAsync("Input: ");
      let response = await bot.ask(input);

      if (response === "")
        break;

      console.log("ChatGPT: " + response + "\n");
    }
  } catch (err) {
    console.error(err);
  }
})();