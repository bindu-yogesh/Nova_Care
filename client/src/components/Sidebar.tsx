
import React from 'react';
import {
  LayoutDashboard,
  Activity,
  User,
  BrainCircuit,
  SearchAlert,
  AlertOctagon,
  BotMessageSquare,
  ShieldAlert,
  Users,
  Compass,
  LineChart,
  FileSpreadsheet,
  Clock,
  Dumbbell,
  ClipboardPenLine,
  Orbit,
  Database
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  openAlertsCount: number;
  userRole: string;
  isMobileOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  openAlertsCount,
  userRole,
  isMobileOpen
}) => {
  const isMedical = userRole === 'medical';

  return (
    <aside className={`sidebar no-print ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="nasa-logo-badge">NASA</div>
        <div className="logo-text">ASTROVITAL</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Flight Operations</div>

        <button
          className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <LayoutDashboard size={16} />
          <span>Mission Control</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'live-monitoring' ? 'active' : ''}`}
          onClick={() => onSelectTab('live-monitoring')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <Activity size={16} />
          <span>Live Telemetry</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'crew-profiles' ? 'active' : ''}`}
          onClick={() => onSelectTab('crew-profiles')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <User size={16} />
          <span>Astronaut Dossier</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'alerts' ? 'active' : ''}`}
          onClick={() => onSelectTab('alerts')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <AlertOctagon size={16} />
          <span>Medical Alerts</span>
          {openAlertsCount > 0 && (
            <span className="nav-badge">{openAlertsCount}</span>
          )}
        </button>

        <button
          className={`nav-item ${currentTab === 'environment' ? 'active' : ''}`}
          onClick={() => onSelectTab('environment')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <ShieldAlert size={16} />
          <span>Station Environment</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'timeline' ? 'active' : ''}`}
          onClick={() => onSelectTab('timeline')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <Clock size={16} />
          <span>Mission Timeline</span>
        </button>

        <div className="nav-section-title">Artificial Intelligence</div>

        <button
          className={`nav-item ${currentTab === 'ai-risk' ? 'active' : ''}`}
          onClick={() => onSelectTab('ai-risk')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <BrainCircuit size={16} />
          <span>AI Risk Prediction</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'anomaly-detection' ? 'active' : ''}`}
          onClick={() => onSelectTab('anomaly-detection')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <SearchAlert size={16} />
          <span>Anomaly Detection</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'ai-assistant' ? 'active' : ''}`}
          onClick={() => onSelectTab('ai-assistant')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <BotMessageSquare size={16} />
          <span>Flight Surgeon AI</span>
        </button>

        <div className="nav-section-title">Command & Management</div>

        <button
          className={`nav-item ${currentTab === 'crew-management' ? 'active' : ''}`}
          onClick={() => onSelectTab('crew-management')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <Users size={16} />
          <span>Crew Manifest</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'mission-management' ? 'active' : ''}`}
          onClick={() => onSelectTab('mission-management')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <Compass size={16} />
          <span>Mission Parameters</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onSelectTab('analytics')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <LineChart size={16} />
          <span>Health Analytics</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'reports' ? 'active' : ''}`}
          onClick={() => onSelectTab('reports')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <FileSpreadsheet size={16} />
          <span>Reports & Export</span>
        </button>

        <div className="nav-section-title">Space Intelligence</div>

        <button
          className={`nav-item ${currentTab === 'iss-tracker' ? 'active' : ''}`}
          onClick={() => onSelectTab('iss-tracker')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <Orbit size={16} />
          <span>Live ISS Tracker</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'nasa-research' ? 'active' : ''}`}
          onClick={() => onSelectTab('nasa-research')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <Database size={16} />
          <span>NASA Research Explorer</span>
        </button>

        <div className="nav-section-title">Crew Health Modules</div>

        <button
          className={`nav-item ${currentTab === 'checkin' ? 'active' : ''}`}
          onClick={() => onSelectTab('checkin')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <ClipboardPenLine size={16} />
          <span>Daily Check-in (Offline)</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'behavioral-health' ? 'active' : ''}`}
          onClick={() => onSelectTab('behavioral-health')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <BrainCircuit size={16} />
          <span>Behavioral Health Monitor</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'gravity-mind' ? 'active' : ''}`}
          onClick={() => onSelectTab('gravity-mind')}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <Dumbbell size={16} />
          <span>Gravity & MindSpace</span>
        </button>
      </nav>
    </aside>
  );
};
