import React from 'react';
import {
  Users,
  Activity,
  Heart,
  ShieldCheck,
  AlertOctagon,
  ArrowUpRight,
  TrendingUp,
  Wind,
  Thermometer,
  Zap
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Astronaut, HealthAlert, EnvironmentalReading } from '../types';
import { LiveEcgWave } from '../components/LiveEcgWave';

interface DashboardViewProps {
  crew: Astronaut[];
  activeAlerts: HealthAlert[];
  environment: EnvironmentalReading | null;
  fleetHealthScore: number;
  missionDay: number;
  onSelectAstronaut: (id: string) => void;
  onNavigateTab: (tab: string) => void;
  liveBiometricsMap: Record<string, any>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  crew,
  activeAlerts,
  environment,
  fleetHealthScore,
  missionDay,
  onSelectAstronaut,
  onNavigateTab,
  liveBiometricsMap
}) => {
  // Primary astronaut for live telemetry ticker (e.g. Commander Vance or first in crew)
  const primaryAstro = crew[0];
  const primaryVitals = (primaryAstro && liveBiometricsMap[primaryAstro.id]) || primaryAstro?.latest_vitals || {};

  // Sparkline data for fleet cardiac overview
  const sparklineData = [
    { t: 'T-60', hr: 68, spo2: 98 },
    { t: 'T-50', hr: 69, spo2: 98 },
    { t: 'T-40', hr: 71, spo2: 99 },
    { t: 'T-30', hr: 70, spo2: 98 },
    { t: 'T-20', hr: primaryVitals.heart_rate ? Math.round(primaryVitals.heart_rate - 2) : 72, spo2: 98 },
    { t: 'T-10', hr: primaryVitals.heart_rate ? Math.round(primaryVitals.heart_rate) : 74, spo2: 98 },
    { t: 'NOW', hr: primaryVitals.heart_rate ? Math.round(primaryVitals.heart_rate) : 72, spo2: primaryVitals.spo2 || 98 }
  ];

  return (
    <div className="page-view">
      {/* Top Welcome & Mission Status Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Activity color="var(--cyan)" size={24} />
            Flight Operations & Health Command
          </h1>
          <p className="page-subtitle">
            Gateway Lunar Orbit · Expedition 03 · Mission Elapsed Day {missionDay} · Autonomous AI Medical Telemetry
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('ai-risk')}>
            <Zap size={14} /> AI Risk Predictor
          </button>
          <button className="btn btn-sm" onClick={() => onNavigateTab('live-monitoring')}>
            <Activity size={14} /> Full Telemetry Console
          </button>
        </div>
      </div>

      {/* Top 4 KPI Tiles */}
      <div className="grid-cols-4">
        {/* Fleet Readiness Score */}
        <div className="metric-tile nominal">
          <div className="metric-name">
            <span>Fleet Health Index</span>
            <ShieldCheck size={16} color="var(--health-green)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ color: fleetHealthScore > 80 ? 'var(--health-green)' : 'var(--health-yellow)' }}>
              {fleetHealthScore}%
            </span>
            <span className="metric-unit">BIO-INDEX</span>
          </div>
          <div className="metric-delta" style={{ color: 'var(--health-green)' }}>
            <TrendingUp size={12} /> 4 Crew Members Nominal Flight Status
          </div>
        </div>

        {/* Commander Heart Rate Real-Time */}
        <div className={`metric-tile ${primaryVitals.heart_rate > 100 ? 'warning' : 'nominal'}`}>
          <div className="metric-name">
            <span>Cmdr. Resting HR</span>
            <Heart size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">
              {primaryVitals.heart_rate ?? 68}
            </span>
            <span className="metric-unit">BPM</span>
          </div>
          <div className="metric-delta" style={{ color: 'var(--text-secondary)' }}>
            Live Stream · HRV: {primaryVitals.hrv ?? 56} ms
          </div>
        </div>

        {/* Blood Oxygen Saturation */}
        <div className={`metric-tile ${primaryVitals.spo2 < 93 ? 'critical' : 'nominal'}`}>
          <div className="metric-name">
            <span>Arterial SpO₂</span>
            <Wind size={16} color="var(--blue-neon)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ color: primaryVitals.spo2 < 93 ? 'var(--health-red)' : '#fff' }}>
              {primaryVitals.spo2 ?? 98.4}%
            </span>
            <span className="metric-unit">SAT</span>
          </div>
          <div className="metric-delta" style={{ color: 'var(--health-green)' }}>
            Normal Partial Pressure O2
          </div>
        </div>

        {/* Open Alerts Counter */}
        <div className={`metric-tile ${activeAlerts.length > 0 ? 'warning' : 'nominal'}`}>
          <div className="metric-name">
            <span>Active Medical Alerts</span>
            <AlertOctagon size={16} color={activeAlerts.length > 0 ? 'var(--health-orange)' : 'var(--health-green)'} />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ color: activeAlerts.length > 0 ? 'var(--health-orange)' : 'var(--health-green)' }}>
              {activeAlerts.length}
            </span>
            <span className="metric-unit">ACTIVE</span>
          </div>
          <div className="metric-delta" style={{ color: activeAlerts.length > 0 ? 'var(--health-orange)' : 'var(--text-muted)' }}>
            {activeAlerts.length > 0 ? 'Attention Required · Click to review' : 'No Critical Deviations'}
          </div>
        </div>
      </div>

      {/* Main Grid: Crew Status Grid & Live Telemetry Stream */}
      <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px', marginBottom: '20px' }}>

        {/* Crew Status Grid */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Users size={16} color="var(--cyan)" />
              Expedition 03 Crew Manifest Status
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('crew-management')}>
              Manage Crew <ArrowUpRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {crew.map(member => {
              const vitals = liveBiometricsMap[member.id] || member.latest_vitals || {};
              const hr = vitals.heart_rate ?? 66;
              const spo2 = vitals.spo2 ?? 98.5;
              const isAlert = (member.open_alerts || 0) > 0 || hr > 100 || spo2 < 93;

              return (
                <div
                  className="crew-member-row"
                  key={member.id}
                  style={{
                    background: 'rgba(9, 15, 32, 0.7)',
                    border: '1px solid var(--border-line)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => onSelectAstronaut(member.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: member.avatar_color || '#00F0FF',
                        color: '#000',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        boxShadow: `0 0 10px ${member.avatar_color || '#00F0FF'}55`
                      }}
                    >
                      {member.callsign?.slice(0, 2) || member.display_name.slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>
                        {member.display_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {member.role_title} · <span style={{ color: 'var(--cyan)' }}>{member.callsign}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vitals snapshot */}
                  <div className="crew-member-vitals" style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: hr > 100 ? 'var(--health-orange)' : '#fff', fontWeight: 600 }}>
                        {hr} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BPM</span>
                      </div>
                      <div style={{ fontSize: '11px', color: spo2 < 93 ? 'var(--health-red)' : 'var(--text-secondary)' }}>
                        {spo2}% <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SpO₂</span>
                      </div>
                    </div>

                    <span className={`badge ${isAlert ? 'badge-orange' : 'badge-green'}`}>
                      {isAlert ? 'ATTENTION' : 'NOMINAL'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Cardiac Waveform & Fleet Vitals Trend */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Heart size={16} color="var(--cyan)" />
              Real-Time Cardiac Telemetry Stream
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)' }}>
              100 Hz Continuous Pulsimeter
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Commander Sarah Vance (VALKYRIE) · Simulated 3-Lead In-Flight ECG Waveform
          </p>

          <LiveEcgWave heartRate={primaryVitals.heart_rate || 72} />

          {/* Area Sparkline */}
          <div style={{ height: 120, marginTop: '14px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--cyan)', borderRadius: 6, fontSize: 11 }}
                />
                <Area type="monotone" dataKey="hr" stroke="#00F0FF" strokeWidth={2} fillOpacity={1} fill="url(#colorHr)" name="Heart Rate (bpm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Station Atmosphere & Recent Alerts */}
      <div className="dashboard-bottom-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>

        {/* Station Environmental Telemetry */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Thermometer size={16} color="var(--cyan)" />
              Station Atmospheric Conditions
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('environment')}>
              Atmospheric Detail <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="dashboard-environment-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div style={{ background: 'rgba(9, 15, 32, 0.6)', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cabin Temp</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                {environment?.cabin_temp_c ?? 22.2}°C
              </div>
              <div style={{ fontSize: '10px', color: 'var(--health-green)' }}>Nominal (21 - 24°C)</div>
            </div>

            <div style={{ background: 'rgba(9, 15, 32, 0.6)', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CO₂ Concentration</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: (environment?.co2_ppm || 0) > 4000 ? 'var(--health-orange)' : '#fff' }}>
                {environment?.co2_ppm ?? 2650} <span style={{ fontSize: '12px' }}>ppm</span>
              </div>
              <div style={{ fontSize: '10px', color: (environment?.co2_ppm || 0) > 4000 ? 'var(--health-orange)' : 'var(--health-green)' }}>
                {(environment?.co2_ppm || 0) > 4000 ? 'Elevated CO2 Scrubber Warning' : 'Safe Flight Margin (<3800 ppm)'}
              </div>
            </div>

            <div style={{ background: 'rgba(9, 15, 32, 0.6)', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ambient Radiation</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                {environment?.radiation_usv_h ?? 24.5} <span style={{ fontSize: '12px' }}>µSv/h</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Cumul: {environment?.cumulative_dose_msv ?? 18.4} mSv</div>
            </div>

            <div style={{ background: 'rgba(9, 15, 32, 0.6)', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cabin Pressure</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                {environment?.cabin_pressure_kpa ?? 101.3} <span style={{ fontSize: '12px' }}>kPa</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--health-green)' }}>Oxygen: {environment?.oxygen_pct ?? 20.9}%</div>
            </div>
          </div>
        </div>

        {/* Priority Alerts Strip */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <AlertOctagon size={16} color="var(--health-orange)" />
              Mission Critical Alerts
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('alerts')}>
              All Alerts ({activeAlerts.length}) <ArrowUpRight size={13} />
            </button>
          </div>

          {activeAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <ShieldCheck size={32} color="var(--health-green)" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, color: '#fff' }}>No Active Flight Telemetry Alerts</div>
              <p style={{ fontSize: '12px' }}>All crew vitals within physiological safety baselines.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeAlerts.slice(0, 3).map(alert => (
                <div
                  key={alert.id}
                  style={{
                    background: 'rgba(9, 15, 32, 0.7)',
                    borderLeft: `3px solid ${alert.severity === 'red' ? 'var(--health-red)' : 'var(--health-orange)'}`,
                    padding: '10px 12px',
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: '#fff' }}>
                      {alert.title}
                    </span>
                    <span className={`badge badge-${alert.severity}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {alert.explanation.slice(0, 110)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
