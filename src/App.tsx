/**
 * ULTIMATE ORNITH 1.0 — Local TinyML Training Workspace
 * 
 * Two-pane canonical workspace with real-time SSE telemetry, Norwegian NLP,
 * full embedded C-export, dataset inspection, and Gemini assistance.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LeftPane } from './components/LeftPane/LeftPane';
import { RightPane } from './components/RightPane/RightPane';
import { SplashLoader } from './components/SplashLoader';
import { ProjectModal } from './components/ProjectModal';
import { UploadDatasetModal } from './components/UploadDatasetModal';
import {
  ProjectMetadata,
  DatasetMetadata,
  TrainingRun,
  ChatMessage,
  RightPaneMode,
  RuntimeSystemStatus,
  TrainingHyperparameters,
} from './types';
import { API } from './lib/api';

export default function App() {
  // Boot & system status
  const [isBooting, setIsBooting] = useState(true);
  const [systemStatus, setSystemStatus] = useState<RuntimeSystemStatus | null>(null);

  // Projects & Datasets
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectMetadata | null>(null);
  const [datasets, setDatasets] = useState<DatasetMetadata[]>([]);
  const [activeDataset, setActiveDataset] = useState<DatasetMetadata | null>(null);

  // Active Training Run & Telemetry
  const [activeRun, setActiveRun] = useState<TrainingRun | null>(null);

  // UI state & Panes
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const saved = localStorage.getItem('ornith_split_ratio');
    return saved ? parseFloat(saved) : 0.36; // 36% left pane by default
  });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [mobileTab, setMobileTab] = useState<'left' | 'right'>('left');
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>('dataset');

  // Theme & Model controls
  const [isDark, setIsDark] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [useThinking, setUseThinking] = useState(false);

  // Conversation timeline
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'model',
      text: `Velkommen til **ULTIMATE ORNITH 1.0** — din lokale arbeidsflate for TinyML-utvikling og embedded kantprosessering.\n\nJeg er forhåndskonfigurert for **norsk naturlig språk (Bokmål / Nynorsk)** med full støtte for **æ, ø og å**, sammensatte ord og mikrokontrollere (Arduino Nano 33 BLE, ESP32, STM32).\n\nHva ønsker du å gjøre først? Du kan analysere det inkluderte smart-hjem datasettet, justere treningshyperparametre eller starte en ekte treningsøkt.`,
      timestamp: new Date().toISOString(),
      modelUsed: 'Ornith Engine',
    },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------
  // 1. Initial Load & Hydration
  // -------------------------------------------------------------
  useEffect(() => {
    const initData = async () => {
      try {
        const [status, projs, dsets, runs] = await Promise.all([
          API.getStatus().catch(() => null),
          API.listProjects().catch(() => []),
          API.listDatasets().catch(() => []),
          API.listRuns().catch(() => []),
        ]);

        if (status) setSystemStatus(status);
        if (projs.length > 0) {
          setProjects(projs);
          setActiveProject(projs[0]);
        }
        if (dsets.length > 0) {
          setDatasets(dsets);
          setActiveDataset(dsets[0]);
        }
        if (runs.length > 0) {
          setActiveRun(runs[0]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    initData();
  }, []);

  // -------------------------------------------------------------
  // 2. Server-Sent Events (SSE) Live Training Telemetry
  // -------------------------------------------------------------
  useEffect(() => {
    const sse = new EventSource('/api/training/stream');

    sse.addEventListener('connected', () => {
      console.log('[SSE] Koblet til sanntidstelemetri');
    });

    sse.addEventListener('run_status', (e: MessageEvent) => {
      try {
        const run: TrainingRun = JSON.parse(e.data);
        setActiveRun(run);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    sse.addEventListener('run_start', (e: MessageEvent) => {
      try {
        const run: TrainingRun = JSON.parse(e.data);
        setActiveRun(run);
        setRightPaneMode('training');
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'system',
            text: `Treningsøkt ${run.id.slice(0, 12)} påbegynt på datasett '${activeDataset?.name || 'Norsk Korpus'}'.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.error(err);
      }
    });

    sse.addEventListener('epoch_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActiveRun((prev) => {
          if (!prev || prev.id !== data.runId) return prev;
          const nextHistory = [...prev.history, data.metric];
          const nextLogs = data.logLine ? [...prev.logLines, data.logLine] : prev.logLines;
          return {
            ...prev,
            currentEpoch: data.currentEpoch,
            progressPercent: data.progressPercent,
            history: nextHistory,
            logLines: nextLogs,
          };
        });
      } catch (err) {
        console.error(err);
      }
    });

    sse.addEventListener('run_completed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActiveRun(data.run);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'model',
            text: `**Trening Fullført!**\n\nModellen er ferdig trent over ${data.run.totalEpochs} epoker med slutt-nøyaktighet på **${(data.run.finalMetrics.accuracy * 100).toFixed(1)}%**.\n\n- Estimert RAM på Arduino/ESP32: **~${data.run.finalMetrics.memoryKb} KB**\n- Selvstendig C-header eksportert: \`ornith_tinyml_model.h\`\n\nDu kan nå teste interaktiv inferens under *Forhåndsvisning* eller inspisere forvekslingsmatrisen under *Evaluering*.`,
            timestamp: new Date().toISOString(),
            modelUsed: 'Ornith Engine',
            trainingEvent: {
              type: 'run_completed',
              runId: data.runId,
            },
          },
        ]);
      } catch (err) {
        console.error(err);
      }
    });

    sse.addEventListener('run_cancelled', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActiveRun(data.run);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'system',
            text: `Treningsøkt ble avbrutt av bruker.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.error(err);
      }
    });

    sse.addEventListener('run_failed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActiveRun(data.run);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'system',
            text: `Trening feilet: ${data.error}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      sse.close();
    };
  }, [activeDataset?.name]);

  // -------------------------------------------------------------
  // 3. Draggable Pane Resizer
  // -------------------------------------------------------------
  const handleMouseDown = useCallback(() => {
    setIsDraggingDivider(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = (e.clientX - rect.left) / rect.width;
      // Clamp ratio between 28% and 55%
      const clamped = Math.max(0.28, Math.min(0.55, newRatio));
      setSplitRatio(clamped);
      localStorage.setItem('ornith_split_ratio', clamped.toFixed(4));
    };

    const handleMouseUp = () => {
      if (isDraggingDivider) {
        setIsDraggingDivider(false);
      }
    };

    if (isDraggingDivider) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  // -------------------------------------------------------------
  // 4. Conversation & AI Chat Handler
  // -------------------------------------------------------------
  const handleSendMessage = async (text: string, attachments?: File[]) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
      attachments: attachments?.map((f, i) => ({
        id: `att-${Date.now()}-${i}`,
        name: f.name,
        size: f.size,
        type: (f.name.endsWith('.jsonl') || f.name.endsWith('.csv') ? 'dataset' : 'file') as 'dataset' | 'file',
      })),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      // Build history for multi-turn chat
      const history = messages.slice(-6).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text,
      }));

      const res = await API.sendChatMessage({
        prompt: text,
        history,
        model: selectedModel,
        thinking: useThinking,
        projectId: activeProject?.id,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          sender: 'model',
          text: res.text,
          timestamp: new Date().toISOString(),
          modelUsed: res.modelUsed,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          sender: 'model',
          text: `Beklager, det oppstod en feil: ${err.message || 'Ukjent feil'}`,
          timestamp: new Date().toISOString(),
          modelUsed: 'Ornith Feilhåndterer',
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    if (action.includes('Start TinyML-trening')) {
      setRightPaneMode('training');
      handleStartTraining({
        epochs: 25,
        batchSize: 8,
        learningRate: 0.02,
        optimizer: 'adam',
        seed: 42,
        earlyStoppingPatience: 6,
      });
    } else if (action.includes('Analyser')) {
      setRightPaneMode('dataset');
      handleSendMessage('Analyser det norske korpuset for klassebalanse og æ/ø/å-dekning.');
    } else if (action.includes('Generer C-header')) {
      setRightPaneMode('code');
      handleSendMessage('Forklar hvordan den eksporterte C-headeren integreres på en mikrokontroller.');
    } else {
      handleSendMessage(action);
    }
  };

  // -------------------------------------------------------------
  // 5. Training Actions
  // -------------------------------------------------------------
  const handleStartTraining = async (hp: TrainingHyperparameters) => {
    if (!activeDataset) return;
    setRightPaneMode('training');
    try {
      const res = await API.startTraining({
        projectId: activeProject?.id || 'default',
        datasetId: activeDataset.id,
        hyperparameters: hp,
      });
      setActiveRun(res.run);
    } catch (err: any) {
      console.error('Could not start training:', err);
      alert(`Kunne ikke starte trening: ${err.message}`);
    }
  };

  const handleCancelTraining = async () => {
    try {
      await API.cancelTraining();
    } catch (e) {
      console.error('Cancel failed', e);
    }
  };

  // -------------------------------------------------------------
  // 6. Project & Dataset Modal Handlers
  // -------------------------------------------------------------
  const handleCreateProject = async (pData: Partial<ProjectMetadata>) => {
    try {
      const newProj = await API.createProject(pData);
      setProjects((prev) => [newProj, ...prev]);
      setActiveProject(newProj);
    } catch (e: any) {
      alert(`Kunne ikke opprette prosjekt: ${e.message}`);
    }
  };

  const handleUploadSuccess = (meta: DatasetMetadata) => {
    setDatasets((prev) => [meta, ...prev]);
    setActiveDataset(meta);
    setRightPaneMode('dataset');
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: 'system',
        text: `Datasett '${meta.name}' (${meta.rowCount} rader, ${meta.dialect}) importert og validert.`,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#090909] text-[#F4F4F2] select-none font-sans antialiased">
      {/* Boot sequence loader */}
      {isBooting && (
        <SplashLoader
          onComplete={() => setIsBooting(false)}
          systemStatus={systemStatus}
        />
      )}

      {/* Top Header */}
      <Header
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(p) => setActiveProject(p)}
        onNewProjectClick={() => setIsProjectModalOpen(true)}
        systemStatus={systemStatus}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        useThinking={useThinking}
        onToggleThinking={() => setUseThinking((prev) => !prev)}
      />

      {/* Mobile view toggle tabs (hidden on md and larger) */}
      <div className="flex h-9 shrink-0 items-center justify-center border-b border-[rgba(255,255,255,0.06)] bg-[#111] md:hidden">
        <button
          onClick={() => setMobileTab('left')}
          className={`flex-1 py-1.5 text-center text-xs font-medium ${
            mobileTab === 'left' ? 'text-white border-b-2 border-[#8F2BFF]' : 'text-[#888]'
          }`}
        >
          Samtale & Kontroll
        </button>
        <button
          onClick={() => setMobileTab('right')}
          className={`flex-1 py-1.5 text-center text-xs font-medium ${
            mobileTab === 'right' ? 'text-white border-b-2 border-[#8F2BFF]' : 'text-[#888]'
          }`}
        >
          Arbeidsflate ({rightPaneMode.toUpperCase()})
        </button>
      </div>

      {/* Main Two-Pane Split Workspace */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        {/* Left Pane (Desktop or Mobile active) */}
        <div
          style={{ width: `${splitRatio * 100}%` }}
          className={`h-full min-w-[360px] ${
            mobileTab === 'left' ? 'block' : 'hidden md:block'
          }`}
        >
          <LeftPane
            messages={messages}
            activeProject={activeProject}
            activeDataset={activeDataset}
            activeRun={activeRun}
            isLoading={isAiLoading}
            onSendMessage={handleSendMessage}
            onCancelLoading={() => setIsAiLoading(false)}
            onQuickAction={handleQuickAction}
            onNavigateToMode={(mode) => {
              setRightPaneMode(mode);
              setMobileTab('right');
            }}
            onStartTrainingShortcut={() =>
              handleStartTraining({
                epochs: 25,
                batchSize: 8,
                learningRate: 0.02,
                optimizer: 'adam',
                seed: 42,
                earlyStoppingPatience: 6,
              })
            }
          />
        </div>

        {/* Vertical Resizable Divider */}
        <div
          onMouseDown={handleMouseDown}
          title="Dra for å endre panelets bredde"
          className={`hidden md:flex w-1.5 cursor-col-resize items-center justify-center transition-colors hover:bg-[#8F2BFF] ${
            isDraggingDivider ? 'bg-[#8F2BFF]' : 'bg-[rgba(255,255,255,0.06)]'
          }`}
        >
          <div className="h-8 w-0.5 rounded-full bg-[rgba(255,255,255,0.3)]" />
        </div>

        {/* Right Pane (Desktop or Mobile active) */}
        <div
          style={{ width: `${(1 - splitRatio) * 100}%` }}
          className={`h-full flex-1 min-w-[480px] ${
            mobileTab === 'right' ? 'block' : 'hidden md:block'
          }`}
        >
          <RightPane
            activeMode={rightPaneMode}
            onSelectMode={setRightPaneMode}
            activeProject={activeProject}
            activeDataset={activeDataset}
            activeRun={activeRun}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onStartTraining={handleStartTraining}
            onCancelTraining={handleCancelTraining}
            onProjectUpdated={(p) => {
              setActiveProject(p);
              setProjects((prev) => prev.map((item) => (item.id === p.id ? p : item)));
            }}
            onDatasetUpdated={(d) => {
              setActiveDataset(d);
              setDatasets((prev) => prev.map((item) => (item.id === d.id ? d : item)));
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreate={handleCreateProject}
        datasets={datasets}
      />

      <UploadDatasetModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        activeProject={activeProject}
      />
    </div>
  );
}
