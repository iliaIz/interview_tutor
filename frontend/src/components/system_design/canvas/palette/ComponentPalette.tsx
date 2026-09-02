import React, { useState } from 'react';
import { 
  Globe, 
  DoorOpen, 
  Server, 
  Database, 
  Zap, 
  MessageSquare, 
  HardDrive, 
  ShieldAlert, 
  ChevronDown, 
  ChevronRight,
  GripVertical
} from 'lucide-react';
import { ArchitectureNodeType, ArchitectureNodeConfig } from '../../../../types/systemDesignCanvas';

interface PaletteItem {
  id: string;
  nodeType: ArchitectureNodeType;
  label: string;
  technology: string;
  icon: React.ReactNode;
  category: 'ingress' | 'compute' | 'storage' | 'messaging' | 'resilience';
  defaultConfig: ArchitectureNodeConfig;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Ingress
  {
    id: 'client_web',
    nodeType: 'client',
    label: 'Клиент (Web/App)',
    technology: 'Web / Mobile Client',
    icon: <Globe className="w-4 h-4 text-sky-500" />,
    category: 'ingress',
    defaultConfig: { technology: 'Web / Mobile Client' }
  },
  {
    id: 'gateway_spring',
    nodeType: 'gateway',
    label: 'API Gateway',
    technology: 'Spring Cloud Gateway',
    icon: <DoorOpen className="w-4 h-4 text-violet-500" />,
    category: 'ingress',
    defaultConfig: { technology: 'Spring Cloud Gateway', replicas: 2, maxRpsCapacity: 15000 }
  },
  // Compute
  {
    id: 'service_spring',
    nodeType: 'service',
    label: 'Spring Boot Service',
    technology: 'Core Microservice',
    icon: <Server className="w-4 h-4 text-emerald-500" />,
    category: 'compute',
    defaultConfig: { technology: 'Spring Boot 3.3', replicas: 3, threadPool: 50, serviceRateMu: 300 }
  },
  {
    id: 'worker_async',
    nodeType: 'service',
    label: 'Async Worker',
    technology: 'Kafka Consumer Node',
    icon: <Server className="w-4 h-4 text-teal-500" />,
    category: 'compute',
    defaultConfig: { technology: 'Spring Batch / Worker', replicas: 2, threadPool: 20 }
  },
  // Storage & Cache
  {
    id: 'db_postgres',
    nodeType: 'database',
    label: 'PostgreSQL Primary',
    technology: 'Patroni PostgreSQL',
    icon: <Database className="w-4 h-4 text-amber-500" />,
    category: 'storage',
    defaultConfig: { technology: 'PostgreSQL 16 (Patroni)', replicas: 2, poolSize: 50, readWriteRatio: 0.8 }
  },
  {
    id: 'cache_redis',
    nodeType: 'cache',
    label: 'Redis Cluster',
    technology: 'Redis Sentinel / Cluster',
    icon: <Zap className="w-4 h-4 text-yellow-500" />,
    category: 'storage',
    defaultConfig: { technology: 'Redis Cluster', replicas: 3, cacheHitRatio: 0.85 }
  },
  {
    id: 'storage_s3',
    nodeType: 'blob_storage',
    label: 'S3 / MinIO Storage',
    technology: 'Object Storage',
    icon: <HardDrive className="w-4 h-4 text-cyan-500" />,
    category: 'storage',
    defaultConfig: { technology: 'AWS S3 / MinIO' }
  },
  // Messaging
  {
    id: 'queue_kafka',
    nodeType: 'queue',
    label: 'Apache Kafka',
    technology: 'Kafka Partitioned Topic',
    icon: <MessageSquare className="w-4 h-4 text-rose-500" />,
    category: 'messaging',
    defaultConfig: { technology: 'Apache Kafka', partitions: 8 }
  },
  // Resilience
  {
    id: 'resilience_cb',
    nodeType: 'circuit_breaker',
    label: 'Circuit Breaker',
    technology: 'Resilience4j',
    icon: <ShieldAlert className="w-4 h-4 text-red-500" />,
    category: 'resilience',
    defaultConfig: { technology: 'Resilience4j' }
  }
];

export const ComponentPalette: React.FC = () => {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    ingress: true,
    compute: true,
    storage: true,
    messaging: true,
    resilience: true
  });

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/reactflow/type', item.nodeType);
    event.dataTransfer.setData('application/reactflow/label', item.label);
    event.dataTransfer.setData('application/reactflow/config', JSON.stringify(item.defaultConfig));
    event.dataTransfer.effectAllowed = 'move';
  };

  const categories = [
    { key: 'ingress', title: 'Клиенты и шлюзы' },
    { key: 'compute', title: 'Вычисления (Spring)' },
    { key: 'storage', title: 'Базы данных и кэш' },
    { key: 'messaging', title: 'Брокеры сообщений' },
    { key: 'resilience', title: 'Отказоустойчивость' }
  ];

  return (
    <div className="w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-r border-slate-200 dark:border-slate-800 flex flex-col h-full select-none z-10">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Палитра компонентов
        </span>
        <span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">Drag & Drop</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {categories.map(cat => {
          const items = PALETTE_ITEMS.filter(i => i.category === cat.key);
          const isOpen = openCategories[cat.key];

          return (
            <div key={cat.key} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleCategory(cat.key)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                <span>{cat.title}</span>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {isOpen && (
                <div className="space-y-1 pl-1">
                  {items.map(item => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, item)}
                      className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all group"
                    >
                      <GripVertical className="w-3 h-3 text-slate-600 dark:text-slate-300 group-hover:text-slate-600" />
                      <div className="p-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.label}
                        </div>
                        <div className="text-[9px] text-slate-600 dark:text-slate-300 truncate font-mono">
                          {item.technology}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
