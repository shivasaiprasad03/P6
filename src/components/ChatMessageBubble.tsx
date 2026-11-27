import type { ChatResponse } from '../../shared/types.js';

export interface RichChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  keyTakeaways?: string[];
  impactHighlight?: string;
  engine?: ChatResponse['engine'];
}

interface ChatMessageBubbleProps {
  message: RichChatMessage;
}

/** One message in the conversation, with optional key points and estimated effect. */
export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  return (
    <div className={`msg msg-${message.role}`}>
      <div className="msg-text">{message.content}</div>

      {message.keyTakeaways && message.keyTakeaways.length > 0 && (
        <ul className="msg-points">
          {message.keyTakeaways.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}

      {message.impactHighlight && (
        <p className="msg-effect">
          <strong>Effect:</strong> {message.impactHighlight}
        </p>
      )}

      {message.engine && (
        <p className="msg-source">{message.engine === 'gemini' ? 'Answered by Gemini' : 'Rule-based answer'}</p>
      )}
    </div>
  );
}
