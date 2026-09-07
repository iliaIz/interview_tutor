import React from 'react';
import { Download } from 'lucide-react';

interface PodcastPlayerAndTranscriptProps {
  onDownloadReport: () => void;
  onClose: () => void;
}

export const PodcastPlayerAndTranscript: React.FC<PodcastPlayerAndTranscriptProps> = ({
  onDownloadReport,
  onClose
}) => {
  return (
    <div className="pt-4 border-t border-pastel-border/60 flex items-center justify-end gap-2.5">
      <button
        type="button"
        onClick={onDownloadReport}
        className="px-4 py-2.5 rounded-xl border border-pastel-border text-xs font-semibold text-pastel-text hover:bg-pastel-bg transition flex items-center gap-1.5 cursor-pointer"
      >
        <Download className="w-4 h-4 text-pastel-accentViolet" />
        <span>Скачать отчет (.md)</span>
      </button>

      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer"
      >
        Готово / Слушать в плеере
      </button>
    </div>
  );
};
