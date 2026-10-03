import React, { useState } from 'react';
import { Code2, ChevronDown, ChevronUp } from 'lucide-react';

interface VoicePromptInspectorSectionProps {
  promptPreview: string;
}

export const VoicePromptInspectorSection: React.FC<VoicePromptInspectorSectionProps> = ({
  promptPreview
}) => {
  const [showPromptInspector, setShowPromptInspector] = useState(false);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
      <button
        type="button"
        onClick={() => setShowPromptInspector(!showPromptInspector)}
        className="w-full p-3 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-pastel-accentViolet" />
          <span>Предпросмотр системного промпта (Inspector)</span>
        </div>
        {showPromptInspector ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {showPromptInspector && (
        <div className="p-3.5 bg-slate-900 text-slate-200 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap border-t border-slate-200">
          {promptPreview}
        </div>
      )}
    </div>
  );
};
