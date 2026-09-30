import { type FC, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { ThemeChoice } from "@/components/layout/ThemeToggle";
import { useTitle } from "@/hooks/useTitle";

// Sections are divided by a rule, not boxed: the page is a list of settings,
// and a border around each one says they are separate things when they are not.
const section = "mt-8 border-t border-surface-border pt-8";
const heading = "text-lg font-semibold text-text-primary";

const MCP_URL = "https://mcp.brighter.fi/mcp";

/** A line of text to paste somewhere else, with a copy button. */
const CopyField: FC<{ value: string; label: string; className?: string }> = ({ value, label, className = "" }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={`flex h-11 items-center gap-2 rounded-lg border border-surface-border bg-surface-1 pl-3 pr-1.5 ${className}`}>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-text-primary">{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
};

export const Settings: FC = () => {
  useTitle("Settings");

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">Settings</h1>

      <section aria-labelledby="mcp-heading" className={section}>
        <h2 id="mcp-heading" className={heading}>MCP server</h2>
        <p id="mcp-description" className="mt-2 text-sm text-text-secondary">
          Connect your AI assistant to Brighter. It can browse and backtest the strategies, and write and check new rules. It is
          read-only: no wallet, no portfolios, no sign-in.
        </p>
        <div className="mt-5 text-sm font-medium text-text-primary">Server URL</div>
        <CopyField value={MCP_URL} label="server URL" className="mt-2" />

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-text-primary">Claude</dt>
            <dd className="mt-1 text-text-secondary">Settings → Connectors → Add custom connector, then paste the server URL.</dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">Claude Code</dt>
            <dd className="mt-1">
              <CopyField value={`claude mcp add --transport http brighter ${MCP_URL}`} label="command" />
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">Cursor and other clients</dt>
            <dd className="mt-1">
              <CopyField value={`{"mcpServers":{"brighter":{"url":"${MCP_URL}"}}}`} label="config" />
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="appearance-heading" className={section}>
        <h2 id="appearance-heading" className={heading}>Appearance</h2>
        <div className="mt-5">
          <ThemeChoice />
        </div>
      </section>

      <section aria-labelledby="accounts-heading" className={section}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="accounts-heading" className={heading}>Linked accounts</h2>
          <Pill>Soon</Pill>
        </div>
        <p className="mt-2 text-sm text-text-secondary">Manage the accounts connected to Brighter.</p>
      </section>

      <section aria-labelledby="notifications-heading" className={section}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="notifications-heading" className={heading}>Notifications</h2>
          <Pill>Soon</Pill>
        </div>
        <p className="mt-2 text-sm text-text-secondary">Choose which updates you receive.</p>
      </section>
    </div>
  );
};
