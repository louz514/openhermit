import { Icon, BrandMark, type IconName } from './Icon';

interface Props {
  agentName: string;
  isOwner: boolean;
  onUseExample: (text: string) => void;
  onOpenManage?: () => void;
}

type Example = { icon: IconName; label: string; prompt: string };

const EXAMPLES_USER: Example[] = [
  { icon: 'wave', label: 'Say hello', prompt: 'Hi! Introduce yourself in two sentences and tell me what kinds of tasks you\'re good at.' },
  { icon: 'folder', label: 'Explore your workspace', prompt: 'List the files in your current workspace and summarize what you have access to.' },
  { icon: 'brain', label: 'Recall memory', prompt: 'What do you remember from our previous conversations? If nothing, say so.' },
  { icon: 'wand', label: 'Show your abilities', prompt: 'Which abilities and tools do you currently have enabled? Briefly describe each.' },
];

const EXAMPLES_OWNER_EXTRAS: Example[] = [
  { icon: 'settings', label: 'Configure yourself', prompt: 'Walk me through the agent settings I should review first as a new operator.' },
  { icon: 'clock', label: 'Set up a recurring task', prompt: 'How would you set up a daily 9am task to summarize my unread items? Walk me through the steps.' },
];

export function ChatWelcome({ agentName, isOwner, onUseExample, onOpenManage }: Props) {
  const examples = isOwner ? [...EXAMPLES_USER, ...EXAMPLES_OWNER_EXTRAS] : EXAMPLES_USER;

  return (
    <section className="chat__messages chat__welcome">
      <div className="chat-welcome">
        <div className="chat-welcome__hero">
          <div className="chat-welcome__avatar"><BrandMark size={32} /></div>
          <p className="eyebrow">Now chatting with</p>
          <h1>{agentName}</h1>
          <p className="hint hint--center">
            This is a persistent assistant with its own memory, abilities, and workspace.
            Anything you say here is remembered across sessions.
          </p>
        </div>

        <h3 className="chat-welcome__heading">Try one of these to get started</h3>
        <div className="chat-welcome__grid" data-tour="examples">
          {examples.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="example-card"
              onClick={() => onUseExample(ex.prompt)}
            >
              <span className="example-card__emoji"><Icon name={ex.icon} size={18} /></span>
              <span className="example-card__label">{ex.label}</span>
              <span className="example-card__preview">{ex.prompt}</span>
            </button>
          ))}
        </div>

        <div className="chat-welcome__tips">
          <div className="tip">
            <span className="tip__icon"><Icon name="lightbulb" size={16} /></span>
            <div>
              <strong>Tip:</strong> sessions on the left preserve full history. Start a new
              session for unrelated work — context bleeds across messages, not sessions.
            </div>
          </div>
          {isOwner && onOpenManage && (
            <div className="tip">
              <span className="tip__icon"><Icon name="settings" size={16} /></span>
              <div>
                <strong>You're the owner.</strong>{' '}
                <button type="button" className="link-btn" onClick={onOpenManage}>
                  Open Manage
                </button>{' '}
                to set up integrations, abilities, permissions, recurring tasks, and apps that can message your agent.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
