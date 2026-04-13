import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyDvZotKO9z6dscZlDIqsRljrqErkkNa7GA";
const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "models/gemini-2.0-flash",
  "models/gemini-1.5-flash",
  "models/gemini-1.5-pro",
];

async function testModels() {
  console.log("\n🧪 Testing available models:\n");
  
  for (const modelName of modelsToTest) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello");
      console.log(`✅ ${modelName} - WORKS`);
    } catch (err) {
      console.log(`❌ ${modelName} - ${err.message.split('\n')[0]}`);
    }
  }
}

testModels();
