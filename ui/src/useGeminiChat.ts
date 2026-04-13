import { useState, useCallback } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  imageBase64?: string
  imageMimeType?: string
}

type GeminiPart =
  | { text: string }
  | {
      inlineData: {
        mimeType: string
        data: string
      }
    }

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY)

export function useGeminiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (userMessage: string, systemPrompt: string, imageBase64?: string, imageMimeType?: string) => {
      if (!userMessage.trim() && !imageBase64) return

      setError(null)
      setLoading(true)

      try {
        // Agregar mensaje del usuario
        const newUserMessage: ChatMessage = {
          role: 'user',
          content: userMessage,
          timestamp: new Date(),
          imageBase64,
          imageMimeType,
        }
        setMessages((prev) => [...prev, newUserMessage])

        // gemini-2.0-flash esta disponible en v1beta y soporta entradas multimodales
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        
        // Construir partes del mensaje
        const messageParts: GeminiPart[] = []

        // Agregar system prompt inicial si es primer mensaje
        if (messages.length === 0) {
          messageParts.push({ text: systemPrompt })
        }

        // Agregar imagen si existe
        if (imageBase64 && imageMimeType) {
          messageParts.push({
            inlineData: {
              mimeType: imageMimeType,
              data: imageBase64,
            },
          })
        }

        // Agregar texto del mensaje
        messageParts.push({ text: userMessage })

        // Enviar mensaje directamente
        const request = {
          contents: [{ role: 'user', parts: messageParts }],
          generationConfig: {
            maxOutputTokens: 2048,
          },
        }

        const result = await model.generateContent(request)
        const assistantResponse = result.response.text()

        // Extraer solo el código Python si está disponible
        const codeBlockMatch = assistantResponse.match(/```python\n([\s\S]*?)\n```/)
        const codeContent = codeBlockMatch ? codeBlockMatch[1] : assistantResponse

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: codeContent,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])

        return codeContent
      } catch (err) {
        const rawError = err instanceof Error ? err.message : 'Error desconocido'
        const errorMessage = rawError.includes('[429')
          ? 'Sin cuota disponible para Gemini en este momento. Revisa billing/cuotas en Google AI Studio.'
          : rawError
        setError(errorMessage)
        console.error('Gemini error:', err)
      } finally {
        setLoading(false)
      }
    },
    [messages]
  )

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, clearChat }
}
