/*
 * Botbuilder v4 SDK - Conversation Flows.
 * 
 * This bot demonstrates how to use dialogs, waterfall, and prompts to manage conversation flows.
 * 
 * To run this bot:
 * 1) install these npm packages:
 * npm install --save restify
 * npm install --save botbuilder@preview
 * npm install --save botbuilder-dialogs@preview
 * 
 * 2) From VSCode, open the package.json file and
 * Update the property "main" to the name of the sample bot you want to run. 
 *    For example: "main": "conversation-flows/app.js" to run the this sample bot.
 * 3) run the bot in debug mode. 
 * 4) Load the emulator and point it to: http://localhost:3978/api/messages
 * 5) Send the message "hi" or "reserve table" to engage with the bot.
 *
 */ 

// Required packages for this bot
const { BotFrameworkAdapter, FileStorage, ConversationState, UserState, BotStateSet } = require('botbuilder');
const restify = require('restify');
const { DialogSet, TextPrompt, DatetimePrompt, NumberPrompt, ChoicePrompt } = require('botbuilder-dialogs');

// Create server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`${server.name} listening to ${server.url}`);
});

// Create adapter
const adapter = new BotFrameworkAdapter({ 
    appId: process.env.MICROSOFT_APP_ID, 
    appPassword: process.env.MICROSOFT_APP_PASSWORD 
});

// Storage
const storage = new FileStorage("c:/temp"); // Go to this directory to verify the persisted data
const conversationState = new ConversationState(storage);
const userState  = new UserState(storage);
adapter.use(new BotStateSet(conversationState, userState));

const dialogs = new DialogSet();

// Listen for incoming activity 
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        const isMessage = (context.activity.type === 'message');
        // State will store all of your information 
        const convo = conversationState.get(context);
        const dc = dialogs.createContext(context, convo);

        if (isMessage) {
            // Check for valid intents
            if(context.activity.text.match(/hello/ig)){
                await dc.begin('greetings');
            }
            else if(context.activity.text.match(/menu/ig)){
                await dc.begin('mainMenu');
            }
        }

        if(!context.responded){
            // Continue executing the "current" dialog, if any.
            await dc.continue();

            if(!context.responded && isMessage){
                // Default message
                await context.sendActivity("Hi! I'm a simple bot. Please say 'Hello' or 'Menu'.");
            }
        }
    });
});


// Greet user:
// Ask for the user name and then greet them by name.
// Ask them where they work.
dialogs.add('greetings',[
    async function (dc){
        await dc.prompt('textPrompt', 'What is your name?');
    },
    async function(dc, results){
        var userName = results;
        await dc.context.sendActivity(`Hi ${userName}!`);
        await dc.prompt('textPrompt', 'Where do you work?');
    },
    async function(dc, results){
        var workPlace = results;
        await dc.context.sendActivity(`${workPlace} is a fun place.`);
        await dc.end(); // Ends the dialog
    }
]);


// Display a menu and ask user to choose a menu item. Direct user to the item selected.
dialogs.add('mainMenu', [
    async function(dc){
        await dc.context.sendActivity("Welcome to Contoso Hotel and Resort.");
        await dc.prompt('choicePrompt', "How may we serve you today?", ['Order Dinner', 'Reserve a table']);
    },
    async function(dc, result){
        if(result.value.match(/order dinner/ig)){
            await dc.begin('orderDinner');
        }
        else if(result.value.match(/reserve a table/ig)){
            await dc.begin('reserveTable');
        }
        else {
            // Repeat the menu
            await dc.replace('mainMenu');
        }
    },
    async function(dc, result){
        // Start over
        await dc.endAll().begin('mainMenu');
    }
]);

// Order dinner:
// Help user order dinner from a menu

var dinnerMenu = {
    choices: ["Potato Salad - $5.99", "Tuna Sandwich - $6.89", "Clam Chowder - $4.50", 
        "Process order", "Cancel"],
    "Potato Salad - $5.99": {
        Description: "Potato Salad",
        Price: 5.99
    },
    "Tuna Sandwich - $6.89": {
        Description: "Tuna Sandwich",
        Price: 6.89
    },
    "Clam Chowder - $4.50": {
        Description: "Clam Chowder",
        Price: 4.50
    }

}

