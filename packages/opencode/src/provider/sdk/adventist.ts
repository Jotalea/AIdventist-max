import {
  type LanguageModelV2,
  type LanguageModelV2StreamPart,
} from "@ai-sdk/provider"
import {
  createEventSourceResponseHandler,
  type FetchFunction,
  parseProviderOptions,
  postJsonToApi,
  type ParseResult,
} from "@ai-sdk/provider-utils"
import { z } from "zod/v4"

export interface AdventistProviderSettings {
  /**
   * Base URL for the Adventist IA API calls.
   */
  baseURL?: string

  /**
   * Custom fetch implementation.
   */
  fetch?: FetchFunction
}

export function createAdventist(options: AdventistProviderSettings = {}) {
  const baseURL = options.baseURL ?? "https://ia.adventistas.org/api/chat"

  const createLanguageModel = (modelId: string): LanguageModelV2 => {
    return new AdventistLanguageModel(modelId, {
      baseURL,
      fetch: options.fetch,
    })
  }

  const provider = function (modelId: string) {
    return createLanguageModel(modelId)
  }

  provider.languageModel = createLanguageModel

  return provider
}

class AdventistLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2"
  readonly modelId: string
  readonly provider = "adventist"

  private readonly config: {
    baseURL: string
    fetch?: FetchFunction
  }

  constructor(modelId: string, config: { baseURL: string; fetch?: FetchFunction }) {
    this.modelId = modelId
    this.config = config
  }

  get defaultObjectGenerationMode() {
    return undefined
  }

  async doGenerate(options: Parameters<LanguageModelV2["doGenerate"]>[0]): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const { prompt } = options

    const { value: response } = await postJsonToApi({
      url: this.config.baseURL,
      body: {
        query: prompt[prompt.length - 1]?.content[0]?.type === "text" ? (prompt[prompt.length - 1].content[0] as any).text : "",
        user_id: "anonymous",
        conversation_id: null,
      },
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      fetch: this.config.fetch,
      failedResponseHandler: (async (response: Response) => {
        const body = await response.text()
        return new Error(`Adventist IA API error: ${response.status} ${body}`)
      }) as any,
      successfulResponseHandler: createEventSourceResponseHandler(
        z.object({
          event: z.string(),
          answer: z.string().optional(),
        }),
      ),
    })

    const responseStream = response as ReadableStream<ParseResult<{ event: string; answer?: string }>>
    const reader = responseStream.getReader()
    let text = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value.type === "data" && value.data.event === "agent_message" && value.data.answer) {
        text += value.data.answer
      }
    }

    return {
      text,
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0 },
    }
  }

  async doStream(options: Parameters<LanguageModelV2["doStream"]>[0]): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const { prompt } = options

    const { value: responseStream, responseHeaders } = await postJsonToApi({
      url: this.config.baseURL,
      body: {
        query: prompt[prompt.length - 1]?.content[0]?.type === "text" ? (prompt[prompt.length - 1].content[0] as any).text : "",
        user_id: "anonymous",
        conversation_id: null,
      },
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      fetch: this.config.fetch,
      failedResponseHandler: (async (response: Response) => {
        const body = await response.text()
        return new Error(`Adventist IA API error: ${response.status} ${body}`)
      }) as any,
      successfulResponseHandler: createEventSourceResponseHandler(
        z.object({
          event: z.string(),
          answer: z.string().optional(),
        }),
      ),
    })

    return {
      stream: (responseStream as ReadableStream<ParseResult<{ event: string; answer?: string }>>).pipeThrough(
        new TransformStream<ParseResult<{ event: string; answer?: string }>, LanguageModelV2StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === "error") {
              controller.enqueue(chunk)
              return
            }

            if (chunk.type === "data" && chunk.data.event === "agent_message" && chunk.data.answer) {
              controller.enqueue({
                type: "text-delta",
                textDelta: chunk.data.answer,
              })
            }
          },
          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: { promptTokens: 0, completionTokens: 0 },
            })
          },
        }),
      ),
      rawResponse: { headers: responseHeaders },
    }
  }
}
