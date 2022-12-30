
# Update 30-DEC-2022
## We have introduced a new method that utilizes a socket for faster performance without the need for a browser anymore. [[C# Version](https://github.com/PawanOsman/ChatGPT.Net)]

# chatgpt-io

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
