interface Props {
  agentName: string;
  isOwner: boolean;
  onUseExample: (text: string) => void;
  onOpenManage?: () => void;
}

const EXAMPLES_USER = [
  { emoji: '👋', label: 'Say hello', prompt: 'Hi! Introduce yourself in two sentences and tell me what kinds of tasks you\'re good at.' },
  { emoji: '📂', label: 'Explore your workspace', prompt: 'List the files in your current workspace and summarize what you have access to.' },
  { emoji: '🧠', label: 'Recall memory', prompt: 'What do you remember from our previous conversations? If nothing, say so.' },
  { emoji: '🛠', label: 'Show your skills', prompt: 'Which skills and tools do you currently have enabled? Briefly describe each.' },
];

const EXAMPLES_OWNER_EXTRAS = [
  { emoji: '⚙️', label: 'Configure yourself', prompt: 'Walk me through the agent settings I should review first as a new operator.' },
  { emoji: '⏰', label: 'Set up a schedule', prompt: 'How would you set up a daily 9am task to summarize my unread items? Walk me through the steps.' },
];

export function ChatWelcome({ agentName, isOwner, onUseExample, onOpenManage }: Props) {
  const examples = isOwner ? [...EXAMPLES_USER, ...EXAMPLES_OWNER_EXTRAS] : EXAMPLES_USER;

  return (
    <section className="chat__messages chat__welcome">
      <div className="chat-welcome">
        <div className="chat-welcome__hero">
          <div className="chat-welcome__avatar">🜲</div>
          <p className="eyebrow">Now chatting with</p>
          <h1>{agentName}</h1>
          <p className="hint hint--center">
            This is a persistent AI agent with its own memory, skills, and workspace.
            Anything you say here is remembered across sessions.
          </p>
        </div>

        <h3 className="chat-welcome__heading">Try one of these to get started</h3>
        <div className="chat-welcome__grid">
          {examples.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="example-card"
              onClick={() => onUseExample(ex.prompt)}
            >
              <span className="example-card__emoji">{ex.emoji}</span>
              <span className="example-card__label">{ex.label}</span>
              <span className="example-card__preview">{ex.prompt}</span>
            </button>
          ))}
        </div>

        <div className="chat-welcome__tips">
          <div className="tip">
            <span className="tip__icon">💡</span>
            <div>
              <strong>Tip:</strong> sessions on the left preserve full history. Start a new
              session for unrelated work — context bleeds across messages, not sessions.
            </div>
          </div>
          {isOwner && onOpenManage && (
            <div className="tip">
              <span className="tip__icon">⚙️</span>
              <div>
                <strong>You're the owner.</strong>{' '}
                <button type="button" className="link-btn" onClick={onOpenManage}>
                  Open Manage
                </button>{' '}
                to configure secrets, skills, MCP servers, schedules, and channels.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
