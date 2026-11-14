import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Thermometer,
  Wind,
  Gauge,
  Sun,
  Radio,
  PlusCircle,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { EnvironmentalReading } from '../types';
import { request } from '../api';

interface EnvironmentMonitoringViewProps {
  currentEnv: EnvironmentalReading | null;
  astronautId: string;
}

export const EnvironmentMonitoringView: React.FC<EnvironmentMonitoringViewProps> = ({
  currentEnv,
  astronautId
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({
    radiation_usv_h: 25.0,
    cumulative_dose_msv: 18.5,
    cabin_temp_c: 22.0,
    humidity_pct: 44.0,
    co2_ppm: 2600,
    cabin_pressure_kpa: 101.3,
    oxygen_pct: 20.9
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    request('/api/environment/history?limit=30')
      .then(res => setHistory((res || []).reverse().map((r: any) => ({
        ...r,
        time: String(r.recorded_at).slice(11, 16) || 'T'
      }))))
      .catch(err => console.error(err));
  }, []);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await request('/api/environment', {
        method: 'POST',
        body: { ...logForm, astronautId }
      });
      setShowLogModal(false);
      // Reload history
      const res = await request('/api/environment/history?limit=30');
      setHistory((res || []).reverse().map((r: any) => ({
        ...r,
        time: String(r.recorded_at).slice(11, 16) || 'T'
      })));
    } catch (err: any) {
      alert('Failed to log reading: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const env = currentEnv || {
    cabin_temp_c: 22.2,
    humidity_pct: 44.5,
    co2_ppm: 2650,
    cabin_pressure_kpa: 101.3,
    oxygen_pct: 20.9,
    radiation_usv_h: 24.5,
    cumulative_dose_msv: 18.4
  };

  const isCo2High = (env.co2_ppm || 0) > 3800;
  const isRadHigh = (env.radiation_usv_h || 0) > 80;

  return (
    <div className="page-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ShieldAlert color="var(--cyan)" size={24} />
            Station Environment & Life Support Systems (ECLSS)
          </h1>
          <p className="page-subtitle">
            Atmospheric composition, cabin thermal regulation, and cosmic ionizing radiation dosimeters
          </p>
        </div>

        <button className="btn btn-sm" onClick={() => setShowLogModal(true)}>
          <PlusCircle size={14} /> Log Manual Dosimeter Reading
        </button>
      </div>

      {/* Solar Flare / Cosmic Hazard Warning Banner if active */}
      {isRadHigh && (
        <div
          style={{
            background: 'rgba(255, 45, 85, 0.15)',
            border: '1px solid var(--health-red)',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <AlertTriangle size={24} color="var(--health-red)" />
          <div>
            <div style={{ fontWeight: 800, color: 'var(--health-red)', fontSize: '14px' }}>
              SOLAR PARTICLE EVENT (SPE) RADIATION HAZARD ALERT
            </div>
            <div style={{ fontSize: '12px', color: '#fff' }}>
              Ambient ionizing flux exceeds safe threshold ({env.radiation_usv_h} µSv/h). Execute Protocol NASA-RAD-SOLAR-03: Retreat to aft storm shelter.
            </div>
          </div>
        </div>
      )}

      {/* Environmental Metrics 6-Grid */}
      <div className="grid-cols-3">
        {/* Radiation Flux */}
        <div className={`metric-tile ${isRadHigh ? 'critical' : 'nominal'}`}>
          <div className="metric-name">
            <span>Ambient Radiation Flux</span>
            <Sun size={16} color={isRadHigh ? 'var(--health-red)' : 'var(--cyan)'} />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ color: isRadHigh ? 'var(--health-red)' : '#fff' }}>
              {env.radiation_usv_h}
            </span>
            <span className="metric-unit">µSv/h</span>
          </div>
          <div className="metric-delta" style={{ color: 'var(--text-secondary)' }}>
            Cumulative Mission Dose: <strong style={{ color: 'var(--cyan)' }}>{env.cumulative_dose_msv} mSv</strong>
          </div>
        </div>

        {/* CO2 Concentration */}
        <div className={`metric-tile ${isCo2High ? 'warning' : 'nominal'}`}>
          <div className="metric-name">
            <span>Cabin CO₂ Partial Pressure</span>
            <Wind size={16} color={isCo2High ? 'var(--health-orange)' : 'var(--cyan)'} />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ color: isCo2High ? 'var(--health-orange)' : '#fff' }}>
              {env.co2_ppm}
            </span>
            <span className="metric-unit">PPM</span>
          </div>
          <div className="metric-delta" style={{ color: isCo2High ? 'var(--health-orange)' : 'var(--health-green)' }}>
            {isCo2High ? 'Elevated: Inspect Scrubber Canister' : 'Nominal Flight Limit: < 3,800 ppm'}
          </div>
        </div>

        {/* Cabin Atmospheric Pressure */}
        <div className="metric-tile nominal">
          <div className="metric-name">
            <span>Cabin Total Pressure</span>
            <Gauge size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">
              {env.cabin_pressure_kpa}
            </span>
            <span className="metric-unit">kPa</span>
          </div>
          <div className="metric-delta" style={{ color: 'var(--health-green)' }}>
            Sea-level Equivalent (101.3 kPa · 14.7 psi)
          </div>
        </div>

        {/* Oxygen Concentration */}
        <div className="metric-tile nominal">
          <div className="metric-name">
            <span>Oxygen Volume (O₂)</span>
            <Wind size={16} color="var(--blue-neon)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">
              {env.oxygen_pct}%
            </span>
            <span className="metric-unit">VOL</span>
          </div>
          <div className="metric-delta" style={{ color: 'var(--health-green)' }}>
            Safe Breathing Range (19.5% - 22.0%)
          </div>
        </div>

        {/* Cabin Temperature */}
        <div className="metric-tile nominal">
          <div className="metric-name">
            <span>Cabin Temperature</span>
            <Thermometer size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">
              {env.cabin_temp_c}
            </span>
            <span className="metric-unit">°C</span>
          </div>
          <div className="metric-delta" style={{ color: 'var(--health-green)' }}>
            Set Point: 22.0°C (± 1.5°C)
          </div>
        </div>

        {/* Relative Humidity */}
        <div className="metric-tile nominal">
          <div className="metric-name">
            <span>Relative Humidity</span>
            <Wind size={16} color="var(--cyan)" />
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">
              {env.humidity_pct}%
            </span>
            <span className="metric-unit">RH</span>
          </div>
          <div className="metric-delta" style={{ color: 'var(--health-green)' }}>
            Comfort Zone (40% - 60%)
          </div>
        </div>
      </div>

      {/* Environmental Historical Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginTop: '20px' }}>

        {/* Radiation Chart */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Sun size={16} color="var(--cyan)" />
              Radiation Flux History (µSv/h)
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dosimeter Sensors</span>
          </div>

          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(30, 58, 102, 0.4)" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-line)', borderRadius: 6, fontSize: 11 }} />
                <Area type="monotone" dataKey="radiation_usv_h" stroke="#00F0FF" strokeWidth={2} fillOpacity={1} fill="url(#colorRad)" name="Radiation (µSv/h)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CO2 History Chart */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Wind size={16} color="var(--cyan)" />
              Cabin CO₂ Concentration History (ppm)
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Life Support Scrubbers</span>
          </div>

          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid stroke="rgba(30, 58, 102, 0.4)" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-line)', borderRadius: 6, fontSize: 11 }} />
                <Line type="monotone" dataKey="co2_ppm" stroke="#FFD24A" strokeWidth={2} dot={false} name="CO2 (ppm)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showLogModal && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              Log Environmental / Dosimeter Reading
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Record calibrated clinician dosimeter measurement or cabin atmosphere log
            </p>

            <form onSubmit={handleLogSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label>Radiation Flux (µSv/h)</label>
                  <input
                    type="number"
                    step="any"
                    value={logForm.radiation_usv_h}
                    onChange={e => setLogForm({ ...logForm, radiation_usv_h: +e.target.value })}
                  />
                </div>
                <div>
                  <label>Cumulative Dose (mSv)</label>
                  <input
                    type="number"
                    step="any"
                    value={logForm.cumulative_dose_msv}
                    onChange={e => setLogForm({ ...logForm, cumulative_dose_msv: +e.target.value })}
                  />
                </div>
                <div>
                  <label>Cabin CO₂ (ppm)</label>
                  <input
                    type="number"
                    step="any"
                    value={logForm.co2_ppm}
                    onChange={e => setLogForm({ ...logForm, co2_ppm: +e.target.value })}
                  />
                </div>
                <div>
                  <label>Cabin Temp (°C)</label>
                  <input
                    type="number"
                    step="any"
                    value={logForm.cabin_temp_c}
                    onChange={e => setLogForm({ ...logForm, cabin_temp_c: +e.target.value })}
                  />
                </div>
                <div>
                  <label>Humidity (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={logForm.humidity_pct}
                    onChange={e => setLogForm({ ...logForm, humidity_pct: +e.target.value })}
                  />
                </div>
                <div>
                  <label>Cabin Pressure (kPa)</label>
                  <input
                    type="number"
                    step="any"
                    value={logForm.cabin_pressure_kpa}
                    onChange={e => setLogForm({ ...logForm, cabin_pressure_kpa: +e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowLogModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Reading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
