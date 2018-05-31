const express = require('express');
const bodyParser = require('body-parser');
const request = require ('request');
const app = express();

// Takes token from Heroku. CHANGE BACK FOR DEPLOYMENT
const VERIFY_TOKEN = process.env.TOKEN;

// Page Access Token
const PAGE_ACCESS_TOKEN = process.env.PAGE_TOKEN

app.use(bodyParser.json())

// --Webhook--

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
      // Checks the mode and token sent is correct
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        // Responds with the challenge token from the request
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
      
      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);      
      }
    }
});

app.post('/webhook', (req, res) => {  

    // Parse the request body from the POST
    let body = req.body;
  
    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {
      // Iterate over each entry - there may be multiple if batched
      body.entry.forEach(function(entry) {
        // Gets the body of the webhook event
        let webhook_event = entry.messaging[0];
        console.log(webhook_event);
        // Get the sender PSID
        let sender_psid = webhook_event.sender.id;
        console.log('Sender PSID: ' + sender_psid);
        // Checks received event and passes event to respected handler function
        if (webhook_event.message) {
            handleMessage(sender_psid, webhook_event.message);        
        } else if (webhook_event.postback) {
            handlePostback(sender_psid, webhook_event.postback);
        }
        
      });
  
      // Return a '200 OK' response to all events
      res.status(200).send('EVENT_RECEIVED');
  
    } else {
      // Return a '404 Not Found' if event is not from a page subscription
      res.sendStatus(404);
    }
  
  });

// --Handler Functions--

// Handles messages events
function handleMessage(sender_psid, received_message) {
    let response;
    //Check if the message contains text
    if (received_message.text) {
        //Create the payload for a basic text message
        response = {
        "text": `You sent the message: ${received_message}, Now send me an Image!`
        }
    } else if (received_message.attachments) {
        // Get the URL of the message attachment
        let attachment_url = received_message.attachments[0].payload.url;
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Is this the right picture?",
                        "subtitle": "Tap a button to answer",
                        "image_url": attachment_url,
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Yes!",
                                "payload": "yes",
                            },
                            {
                                "type": "postback",
                                "title": "No!",
                                "payload": "no",
                            }
                        ],
                    }]
                }
            }
        }
    }

    // Sends the response message
    callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
    let response;
    let payload = received_postback.payload

    if(payload) {
        switch (payload) {
            case 'Greeting':
                userGreeting(sender_psid)
                break;
            
            default:
                callSendAPI(sender_psid, response);
        }
    }
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }
    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
            if (!err) {
                console.log('message sent!')
            } else {
                console.log("Unable to send message:" + err);
            }
         }
    );
}

function userGreeting(sender_psid) {
    console.log("user id is: " + sender_psid)
    let name;
    let response;

    request({
        "uri": "https://graph.facebook.com/v2.6/me/" + sender_psid,
        "qs": { 
            "access_token": PAGE_ACCESS_TOKEN,
            "fields": "first_name"
        },
        "method": "GET"
    }, (err, res, body) => {
            if (!err) {
                var bodyObj = JSON.parse(body);
                name = bodyObj.first_name;
                console.log("user's name: " + name );
                response = { "text": `Hello, ${name}. I am Dolores`}
                callSendAPI(sender_psid, response)
            } else {
                console.log("Unable to get name:" + err)
            }
    })
}

module.exports = app