import { useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type { ChatTurn, CityLocation, HouseholdProfile } from '../../shared/types.js';
import { sendAdvisorChatApi } from '../lib/apiClient.js';
import { ChatMessageBubble, type RichChatMessage } from './ChatMessageBubble.js';

interface AdvisorChatProps {
  location: CityLocation;
  profile: HouseholdProfile;
  currentAqi?: number;
}

const QUICK_PROMPTS = [
  'When is it safe for the kids to play outside today?',
  'How do I build a cheap DIY air purifier?',
  'Should I open the windows, and when?',
  'Write a short smog alert for my building group',
] as const;

/**
 * Question box answered from the current readings and household profile,
 * with suggested questions, key points, and an estimated effect for each answer.
 */
export function AdvisorChat({ location, profile, currentAqi }: AdvisorChatProps) {
  const [messages, setMessages] = useState<RichChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Ask about air quality in ${location.name}: when to go out, cleaning the air at home, masks, cooking smoke, or getting neighbours involved. Answers use today's readings and your household details.`,
    },
  ]);
  const nextIdRef = useRef(1);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitQuestion(rawText: string): Promise<void> {
    const trimmed = rawText.trim();
    if (trimmed.length < 2 || sending) return;

    nextIdRef.current += 1;
    const userMsg: RichChatMessage = {
      id: `user-${nextIdRef.current}`,
      role: 'user',
      content: trimmed,
    };

    const history: ChatTurn[] = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const response = await sendAdvisorChatApi({
        location,
        profile,
        message: trimmed,
        history,
      });

      nextIdRef.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${nextIdRef.current}`,
          role: 'assistant',
          content: response.reply,
          keyTakeaways: response.keyTakeaways,
          impactHighlight: response.impactHighlight,
          engine: response.engine,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-layout" aria-labelledby="advisor-chat-heading">
      <div className="page-intro">
        <p className="eyebrow">Ask a question</p>
        <h2 id="advisor-chat-heading" className="page-title">
          Questions about the air in {location.name}
        </h2>
        <p className="muted">
          Using {currentAqi !== undefined ? `today's AQI of ${currentAqi}` : "today's readings"}{' '}
          and your {profile.householdSize}-person household.
        </p>
      </div>

      <div className="panel chat">
        <div
          className="chat-log"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation"
        >
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}
          {sending && (
            <div className="msg msg-assistant" aria-busy="true">
              <span className="muted">Thinking…</span>
            </div>
          )}
        </div>

        {error && (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        )}

        <div className="suggestions" role="group" aria-label="Suggested questions">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip"
              disabled={sending}
              onClick={() => {
                void submitQuestion(prompt);
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submitQuestion(input);
          }}
        >
          <label htmlFor="advisor-chat-input" className="sr-only">
            Ask a question about air quality
          </label>
          <input
            id="advisor-chat-input"
            type="text"
            className="input"
            maxLength={600}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a question"
            disabled={sending}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || input.trim().length < 2}
            aria-label="Send"
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </form>
      </div>

      <p className="fineprint">General guidance, not medical advice. If breathing is difficult, seek medical care.</p>
    </section>
  );
}
