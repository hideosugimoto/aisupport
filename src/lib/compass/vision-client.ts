import OpenAI from "openai";
import { loadTemplate } from "../llm/prompt-builder";
import compassConfig from "../../../config/compass.json";

export class VisionClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  async describe(imageBase64: string, mimeType: string): Promise<string> {
    const prompt = loadTemplate("compass", "image-describe.md");
    const response = await this.client.chat.completions.create({
      model: compassConfig.vision_model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: compassConfig.vision_max_tokens,
    });
    return response.choices[0].message.content ?? "";
  }
}
