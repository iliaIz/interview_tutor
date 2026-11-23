/**
 * topicIcons.ts
 * Map of topic icon string identifiers to Lucide icon components.
 */

import {
  Coffee, Boxes, Cpu, Layers, Sparkles, Zap, Leaf,
  ArrowLeftRight, Archive, GitFork, Database, Table,
  Link as LinkIcon, Activity, Server, Globe, Radio,
  CheckCircle2, FileText, Code2, Network, FileCode, Palette
} from 'lucide-react';

export const ICON_MAP: Record<string, any> = {
  'coffee': Coffee,
  'boxes': Boxes,
  'cpu': Cpu,
  'layers': Layers,
  'sparkles': Sparkles,
  'zap': Zap,
  'leaf': Leaf,
  'arrow-left-right': ArrowLeftRight,
  'archive': Archive,
  'git-fork': GitFork,
  'database': Database,
  'table': Table,
  'link': LinkIcon,
  'activity': Activity,
  'server': Server,
  'globe': Globe,
  'radio': Radio,
  'check-circle-2': CheckCircle2,
  'file-text': FileText,
  'code-2': Code2,
  'network': Network,
  'file-code': FileCode,
  'palette': Palette
};
