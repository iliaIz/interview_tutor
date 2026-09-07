import {
  Coffee,
  Boxes,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Leaf,
  ArrowLeftRight,
  Archive,
  GitFork,
  Database,
  Table,
  Link as LinkIcon,
  Activity,
  Server,
  Globe,
  Radio,
  CheckCircle2,
  FileText,
  Code2,
  Network,
  FileCode,
  Palette,
  FolderTree,
  LucideIcon
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
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

export interface DomainMeta {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  desc: string;
}

export const DOMAIN_DEFINITIONS: DomainMeta[] = [
  { id: 'all', title: 'Все разделы', icon: FolderTree, color: '#6366F1', desc: 'Все 24 инженерные темы' },
  { id: 'Core Java & JVM', title: 'Core Java & JVM Internals', icon: Coffee, color: '#E08E89', desc: 'Синтаксис, память, ООП, Collections, Generics & JVM' },
  { id: 'Architecture & Concurrency', title: 'Architecture, Concurrency & Loom', icon: Zap, color: '#8B78E6', desc: 'JMM, Threads, Locks, Virtual Threads & Patterns' },
  { id: 'Data & Storage', title: 'Databases, Storage & ACID', icon: Database, color: '#5A9E96', desc: 'PostgreSQL, SQL, Hibernate, JPA, Транзакции & Redis' },
  { id: 'Web & Enterprise', title: 'Spring Enterprise & Architecture', icon: Server, color: '#4F8A8B', desc: 'Spring Boot, IoC, Spring Data, Security & Microservices' },
  { id: 'Engineering & Tools', title: 'Engineering, Testing & Forensics', icon: Activity, color: '#D97706', desc: 'Kafka, CI/CD, Docker, Тестирование & JFR Profiling' },
  { id: 'Frontend Basics', title: 'Frontend & Web Foundations', icon: Palette, color: '#E67E22', desc: 'Основы HTML, семантика, формы, CSS, Flexbox & Grid' }
];

export function getTopicIcon(iconName?: string): LucideIcon {
  if (!iconName) return Coffee;
  return ICON_MAP[iconName.toLowerCase()] || Coffee;
}
