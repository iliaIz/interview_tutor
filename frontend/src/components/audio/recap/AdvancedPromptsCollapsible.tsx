import React, { useState } from 'react';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from '../audioRecapConfig';

export interface AdvancedPromptsCollapsibleProps {
  systemPrompt: string;
  setSystemPrompt: (p: string) => void;
  userPrompt: string;
  setUserPrompt: (p: string) => void;
}

export const AdvancedPromptsCollapsible: React.FC<AdvancedPromptsCollapsibleProps> = ({
  systemPrompt,
  setSystemPrompt,
  userPrompt,
  setUserPrompt,
}) => {
  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState(false);

  return (
    <div className="border-t border-pastel-border/60 pt-3">
      <button
        type="button"
        onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
        className="flex items-center justify-between w-full text-xs font-semibold text-pastel-muted hover:text-pastel-text py-1 transition cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5" /> Настройки системных промптов (Advanced)
        </span>
        {showAdvancedPrompts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showAdvancedPrompts && (
        <div className="mt-3 space-y-3 p-3 bg-white rounded-2xl border border-pastel-border shadow-xs">
          <div>
            <label className="block text-[11px] font-semibold text-pastel-muted mb-1">
              Системный промпт роли (System Prompt)
            </label>
            <textarea
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full text-xs p-2.5 bg-pastel-bg rounded-xl border border-pastel-border focus:border-pastel-accentRose outline-none text-pastel-text font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-pastel-muted mb-1">
              Инструкция к пересказу (User Prompt / Фокус)
            </label>
            <textarea
              rows={2}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              className="w-full text-xs p-2.5 bg-pastel-bg rounded-xl border border-pastel-border focus:border-pastel-accentRose outline-none text-pastel-text"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
              setUserPrompt(DEFAULT_USER_PROMPT);
            }}
            className="text-[10px] text-pastel-accentRose hover:underline cursor-pointer"
          >
            Сбросить промпты к дефолтным
          </button>
        </div>
      )}
    </div>
  );
};
