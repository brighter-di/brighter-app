import type { FC } from "react";
import type { Params, Template } from "@/api/client";
import { InfoTip } from "@/components/ui/InfoTip";
import { isDefault } from "@/lib/params";

export const ParamControls: FC<{ template: Template; params: Params; onChange: (p: Params) => void }> = ({ template, params, onChange }) => (
  <div>
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-text-primary">Parameters</h2>
      <button
        onClick={() => onChange({ ...template.defaults })}
        disabled={isDefault(template, params)}
        className="text-xs font-medium text-accent disabled:text-text-muted"
      >
        Reset
      </button>
    </div>
    <div className="space-y-5">
      {template.params.map((s) => (
        <div key={s.key}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              {s.label}
              {s.hint && <InfoTip align="left" body={s.hint} />}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
              {params[s.key]}
              {s.unit}
            </span>
          </div>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={params[s.key]}
            onChange={(e) => onChange({ ...params, [s.key]: Number(e.target.value) })}
            aria-label={s.label}
          />
        </div>
      ))}
    </div>
  </div>
);
