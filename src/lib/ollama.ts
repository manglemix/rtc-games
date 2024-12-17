import { browser } from "$app/environment";
import ollama from "ollama/browser";


export const DEFAULT_MODEL = "llama3.1:8b";

export async function generateContextless(prompt: string, onPart: (part?: string) => void, system: string, model = DEFAULT_MODEL) {
    // console.log(system);
    if (!browser) {
        return;
    }
    const response = await ollama.chat({
        model,
        stream: true,
        messages: [
            {
                role: "system",
                content: system,
            },
            {
                role: "user",
                content: prompt,
            },
        ],
    });

    for await (const part of response) {
        onPart(part.message.content);
    }
    onPart();
}

export async function listModels(): Promise<string[]> {
    if (!browser) {
        return [];
    }
    return (await ollama.list()).models.map((model) => model.name);
}

export async function pullModel(model=DEFAULT_MODEL): Promise<"success" | string> {
    if (!browser) {
        return "not on browser";
    }
    return (await ollama.pull({ model })).status;
}