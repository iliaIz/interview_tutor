import { useState, useEffect } from 'react';

interface UseSystemDesignDraftProps {
  scenarioId?: string;
  onRestore: (sub: {
    canvasTopology?: any;
    architectureMermaid?: string;
    candidateNotes?: string;
    evaluation?: any;
  }) => void;
}

export function useSystemDesignDraft({ scenarioId, onRestore }: UseSystemDesignDraftProps) {
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  useEffect(() => {
    if (!scenarioId) return;
    let isCancelled = false;

    fetch(`/api/system-design/submissions/${scenarioId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isCancelled || !data?.submission) return;
        const sub = data.submission;

        let parsedEval = sub.evaluation;
        if (!parsedEval && sub.evaluation_json) {
          try {
            parsedEval = JSON.parse(sub.evaluation_json);
          } catch {}
        }

        onRestore({
          canvasTopology: sub.canvasTopology,
          architectureMermaid: sub.architectureMermaid || sub.mermaid_diagram,
          candidateNotes: sub.candidateNotes || sub.candidate_notes || sub.architectureNotes,
          evaluation: parsedEval
        });
        setIsDraftRestored(true);
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [scenarioId]);

  return { isDraftRestored };
}
