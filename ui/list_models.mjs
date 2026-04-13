import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyDvZotKO9z6dscZlDIqsRljrqErkkNa7GA";

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const models = await genAI.listModels();
    console.log("\n📋 Available Models:\n");
    models.models.forEach((model) => {
      console.log(`✓ ${model.name}`);
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

listModels();
