
# Update 30-DEC-2022
## We have introduced a new method that utilizes a socket for faster performance without the need for a browser anymore. [[C# Version](https://github.com/PawanOsman/ChatGPT.Net)][[Python Version](https://github.com/PawanOsman/ChatGPT.py)]

## For support join [[Discord](https://discord.pawan.krd)]
# chatgpt-io - Unofficial API client for ChatGPT [[Discord](https://discord.pawan.krd)]

[![NPM](https://img.shields.io/npm/v/chatgpt-io.svg)](https://www.npmjs.com/package/chatgpt-io)
[![GitHub issues](https://img.shields.io/github/issues/pawanosman/chatgpt-io)](https://github.com/PawanOsman/ChatGPT.Net/issues)
[![GitHub forks](https://img.shields.io/github/forks/pawanosman/chatgpt-io)](https://github.com/pawanosman/ChatGPT.Net/network)
[![GitHub stars](https://img.shields.io/github/stars/pawanosman/chatgpt-io)](https://github.com/pawanosman/ChatGPT.Net/stargazers)
[![GitHub license](https://img.shields.io/github/license/pawanosman/chatgpt-io)](https://github.com/pawanosman/ChatGPT.Net)
[![Discord server](https://img.shields.io/discord/1055397662976905229?color=5865F2&logo=discord&logoColor=white)](https://discord.pawan.krd)

A simple Node.js module for interacting with the ChatGPT without using any **~~Browser~~**.
```javascript
const chatGPT = require("chatgpt-io");

(async function(){
    let bot = new chatGPT("<SESSION_TOKEN>");
    await bot.waitForReady();

    let response = await bot.ask("Hello?");
    console.log(response)
})()
```
## How the new method working without a browser?
The new method operates without a browser by utilizing a server that has implemented bypass methods to function as a proxy. The library sends requests to the server, which then redirects the request to ChatGPT while bypassing Cloudflare and other bot detection measures. The server then returns the ChatGPT response, ensuring that the method remains effective even if ChatGPT implements changes to prevent bot usage. Our servers are continuously updated to maintain their bypass capabilities.

## Installation

To install the package, run the following command:

```bash
npm install chatgpt-io
``` 

## Usage

To use the package, require it in your code and create a new instance of the `chatGPT` class, passing in your ChatGPT API session token as an argument.

```javascript
const chatGPT = require("chatgpt-io");

let bot = new chatGPT("<SESSION_TOKEN>");
``` 

Before making any requests to the API, you should wait for the `bot` instance to be ready by calling the `waitForReady` method. This ensures that the connection to the API has been established and any necessary setup has been completed.

```javascript
await bot.waitForReady();
``` 

Once the `bot` instance is ready, you can send a message to the API using the `ask` method. This method takes a message string as its first argument and an optional conversation ID as its second argument. If a conversation ID is not provided, the default conversation will be used.

```javascript
let response = await bot.ask("Hello?");
console.log(response);

let response2 = await bot.ask("Hello?", "any-unique-string");
console.log(response2);
```

The `ask` method returns a promise that resolves with the API's response to the message.

## API Reference

### `ChatGPT` class

#### `constructor(sessionToken: string)`

Creates a new instance of the `ChatGPT` class.

##### Parameters

-   `sessionToken` (string): Your ChatGPT API session token.

#### `waitForReady(): Promise<void>`

Waits for the `chatGPT` instance to be ready to make requests to the API. Returns a promise that resolves when the instance is ready.

#### `ask(message: string, conversationId?: string): Promise<string>`

Sends a message to the API and returns a promise that resolves with the API's response.

##### Parameters

-   `message` (string): The message to send to the API.
-   `conversationId` (string, optional): The ID of the conversation to send the message to. If not provided, the default conversation will be used.

## Example

Here is an example of how to use the `chatgpt-io` module to send a message to the API and log the response:

```javascript
const chatGPT = require("chatgpt-io");

(async function(){
    let bot = new chatGPT("<SESSION_TOKEN>");
    await bot.waitForReady();

    // default conversation
    let response = await bot.ask("Hello?");
    console.log(response)

    // specific conversation
    let response2 = await bot.ask("Hello?", "any-unique-string");
    console.log(response2)
})()
```

## Server Example

In `examples/server.js` you can find an example of how to use the `chatgpt-io` module to create a simple Fastify server that can be used to send messages to ChatGPT.

Run the server by setting the `CHATGPT_SESSION_TOKEN` environment variable to your ChatGPT API session token and running the following command:

```bash
node examples/server.js
```

You can also set the port with the `CHATGPT_PORT` environment variable. The default port is `3000`.

To send a message to the server, make a `POST` request to `http://localhost:<port>/ask` with the following JSON body:

```json
{
    "message": "Hello?",
    "conversation_id": "any-unique-string"
}
```

A standalone version of this API server can be found at [chatgpt-io-api](https://github.com/waylaidwanderer/chatgpt-io-api).