// The order cart
var orderCart = {
    orders: [],
    total: 0,
    clear: function(dc) {
        this.orders = [];
        this.total = 0;
        dc.context.activity.conversation.orderCart = null;
    }
};

dialogs.add('orderDinner', [
    async function (dc){
        await dc.context.sendActivity("Welcome to our Dinner order service.");
        orderCart.clear(dc); // Clears the cart.

        await dc.begin('orderPrompt'); // Prompt for orders
    },
    async function (dc, result) {
        if(result == "Cancel"){
            await dc.end();
        }
        else { 
            await dc.prompt('numberPrompt', "What is your room number?");
        }
    },
    async function(dc, result){
        await dc.context.sendActivity(`Thank you. Your order will be delivered to room ${result} within 45 minutes.`);
        await dc.end();
    }
]);

// Helper dialog to repeatedly prompt user for orders
dialogs.add('orderPrompt', [
    async function(dc){
        await dc.prompt('choicePrompt', "What would you like?", dinnerMenu.choices);
    },
    async function(dc, choice){
        if(choice.value.match(/process order/ig)){
            if(orderCart.orders.length > 0) {
                // Process the order
                // ...
                await dc.context.sendActivity("Processing your order.");
                await dc.end();
            }
            else {
                await dc.context.sendActivity("Your cart was empty. Please add at least one item to the cart.");
                // Ask again
                await dc.replace('orderPrompt');
            }
        }
        else if(choice.value.match(/cancel/ig)){
            orderCart.clear(dc);
            await dc.context.sendActivity("Your order has been canceled.");
            await dc.end(choice.value);
        }
        else {
            var item = dinnerMenu[choice.value];

            // Only proceed if user chooses an item from the menu
            if(!item){
                await dc.context.sendActivity("Sorry, that is not a valid item. Please pick one from the menu.");
                
                // Ask again
                await dc.replace('orderPrompt');
            }
            else {
                // Add the item to cart
                orderCart.orders.push(item);
                orderCart.total += item.Price;

                await dc.context.sendActivity(`Added to cart: ${choice.value}. <br/>Current total: $${orderCart.total}`);

                // Ask again
                await dc.replace('orderPrompt');
            }
        }
    }
]);

// Reserve a table:
// Help the user to reserve a table
var reservationInfo = {};

dialogs.add('reserveTable', [
    async function(dc, args, next){
        await dc.context.sendActivity("Welcome to the reservation service.");

        dc.activeDialog.state.reservationInfo = {}; // Clears any previous data
        await dc.prompt('dateTimePrompt', "Please provide a reservation date and time.");
    },
    async function(dc, result){
        dc.activeDialog.state.reservationInfo.dateTime = result[0].value;

        // Ask for next info
        await dc.prompt('partySizePrompt', "How many people are in your party?");
    },
    async function(dc, result){
        dc.activeDialog.state.reservationInfo.partySize = result;

        // Ask for next info
        await dc.prompt('textPrompt', "Who's name will this be under?");
    },
    async function(dc, result){
        dc.activeDialog.state.reservationInfo.reserveName = result;
        
        // Persist data
        var convo = conversationState.get(dc.context);
        convo.reservationInfo = dc.activeDialog.state.reservationInfo;

        // Confirm reservation
        var msg = `Reservation confirmed. Reservation details: 
            <br/>Date/Time: ${dc.activeDialog.state.reservationInfo.dateTime} 
            <br/>Party size: ${dc.activeDialog.state.reservationInfo.partySize} 
            <br/>Reservation name: ${dc.activeDialog.state.reservationInfo.reserveName}`;
            
        await dc.context.sendActivity(msg);
        await dc.end();
    }
]);

// Define prompts
// Generic prompts
dialogs.add('textPrompt', new TextPrompt());
dialogs.add('dateTimePrompt', new DatetimePrompt());
dialogs.add('numberPrompt', new NumberPrompt());
dialogs.add('choicePrompt', new ChoicePrompt());
dialogs.add('partySizePrompt', new NumberPrompt());
