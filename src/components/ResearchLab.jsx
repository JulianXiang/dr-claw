import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  FlaskConical, RefreshCw, FileText, BookOpen, Settings2, Lightbulb,
  GitBranch, FolderOpen, ChevronDown, ChevronRight, ExternalLink,
  FileCode, Beaker, Brain, Save, AlertCircle,
  Sparkles, Copy, Check, PenTool, Target, Clock3, ListChecks, MessageSquare,
  Plus, Trash2, AlertTriangle
} from 'lucide-react';
import ReactDOM from 'react-dom';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { api } from '../utils/api';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Read a JSON file from the project via API, return parsed object or null */
async function readProjectJson(projectName, relativePath) {
  try {
    const res = await api.readFile(projectName, relativePath);
    if (!res.ok) return null; // 404 or other error — file doesn't exist yet
    const data = await res.json();
    if (data?.content) return JSON.parse(data.content);
  } catch (e) {
    console.warn(`ResearchLab: failed to read ${relativePath}:`, e.message);
  }
  return null;
}

/** Convert absolute path to relative to project root for API reads; if already relative, return as-is */
function toRelativePath(fullPath, projectRoot) {
  if (!fullPath || typeof fullPath !== 'string') return fullPath;
  const p = fullPath.replace(/\\/g, '/').trim();
  const root = (projectRoot || '').replace(/\\/g, '/').replace(/\/+$/, '') + '/';
  if (root !== '/' && p.startsWith(root)) return p.slice(root.length).replace(/^\/+/, '');
  if (p.startsWith('/') && projectRoot) return p; // absolute but not under projectRoot — keep for display only
  return p;
}

/** Collect all relative file paths from the file tree (for existence checks, to avoid 404s) */
function collectAllRelativePaths(nodes, projectRoot) {
  const out = new Set();
  if (!nodes || !Array.isArray(nodes)) return out;
  const normRoot = projectRoot
    ? (projectRoot.replace(/[/\\]+$/, '') + '/').replace(/\\/g, '/')
    : '';

  function walk(items) {
    for (const item of items) {
      const pathNorm = (item.path || '').replace(/\\/g, '/');
      const rel = normRoot ? pathNorm.replace(normRoot, '').replace(/^\/+/, '') : pathNorm;
      if (item.type === 'file') out.add(rel);
      if (item.type === 'directory' && Array.isArray(item.children)) walk(item.children);
    }
  }
  walk(nodes);
  return out;
}

/** Walk file tree and collect files matching a predicate on the relative path */
function collectFiles(nodes, projectRoot, predicate) {
  const files = [];
  if (!nodes || !Array.isArray(nodes)) return files;
  const normRoot = projectRoot
    ? (projectRoot.replace(/[/\\]+$/, '') + '/').replace(/\\/g, '/')
    : '';

  function walk(items) {
    for (const item of items) {
      const pathNorm = (item.path || '').replace(/\\/g, '/');
      const rel = normRoot ? pathNorm.replace(normRoot, '').replace(/^\/+/, '') : pathNorm;
      if (item.type === 'file' && predicate(rel, item.name)) {
        files.push({ name: item.name, relativePath: rel, path: item.path });
      }
      if (item.type === 'directory' && Array.isArray(item.children)) {
        walk(item.children);
      }
    }
  }
  walk(nodes);
  return files;
}

/** Classify a log JSON file into a pipeline stage based on its name and relative path.
 *  Uses the new semantic directory layout (Ideation/, Experiment/) for primary
 *  classification, with filename-based fallback for legacy cache/ layout. */
function classifyArtifact(name, relativePath) {
  const rp = (relativePath || '').replace(/\\/g, '/');

  // ---- Directory-based classification (new layout) ----
  if (rp.startsWith('Survey/') || rp.startsWith('Research/')) {
    if (rp.includes('/references/')) return { stage: 'Literature Survey', icon: BookOpen, color: 'sky' };
    if (rp.includes('/reports/')) return { stage: 'Gap Analysis', icon: BookOpen, color: 'sky' };
    return { stage: 'Literature Survey', icon: BookOpen, color: 'sky' };
  }
  if (rp.startsWith('Ideation/references/')) {
    if (name === 'load_instance.json') return { stage: 'Data Loading', icon: FolderOpen, color: 'blue' };
    if (name === 'github_search.json') return { stage: 'Data Loading', icon: FolderOpen, color: 'blue' };
    if (name.includes('download_arxiv')) return { stage: 'Data Loading', icon: FolderOpen, color: 'blue' };
    if (name === 'prepare_agent.json') return { stage: 'Prepare', icon: Settings2, color: 'blue' };
    return { stage: 'Prepare', icon: Settings2, color: 'blue' };
  }
  if (rp.startsWith('Ideation/ideas/')) {
    if (name.startsWith('idea_generation')) return { stage: 'Idea Generation', icon: Lightbulb, color: 'amber' };
    if (name.includes('medical_evidence') || name.includes('medical_expert'))
      return { stage: 'Medical Expert', icon: Brain, color: 'rose' };
    if (name.includes('engineering_evidence') || name.includes('engineering_expert'))
      return { stage: 'Engineering Expert', icon: Brain, color: 'indigo' };
    return { stage: 'Idea Generation', icon: Lightbulb, color: 'amber' };
  }
  if (rp.startsWith('Experiment/code_references/')) {
    if (name === 'repo_acquisition_agent.json') return { stage: 'Repo Acquisition', icon: GitBranch, color: 'green' };
    if (name === 'code_survey_agent.json') return { stage: 'Code Survey', icon: FileCode, color: 'cyan' };
    return { stage: 'Code Survey', icon: FileCode, color: 'cyan' };
  }
  if (rp.startsWith('Experiment/core_code/')) {
    if (name === 'coding_plan_agent.json') return { stage: 'Implementation Plan', icon: FileText, color: 'purple' };
    if (name.startsWith('machine_learning')) return { stage: 'ML Development', icon: Beaker, color: 'orange' };
    if (name.startsWith('judge_agent')) return { stage: 'Judge', icon: AlertCircle, color: 'yellow' };
    return { stage: 'ML Development', icon: Beaker, color: 'orange' };
  }
  if (rp.startsWith('Experiment/analysis/')) {
    if (name.startsWith('experiment_analysis')) return { stage: 'Experiment Analysis', icon: Beaker, color: 'teal' };
    if (name.startsWith('machine_learning')) return { stage: 'ML Development', icon: Beaker, color: 'orange' };
    return { stage: 'Experiment Analysis', icon: Beaker, color: 'teal' };
  }
  if (
    rp.startsWith('Promotion/')
    || rp.startsWith('Presentation/')
    || rp.startsWith('Publication/homepage/')
    || rp.startsWith('Publication/slide/')
  ) {
    if (rp.includes('/homepage/'))
      return { stage: 'Homepage Delivery', icon: FileText, color: 'pink' };
    if (rp.includes('slides/') || rp.includes('/slide/') || name.endsWith('.png') || name.endsWith('.jpg'))
      return { stage: 'Slide Generation', icon: FileText, color: 'pink' };
    if (name.endsWith('.mp3') || name.endsWith('.wav'))
      return { stage: 'TTS Audio', icon: FileText, color: 'pink' };
    if (name.endsWith('.mp4'))
      return { stage: 'Video Assembly', icon: FileText, color: 'pink' };
    return { stage: 'Slide Generation', icon: FileText, color: 'pink' };
  }
  if (rp.startsWith('Publication/')) {
    return { stage: 'Paper Writing', icon: PenTool, color: 'purple' };
  }

  // ---- Filename-based fallback (legacy cache/ layout) ----
  if (relativePath?.includes('/tools/') || name === 'load_instance.json')
    return { stage: 'Data Loading', icon: FolderOpen, color: 'blue' };
  if (name === 'github_search.json') return { stage: 'Data Loading', icon: FolderOpen, color: 'blue' };
  if (name.includes('download_arxiv')) return { stage: 'Data Loading', icon: FolderOpen, color: 'blue' };
  if (name === 'prepare_agent.json') return { stage: 'Prepare', icon: Settings2, color: 'blue' };
  if (name.startsWith('idea_generation')) return { stage: 'Idea Generation', icon: Lightbulb, color: 'amber' };
  if (name.includes('medical_evidence') || name.includes('medical_expert'))
    return { stage: 'Medical Expert', icon: Brain, color: 'rose' };
  if (name.includes('engineering_evidence') || name.includes('engineering_expert'))
    return { stage: 'Engineering Expert', icon: Brain, color: 'indigo' };
  if (name === 'repo_acquisition_agent.json') return { stage: 'Repo Acquisition', icon: GitBranch, color: 'green' };
  if (name === 'code_survey_agent.json') return { stage: 'Code Survey', icon: FileCode, color: 'cyan' };
  if (name === 'coding_plan_agent.json') return { stage: 'Implementation Plan', icon: FileText, color: 'purple' };
  if (name.startsWith('machine_learning')) return { stage: 'ML Development', icon: Beaker, color: 'orange' };
  if (name.startsWith('judge_agent')) return { stage: 'Judge', icon: AlertCircle, color: 'yellow' };
  if (name.startsWith('experiment_analysis')) return { stage: 'Experiment Analysis', icon: Beaker, color: 'teal' };
  if (relativePath?.startsWith('Research/') || relativePath?.startsWith('Survey/'))
    return { stage: 'Literature Survey', icon: BookOpen, color: 'sky' };
  return { stage: 'Other', icon: FileText, color: 'gray' };
}

