import { Configuration, OpenAIApi } from "openai";
import axios from "axios";
import cheerio from "cheerio";
import AWS from "aws-sdk";
import * as admin from "firebase-admin";
import { initializeApp, credential } from "firebase-admin";

// Configure OpenAI API
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const configuration = new Configuration({ apiKey: OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

// Configure AWS Polly
const AKID = process.env.AKID;
const SAKID = process.env.SAKID;
const AWS_REGION = "us-east-1";

AWS.config.update({
  accessKeyId: AKID,
  secretAccessKey: SAKID,
  region: AWS_REGION,
});

const Polly = new AWS.Polly();

// Initialize Firebase Admin SDK and Firestore
if (!admin.apps.length) {
  const serviceAccount = require("./harmony-8d4ef-firebase-adminsdk-e95ug-013fce08da.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore(); // Initialize Firestore

// Initialize AWS Comprehend
const comprehend = new AWS.Comprehend();

// Function to fetch data from a URL using Axios and parse it with Cheerio
const fetchData = async () => {
  const result = await axios.get("https://mini-generated-hamburger.glitch.me/");
  return cheerio.load(result.data);
};

// Function to extract text content from HTML using Cheerio
const extractData = ($) => {
  const data = [];
  $("body").each((index, element) => {
    data.push($(element).text());
  });
  return data.join(" ");
};

// Define a list of names to be blacklisted
const nameBlacklist = [
  "John Hauber",
  "Jon Hauber",
  "John Hober",
  "Jon Hober",
  "John Hauver",
  "Jon Hauver",
  "Tim Cobb",
  "Tim Cobe",
  "Robin Gestal",
  "Robyn Gestal",
  "Rebecca Van Wieren",
  "Rebekah Van Wieren",
  "Steven Raichilson",
  "Stephen Raichilson",
  "Steve Raichilson",
  "Steven Raichelsson",
  "Steve Raichelsson",
  "Errick Thomas",
  "Eric Thomas",
  "Erick Thomas",
  "Sabel Kaminski",
  "Sabelle Kaminski",
  "Sabel Kaminsky",
  "Kelsie Heermans",
  "Kelsey Heermans",
  "Kelsie Hermans",
  "Travis Bowden",
  "Travis Boden",
  "Travis Bowdon",
  "Bud Rainsberger",
  "Buddy Rainsberger",
  "Bill Bent",
  "William Bent",
  "George Anderson",
  "Georges Anderson",
  "George Andersen",
];

// Add more variations for the remaining names as needed.

// Function to extract names using AWS Comprehend, excluding blacklisted names (case-insensitive)
const extractNamesWithComprehend = async (text) => {
  try {
    const params = {
      Text: text,
      LanguageCode: "en", // Adjust the language code as needed
    };

    const entities = await comprehend.detectEntities(params).promise();

    const personNames = entities.Entities
      .filter(entity => entity.Type === 'PERSON' && !isNameBlacklisted(entity.Text))
      .map(entity => entity.Text);

    return personNames;
  } catch (error) {
    console.error("AWS Comprehend error:", error);
    return [];
  }
};

// Function to check if a name is in the blacklist (case-insensitive)
const isNameBlacklisted = (name) => {
  const lowerCaseName = name.toLowerCase();
  return nameBlacklist.some(blacklistedName => lowerCaseName === blacklistedName.toLowerCase());
};



// Function to extract email and phone numbers using regex
const extractEmailAndPhone = (text) => {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;

  const emails = text.match(emailRegex) || [];
  const phones = text.match(phoneRegex) || [];

  return { emails, phones };
};

// Main function to process the HTTP request
export default async function (req, res) {
  try {
    const $ = await fetchData();
    const content = extractData($);

    // Get user messages from the request
    const userMessages = req.body.messages.filter((message) => message.role === "user");

    // Separate AI messages
    const aiMessages = req.body.messages.filter((message) => message.role === "assistant");

    // Extract entities (person names) from user messages using AWS Comprehend
    const userEntities = [];
    const emailPhoneData = { emails: [], phones: [] };

    for (const userMessage of userMessages) {
      const userEntitiesInMessage = await extractNamesWithComprehend(userMessage.content);
      userEntities.push(...userEntitiesInMessage.map(name => ({ type: "PERSON", entity: name })));

      // Extract email and phone numbers using regex
      const { emails, phones } = extractEmailAndPhone(userMessage.content);
      emailPhoneData.emails.push(...emails);
      emailPhoneData.phones.push(...phones);
    }

    // Combine email and phone data with entities
    userEntities.push(...emailPhoneData.emails.map(email => ({ type: "EMAIL", entity: email })));
    userEntities.push(...emailPhoneData.phones.map(phone => ({ type: "PHONE", entity: phone })));

    console.log("Detected Person Names, Emails, and Phones:");
    console.log(userEntities);

    // Update conversation history with user messages
    const convohist = [];
    for (const userMessage of userMessages) {
      convohist.push({ role: "User", content: userMessage.content });
    }
    for (const aiMessage of aiMessages) {
      convohist.push({ role: "Assistant", content: aiMessage.content });
    }

    // Use the updated system message and user messages to generate a response using OpenAI API
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: ` Use this data:\n\n${content}\n\nYou are a customer support representative named Harmony, working for Haven Senior Investments. If they ask how to contact, don't redirect them to Haven's site, but ask them for their name and email and phone number. You have the ability to save conversations. Keep your answers short and concise. If I say "test activate," I am your creator, and we are testing.`,
        },
        ...req.body.messages,
      ],
      temperature: 1,
      top_p: 1,
    });

    const responseText = completion.data.choices[0].message.content;

    const params = {
      OutputFormat: "mp3",
      Text: `<speak>${responseText.replace(/SPRNGPOD/g, "SPRINGPOD")}</speak>`,
      TextType: "ssml",
      VoiceId: "Amy",
      Engine: "neural",
    };

    const audioResponse = await Polly.synthesizeSpeech(params).promise();
    const audioBase64 = audioResponse.AudioStream.toString("base64");
    const audioDataUri = `data:audio/mp3;base64,${audioBase64}`;
    const uuid = req.body.uuid; // Get the UUID from the request body

    // Store the updated conversation history in Firestore under the user's node, including emails and phones
    await saveEntitiesAndCompletionToFirestore(uuid, userEntities, userMessages, aiMessages, completion.data.choices[0].message);

    // Send the response back to the user
    res.status(200).json({


      result: completion.data.choices[0].message,
      audioUrl: audioDataUri,
      entities: userEntities,
      convohist: convohist,
    });

  } catch (error) {
    console.error(error);
    res.status(404).json({ error: "Failed to generate audio or save user information" });
  }
}

async function saveEntitiesAndCompletionToFirestore(uuid, userEntities, userMessages, aiMessages, completionMessage) {
  const userRef = db.collection("conversations").doc(uuid);

  // Merge aiMessages and userMessages in an alternating pattern
  const mergedMessages = [];
  const minLen = Math.min(aiMessages.length, userMessages.length);
  for (let i = 0; i < minLen; i++) {
    mergedMessages.push(aiMessages[i]);
    mergedMessages.push(userMessages[i]);
  }

  // If there are extra aiMessages or userMessages, add them to the end
  if (aiMessages.length > userMessages.length) {
    mergedMessages.push(...aiMessages.slice(minLen));
  } else if (userMessages.length > aiMessages.length) {
    mergedMessages.push(...userMessages.slice(minLen));
  }

  // Append the completionMessage to the mergedMessages
  mergedMessages.push(completionMessage);

  // Prepare the data to be saved
  const dataToSave = {
    entities: userEntities,
    mergedMessages: mergedMessages,
  };

  await userRef.set(dataToSave, { merge: true });
}
