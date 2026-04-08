import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FlaskConical, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AUTO_RESEARCH_PACKS, type LocaleKey } from '../../../../constants/autoResearchPacks';
import type { AttachedPrompt } from '../../types/types';

function resolveLocaleKey(lang: string): LocaleKey {
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ko')) return 'ko';
  return 'en';
}

interface AutoResearchDropdownProps {
  setInput: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  setAttachedPrompt?: (prompt: AttachedPrompt | null) => void;
  onNavigateToHub?: () => void;
}

export default function AutoResearchDropdown({
  setInput,
  textareaRef,
  setAttachedPrompt,
  onNavigateToHub,
}: AutoResearchDropdownProps) {
  const { i18n } = useTranslation();
  const locale = useMemo(() => resolveLocaleKey(i18n.language || 'en'), [i18n.language]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (command: string, packName: string, wfName: string) => {
    if (setAttachedPrompt) {
      setAttachedPrompt({
        scenarioId: `autoresearch-${command}`,
        scenarioIcon: '🧪',
        scenarioTitle: `${packName}: ${wfName}`,
        promptText: command,
      });
    } else {
      setInput((prev: string) => prev ? `${command} ${prev}` : `${command} `);
    }
    setTimeout(() => textareaRef.current?.focus(), 100);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-300/50 text-[11px] font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50/60 dark:border-purple-700/40 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950/30 transition-all duration-150"
      >
        <FlaskConical className="w-3 h-3" />
        <span>Auto Research</span>
        <svg className="w-3 h-3 opacity-60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-72 max-h-[400px] bg-popover border border-border rounded-xl shadow-xl overflow-y-auto">
          {AUTO_RESEARCH_PACKS.map((pack) => (
            <div key={pack.name}>
              <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 backdrop-blur">
                <span>{pack.name}</span>
                {pack.mcp.length > 0 && (
                  <span className="text-[9px] text-amber-600 dark:text-amber-400">
                    {locale === 'zh' ? '需配置' : 'Setup needed'}
                  </span>
                )}
              </div>
              {pack.workflows.map((wf) => (
                <button
                  key={wf.command}
                  type="button"
                  onClick={() => select(wf.command, pack.name, wf.name)}
                  className="w-full flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-purple-50/60 dark:hover:bg-purple-950/20 transition-colors"
                >
                  <span className="text-[11px] font-semibold text-foreground">{wf.name}</span>
                  <span className="text-[10px] text-muted-foreground">{wf.description[locale]}</span>
                </button>
              ))}
            </div>
          ))}

          {/* Configure link */}
          {onNavigateToHub && (
            <button
              type="button"
              onClick={() => { setOpen(false); onNavigateToHub(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-border/50 text-[11px] font-medium text-purple-600 hover:bg-purple-50/40 dark:text-purple-400 dark:hover:bg-purple-950/20 transition-colors"
            >
              <Settings className="w-3 h-3" />
              {locale === 'zh' ? '在 Research Hub 中配置' : 'Configure in Research Hub'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
