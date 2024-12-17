import ollama from "ollama/browser";


export async function generateContextless(prompt: string, onPart: (part?: string) => void, system: string, model = "llama3.1:8b") {
    console.log(system);
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
    return (await ollama.list()).models.map((model) => model.name);
}

export async function pullModel(model: string): Promise<"success" | string> {
    return (await ollama.pull({ model })).status;
}