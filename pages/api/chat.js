import { Configuration, OpenAIApi } from "openai";
import axios from "axios";
import cheerio from "cheerio";
import AWS from "aws-sdk";
import * as admin from "firebase-admin";
import AWSComprehend from "aws-sdk/clients/comprehend";
import { initializeApp, credential } from "firebase-admin";
import { Firestore } from "@google-cloud/firestore";

// Configure OpenAI API
const OPENAI_API_KEY = "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";
const configuration = new Configuration({ apiKey: OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);



// Configure AWS Polly
const AKID = "AKIAYB34LVOBH4DIRYMW";
const SAKID = "5Xp4XcZvTBSbktWu+rJcfLWwol3Jiz7w9g8NEu/F";
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

// Function to extract entities using Amazon Comprehend
const extractEntitiesWithComprehend = async (text) => {
  const comprehend = new AWSComprehend({
    accessKeyId: AKID,
    secretAccessKey: SAKID,
    region: AWS_REGION,
  });

  const entities = [];
  const params = {
    LanguageCode: "en",
    Text: text,
  };

  try {
    const result = await comprehend.detectEntities(params).promise();
    const comprehendEntities = result.Entities;

    if (comprehendEntities) {
      comprehendEntities.forEach((entity) => {
        entities.push({ type: entity.Type.toLowerCase(), entity: entity.Text });
      });
    }
  } catch (error) {
    console.error("Failed to detect entities using Amazon Comprehend:", error);
  }

  return entities;
};

export default async function (req, res) {
  try {
    const $ = await fetchData();
    const content = extractData($);

    // Get user messages from the request
    const userMessages = req.body.messages.filter((message) => message.role === "user");

    // Extract entities from user messages using Amazon Comprehend
    const userEntities = [];
    for (const userMessage of userMessages) {
      const userEntitiesInMessage = await extractEntitiesWithComprehend(userMessage.content);
      userEntities.push(...userEntitiesInMessage);
    }

    console.log("Detected Entities:");
    console.log(userEntities);

    // Update conversation history with user messages
    const convohist = [];
    for (const userMessage of userMessages) {
      convohist.push({ role: "User", content: userMessage.content });
    }

    // Use the updated system message and user messages to generate a response using OpenAI API
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: ` Use this data:\n\n${content}\n\nYou are a customer support representative named Harmony, working for Haven Senior Investments. If they ask how to contact, don't redirect them to Haven's site, but ask them for their name and email. You have the ability to save conversations. Keep your answers short and concise`,
        },
        ...req.body.messages,
      ],
      temperature: 1,
      top_p: 1,
   
    });

    // Extract the response text from the completion
    const responseText = completion.data.choices[0].message.content;

    // Update conversation history with AI response
    convohist.push({ role: "assistant", content: responseText });

    // Convert the response text to SSML format and generate audio using AWS Polly
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

    // Save conversation history under the "conversations" collection in Firestore
    const conversationRef = db.collection("conversations").doc(uuid); // Auto-generated document ID
    await conversationRef.set({
      userMessages: userMessages,
      aiMessages: [{ role: "assistant", content: responseText }],
      entities: userEntities,
      completion: completion.data.choices[0].message,
    });

    // Send the response back to the user
    res.status(200).json({
      result: completion.data.choices[0].message,
      audioUrl: audioDataUri,
      entities: userEntities,
      convohist: convohist,
    });

    // Store the updated conversation history in Firestore under the user's node
    await saveEntitiesAndCompletionToFirestore(uuid, userEntities, completion.data.choices[0].message); // Use the UUID
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
}

async function saveEntitiesAndCompletionToFirestore(uuid, userEntities, completionMessage) {
  const userRef = db.collection("users").doc(uuid); // Replace "users" with your collection name
  await userRef.set({
    entities: userEntities,
    completion: completionMessage,
  }, { merge: true });
}
