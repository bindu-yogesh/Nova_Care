import React, { useState } from 'react';
import { Play, Pause, Zap, RotateCcw, AlertTriangle, Radio } from 'lucide-react';
import { request } from '../api';
import { SimulatorStatus, Astronaut } from '../types';

interface SimulationControlBarProps {
  status: SimulatorStatus | null;
  onStatusChange: (newStatus: SimulatorStatus) => void;
  crew: Astronaut[];
  selectedAstronautId?: string;
}

export const SimulationControlBar: React.FC<SimulationControlBarProps> = ({
  status,
  onStatusChange,
  crew,
  selectedAstronautId
}) => {
  const [loading, setLoading] = useState(false);

  const isRunning = status?.isRunning ?? true;
  const activeScenario = status?.activeScenario;

  const toggleSimulation = async () => {
    try {
      setLoading(true);
      const res = await request<SimulatorStatus>('/api/simulator/toggle', { method: 'POST' });
      onStatusChange(res);
    } catch (err: any) {
      alert('Simulation toggle failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const injectScenario = async (scenario: string) => {
    try {
      setLoading(true);
      const target = selectedAstronautId || crew[0]?.id;
      await request('/api/simulator/inject', {
        method: 'POST',
        body: { scenario, astronautId: target }
      });
      const st = await request<SimulatorStatus>('/api/simulator/status');
      onStatusChange(st);
    } catch (err: any) {
      alert('Failed to inject scenario: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearAnomaly = async () => {
    try {
      setLoading(true);
      await request('/api/simulator/clear', { method: 'POST' });
      const st = await request<SimulatorStatus>('/api/simulator/status');
      onStatusChange(st);
    } catch (err: any) {
      alert('Failed to clear scenario: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simulation-bar no-print">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radio size={15} color={isRunning ? '#00F59B' : '#5E7399'} />
          <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
            TELEMETRY STREAM:
          </span>
          <span className={`badge ${isRunning ? 'badge-green' : 'badge-yellow'}`}>
            {isRunning ? 'LIVE (SIMULATED)' : 'PAUSED'}
          </span>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={toggleSimulation}
          disabled={loading}
          title={isRunning ? 'Pause telemetry stream' : 'Resume telemetry stream'}
        >
          {isRunning ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Stream</>}
        </button>
      </div>

      {/* Scenario Injection Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
          Inject Anomaly:
        </span>


        <div className="scenario-pills">
          <button
            className={`scenario-pill ${activeScenario === 'hypoxia' ? 'active' : ''}`}
            onClick={() => injectScenario('hypoxia')}
            title="SpO2 drops to ~89%, Tachypnea, Tachycardia"
          >
            <Zap size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            Hypoxia
          </button>

          <button
            className={`scenario-pill ${activeScenario === 'cardiac_stress' ? 'active' : ''}`}
            onClick={() => injectScenario('cardiac_stress')}
            title="Heart rate spikes to ~140 bpm, HRV drops to ~18 ms, BP elevates"
          >
            <AlertTriangle size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            Cardiac Stress
          </button>

          <button
            className={`scenario-pill ${activeScenario === 'cabin_co2_spike' ? 'active' : ''}`}
            onClick={() => injectScenario('cabin_co2_spike')}
            title="Cabin CO2 spikes to ~5200 ppm"
          >
            CO₂ Spike
          </button>

          <button
            className={`scenario-pill ${activeScenario === 'hyperthermia' ? 'active' : ''}`}
            onClick={() => injectScenario('hyperthermia')}
            title="Core body temp rises to 38.8°C"
          >
            Hyperthermia
          </button>

          {activeScenario && (
            <button
              className="scenario-pill"
              onClick={clearAnomaly}
              style={{ background: 'rgba(0, 245, 155, 0.15)', borderColor: 'var(--health-green)', color: 'var(--health-green)' }}
              title="Reset telemetry to baseline tolerances"
            >
              <RotateCcw size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              Reset Nominal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
