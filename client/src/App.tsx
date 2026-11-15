
import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL, request, flushOfflineQueue } from './api';
import { pending } from './offline';
import {
  Astronaut,
  HealthAlert,
  EnvironmentalReading,
  SimulatorStatus,
  RiskAssessment
} from './types';

// Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { SimulationControlBar } from './components/SimulationControlBar';
import { NotificationDrawer } from './components/NotificationDrawer';

// Views
import { DashboardView } from './views/DashboardView';
import { LiveMonitoringView } from './views/LiveMonitoringView';
import { AstronautProfileView } from './views/AstronautProfileView';
import { AiRiskPredictionView } from './views/AiRiskPredictionView';
import { AnomalyDetectionView } from './views/AnomalyDetectionView';
import { AlertsCenterView } from './views/AlertsCenterView';
import { AiMedicalAssistantView } from './views/AiMedicalAssistantView';
import { EnvironmentMonitoringView } from './views/EnvironmentMonitoringView';
import { CrewManagementView } from './views/CrewManagementView';
import { MissionManagementView } from './views/MissionManagementView';
import { HealthAnalyticsView } from './views/HealthAnalyticsView';
import { ReportsExportView } from './views/ReportsExportView';
import { TimelineView } from './views/TimelineView';
import { CheckinView } from './views/CheckinView';
import { GravityMindView } from './views/GravityMindView';
import { LoginView } from './views/LoginView';
import { ISSTrackerView } from './views/ISSTrackerView';
import { NasaResearchView } from './views/NasaResearchView';
import { BehavioralHealthView } from './views/BehavioralHealthView';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState<string>(localStorage.getItem('role') || 'astronaut');
  const [currentAstronaut, setCurrentAstronaut] = useState<Astronaut | null>(null);

  const [currentTab, setCurrentTab] = useState<string>(() => {
    return window.location.hash.slice(2) || 'dashboard';
  });

  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>('');
  const [openAlerts, setOpenAlerts] = useState<HealthAlert[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentalReading | null>(null);
  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus | null>(null);

  const [liveBiometricsMap, setLiveBiometricsMap] = useState<Record<string, any>>({});
  const [fleetHealthScore, setFleetHealthScore] = useState<number>(96);
  const [missionDay, setMissionDay] = useState<number>(30);
  const [latestRiskAssessment, setLatestRiskAssessment] = useState<RiskAssessment | null>(null);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Sync hash with currentTab
  useEffect(() => {
    const onHashChange = () => {
      const hashTab = window.location.hash.slice(2);
      if (hashTab && hashTab !== currentTab) {
        setCurrentTab(hashTab);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentTab]);

  const selectTab = useCallback((tab: string) => {
    setCurrentTab(tab);
    setIsMobileNavOpen(false);
    window.location.hash = `#/${tab}`;
  }, []);

  // Online / Offline synchronization listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue()
        .catch(error => {
          console.warn('[Sync] Reconnect flush failed:', error);
        })
        .finally(() => {
          pending().then(p => setPendingSyncCount(p.length));
        });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const queueCheckInterval = setInterval(() => {
      pending().then(p => setPendingSyncCount(p.length));
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(queueCheckInterval);
    };
  }, []);

  // Initial Data Fetch
  const loadInitialData = useCallback(() => {
    if (!token) return;

    // Load active crew
    request<Astronaut[]>('/api/crew')
      .then(crewList => {
        setCrew(crewList || []);
        if (crewList && crewList.length > 0 && !selectedAstronautId) {
          setSelectedAstronautId(crewList[0].id);
        }
      })
      .catch(err => console.error('Failed to load crew:', err));

    // Load current astronaut / user
    request('/api/auth/me')
      .then(authMe => {
        if (authMe.astronaut) {
          setCurrentAstronaut(authMe.astronaut);
          if (!selectedAstronautId) {
            setSelectedAstronautId(authMe.astronaut.id);
          }
        }
      })
      .catch(err => console.error('Failed to load profile:', err));

    // Load active alerts
    request<HealthAlert[]>('/api/alerts')
      .then(alerts => setOpenAlerts(alerts || []))
      .catch(err => console.error('Failed to load alerts:', err));

    // Load mission overview & environment
    request('/api/mission/overview')
      .then(overview => {
        if (overview.environment) setEnvironment(overview.environment);
        if (overview.fleetHealthScore) setFleetHealthScore(overview.fleetHealthScore);
      })
      .catch(err => console.error('Failed to load mission overview:', err));

    // Load simulator status
    request<SimulatorStatus>('/api/simulator/status')
      .then(status => setSimulatorStatus(status))
      .catch(err => console.error('Failed to load simulator status:', err));
  }, [token, selectedAstronautId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Real-Time Socket.IO Telemetry Stream
  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(API_URL, {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to AstroVital Mission Stream');
    });

    socket.on('telemetry_tick', (payload: any) => {
      if (payload?.astronautId) {
        setLiveBiometricsMap(prev => ({
          ...prev,
          [payload.astronautId]: payload
        }));
      }
    });

    socket.on('environment_tick', (envPayload: EnvironmentalReading) => {
      setEnvironment(envPayload);
    });

    socket.on('alert', (alertPayload: HealthAlert) => {
      setOpenAlerts(prev => {
        const exists = prev.some(a => a.id === alertPayload.id);
        if (exists) return prev;
        return [alertPayload, ...prev];
      });
    });

    socket.on('alert_acknowledged', (ackAlert: HealthAlert) => {
      setOpenAlerts(prev => prev.map(a => (a.id === ackAlert.id ? ackAlert : a)));
    });

    socket.on('risk_update', (riskPayload: { astronautId: string; analysis: RiskAssessment }) => {
      if (riskPayload.astronautId === selectedAstronautId) {
        setLatestRiskAssessment(riskPayload.analysis);
      }
    });

    socket.on('simulator_status', (st: SimulatorStatus) => {
      setSimulatorStatus(st);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, selectedAstronautId]);

  // Handlers
  const handleLoginSuccess = (authData: any) => {
    setToken(authData.token);
    setUserRole(authData.role);
    setCurrentAstronaut(authData.astronaut ?? null);
    setSelectedAstronautId(authData.astronaut?.id ?? '');
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setCurrentAstronaut(null);
    window.location.hash = '#/';
  };

  const handleQuickSwitchUser = async (demoEmail: string) => {
    try {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: demoEmail, password: 'demo1234' }
      });
      localStorage.setItem('token', res.token);
      localStorage.setItem('role', res.role);
      handleLoginSuccess(res);
    } catch (err: any) {
      alert('Quick switch failed: ' + err.message);
    }
  };

  const handleAcknowledgeAlert = async (id: string, notes?: string) => {
    await request(`/api/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      body: { notes }
    });
    setOpenAlerts(prev => prev.map(a => (a.id === id ? { ...a, status: 'acknowledged' } : a)));
  };

  const handleRunRiskEvaluation = async (aid: string): Promise<RiskAssessment> => {
    const res = await request<RiskAssessment>('/api/analysis/run', {
      method: 'POST',
      body: { astronautId: aid }
    });
    setLatestRiskAssessment(res);
    if (res.alert) {
      setOpenAlerts(prev => [res.alert!, ...prev]);
    }
    return res;
  };

  // Unauthenticated view
  if (!token) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {isMobileNavOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}
      {/* Flight Operations Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={selectTab}
        openAlertsCount={openAlerts.filter(a => a.status === 'open').length}
        userRole={userRole}
        isMobileOpen={isMobileNavOpen}
      />

      <div className="main-wrapper">
        {/* Top Telemetry Flight Header */}
        <Navbar
          userRole={userRole}
          userName={currentAstronaut?.display_name || (userRole === 'medical' ? 'Dr. Robert Hayes' : 'Astronaut')}
          missionDay={missionDay}
          openAlerts={openAlerts.filter(a => a.status === 'open')}
          onOpenNotifications={() => setIsNotificationOpen(true)}
          onOpenMenu={() => setIsMobileNavOpen(true)}
          onQuickSwitchUser={handleQuickSwitchUser}
          onLogout={handleLogout}
        />

        {/* Real-Time Telemetry Simulation Control Bar */}
        <SimulationControlBar
          status={simulatorStatus}
          onStatusChange={setSimulatorStatus}
          crew={crew}
          selectedAstronautId={selectedAstronautId}
        />

        {/* Offline & Pending Sync Banner */}
        {(!isOnline || pendingSyncCount > 0) && (
          <div
            style={{
              background: 'rgba(255, 184, 0, 0.15)',
              borderBottom: '1px solid var(--health-yellow)',
              padding: '6px 24px',
              fontSize: '12px',
              color: 'var(--health-yellow)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
            className="no-print"
          >
            <span>
              {!isOnline ? 'âš  Telemetry Radio Offline: Local rules active. All submissions queued in browser vault.' : 'â³ Synchronizing records with mission database...'}
            </span>
            {pendingSyncCount > 0 && (
              <span style={{ fontWeight: 700 }}>
                {pendingSyncCount} record(s) pending sync
              </span>
            )}
          </div>
        )}

        {/* Dynamic Page Views */}
        <main style={{ flex: 1, minHeight: 'calc(100vh - 120px)' }}>
          {currentTab === 'dashboard' && (
            <DashboardView
              crew={crew}
              activeAlerts={openAlerts.filter(a => a.status === 'open')}
              environment={environment}
              fleetHealthScore={fleetHealthScore}
              missionDay={missionDay}
              onSelectAstronaut={setSelectedAstronautId}
              onNavigateTab={selectTab}
              liveBiometricsMap={liveBiometricsMap}
            />
          )}

          {currentTab === 'live-monitoring' && (
            <LiveMonitoringView
              crew={crew}
              selectedAstronautId={selectedAstronautId}
              onSelectAstronaut={setSelectedAstronautId}
              liveBiometricsMap={liveBiometricsMap}
              onRunAiAnalysis={handleRunRiskEvaluation}
            />
          )}

          {currentTab === 'crew-profiles' && (
            <AstronautProfileView
              crew={crew}
              selectedAstronautId={selectedAstronautId}
              onSelectAstronaut={setSelectedAstronautId}
            />
          )}

          {currentTab === 'ai-risk' && (
            <AiRiskPredictionView
              crew={crew}
              selectedAstronautId={selectedAstronautId}
              onSelectAstronaut={setSelectedAstronautId}
              latestRiskAssessment={latestRiskAssessment}
              onRunRiskEvaluation={handleRunRiskEvaluation}
            />
          )}

          {currentTab === 'anomaly-detection' && (
            <AnomalyDetectionView
              crew={crew}
              selectedAstronautId={selectedAstronautId}
              authenticatedAstronautId={currentAstronaut?.id || ''}
              userRole={userRole}
              onSelectAstronaut={setSelectedAstronautId}
            />
          )}

          {currentTab === 'alerts' && (
            <AlertsCenterView
              alerts={openAlerts}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onRefreshAlerts={() => {
                request<HealthAlert[]>('/api/alerts')
                  .then(al => setOpenAlerts(al || []))
                  .catch(err => console.error(err));
              }}
              userRole={userRole}
            />
          )}

          {currentTab === 'ai-assistant' && (
            <AiMedicalAssistantView
              crew={crew}
              selectedAstronautId={selectedAstronautId}
              onSelectAstronaut={setSelectedAstronautId}
            />
          )}

          {currentTab === 'environment' && (
            <EnvironmentMonitoringView
              currentEnv={environment}
              astronautId={selectedAstronautId}
            />
          )}

          {currentTab === 'crew-management' && (
            <CrewManagementView
              crew={crew}
              onSelectAstronaut={(aid) => {
                setSelectedAstronautId(aid);
                selectTab('crew-profiles');
              }}
              onRefreshCrew={loadInitialData}
              userRole={userRole}
            />
          )}

          {currentTab === 'mission-management' && (
            <MissionManagementView
              userRole={userRole}
            />
          )}

          {currentTab === 'analytics' && (
            <HealthAnalyticsView
              crew={crew}
              selectedAstronautId={selectedAstronautId}
              onSelectAstronaut={setSelectedAstronautId}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsExportView
              crew={crew}
              selectedAstronautId={selectedAstronautId}
              onSelectAstronaut={setSelectedAstronautId}
            />
          )}

          {currentTab === 'timeline' && (
            <TimelineView />
          )}

          {currentTab === 'checkin' && (
            <CheckinView
              currentAstronaut={currentAstronaut}
              userRole={userRole}
              selectedAstronautId={selectedAstronautId}
              isOnline={isOnline}
              onCheckinSuccess={(analysis) => {
                setLatestRiskAssessment(analysis);
                loadInitialData();
              }}
            />
          )}

          {currentTab === 'behavioral-health' && (
            <BehavioralHealthView key={token} />
          )}

          {currentTab === 'gravity-mind' && (
            <GravityMindView
              crew={crew}
              selectedAstronautId={selectedAstronautId}
              onSelectAstronaut={setSelectedAstronautId}
            />
          )}

          {currentTab === 'iss-tracker' && <ISSTrackerView />}

          {currentTab === 'nasa-research' && <NasaResearchView />}
        </main>
      </div>

      {/* Flyout Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        alerts={openAlerts.filter(a => a.status === 'open')}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        onViewAlertsCenter={() => selectTab('alerts')}
      />
    </div>
  );
}
