import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyDvZotKO9z6dscZlDIqsRljrqErkkNa7GA";
const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
  "gemini-pro",
  "gemini-pro-vision",
  "text-bison",
  "text-unicorn",
];

async function testModels() {
  console.log("\n🧪 Testing legacy models:\n");
  
  for (const modelName of modelsToTest) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello");
      console.log(`✅ ${modelName} - WORKS`);
    } catch (err) {
      const msg = err.message.split('\n')[0];
      console.log(`❌ ${modelName} - ${msg.slice(0, 80)}`);
    }
  }
}

testModels();
