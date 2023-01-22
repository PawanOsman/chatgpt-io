import chatGPT from "../dist/index.js";

(async function () {
  let bot = new chatGPT("<SESSION_TOKEN>");
  await bot.waitForReady();
  // default conversation
  let response = await bot.ask("Hello?");
  console.log(response);
})();
