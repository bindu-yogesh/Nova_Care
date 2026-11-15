import React, { useState } from 'react';
import {
  Activity,
  Heart,
  Wind,
  Thermometer,
  Zap,
  Gauge,
  Clock,
  Radio,
  RefreshCw
} from 'lucide-react';
import { Astronaut } from '../types';
import { LiveEcgWave } from '../components/LiveEcgWave';
import { request } from '../api';

interface LiveMonitoringViewProps {
  crew: Astronaut[];
  selectedAstronautId: string;
  onSelectAstronaut: (id: string) => void;
  liveBiometricsMap: Record<string, any>;
  onRunAiAnalysis: (aid: string) => void;
}

export const LiveMonitoringView: React.FC<LiveMonitoringViewProps> = ({
  crew,
  selectedAstronautId,
  onSelectAstronaut,
  liveBiometricsMap,
  onRunAiAnalysis
}) => {
  const [analyzing, setAnalyzing] = useState(false);

  const selectedAstro = crew.find(a => a.id === selectedAstronautId) || crew[0];
  const live = (selectedAstro && liveBiometricsMap[selectedAstro.id]) || selectedAstro?.latest_vitals || {};

  const hr = live.heart_rate ?? 68;
  const spo2 = live.spo2 ?? 98.4;
  const rr = live.respiratory_rate ?? 14.2;
  const temp = live.body_temperature ?? 36.8;
  const sbp = live.systolic_bp ?? 118;
  const dbp = live.diastolic_bp ?? 76;
  const hrv = live.hrv ?? 56;

  const handleRunAnalysis = async () => {
    if (!selectedAstro) return;
    setAnalyzing(true);
    try {
      await onRunAiAnalysis(selectedAstro.id);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="page-view">
      <div className="page-header live-monitoring-header">
        <div>
          <h1 className="page-title">
            <Activity color="var(--cyan)" size={24} />
            Live Astronaut Telemetry & Biometrics
          </h1>
          <p className="page-subtitle">
            Real-time biometric monitoring via in-flight biosensors and telemetry downlink
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-sm"
            onClick={handleRunAnalysis}
            disabled={analyzing}
          >
            <Zap size={14} />
            {analyzing ? 'Evaluating Risk...' : 'Run Real-Time AI Risk Check'}
          </button>
        </div>
      </div>

      {/* Astronaut Selector Bar */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '16px'
        }}
      >
        {crew.map(member => {
          const isSelected = member.id === selectedAstro?.id;
          const liveMem = liveBiometricsMap[member.id] || member.latest_vitals || {};
          const memHr = liveMem.heart_rate ?? 66;

          return (
            <div
              key={member.id}
              onClick={() => onSelectAstronaut(member.id)}
              style={{
                background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'var(--bg-card)',
                border: `1px solid ${isSelected ? 'var(--cyan)' : 'var(--border-line)'}`,
                boxShadow: isSelected ? '0 0 15px rgba(0, 240, 255, 0.25)' : 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '220px',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: member.avatar_color || '#00F0FF',
                  color: '#000',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px'
                }}
              >
                {member.callsign?.slice(0, 2) || 'AS'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                  {member.display_name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {member.callsign} · <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{memHr} bpm</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live ECG Wave Monitor Banner */}
      <div className="glass-card live-ecg-card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div className="card-title">
            <Heart size={16} color="var(--cyan)" />
            Continuous Cardiac Telemetry · Lead II Rhythm Strip
          </div>
          <div className="live-ecg-status" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="live-indicator">
              <span className="live-dot" /> STREAMING 100Hz
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--cyan)' }}>
              HR: {hr} BPM
            </span>
          </div>
        </div>

        <LiveEcgWave heartRate={hr} height={95} />

        <div className="live-ecg-metadata" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
          <span>Bandwidth: 0.05 - 150 Hz · Cal: 10mm/mV · Speed: 25mm/s</span>
          <span>Subject: {selectedAstro?.display_name} ({selectedAstro?.callsign}) · Seat: {selectedAstro?.assigned_seat || 'Flight Deck'}</span>
        </div>
      </div>

      {/* Primary Biometrics Vital Signs Cluster (6 Core Gauges) */}
      <div className="grid-cols-3">
        {/* Heart Rate Tile */}
        <div className={`metric-tile ${hr > 100 ? 'warning' : hr < 45 ? 'critical' : 'nominal'}`}>
          <div className="metric-name">
            <span>Resting Heart Rate</span>
            <Heart size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{hr}</span>
            <span className="metric-unit">BPM</span>
          </div>
          <div className="metric-delta" style={{ color: hr > 100 ? 'var(--health-orange)' : 'var(--health-green)' }}>
            Baseline Target: 60 - 80 BPM
          </div>
          {/* Progress / Tolerance Bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (hr / 150) * 100)}%`, height: '100%', background: hr > 100 ? 'var(--health-orange)' : 'var(--cyan)' }} />
          </div>
        </div>

        {/* Blood Oxygen SpO2 */}
        <div className={`metric-tile ${spo2 < 93 ? 'critical' : spo2 < 95 ? 'watch' : 'nominal'}`}>
          <div className="metric-name">
            <span>Arterial Oxygenation (SpO₂)</span>
            <Wind size={16} color="var(--blue-neon)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ color: spo2 < 93 ? 'var(--health-red)' : '#fff' }}>
              {spo2}%
            </span>
            <span className="metric-unit">O₂ SAT</span>
          </div>
          <div className="metric-delta" style={{ color: spo2 < 95 ? 'var(--health-orange)' : 'var(--health-green)' }}>
            {spo2 < 93 ? 'Hypoxemia Alert: <93%' : 'Optimal Microgravity Saturation (>96%)'}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${spo2}%`, height: '100%', background: spo2 < 93 ? 'var(--health-red)' : 'var(--blue-neon)' }} />
          </div>
        </div>

        {/* Core Body Temperature */}
        <div className={`metric-tile ${temp >= 38 ? 'critical' : temp >= 37.5 ? 'watch' : 'nominal'}`}>
          <div className="metric-name">
            <span>Core Body Temperature</span>
            <Thermometer size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{temp}</span>
            <span className="metric-unit">°C</span>
          </div>
          <div className="metric-delta" style={{ color: temp >= 38 ? 'var(--health-red)' : 'var(--health-green)' }}>
            {temp >= 38 ? 'Pyrexia / Thermal Strain' : 'Circadian Norm: 36.5 - 37.3°C'}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, ((temp - 35) / 5) * 100)}%`, height: '100%', background: temp >= 38 ? 'var(--health-red)' : 'var(--cyan)' }} />
          </div>
        </div>

        {/* Respiratory Rate */}
        <div className={`metric-tile ${rr >= 24 ? 'warning' : 'nominal'}`}>
          <div className="metric-name">
            <span>Respiratory Rate</span>
            <Activity size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{rr}</span>
            <span className="metric-unit">BR/MIN</span>
          </div>
          <div className="metric-delta" style={{ color: rr >= 24 ? 'var(--health-orange)' : 'var(--health-green)' }}>
            {rr >= 24 ? 'Tachypnea Detected' : 'Nominal Ventilation: 12 - 18 br/min'}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (rr / 35) * 100)}%`, height: '100%', background: rr >= 24 ? 'var(--health-orange)' : 'var(--cyan)' }} />
          </div>
        </div>

        {/* Arterial Blood Pressure */}
        <div className={`metric-tile ${sbp >= 140 ? 'warning' : 'nominal'}`}>
          <div className="metric-name">
            <span>Arterial Blood Pressure</span>
            <Gauge size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{sbp}/{dbp}</span>
            <span className="metric-unit">mmHg</span>
          </div>
          <div className="metric-delta" style={{ color: sbp >= 140 ? 'var(--health-orange)' : 'var(--health-green)' }}>
            {sbp >= 140 ? 'Cephalad Fluid Shift Pressure' : 'Normal Resting MAP: 93 mmHg'}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (sbp / 180) * 100)}%`, height: '100%', background: sbp >= 140 ? 'var(--health-orange)' : 'var(--cyan)' }} />
          </div>
        </div>

        {/* Heart Rate Variability (HRV) */}
        <div className={`metric-tile ${hrv < 25 ? 'critical' : hrv < 38 ? 'watch' : 'nominal'}`}>
          <div className="metric-name">
            <span>Heart Rate Variability (rMSSD)</span>
            <Radio size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{hrv}</span>
            <span className="metric-unit">MS</span>
          </div>
          <div className="metric-delta" style={{ color: hrv < 30 ? 'var(--health-orange)' : 'var(--health-green)' }}>
            {hrv < 30 ? 'Autonomic Recovery Depressed' : 'Vagal Tone & Parasympathetic Active'}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (hrv / 100) * 100)}%`, height: '100%', background: hrv < 30 ? 'var(--health-orange)' : 'var(--cyan)' }} />
          </div>
        </div>
      </div>

      {/* Telemetry Stream Metadata Card */}
      <div className="glass-card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div className="card-title">
            <Radio size={16} color="var(--cyan)" />
            Live Downlink Metadata & Sensor Channel Status
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Channel 04-A / Encryption: AES-GCM
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '12px' }}>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>TRANSMISSION SOURCE:</div>
            <div style={{ fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono)' }}>BioHarness 3.0 + Optical Pulse Ox</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>DATA QUALITY:</div>
            <div style={{ fontWeight: 600, color: 'var(--health-green)', fontFamily: 'var(--font-mono)' }}>VALID (Artifact Filter Applied)</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>DOWNLINK LATENCY:</div>
            <div style={{ fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono)' }}>284 ms (Gateway to White Sands)</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>RECORDED AT:</div>
            <div style={{ fontWeight: 600, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
              {live.recorded_at ? new Date(live.recorded_at).toLocaleTimeString() : 'STREAMING'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