const BADGE_COLORS = {
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
};

const IDEATION_STAGES = new Set([
  'Data Loading',
  'Prepare',
  'Idea Generation',
  'Medical Expert',
  'Engineering Expert',
]);

const EXPERIMENT_STAGES = new Set([
  'Repo Acquisition',
  'Code Survey',
  'Implementation Plan',
  'ML Development',
  'Judge',
  'Experiment Analysis',
  'Other',
]);

const PUBLICATION_STAGES = new Set(['Paper Writing']);
const PRESENTATION_STAGES = new Set(['Homepage Delivery', 'Slide Generation', 'TTS Audio', 'Video Assembly']);
const DEFAULT_RESEARCH_BRIEF_FILENAME = 'research_brief.json';
const DEFAULT_TASKS_FILENAME = 'tasks.json';
const TASK_STAGE_ORDER = ['survey', 'ideation', 'experiment', 'publication', 'promotion', 'unassigned'];
const TASK_STAGE_META = {
  survey: { label: 'Survey', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  ideation: { label: 'Ideation', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  experiment: { label: 'Experiment', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' },
  publication: { label: 'Publication', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  promotion: { label: 'Promotion', className: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' },
  unassigned: { label: 'Unassigned', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};
const TASK_STATUS_META = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  done: { label: 'Done', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  review: { label: 'Review', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  deferred: { label: 'Deferred', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};
const ARTIFACT_STAGE_ORDER = [
  'Literature Survey',
  'Gap Analysis',
  'Data Loading',
  'Prepare',
  'Idea Generation',
  'Medical Expert',
  'Engineering Expert',
  'Repo Acquisition',
  'Code Survey',
  'Implementation Plan',
  'ML Development',
  'Judge',
  'Experiment Analysis',
  'Paper Writing',
  'Homepage Delivery',
  'Slide Generation',
  'TTS Audio',
  'Video Assembly',
  'Other',
];

function sortArtifactsByStageAndPath(files) {
  const rank = new Map(ARTIFACT_STAGE_ORDER.map((stage, index) => [stage, index]));
  return [...files].sort((left, right) => {
    const leftStage = classifyArtifact(left.name, left.relativePath).stage;
    const rightStage = classifyArtifact(right.name, right.relativePath).stage;
    const leftRank = rank.get(leftStage) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(rightStage) ?? Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.relativePath.localeCompare(right.relativePath);
  });
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v']);
const UNSUPPORTED_BINARY_EXTENSIONS = new Set([
  'zip', 'gz', 'tar', 'tgz', '7z', 'rar',
  'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx',
  'bin', 'npy', 'npz', 'pkl', 'pt', 'pth', 'ckpt', 'onnx',
]);

function getArtifactPreviewKind(file) {
  const name = file?.name || file?.relativePath || '';
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

  if (extension === 'pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (UNSUPPORTED_BINARY_EXTENSIONS.has(extension)) return 'unsupported';
  return 'text';
}

/* ------------------------------------------------------------------ */
/*  Sub-components (cards)                                             */
/* ------------------------------------------------------------------ */

/** Overview card: target paper, task, mode */
function OverviewCard({ instance, config }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const mode = config?.task_level === 'task1' ? 'Plan' : 'Idea';
  const modeColor = mode === 'Plan'
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  const taskText = instance?.task2 || instance?.task1 || instance?.ideas || '';
  const shouldTruncate = taskText.length > 400;
  const displayedText = (shouldTruncate && !isExpanded)
    ? taskText.slice(0, 400) + '…'
    : taskText;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Research Overview
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${modeColor}`}>
          {mode} Mode
        </span>
      </div>
      {instance?.target && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Target Paper</p>
          <p className="text-sm font-medium text-foreground">{instance.target}</p>
          {instance?.url && (
            <a href={instance.url} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-0.5">
              {instance.url} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
      {(instance?.instance_id ?? instance?.instance_path) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Instance: <code className="bg-muted px-1 rounded">{instance.instance_id ?? instance.instance_path?.split('/').pop()}</code></span>
          {config?.category && <span>Category: <code className="bg-muted px-1 rounded">{config.category}</code></span>}
        </div>
      )}
      {taskText && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Task Description</p>
          <div className="text-sm text-foreground/80 leading-relaxed markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                li: ({node, ...props}) => <li className="mb-0.5" {...props} />,
                code: ({node, inline, className, children, ...props}) => {
                  return inline ? (
                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="block bg-muted p-2 rounded text-xs font-mono whitespace-pre-wrap my-2" {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {displayedText}
            </ReactMarkdown>
          </div>
          {shouldTruncate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-0 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <span className="flex items-center">
                  <ChevronDown className="w-3 h-3 mr-1" /> Show less
                </span>
              ) : (
                <span className="flex items-center">
                  <ChevronRight className="w-3 h-3 mr-1" /> Show more
                </span>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Source papers list */
function PapersCard({ papers }) {
  const [expanded, setExpanded] = useState(false);
  if (!papers || papers.length === 0) return null;
  const shown = expanded ? papers : papers.slice(0, 5);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        Source Papers
        <span className="text-xs font-normal text-muted-foreground">({papers.length})</span>
      </h3>
      <ul className="space-y-1.5">
        {shown.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="text-xs text-muted-foreground mt-0.5 w-5 text-right flex-shrink-0">{p.rank || i + 1}.</span>
            <div className="min-w-0">
              <span className="text-foreground">{p.reference}</span>
              {p.type && (() => {
                const types = Array.isArray(p.type) ? p.type : [p.type];
                const label = types.join(', ');
                const cls = label.includes('methodolog') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  label.includes('component') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
                return <span className={`ml-2 text-xs px-1.5 py-0 rounded ${cls}`}>{label}</span>;
              })()}
            </div>
          </li>
        ))}
      </ul>
      {papers.length > 5 && (
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
          {expanded ? 'Show less' : `Show all ${papers.length} papers`}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

function StageSection({ title, icon: Icon, badgeClass, expanded, onToggle, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 text-left hover:bg-muted/40 rounded-md px-1.5 py-1"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Icon className="w-4 h-4" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>Stage</span>
      </button>
      {expanded && <div className="space-y-3">{children}</div>}
    </div>
  );
}

function TaskPipelineBoard({ tasks, isLoading, onNavigateToChat, projectName, onTaskUpdated }) {
  const { t } = useTranslation('common');
  const [openStages, setOpenStages] = useState({});
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [addingToStage, setAddingToStage] = useState(null);
  const [addForm, setAddForm] = useState({ title: '', description: '' });
  const [addingTask, setAddingTask] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);

  // Clear all interaction state when project changes
  useEffect(() => {
    setEditingTaskId(null);
    setEditForm({ title: '', description: '' });
    setAddingToStage(null);
    setAddForm({ title: '', description: '' });
    setDeleteConfirmTask(null);
  }, [projectName]);

  const handleDoubleClick = useCallback((task) => {
    setEditingTaskId(String(task.id));
    setEditForm({ title: task.title || '', description: task.description || '' });
  }, []);

  const handleCancel = useCallback(() => {
    setEditingTaskId(null);
    setEditForm({ title: '', description: '' });
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingTaskId || !projectName) return;
    setSaving(true);
    try {
      await api.taskmaster.updateTask(
        encodeURIComponent(projectName),
        editingTaskId,
        { title: editForm.title, description: editForm.description },
      );
      if (onTaskUpdated) onTaskUpdated();
    } catch (e) {
      console.error('Failed to update task:', e);
    } finally {
      setSaving(false);
      setEditingTaskId(null);
      setEditForm({ title: '', description: '' });
    }
  }, [editingTaskId, editForm, projectName, onTaskUpdated]);

  const handleAddTask = useCallback(async () => {
    if (!addForm.title.trim() || !projectName || !addingToStage) return;
    setAddingTask(true);
    try {
      await api.taskmaster.addTask(
        encodeURIComponent(projectName),
        {
          title: addForm.title.trim(),
          description: addForm.description.trim() || addForm.title.trim(),
          priority: 'medium',
          stage: addingToStage.stage === 'unassigned' ? undefined : addingToStage.stage,
          insertAfterId: addingToStage.insertAfterId,
        },
      );
      if (onTaskUpdated) onTaskUpdated();
    } catch (e) {
      console.error('Failed to add task:', e);
    } finally {
      setAddingTask(false);
      setAddingToStage(null);
      setAddForm({ title: '', description: '' });
    }
  }, [addForm, addingToStage, projectName, onTaskUpdated]);

  const handleCancelAdd = useCallback(() => {
    setAddingToStage(null);
    setAddForm({ title: '', description: '' });
  }, []);

  const handleDeleteTask = useCallback(async () => {
    if (!deleteConfirmTask || !projectName) return;
    setDeletingTask(true);
    try {
      await api.taskmaster.deleteTask(
        encodeURIComponent(projectName),
        String(deleteConfirmTask.id),
      );
      if (onTaskUpdated) onTaskUpdated();
    } catch (e) {
      console.error('Failed to delete task:', e);
    } finally {
      setDeletingTask(false);
      setDeleteConfirmTask(null);
    }
  }, [deleteConfirmTask, projectName, onTaskUpdated]);

  useEffect(() => {
    setOpenStages((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return { survey: true, ideation: true, experiment: true, publication: true, promotion: true, unassigned: false };
    });
  }, [tasks]);

  const normalizedTasks = useMemo(
    () => (Array.isArray(tasks) ? tasks : []).map((task) => ({
      ...task,
      stage: task?.stage === 'presentation'
        ? 'promotion'
        : task?.stage === 'research'
          ? 'survey'
        : (TASK_STAGE_META[task?.stage] ? task.stage : 'unassigned'),
      status: TASK_STATUS_META[task?.status] ? task.status : 'pending',
    })),
    [tasks],
  );

  const summary = useMemo(() => {
    const total = normalizedTasks.length;
    const done = normalizedTasks.filter((task) => task.status === 'done').length;
    const inProgress = normalizedTasks.filter((task) => task.status === 'in-progress').length;
    const pending = normalizedTasks.filter((task) => task.status === 'pending').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, pending, progress };
  }, [normalizedTasks]);

  const groupedTasks = useMemo(() => {
    const groups = {
      survey: [],
      ideation: [],
      experiment: [],
      publication: [],
      promotion: [],
      unassigned: [],
    };
    normalizedTasks.forEach((task) => {
      groups[task.stage].push(task);
    });
    Object.values(groups).forEach((list) => {
      list.sort((a, b) => Number(a.id) - Number(b.id));
    });
    return groups;
  }, [normalizedTasks]);

  const firstPendingTaskId = useMemo(() => {
    const first = normalizedTasks.find((task) => task.status === 'pending');
    return first ? String(first.id) : null;
  }, [normalizedTasks]);

  const toggleStage = useCallback((stage) => {
    setOpenStages((prev) => ({ ...prev, [stage]: !(prev[stage] ?? false) }));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-sky-50 via-cyan-50 to-emerald-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-border flex items-center justify-center">
              <ListChecks className="w-4 h-4 text-cyan-700 dark:text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Pipeline Task List
              </h3>
              <p className="text-xs text-muted-foreground">
                Stage-oriented task board for your research pipeline
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading pipeline tasks...</div>
        ) : summary.total === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No tasks found yet. Start a conversation in Chat to generate your research pipeline and tasks.
            </p>
            {onNavigateToChat && (
              <Button
                size="sm"
                className="text-white bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 hover:from-cyan-400 hover:via-sky-400 hover:to-emerald-400"
                onClick={() => onNavigateToChat()}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Go to Chat
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Total</p>
                <p className="text-sm font-semibold text-foreground">{summary.total}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Done</p>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">{summary.done}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">In Progress</p>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{summary.inProgress}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Pending</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{summary.pending}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Progress</span>
                <span>{summary.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${summary.progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              {TASK_STAGE_ORDER.map((stage) => {
                const stageTasks = groupedTasks[stage] || [];
                // Always show pipeline stages; hide unassigned when empty
                if (stage === 'unassigned' && stageTasks.length === 0) return null;
                const isOpen = openStages[stage] ?? true;
                const meta = TASK_STAGE_META[stage];

                const isAddingHere = (afterId) =>
                  addingToStage?.stage === stage && addingToStage?.insertAfterId === afterId;

                const renderInsertionPoint = (afterId, key) =>
                  isAddingHere(afterId) ? (
                    <div key={key} className="px-3 py-2 border-b border-border bg-muted/20">
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          className="w-full text-sm font-medium text-foreground bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          value={addForm.title}
                          onChange={(e) => setAddForm((prev) => ({ ...prev, title: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddTask(); }
                            if (e.key === 'Escape') handleCancelAdd();
                          }}
                          disabled={addingTask}
                          autoFocus
                          placeholder="Task title"
                        />
                        <textarea
                          className="w-full text-xs text-muted-foreground bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-y min-h-[2.5rem]"
                          value={addForm.description}
                          onChange={(e) => setAddForm((prev) => ({ ...prev, description: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTask(); }
                            if (e.key === 'Escape') handleCancelAdd();
                          }}
                          disabled={addingTask}
                          rows={2}
                          placeholder="Task description (optional)"
                        />
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" className="h-6 px-2 text-[10px]" onClick={handleAddTask} disabled={addingTask || !addForm.title.trim()}>
                            <Plus className="w-3 h-3 mr-1" />
                            {addingTask ? 'Adding...' : 'Add'}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={handleCancelAdd} disabled={addingTask}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={key} className="group/insert relative h-0">
                      <button
                        type="button"
                        onClick={() => setAddingToStage({ stage, insertAfterId: afterId })}
                        className="absolute inset-x-0 -top-2 -bottom-2 z-10 flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                          <Plus className="w-3 h-3" />
                          <span className="text-[10px]">Insert</span>
                        </div>
                      </button>
                    </div>
                  );

                return (
                  <div key={stage} className="rounded-lg border border-border overflow-hidden pb-2">
                    <div className="flex items-center hover:bg-muted/40">
                      <button
                        type="button"
                        onClick={() => toggleStage(stage)}
                        className="flex-1 px-3 py-2 flex items-center gap-2 text-left"
                      >
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.className}`}>{meta.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{stageTasks.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingToStage({ stage, insertAfterId: null }); if (!isOpen) toggleStage(stage); }}
                        className="p-1.5 mr-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Add task at beginning"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-border bg-background/60">
                        {/* Insertion point before first task */}
                        {renderInsertionPoint(null, `${stage}-insert-top`)}
                        {stageTasks.map((task) => {
                          const statusMeta = TASK_STATUS_META[task.status] || TASK_STATUS_META.pending;
                          const isFirstPendingTask = task.status === 'pending' && String(task.id) === firstPendingTaskId;
                          const isEditing = editingTaskId === String(task.id);
                          const cardTone = task.status === 'done'
                            ? 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/70 dark:bg-emerald-950/20'
                            : task.status === 'in-progress'
                              ? 'border-blue-200/80 bg-blue-50/40 dark:border-blue-900/70 dark:bg-blue-950/20'
                              : 'border-slate-200/80 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/20';
                          return (
                            <React.Fragment key={`${stage}-${task.id}`}>
                            <div
                              className={`group mx-2 my-2 rounded-xl border px-3 py-2.5 transition-all ${
                                isFirstPendingTask && !isEditing ? 'ring-1 ring-emerald-300/60 dark:ring-emerald-700/60' : ''
                              } ${cardTone} ${!isEditing ? 'cursor-pointer hover:shadow-sm hover:border-cyan-300/70 dark:hover:border-cyan-800/70' : 'border-cyan-400/70 dark:border-cyan-700/70 bg-cyan-50/40 dark:bg-cyan-950/20'}`}
                              onDoubleClick={!isEditing ? () => handleDoubleClick(task) : undefined}
                              title={!isEditing ? t('researchLabTaskBoard.doubleClickToEdit') : undefined}
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-background/90 border border-border text-muted-foreground mt-0.5">#{task.id}</span>
                                <div className="min-w-0 flex-1">
                                  {isEditing ? (
                                    <div className="space-y-1.5">
                                      <input
                                        type="text"
                                        className="w-full text-sm font-medium text-foreground bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                        value={editForm.title}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                                          if (e.key === 'Escape') handleCancel();
                                        }}
                                        disabled={saving}
                                        autoFocus
                                        placeholder={t('researchLabTaskBoard.taskTitlePlaceholder')}
                                      />
                                      <textarea
                                        className="w-full text-xs text-muted-foreground bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-y min-h-[2.5rem]"
                                        value={editForm.description}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
                                          if (e.key === 'Escape') handleCancel();
                                        }}
                                        disabled={saving}
                                        rows={2}
                                        placeholder={t('researchLabTaskBoard.taskDescriptionPlaceholder')}
                                      />
                                      <div className="flex items-center gap-1.5">
                                        <Button
                                          size="sm"
                                          className="h-6 px-2 text-[10px]"
                                          onClick={handleSave}
                                          disabled={saving}
                                        >
                                          <Check className="w-3 h-3 mr-1" />
                                          {saving ? t('researchLabTaskBoard.saving') : t('buttons.save')}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-[10px]"
                                          onClick={handleCancel}
                                          disabled={saving}
                                        >
                                          {t('buttons.cancel')}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-sm font-semibold text-foreground line-clamp-2">{task.title || t('researchLabTaskBoard.untitledTask')}</p>
                                      {task.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                                      )}
                                      <p className="text-[10px] text-muted-foreground/80 mt-1 inline-flex items-center gap-1">
                                        <PenTool className="w-3 h-3" />
                                        {t('researchLabTaskBoard.editHint')}
                                      </p>
                                    </>
                                  )}
                                  {!isEditing && Array.isArray(task.suggestedSkills) && task.suggestedSkills.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {task.suggestedSkills.slice(0, 3).map((skill) => (
                                        <span key={`${task.id}-${skill}`} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {!isEditing && (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusMeta.className}`}>{statusMeta.label}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] border border-border/70 hover:border-cyan-400/70"
                                        onClick={() => handleDoubleClick(task)}
                                      >
                                        <PenTool className="w-3 h-3 mr-1" />
                                        {t('buttons.edit')}
                                      </Button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmTask(task); }}
                                        className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete task"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    {isFirstPendingTask && onNavigateToChat && (
                                      <div className="mt-0.5 inline-flex flex-col items-end gap-1">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 animate-pulse">
                                          Next
                                        </span>
                                        <Button
                                          size="sm"
                                          className="h-7 px-2.5 text-[11px] font-semibold text-white bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 hover:from-cyan-400 hover:via-sky-400 hover:to-emerald-400 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_8px_18px_rgba(16,185,129,0.35)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_20px_rgba(34,211,238,0.35)] transition-all"
                                          onClick={() => onNavigateToChat()}
                                        >
                                          <Sparkles className="w-3 h-3 mr-1.5" />
                                          <MessageSquare className="w-3 h-3 mr-1" />
                                          Go to Chat
                                        </Button>
                                      </div>
                                    )}
                                    {task.status === 'in-progress' && (
                                      <span className="text-[10px] text-blue-600 dark:text-blue-300 inline-flex items-center gap-1">
                                        <Clock3 className="w-3 h-3" />
                                        Active
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                              {/* Insertion point after this task */}
                              {renderInsertionPoint(task.id, `${stage}-insert-after-${task.id}`)}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {deleteConfirmTask && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-1">Delete Task</h3>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete{' '}
                    <span className="font-medium text-foreground">#{deleteConfirmTask.id} {deleteConfirmTask.title}</span>?
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">This action cannot be undone.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-4 bg-muted/30 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmTask(null)} disabled={deletingTask}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeleteTask} disabled={deletingTask}>
                <Trash2 className="w-4 h-4 mr-1.5" />
                {deletingTask ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Research artifacts grouped by pipeline stage */
function ArtifactsCard({ artifacts, onSelect, selectedPath }) {
  const [openStages, setOpenStages] = useState({});

  // Group by stage
  const groups = {};
  for (const a of artifacts) {
    const info = classifyArtifact(a.name, a.relativePath);
    if (!groups[info.stage]) groups[info.stage] = { ...info, files: [] };
    groups[info.stage].files.push(a);
  }
  const sorted = [
    ...ARTIFACT_STAGE_ORDER.filter((stage) => groups[stage]).map((stage) => ({ stage, ...groups[stage] })),
    ...Object.keys(groups)
      .filter((stage) => !ARTIFACT_STAGE_ORDER.includes(stage))
      .sort((left, right) => left.localeCompare(right))
      .map((stage) => ({ stage, ...groups[stage] })),
  ];

  const toggle = (stage, defaultOpen) => setOpenStages(prev => ({ ...prev, [stage]: !(prev[stage] ?? defaultOpen) }));

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Beaker className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          Artifacts Explorer
        </h3>
        <span className="text-xs text-muted-foreground">{artifacts.length} files</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Browse artifacts generated across the 5-stage pipeline: Survey, Ideation, Experiment, Publication, and Promotion.
      </p>
      {artifacts.length === 0 ? (
        <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-4">
          No stage artifacts found yet. Use the <code className="bg-muted px-1 rounded">inno-pipeline-planner</code> skill in Chat to start a pipeline, then refresh after tasks run.
        </div>
      ) : (
        <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
          {sorted.map(g => {
            const Icon = g.icon;
            const isStageSelected = g.files.some((file) => file.relativePath === selectedPath);
            const defaultOpen = isStageSelected || (!selectedPath && sorted[0]?.stage === g.stage);
            const isOpen = openStages[g.stage] ?? defaultOpen;
            return (
              <div key={g.stage}>
                <button onClick={() => toggle(g.stage, defaultOpen)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-foreground">{g.stage}</span>
                  <span className={`ml-auto text-xs px-1.5 py-0 rounded ${BADGE_COLORS[g.color]}`}>
                    {g.files.length}
                  </span>
                </button>
                {isOpen && (
                  <ul className="ml-6 pl-2 border-l border-border space-y-0.5 py-1">
                    {g.files.map(f => (
                      <li key={f.relativePath}>
                        <button onClick={() => onSelect(f)}
                          className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 truncate ${
                            selectedPath === f.relativePath
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}>
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Markdown components for IdeaCard                                   */
/* ------------------------------------------------------------------ */
const ideaMarkdownComponents = {
  h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mt-5 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground mt-4 mb-2 border-b border-border pb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mt-3 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h4>,
  p: ({ children }) => <p className="text-sm text-foreground/85 leading-relaxed mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside text-sm text-foreground/85 mb-2 space-y-0.5 ml-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-foreground/85 mb-2 space-y-0.5 ml-2">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-300 dark:border-blue-600 pl-3 italic text-foreground/70 my-2 text-sm">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">{children}</code>;
    }
    const lang = (className || '').replace('language-', '');
    return (
      <div className="my-2 rounded-lg overflow-hidden border border-border">
        {lang && <div className="bg-muted/60 px-3 py-1 text-xs text-muted-foreground font-mono border-b border-border">{lang}</div>}
        <pre className="bg-muted/30 p-3 overflow-x-auto text-xs">
          <code className="font-mono text-foreground/90">{children}</code>
        </pre>
      </div>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
};

/** Markdown component overrides */
const markdownComponents = {
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-300 dark:border-blue-600 pl-3 italic text-foreground/70 my-2 text-sm">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">{children}</code>;
    }
    const lang = (className || '').replace('language-', '');
    return (
      <div className="my-2 rounded-lg overflow-hidden border border-border">
        {lang && <div className="bg-muted/60 px-3 py-1 text-xs text-muted-foreground font-mono border-b border-border">{lang}</div>}
        <pre className="bg-muted/30 p-3 overflow-x-auto text-xs">
          <code className="font-mono text-foreground/90">{children}</code>
        </pre>
      </div>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-border text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-1.5 text-left text-xs font-semibold border border-border">{children}</th>,
  td: ({ children }) => <td className="px-3 py-1.5 align-top text-xs border border-border">{children}</td>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-3 border-border" />,
};

/** Read a text file from the project via API, return string or null */
async function readProjectText(projectName, relativePath) {
  try {
    const res = await api.readFile(projectName, relativePath);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.content) return data.content;
  } catch (e) {
    console.warn(`ResearchLab: failed to read text ${relativePath}:`, e.message);
  }
  return null;
}

/** Helper: only request file if it might exist (avoids 404s when project has no pipeline output yet) */
function hasFile(fileSet, relativePath) {
  if (!fileSet) return false;
  return fileSet.has(relativePath);
}

/** Final Idea card — shows the selected idea rendered as markdown */
function IdeaCard({ projectName, config, projectFileSet }) {
  const [ideaText, setIdeaText] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = useMemo(() => [rehypeKatex], []);

  useEffect(() => {
    if (!projectName) { setLoading(false); return; }
    // Wait for file tree to load so we can avoid probing missing files (prevents 404 spam).
    if (projectFileSet === null) { setLoading(true); return; }

    setLoading(true);

    (async () => {
      try {
        // --- New layout or legacy path: prefer config.ideas_path_relative (compat with old projects) ---
        const ideasDir = config?.ideas_path_relative || 'Ideation/ideas';

        // 1. Primary: read selected_idea.txt from ideas dir (skip request if file not in tree to avoid 404)
        const selectedPath = `${ideasDir}/selected_idea.txt`;
        if (hasFile(projectFileSet, selectedPath)) {
          const selectedTxt = await readProjectText(projectName, selectedPath);
          if (selectedTxt) {
            setIdeaText(selectedTxt);
            setLoading(false);
            return;
          }
        }

        // 2. Fallback: read raw_idea_N.txt in reverse order (latest first)
        for (let i = 10; i >= 1; i--) {
          const rawPath = `${ideasDir}/raw_idea_${i}.txt`;
          if (!hasFile(projectFileSet, rawPath)) continue;
          const rawTxt = await readProjectText(projectName, rawPath);
          if (rawTxt) {
            setIdeaText(rawTxt);
            setLoading(false);
            return;
          }
        }

        // 3. Fallback: read from logs JSON
        const selectFile = `${ideasDir}/logs/idea_generation_agent_iter_select.json`;
        if (hasFile(projectFileSet, selectFile)) {
          const selectData = await readProjectJson(projectName, selectFile);
          if (selectData?.context_variables?.final_selected_idea_data) {
            const data = selectData.context_variables.final_selected_idea_data;
            setIdeaText(data.selected_idea_text || data.raw_idea || null);
            setLoading(false);
            return;
          }
        }

        // --- Legacy layout: cache_path based ---
        if (config?.cache_path) {
          const cachePath = config.cache_path;
          const relativeCacheBase = cachePath.includes('/outputs/')
            ? 'outputs/' + cachePath.split('/outputs/')[1]
            : cachePath;
          const cacheDir = relativeCacheBase.replace(/\/+$/, '');

          const legacySelectedPath = `${cacheDir}/selected_idea.txt`;
          if (hasFile(projectFileSet, legacySelectedPath)) {
            const legacySelected = await readProjectText(projectName, legacySelectedPath);
            if (legacySelected) {
              setIdeaText(legacySelected);
              setLoading(false);
              return;
            }
          }
          for (let i = 10; i >= 1; i--) {
            const rawPath = `${cacheDir}/raw_idea_${i}.txt`;
            if (!hasFile(projectFileSet, rawPath)) continue;
            const rawTxt = await readProjectText(projectName, rawPath);
            if (rawTxt) {
              setIdeaText(rawTxt);
              setLoading(false);
              return;
            }
          }
          const legacySelectFile = `${cacheDir}/agents/idea_generation_agent_iter_select.json`;
          if (hasFile(projectFileSet, legacySelectFile)) {
            const legacyData = await readProjectJson(projectName, legacySelectFile);
            if (legacyData?.context_variables?.final_selected_idea_data) {
              const data = legacyData.context_variables.final_selected_idea_data;
              setIdeaText(data.selected_idea_text || data.raw_idea || null);
              setLoading(false);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('IdeaCard: failed to load idea:', e.message);
      }
      setIdeaText(null);
      setLoading(false);
    })();
  }, [projectName, config, projectFileSet]);

  const handleCopy = useCallback(() => {
    if (!ideaText) return;
    navigator.clipboard.writeText(ideaText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [ideaText]);

  if (loading) return null;
  if (!ideaText) return null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          Final Selected Idea
        </h3>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            title="Copy to clipboard"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-600" />
              : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </div>
      </div>

      {/* Body — markdown rendered */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 max-h-[600px] overflow-y-auto">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={ideaMarkdownComponents}
          >
            {ideaText}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

/** Paper (main.pdf) viewer — shows Publication/paper/main.pdf when present */
function PaperCard({ projectName, projectRoot }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'not_found' | 'error'
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!projectName || !projectRoot) {
      setStatus('not_found');
      return;
    }
    const absolutePath = `${projectRoot.replace(/\\/g, '/').replace(/\/+$/, '')}/Publication/paper/main.pdf`;
    setStatus('loading');
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    api.getFileContentBlob(projectName, absolutePath)
      .then((blob) => {
        setPdfUrl(URL.createObjectURL(blob));
        setStatus('loaded');
      })
      .catch((err) => {
        setStatus(err?.message === 'Not found' ? 'not_found' : 'error');
      });
    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [projectName, projectRoot]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <PenTool className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          Paper (main.pdf)
        </h3>
        {status === 'loaded' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener');
            }}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            Open in new tab
          </Button>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </div>
      {expanded && (
        <div className="border-t border-border">
          {status === 'loading' && (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading paper…</div>
          )}
          {status === 'loaded' && pdfUrl && (
            <div className="relative w-full" style={{ minHeight: '60vh' }}>
              <iframe
                title="Paper (main.pdf)"
                src={pdfUrl}
                className="w-full border-0 rounded-b-lg"
                style={{ height: '70vh' }}
              />
            </div>
          )}
          {status === 'not_found' && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <p>No <code className="bg-muted px-1 rounded">main.pdf</code> found.</p>
              <p className="mt-1">Run the <strong>inno-paper-writing</strong> skill and output the paper to <code className="bg-muted px-1 rounded">Publication/paper/</code> to view it here.</p>
            </div>
          )}
          {status === 'error' && (
            <div className="p-6 text-center text-sm text-destructive">
              Failed to load the paper. Check that <code className="bg-muted px-1 rounded">Publication/paper/main.pdf</code> exists and try again.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** File viewer / editor panel */
function FileViewer({ projectName, file, onClose }) {
  const [content, setContent] = useState('');
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const previewKind = useMemo(() => getArtifactPreviewKind(file), [file]);
  const isTextEditable = previewKind === 'text';
  const supportsBlobPreview = previewKind === 'pdf' || previewKind === 'image' || previewKind === 'audio' || previewKind === 'video';
  const viewerHeight = previewKind === 'pdf'
    ? '70vh'
    : previewKind === 'video'
      ? '32rem'
      : previewKind === 'image'
        ? '30rem'
        : '28rem';

  useEffect(() => {
    if (!file) return;
    let objectUrl = null;
    let cancelled = false;

    setLoading(true);
    setDirty(false);
    setSaveStatus(null);
    setLoadError(null);
    setContent('');
    setBlobUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    const loadPreview = async () => {
      try {
        if (supportsBlobPreview) {
          const absolutePath = file.path || file.absolutePath;
          if (!absolutePath) {
            throw new Error('Missing absolute path for binary preview.');
          }

          const blob = await api.getFileContentBlob(projectName, absolutePath);
          if (cancelled) return;

          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
          return;
        }

        if (previewKind === 'unsupported') {
          return;
        }

        const response = await api.readFile(projectName, file.relativePath);
        if (!response?.ok) {
          throw new Error(`Failed to load file: ${response?.status || 'unknown error'}`);
        }

        const rawText = await response.text();
        if (cancelled) return;

        if (!rawText) {
          setContent('');
          return;
        }

        try {
          const data = JSON.parse(rawText);
          setContent(data?.content ?? '');
        } catch {
          // Fallback for non-JSON responses.
          setContent(rawText);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error?.message || 'Failed to load preview.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectName, file, previewKind, supportsBlobPreview]);

  const handleSave = async () => {
    if (!file || !isTextEditable) return;
    setSaveStatus('saving');
    try {
      await api.saveFile(projectName, file.relativePath, content);
      setDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  if (!file) return null;

  return (
    <div
      className="rounded-lg border border-border bg-card flex flex-col overflow-hidden resize-y min-h-[320px] max-h-[85vh]"
      style={{ height: viewerHeight }}
    >
      <div className="border-b border-border px-3 py-2 flex items-center justify-between flex-shrink-0 bg-muted/30">
        <span className="text-xs font-medium text-foreground truncate flex-1 mr-2">{file.relativePath}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveStatus === 'saved' && <span className="text-xs text-green-600">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-600">Failed</span>}
          {blobUrl && supportsBlobPreview && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(blobUrl, '_blank', 'noopener')}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
            </Button>
          )}
          {isTextEditable && (
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={!dirty || loading}>
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>
      </div>
      {loading ? (
        <div className="flex-1 min-h-0 p-4 text-sm text-muted-foreground">Loading...</div>
      ) : loadError ? (
        <div className="flex-1 min-h-0 p-4 text-sm text-destructive">
          Failed to load preview. {loadError}
        </div>
      ) : previewKind === 'pdf' && blobUrl ? (
        <div className="flex-1 min-h-0 bg-background">
          <iframe
            title={file.name}
            src={blobUrl}
            className="w-full h-full border-0"
          />
        </div>
      ) : previewKind === 'image' && blobUrl ? (
        <div className="flex-1 min-h-0 bg-muted/10 overflow-auto p-3">
          <img
            src={blobUrl}
            alt={file.name}
            className="max-w-full h-auto mx-auto rounded-md border border-border"
          />
        </div>
      ) : previewKind === 'audio' && blobUrl ? (
        <div className="flex-1 min-h-0 p-4 flex items-center justify-center bg-background">
          <audio src={blobUrl} controls className="w-full max-w-md" />
        </div>
      ) : previewKind === 'video' && blobUrl ? (
        <div className="flex-1 min-h-0 bg-background p-3">
          <video src={blobUrl} controls className="w-full h-full rounded-md border border-border bg-black" />
        </div>
      ) : previewKind === 'unsupported' ? (
        <div className="flex-1 min-h-0 p-4 text-sm text-muted-foreground">
          This file type cannot be previewed inline here yet.
        </div>
      ) : (
        <textarea
          className="flex-1 min-h-0 h-full w-full p-3 text-xs font-mono bg-background border-0 resize-none focus:outline-none focus:ring-0 text-foreground"
          value={content}
          onChange={e => { setContent(e.target.value); setDirty(true); }}
          spellCheck={false}
        />
      )}
    </div>
  );
}

function ArtifactPreviewEmptyState({ hasArtifacts }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/60 px-4 py-8 text-center">
      <FileText className="w-8 h-8 mx-auto text-muted-foreground/60" />
      <h3 className="mt-3 text-sm font-semibold text-foreground">Artifact Preview</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
        {hasArtifacts
          ? 'Choose a file from Artifacts Explorer to inspect or edit it here.'
          : 'Run the pipeline first, then preview generated artifacts here.'}
      </p>
    </div>
  );
}

function UsageGuideNotice({ t, onNavigateToChat }) {
  const guideSteps = ['step1', 'step2', 'step3', 'step4', 'step5'];

  return (
    <div className="rounded-lg border border-blue-300/60 dark:border-blue-700/60 bg-blue-50/80 dark:bg-blue-900/20 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            {t('researchLabGuide.title')}
          </h3>
          <p className="text-xs text-blue-900/90 dark:text-blue-200/90">
            {t('researchLabGuide.description')}
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-xs text-blue-900/90 dark:text-blue-200/90">
            {guideSteps.map((key) => (
              <li key={key}>{t(`researchLabGuide.${key}`)}</li>
            ))}
          </ol>
          <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
            {t('researchLabGuide.interfaceMap')}
          </p>
          {onNavigateToChat && (
            <Button
              size="sm"
              className="mt-1 text-white bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 hover:from-cyan-400 hover:via-sky-400 hover:to-emerald-400"
              onClick={onNavigateToChat}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Go to Chat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function ResearchLab({ selectedProject, onNavigateToChat }) {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [instance, setInstance] = useState(null);
  const [config, setConfig] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectFileSet, setProjectFileSet] = useState(null);
  const [selectedFile, setSelectedFileRaw] = useState(null);
  const HIDDEN_FILENAMES = useMemo(() => new Set([DEFAULT_RESEARCH_BRIEF_FILENAME, DEFAULT_TASKS_FILENAME]), []);
  const setSelectedFile = useCallback((file) => {
    if (file && HIDDEN_FILENAMES.has(file.name)) return;
    setSelectedFileRaw(file);
  }, [HIDDEN_FILENAMES]);

  const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
  const projectName = selectedProject?.name;
  const projectIdentity = `${projectRoot || ''}::${projectName || ''}`;

  useEffect(() => {
    setSelectedFileRaw(null);
  }, [projectIdentity]);

  const loadData = useCallback(async () => {
    if (!projectName) {
      setInstance(null);
      setConfig(null);
      setArtifacts([]);
      setTasks([]);
      setProjectFileSet(null);
      return;
    }
    setLoading(true);
    setTasksLoading(true);
    setInstance(null);
    setConfig(null);
    try {
      const [tasksResponse, filesResponse] = await Promise.all([
        api.get(`/taskmaster/tasks/${encodeURIComponent(projectName)}`).catch(() => null),
        api.getFiles(projectName),
      ]);
      const taskData = tasksResponse && tasksResponse.ok ? await tasksResponse.json() : null;
      setTasks(Array.isArray(taskData?.tasks) ? taskData.tasks : []);

      // Load file tree and collect log artifacts from new layout + legacy cache
      const filesRawText = filesResponse?.ok ? await filesResponse.text() : '[]';
      let data = [];
      try {
        data = filesRawText ? JSON.parse(filesRawText) : [];
      } catch {
        data = [];
      }
      const tree = Array.isArray(data) ? data : [];
      const fileSet = collectAllRelativePaths(tree, projectRoot);
      setProjectFileSet(fileSet);

      // Optional compatibility: read legacy metadata files only when they exist.
      const hasInstanceFile = fileSet.has('instance.json');
      const hasPipelineConfig = fileSet.has('pipeline_config.json');

      if (hasInstanceFile || hasPipelineConfig) {
        const [inst, pipelineConfig] = await Promise.all([
          hasInstanceFile ? readProjectJson(projectName, 'instance.json') : Promise.resolve(null),
          hasPipelineConfig ? readProjectJson(projectName, 'pipeline_config.json') : Promise.resolve(null),
        ]);

        // Prefer instance.json; merge in pipeline_config for old projects or missing keys
        const merged = inst
          ? { ...(pipelineConfig || {}), ...inst }
          : pipelineConfig
            ? { ...pipelineConfig, instance_path: pipelineConfig.instance_path }
            : null;
        setInstance(merged);

        // Normalize for UI: support both new schema (Ideation.*, Experiment.*, instance) and old (*_path, task_level)
        const ideasPath = merged?.Ideation?.ideas ?? merged?.ideas_path;
        const referencesPath = merged?.Ideation?.references ?? merged?.references_path;
        const surveyReferencesPath = merged?.Survey?.references ?? merged?.survey_references_path;
        const surveyReportsPath = merged?.Survey?.reports ?? merged?.survey_reports_path ?? merged?.Research;
        const conf = merged
          ? {
              ...merged,
              instance: merged.instance ?? merged.instance_path,
              dataset_path: merged.Experiment?.datasets ?? merged.datasets_path,
              task_level: merged.idea_maturity ?? merged.task_level ?? undefined,
              cache_path: merged.cache_path,
              ideas_path: ideasPath,
              references_path: referencesPath,
              survey_references_path: surveyReferencesPath,
              survey_reports_path: surveyReportsPath,
              ideas_path_relative: toRelativePath(ideasPath, projectRoot) || 'Ideation/ideas',
              references_path_relative: toRelativePath(referencesPath, projectRoot) || 'Ideation/references',
              survey_references_path_relative: toRelativePath(surveyReferencesPath, projectRoot) || (surveyReferencesPath ? 'Survey/references' : undefined),
              survey_reports_path_relative: toRelativePath(surveyReportsPath, projectRoot) || (surveyReportsPath ? 'Survey/reports' : undefined),
            }
          : null;
        setConfig(conf);
      }

      const logFiles = collectFiles(tree, projectRoot, (rel) => {
        if (/^(Survey|Research)\//.test(rel)) return true;
        // Promotion: collect all files under Promotion/ and legacy Presentation/.
        if (/^(Promotion|Presentation)\//.test(rel)) return true;
        // Legacy publication outputs that now belong to Promotion.
        if (/^Publication\/(homepage|slide)\//.test(rel)) return true;
        if (!rel.endsWith('.json')) return false;
        // New layout: JSON files inside logs/ dirs under Survey/, Ideation/, or Experiment/
        if (/^(Survey|Ideation|Experiment)\/.*\/logs\//.test(rel)) return true;
        // Publication: any JSON files under Publication/
        if (/^Publication\//.test(rel)) return true;
        // Legacy layout: JSON files inside cache/ directories
        if (/(?:^|\/)cache\//.test(rel)) return true;
        return false;
      });
      // Exclude research_brief.json and tasks.json from user-visible artifacts
      setArtifacts(sortArtifactsByStageAndPath(
        logFiles.filter((f) => !HIDDEN_FILENAMES.has(f.name))
      ));
    } catch (e) {
      console.error('ResearchLab load:', e);
    } finally {
      setLoading(false);
      setTasksLoading(false);
    }
  }, [projectName, projectRoot, HIDDEN_FILENAMES]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!projectName || artifacts.length === 0) {
      setSelectedFileRaw(null);
      return;
    }

    setSelectedFileRaw((current) => {
      if (!current) return artifacts[0];
      return artifacts.find((artifact) => artifact.relativePath === current.relativePath) || artifacts[0];
    });
  }, [artifacts, projectName]);

  const hasContent = instance || config || artifacts.length > 0 || tasks.length > 0;
  const sidebar = (
    <div className="space-y-4">
      <ArtifactsCard
        artifacts={artifacts}
        onSelect={setSelectedFile}
        selectedPath={selectedFile?.relativePath}
      />

      {selectedFile ? (
        <FileViewer
          projectName={projectName}
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      ) : (
        <ArtifactPreviewEmptyState hasArtifacts={artifacts.length > 0} />
      )}
    </div>
  );

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>{t('mainContent.chooseProject') || 'Choose a project'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-foreground">
            {t('tabs.researchLab') || 'Research Lab'}
          </span>
          {config?.task_level && (
            <Badge variant="outline" className="text-xs">
              {config.task_level === 'task1' ? 'Plan' : 'Idea'}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-4 max-w-[1380px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
            <div className="space-y-4 min-w-0">
              <UsageGuideNotice t={t} onNavigateToChat={onNavigateToChat} />

              <div className="lg:hidden">
                {sidebar}
              </div>

              <TaskPipelineBoard
                tasks={tasks}
                isLoading={tasksLoading}
                onNavigateToChat={onNavigateToChat}
                projectName={projectName}
                onTaskUpdated={loadData}
              />

              {loading && !hasContent ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  Loading research data...
                </div>
              ) : !hasContent ? (
                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground text-sm gap-3">
                  <FolderOpen className="w-14 h-14 opacity-40" />
                  <p>No research data found in this project.</p>
                  <p className="text-xs max-w-md text-center">
                    Use the <code className="bg-muted px-1 rounded">inno-pipeline-planner</code> skill in Chat to initialize the 5-stage research pipeline and its artifacts.
                  </p>
                </div>
              ) : (
                <div className="space-y-3" />
              )}
            </div>

            <div className="hidden lg:block lg:sticky lg:top-4">
              {sidebar}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default ResearchLab;
