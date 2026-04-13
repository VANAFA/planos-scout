import { useState, useRef, useEffect } from 'react'
import { useGeminiChat } from './useGeminiChat'
import './GeminiChatModal.css'

interface GeminiChatModalProps {
  geminiPrompt: string
  onCodeGenerated: (code: string) => void
}

export function GeminiChatModal({ geminiPrompt, onCodeGenerated }: GeminiChatModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined)
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined)
  const [imageFileName, setImageFileName] = useState<string>('')
  const { messages, loading, error, sendMessage, clearChat } = useGeminiChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll a los últimos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() && !imageBase64) return

    const generatedCode = await sendMessage(inputValue, geminiPrompt, imageBase64, imageMimeType)
    
    if (generatedCode) {
      onCodeGenerated(generatedCode)
      setInputValue('')
      setImageBase64(undefined)
      setImageMimeType(undefined)
      setImageFileName('')
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFileName(file.name)
      setImageMimeType(file.type)

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64String = event.target?.result as string
        // Remover el prefijo "data:image/...;base64," para obtener solo los datos
        const base64Data = base64String.split(',')[1]
        setImageBase64(base64Data)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const lastMessage = messages[messages.length - 1]
  const isAssistantResponded = lastMessage?.role === 'assistant'

  return (
    <div className={`gemini-chat-modal ${isOpen ? 'open' : 'closed'}`}>
      {/* Bubble Button */}
      <button
        className="gemini-bubble-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Cerrar Gemini' : 'Abrir Gemini'}
      >
        <span className="gemini-icon">✨</span>
      </button>

      {/* Modal Container */}
      {isOpen && (
        <div className="gemini-modal-container">
          {/* Header */}
          <div className="gemini-header">
            <h3>Gemini Scout 3D</h3>
            <button
              className="gemini-close-btn"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="gemini-messages">
            {error && (
              <div className="gemini-error">
                <strong>Error:</strong> {error}
              </div>
            )}

            {messages.length === 0 && !error && (
              <div className="gemini-welcome">
                <p>✨ Hola! Soy tu asistente Scout 3D.</p>
                <p style={{ fontSize: '11px', color: '#888', marginTop: '12px', fontStyle: 'italic' }}>
                  ✓ Prompt Scout cargada automáticamente
                </p>
                <p style={{ marginTop: '8px', fontSize: '13px' }}>
                  Describe tu estructura o sube una foto y generaré el código automáticamente.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`gemini-message gemini-${msg.role}`}>
                <div className="gemini-message-content">
                  {msg.role === 'assistant' && (
                    <pre className="gemini-code">{msg.content}</pre>
                  )}
                  {msg.role === 'user' && <p>{msg.content}</p>}
                </div>
                <span className="gemini-time">
                  {msg.timestamp.toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="gemini-input-area">
            <div className="gemini-input-wrapper">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej: 'Trípode de 8m con base triangular' o sube una foto..."
                disabled={loading}
                rows={3}
              />

              <div className="gemini-input-actions">
                <button
                  className="gemini-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Subir imagen"
                  disabled={loading}
                >
                  📎
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />

                <button
                  className={`gemini-send-btn ${loading ? 'loading' : ''}`}
                  onClick={handleSendMessage}
                  disabled={loading || (!inputValue.trim() && !imageBase64)}
                >
                  {loading ? '⏳' : '➤'}
                </button>
              </div>
            </div>

            {imageFileName && (
              <div style={{ fontSize: '11px', color: '#667eea', marginBottom: '6px', padding: '0 4px' }}>
                📎 {imageFileName}
              </div>
            )}

            {isAssistantResponded && (
              <button
                className="gemini-insert-btn"
                onClick={() => {
                  if (lastMessage?.content) {
                    onCodeGenerated(lastMessage.content)
                  }
                }}
              >
                ✓ Insertar código en editor
              </button>
            )}

            <button
              className="gemini-clear-btn"
              onClick={() => {
                clearChat()
                setImageBase64(undefined)
                setImageMimeType(undefined)
                setImageFileName('')
              }}
              disabled={messages.length === 0}
            >
              Limpiar chat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
