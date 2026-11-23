/**
 * BugIncidentAccordion.tsx
 * Pure presentation accordion for production incident context & telemetry lore.
 * SLA: <= 120 lines (Rule 8 compliant).
 */

import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Server, AlertTriangle, GitPullRequest } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductionContext } from '../../hooks/useBugChallengeInspection';

interface BugIncidentAccordionProps {
  productionContext: ProductionContext;
}

export const BugIncidentAccordion: React.FC<BugIncidentAccordionProps> = ({ productionContext }) => {
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-pink-200/80 bg-gradient-to-r from-[#FFF5F8] via-[#FAF5FF] to-white overflow-hidden shadow-2xs transition-all">
      <button
        onClick={() => setIsIncidentOpen(!isIncidentOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-[#4A1E6D] hover:bg-pink-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-pink-600 animate-pulse" />
          <span>🏢 Производственный контекст & Телеметрия инцидента</span>
          <span className="text-[10px] font-mono font-normal text-[#7E699B] bg-white px-2 py-0.5 rounded-md border border-pink-200 shadow-2xs">
            {productionContext.systemName}
          </span>
        </div>
        {isIncidentOpen ? <ChevronUp className="w-4 h-4 text-pink-600" /> : <ChevronDown className="w-4 h-4 text-[#7E699B]" />}
      </button>

      <AnimatePresence>
        {isIncidentOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            data-selection-zone="incident"
            className="px-4 pb-4 pt-1 border-t border-pink-100 space-y-3 text-xs bg-white/70 font-sans"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#4A1E6D]">
                  <Server className="w-3.5 h-3.5 text-purple-700" />
                  <span>Архитектура системы:</span>
                </div>
                <p className="text-[#3B2556] leading-relaxed">
                  {productionContext.architectureType}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-950">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                  <span>Бизнес-радиус поражения:</span>
                </div>
                <p className="text-rose-900 leading-relaxed">
                  {productionContext.businessImpact}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <Activity className="w-3.5 h-3.5 text-amber-700" />
                <span>Симптомы в телеметрии (Grafana / Sentry / Prometheus):</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                {productionContext.incidentSymptoms}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#4A1E6D]">
                <GitPullRequest className="w-3.5 h-3.5 text-pink-600" />
                <span>Контекст Pull Request (почему код был написан именно так):</span>
              </div>
              <p className="text-[#3B2556] leading-relaxed">
                {productionContext.prReviewContext}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
