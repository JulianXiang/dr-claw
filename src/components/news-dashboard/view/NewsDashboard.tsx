import {
  Newspaper,
  Play,
  Settings2,
  ExternalLink,
  Star,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Search,
  Zap,
  Filter,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../ui/button';
import { api } from '../../../utils/api';

type ResearchDomain = {
  keywords: string[];
  arxiv_categories: string[];
  priority: number;
};

type NewsConfig = {
  research_domains: Record<string, ResearchDomain>;
  top_n: number;
  max_results: number;
  categories: string;
};

type Paper = {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  published: string;
  categories: string[];
  relevance_score: number;
  recency_score: number;
  popularity_score: number;
  quality_score: number;
  final_score: number;
  matched_domain: string;
  matched_keywords: string[];
  link?: string;
  pdf_link?: string;
};

type SearchResults = {
  top_papers: Paper[];
  total_found: number;
  total_filtered: number;
  search_date?: string;
};

const ARXIV_CATEGORIES = [
  'cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.MM', 'cs.MA', 'cs.RO',
  'cs.IR', 'cs.NE', 'cs.SE', 'stat.ML', 'eess.AS', 'eess.IV',
];

const SCORE_COLORS = [
  { label: 'Relevance', key: 'relevance_score' as const, bar: 'bg-gradient-to-r from-sky-400 to-sky-500', dot: 'bg-sky-500' },
  { label: 'Recency', key: 'recency_score' as const, bar: 'bg-gradient-to-r from-emerald-400 to-emerald-500', dot: 'bg-emerald-500' },
  { label: 'Popularity', key: 'popularity_score' as const, bar: 'bg-gradient-to-r from-amber-400 to-amber-500', dot: 'bg-amber-500' },
  { label: 'Quality', key: 'quality_score' as const, bar: 'bg-gradient-to-r from-violet-400 to-violet-500', dot: 'bg-violet-500' },
];

function ScoreBar({ label, score, max = 3, barClass, dotClass }: { label: string; score: number; max?: number; barClass: string; dotClass: string }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="flex items-center gap-1.5 w-[5.5rem] text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {label}
      </span>
      <div className="flex-1 h-[5px] bg-muted/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right font-medium tabular-nums text-foreground/70">{score.toFixed(1)}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Search; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/45">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function PaperCard({ paper, index }: { paper: Paper; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const arxivUrl = paper.link || `https://arxiv.org/abs/${paper.id}`;
  const pdfUrl = paper.pdf_link || `https://arxiv.org/pdf/${paper.id}`;

  const isTopPaper = index < 3;
  const borderAccent = isTopPaper
    ? 'border-amber-200/80 dark:border-amber-800/50'
    : 'border-border/60';

  return (
    <article className={`group relative overflow-hidden rounded-[22px] border ${borderAccent} bg-card/85 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}>
      {/* Top accent strip */}
      {isTopPaper ? (
        <div className="h-[3px] bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
      ) : (
        <div className="h-[2px] bg-gradient-to-r from-amber-500/40 via-orange-500/40 to-rose-500/40" />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
              isTopPaper
                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm'
                : 'bg-muted/80 text-muted-foreground'
            }`}>
              {index + 1}
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 dark:bg-amber-950/30">
              <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
              <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">{paper.final_score?.toFixed(1) ?? '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <a href={arxivUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors">
              arXiv <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors">
              PDF <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-3.5 text-[15px] font-semibold leading-snug text-foreground tracking-tight">{paper.title}</h3>

        {/* Authors */}
        <p className="mt-1.5 text-xs text-muted-foreground/80 line-clamp-1">{paper.authors}</p>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.matched_domain && (
            <span className="rounded-lg border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300">
              {paper.matched_domain}
            </span>
          )}
          {paper.categories?.slice(0, 3).map((cat) => (
            <span key={cat} className="rounded-lg border border-border/40 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {cat}
            </span>
          ))}
          {paper.published && (
            <span className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {paper.published.slice(0, 10)}
            </span>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3.5 flex items-center gap-1.5 text-xs font-medium text-primary/80 hover:text-primary transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? 'Collapse' : 'Abstract & score breakdown'}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3.5 space-y-4 rounded-xl bg-muted/20 p-4 border border-border/30">
            <p className="text-xs leading-[1.7] text-muted-foreground">{paper.abstract}</p>

            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">Score Breakdown</div>
              {SCORE_COLORS.map(({ label, key, bar, dot }) => (
                <ScoreBar key={key} label={label} score={paper[key] ?? 0} barClass={bar} dotClass={dot} />
              ))}
            </div>

            {paper.matched_keywords?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground/70 mr-0.5">Matched keywords:</span>
                {paper.matched_keywords.map((kw) => (
                  <span key={kw} className="rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary/80 border border-primary/10">{kw}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function DomainEditor({
  name,
  domain,
  onUpdate,
  onRemove,
}: {
  name: string;
  domain: ResearchDomain;
  onUpdate: (name: string, domain: ResearchDomain) => void;
  onRemove: (name: string) => void;
}) {
  const [keywordInput, setKeywordInput] = useState('');
  const [catInput, setCatInput] = useState('');

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !domain.keywords.includes(kw)) {
      onUpdate(name, { ...domain, keywords: [...domain.keywords, kw] });
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    onUpdate(name, { ...domain, keywords: domain.keywords.filter((k) => k !== kw) });
  };

  const addCategory = () => {
    const cat = catInput.trim();
    if (cat && !domain.arxiv_categories.includes(cat)) {
      onUpdate(name, { ...domain, arxiv_categories: [...domain.arxiv_categories, cat] });
      setCatInput('');
    }
  };

  const removeCategory = (cat: string) => {
    onUpdate(name, { ...domain, arxiv_categories: domain.arxiv_categories.filter((c) => c !== cat) });
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 p-4 space-y-3 transition-colors hover:border-border/80">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{name}</h4>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-muted-foreground">Priority</label>
            <input
              type="number" min={1} max={10}
              value={domain.priority}
              onChange={(e) => onUpdate(name, { ...domain, priority: parseInt(e.target.value) || 5 })}
              className="w-12 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-center font-medium tabular-nums"
            />
          </div>
          <button onClick={() => onRemove(name)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Keywords</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {domain.keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 rounded-lg border border-sky-200/60 bg-sky-50/80 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-800/40 dark:bg-sky-950/30 dark:text-sky-300">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="text-sky-400 hover:text-destructive transition-colors">&times;</button>
            </span>
          ))}
          <div className="inline-flex items-center gap-1">
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="Add..."
              className="w-20 rounded-lg border border-dashed border-border/60 bg-transparent px-2 py-0.5 text-[10px] placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
            />
            <button onClick={addKeyword} className="rounded p-0.5 text-primary/60 hover:text-primary transition-colors"><Plus className="h-3 w-3" /></button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">arXiv Categories</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {domain.arxiv_categories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/60 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              {cat}
              <button onClick={() => removeCategory(cat)} className="text-emerald-400 hover:text-destructive transition-colors">&times;</button>
            </span>
          ))}
          <select
            value={catInput}
            onChange={(e) => { setCatInput(e.target.value); if (e.target.value) { const cat = e.target.value; if (!domain.arxiv_categories.includes(cat)) { onUpdate(name, { ...domain, arxiv_categories: [...domain.arxiv_categories, cat] }); } setCatInput(''); } }}
            className="rounded-lg border border-dashed border-border/60 bg-transparent px-2 py-0.5 text-[10px] text-muted-foreground/70 focus:border-primary/40 focus:outline-none"
          >
            <option value="">Add...</option>
            {ARXIV_CATEGORIES.filter((c) => !domain.arxiv_categories.includes(c)).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function NewsDashboard() {
  const { t } = useTranslation('common');

  const [config, setConfig] = useState<NewsConfig | null>(null);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');

  useEffect(() => {
    Promise.all([
      api.news.getConfig().then((r) => r.json()),
      api.news.getResults().then((r) => r.json()),
    ]).then(([cfg, res]) => {
      setConfig(cfg);
      setResults(res);
    }).catch((err) => {
      console.error('Failed to load news data:', err);
      setError('Failed to load configuration');
    }).finally(() => {
      setIsLoadingConfig(false);
    });
  }, []);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setError(null);
    try {
      if (configDirty && config) {
        await api.news.updateConfig(config);
        setConfigDirty(false);
      }
      const res = await api.news.search();
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Search failed');
      }
      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [config, configDirty]);

  const handleSaveConfig = useCallback(async () => {
    if (!config) return;
    try {
      await api.news.updateConfig(config);
      setConfigDirty(false);
    } catch (err: any) {
      setError('Failed to save config: ' + err.message);
    }
  }, [config]);

  const updateDomain = useCallback((name: string, domain: ResearchDomain) => {
    if (!config) return;
    setConfig({ ...config, research_domains: { ...config.research_domains, [name]: domain } });
    setConfigDirty(true);
  }, [config]);

  const removeDomain = useCallback((name: string) => {
    if (!config) return;
    const { [name]: _, ...rest } = config.research_domains;
    setConfig({ ...config, research_domains: rest });
    setConfigDirty(true);
  }, [config]);

  const addDomain = useCallback(() => {
    if (!config || !newDomainName.trim()) return;
    setConfig({
      ...config,
      research_domains: {
        ...config.research_domains,
        [newDomainName.trim()]: { keywords: [], arxiv_categories: ['cs.AI'], priority: 5 },
      },
    });
    setNewDomainName('');
    setConfigDirty(true);
  }, [config, newDomainName]);

  const papers = useMemo(() => results?.top_papers ?? [], [results]);
  const domainCount = config ? Object.keys(config.research_domains).length : 0;

  if (isLoadingConfig) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
        <span className="text-sm text-muted-foreground">Loading news dashboard...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Hero Header ── */}
        <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),linear-gradient(135deg,rgba(252,250,246,0.97),rgba(255,251,247,0.94))] p-6 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(135deg,rgba(27,21,16,0.96),rgba(29,21,24,0.92))] sm:p-7">
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute -right-12 -top-10 h-36 w-36 rounded-full bg-amber-100/45 blur-3xl dark:bg-amber-500/12" />
          <div className="pointer-events-none absolute bottom-0 right-20 h-24 w-24 rounded-full bg-rose-100/35 blur-2xl dark:bg-rose-500/8" />

          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-700 shadow-sm dark:border-amber-800/60 dark:bg-slate-950/60 dark:text-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                {t('newsDashboard.badge', 'Research News')}
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {t('newsDashboard.title', 'Paper News')}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {t('newsDashboard.subtitle', 'Discover the latest research from arXiv, automatically scored by relevance, recency, popularity, and quality.')}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="h-10 gap-2.5 rounded-xl bg-amber-600 px-5 text-white shadow-sm hover:bg-amber-700"
                  size="lg"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {isSearching
                    ? t('newsDashboard.searching', 'Searching...')
                    : t('newsDashboard.startMyDay', 'Start My Day')}
                </Button>
                <Button
                  variant={showSettings ? 'secondary' : 'outline'}
                  onClick={() => setShowSettings((v) => !v)}
                  className="h-10 gap-2 rounded-xl border-amber-200/70 bg-background/85 text-amber-900 backdrop-blur hover:bg-amber-50 dark:border-amber-800/40 dark:bg-slate-950/30 dark:text-amber-100 dark:hover:bg-amber-950/20"
                >
                  <Settings2 className="h-4 w-4" />
                  {t('newsDashboard.settings', 'Research Interests')}
                  {domainCount > 0 && (
                    <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{domainCount}</span>
                  )}
                </Button>
                {results?.search_date && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {results.search_date}
                  </span>
                )}
              </div>
            </div>

            {/* Stats cards (shown when results exist) */}
            {papers.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <StatCard icon={Search} label="Scanned" value={results?.total_found ?? 0} accent="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" />
                <StatCard icon={Filter} label="Filtered" value={results?.total_filtered ?? 0} accent="bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" />
                <StatCard icon={BarChart3} label="Top Picks" value={papers.length} accent="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" />
              </div>
            )}
          </div>
        </section>

        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200/80 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40">
              <span className="text-base">!</span>
            </div>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
          </div>
        )}

        {/* ── Settings Panel ── */}
        {showSettings && config && (
          <section className="space-y-5 rounded-[28px] border border-border/60 bg-card/78 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                  <Settings2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t('newsDashboard.configTitle', 'Research Interests')}</h3>
                  <p className="text-[11px] text-muted-foreground">Define your research domains, keywords, and search parameters</p>
                </div>
              </div>
              {configDirty && (
                <Button size="sm" className="rounded-full text-xs gap-1.5 shadow-sm" onClick={handleSaveConfig}>
                  Save Changes
                </Button>
              )}
            </div>

            {/* Search parameters */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-background/50 p-3.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Papers per search</label>
                <input
                  type="number" min={1} max={50}
                  value={config.top_n}
                  onChange={(e) => { setConfig({ ...config, top_n: parseInt(e.target.value) || 10 }); setConfigDirty(true); }}
                  className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm font-medium tabular-nums focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div className="rounded-xl border border-border/40 bg-background/50 p-3.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Max arXiv results to scan</label>
                <input
                  type="number" min={50} max={1000} step={50}
                  value={config.max_results}
                  onChange={(e) => { setConfig({ ...config, max_results: parseInt(e.target.value) || 200 }); setConfigDirty(true); }}
                  className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm font-medium tabular-nums focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Domains */}
            <div className="space-y-3">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Research Domains</label>
              {Object.entries(config.research_domains).map(([name, domain]) => (
                <DomainEditor key={name} name={name} domain={domain} onUpdate={updateDomain} onRemove={removeDomain} />
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                  placeholder="New domain name..."
                  className="flex-1 rounded-xl border border-dashed border-border/60 bg-transparent px-3.5 py-2 text-sm placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
                />
                <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={addDomain} disabled={!newDomainName.trim()}>
                  <Plus className="h-3.5 w-3.5" /> Add Domain
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ── Paper Results ── */}
        {papers.length > 0 && (
          <>
            <section className="rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
                    {t('newsDashboard.badge', 'Research News')}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-foreground">
                    {t('newsDashboard.papersTitle', 'Recommended Papers')}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('newsDashboard.papersSubtitle', 'Sorted by composite score — relevance 40%, popularity 30%, recency 20%, quality 10%')}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="w-fit rounded-xl gap-1.5" onClick={handleSearch} disabled={isSearching}>
                  <RefreshCw className={`h-3.5 w-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {papers.map((paper, index) => (
                <PaperCard key={paper.id} paper={paper} index={index} />
              ))}
            </section>
          </>
        )}

        {/* ── Empty State ── */}
        {papers.length === 0 && !isSearching && !isLoadingConfig && (
          <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/70 p-10 text-center shadow-sm backdrop-blur sm:p-14">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-amber-500/10 via-orange-400/10 to-rose-400/10" />
            <div className="relative mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <BookOpen className="h-7 w-7" />
            </div>
            <h2 className="relative mt-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t('newsDashboard.emptyTitle', 'No papers yet')}
            </h2>
            <p className="relative mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t('newsDashboard.emptyDescription', 'Configure your research interests above, then click "Start My Day" to discover the latest papers from arXiv.')}
            </p>
            <Button onClick={handleSearch} disabled={isSearching} className="relative mt-6 rounded-xl bg-amber-600 gap-2 text-white shadow-sm hover:bg-amber-700" size="lg">
              <Zap className="h-4 w-4" />
              Get Started
            </Button>
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="flex items-center justify-center gap-2 pb-6 pt-2 text-[11px] text-muted-foreground/60">
          <span className="inline-flex items-center gap-1.5">
            Powered by
            <a href="https://arxiv.org" target="_blank" rel="noopener noreferrer" className="font-medium text-muted-foreground/80 hover:text-foreground transition-colors">arXiv API</a>
            <span>&middot;</span>
            <a href="https://www.semanticscholar.org" target="_blank" rel="noopener noreferrer" className="font-medium text-muted-foreground/80 hover:text-foreground transition-colors">Semantic Scholar</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
