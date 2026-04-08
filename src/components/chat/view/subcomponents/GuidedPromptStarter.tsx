import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GUIDED_PROMPT_SCENARIOS,
  AUTO_RESEARCH_SCENARIOS,
  type GuidedPromptScenario,
} from '../../constants/guidedPromptScenarios';
import { AUTO_RESEARCH_PACKS, type LocaleKey } from '../../../../constants/autoResearchPacks';
import { api } from '../../../../utils/api';
import type { AttachedPrompt } from '../../types/types';

function resolveLocaleKey(lang: string): LocaleKey {
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ko')) return 'ko';
  return 'en';
}

interface GuidedPromptStarterProps {
  projectName: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  setAttachedPrompt?: (prompt: AttachedPrompt | null) => void;
}

interface SkillTreeNode {
  name: string;
  type: 'directory' | 'file';
  children?: SkillTreeNode[];
}

function buildTemplate(
  t: (key: string, options?: Record<string, unknown>) => string,
  scenario: GuidedPromptScenario,
  skills: string[],
) {
  return t('guidedStarter.template.intro', {
    scenario: t(scenario.titleKey),
    skills: skills.join(', '),
  });
}

export default function GuidedPromptStarter({
  projectName: _projectName,
  setInput,
  textareaRef,
  setAttachedPrompt,
}: GuidedPromptStarterProps) {
  const { t, i18n } = useTranslation('chat');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<Set<string> | null>(null);
  const [autoResearchOpen, setAutoResearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const normalize = (value: string) => value.trim().toLowerCase();
    const discovered = new Set<string>();

    const collect = (nodes: SkillTreeNode[]) => {
      for (const node of nodes) {
        if (node.type !== 'directory') {
          continue;
        }
        const hasSkillMd = (node.children || []).some(
          (child) => child.type === 'file' && child.name === 'SKILL.md',
        );
        if (hasSkillMd) {
          discovered.add(normalize(node.name));
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
          collect(node.children);
        }
      }
    };

    const fetchSkills = async () => {
      try {
        const response = await api.getGlobalSkills();
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as SkillTreeNode[];
        collect(payload);
        if (!cancelled && discovered.size > 0) {
          setAvailableSkills(discovered);
        }
      } catch {
        // Keep static list as fallback.
      }
    };

    fetchSkills();
    return () => {
      cancelled = true;
    };
  }, []);

  const injectTemplate = (scenario: GuidedPromptScenario, skills: string[]) => {
    const nextValue = buildTemplate(t, scenario, skills);
    if (setAttachedPrompt) {
      setAttachedPrompt({
        scenarioId: scenario.id,
        scenarioIcon: scenario.icon,
        scenarioTitle: t(scenario.titleKey),
        promptText: nextValue,
      });
      setTimeout(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
      }, 100);
    } else {
      setInput(prev => prev ? `${nextValue}\n\n${prev}` : nextValue);
      setTimeout(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const cursor = el.value.length;
        el.setSelectionRange(cursor, cursor);
      }, 100);
    }
  };

  const handleScenarioSelect = (scenario: GuidedPromptScenario) => {
    setSelectedScenarioId(scenario.id);
    setAutoResearchOpen(false);

    // Auto Research scenarios inject slash command as AttachedPrompt
    if (scenario.slashCommand) {
      if (setAttachedPrompt) {
        setAttachedPrompt({
          scenarioId: scenario.id,
          scenarioIcon: scenario.icon,
          scenarioTitle: t(scenario.titleKey),
          promptText: scenario.slashCommand,
        });
        setTimeout(() => textareaRef.current?.focus(), 100);
      } else {
        setInput((prev: string) => prev ? `${scenario.slashCommand} ${prev}` : `${scenario.slashCommand} `);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
      return;
    }

    const matchedSkills = availableSkills
      ? scenario.skills.filter((skill) => availableSkills.has(skill.toLowerCase()))
      : [];
    injectTemplate(scenario, matchedSkills.length > 0 ? matchedSkills : scenario.skills);
  };

  return (
    <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto px-4 mt-6">
      {/* Auto Research dropdown button — reads from Research Hub packs */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setAutoResearchOpen(!autoResearchOpen)}
          className={`rounded-full border px-3 py-2 text-left transition-colors ${
            autoResearchOpen
              ? 'border-purple-500/50 bg-purple-500/12 text-foreground dark:border-purple-400/70 dark:bg-purple-400/14 dark:text-white'
              : 'border-purple-300/50 bg-purple-50/40 text-purple-700 hover:bg-purple-100/60 dark:border-purple-700/40 dark:bg-purple-950/20 dark:text-purple-300 dark:hover:bg-purple-900/30'
          }`}
        >
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <span className="text-sm leading-none">🧪</span>
            Auto Research
            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={autoResearchOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
            </svg>
          </p>
        </button>
        {autoResearchOpen && (() => {
          const loc = resolveLocaleKey(i18n.language || 'en');
          return (
            <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 w-72 max-h-[360px] bg-popover border border-border rounded-xl shadow-xl overflow-y-auto">
              {AUTO_RESEARCH_PACKS.map((pack) => (
                <div key={pack.name}>
                  <div className="sticky top-0 z-10 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 backdrop-blur">
                    {pack.name}
                  </div>
                  {pack.workflows.map((wf) => (
                    <button
                      key={wf.command}
                      type="button"
                      onClick={() => {
                        setAutoResearchOpen(false);
                        setSelectedScenarioId(wf.command);
                        if (setAttachedPrompt) {
                          setAttachedPrompt({
                            scenarioId: `autoresearch-${wf.command}`,
                            scenarioIcon: '🧪',
                            scenarioTitle: `${pack.name}: ${wf.name}`,
                            promptText: wf.command,
                          });
                          setTimeout(() => textareaRef.current?.focus(), 100);
                        } else {
                          setInput((prev: string) => prev ? `${wf.command} ${prev}` : `${wf.command} `);
                          setTimeout(() => textareaRef.current?.focus(), 100);
                        }
                      }}
                      className="w-full flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-purple-50/60 dark:hover:bg-purple-950/20 transition-colors"
                    >
                      <span className="text-[11px] font-semibold text-foreground">{wf.name}</span>
                      <span className="text-[10px] text-muted-foreground">{wf.description[loc]}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Existing scenario buttons */}
      {GUIDED_PROMPT_SCENARIOS.map((scenario) => {
        const isActive = selectedScenarioId === scenario.id;
        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() => handleScenarioSelect(scenario)}
            className={`rounded-full border px-3 py-2 text-left transition-colors ${
              isActive
                ? 'border-cyan-500/50 bg-cyan-500/12 text-foreground dark:border-cyan-400/70 dark:bg-cyan-400/14 dark:text-white'
                : 'border-border/70 bg-card/60 text-foreground/80 hover:bg-accent hover:text-foreground dark:border-white/8 dark:bg-white/[0.04] dark:text-white/78 dark:hover:bg-white/[0.08] dark:hover:text-white'
            }`}
          >
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-sm leading-none">{scenario.icon}</span>
              {t(scenario.titleKey)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
