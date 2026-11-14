import React, { useState, useEffect } from 'react';
import {
  LineChart as LucideLineChart,
  Heart,
  Activity,
  Brain
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { Astronaut } from '../types';
import { request } from '../api';

interface HealthAnalyticsViewProps {
  crew: Astronaut[];
  selectedAstronautId: string;
  onSelectAstronaut: (id: string) => void;
}

export const HealthAnalyticsView: React.FC<HealthAnalyticsViewProps> = ({
  crew,
  selectedAstronautId,
  onSelectAstronaut
}) => {
  const [timeframeDays, setTimeframeDays] = useState(30);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeAstro = crew.find(a => a.id === selectedAstronautId) || crew[0];

  useEffect(() => {
    if (!activeAstro) {
      setAnalyticsData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setAnalyticsData(null);

    request(`/api/reports/analytics?astronautId=${activeAstro.id}&days=${timeframeDays}`)
      .then(res => {
        if (!cancelled) setAnalyticsData(res);
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to load health analytics:', err);
          setAnalyticsData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeAstro?.id, timeframeDays]);

  const vitals = (analyticsData?.vitalsHistory || []).map((v: any) => ({
    ...v,
    time: String(v.recorded_at).slice(5, 10)
  }));

  const mental = (analyticsData?.mentalHistory || []).map((m: any) => ({
    ...m,
    time: String(m.recorded_at).slice(5, 10)
  }));

  // Match sleep and stress measurements by calendar date.
  // Missing stress measurements remain null; no values are fabricated.
  const sleepStressMap = new Map<string, any>();

  vitals.forEach((v: any) => {
    if (v.sleep_hours == null) return;

    const date = String(v.recorded_at).slice(0, 10);
    const existing = sleepStressMap.get(date) || {
      date,
      time: date.slice(5, 10),
      sleep_hours: null,
      stress: null
    };

    existing.sleep_hours = Number(v.sleep_hours);
    sleepStressMap.set(date, existing);
  });

  mental.forEach((m: any) => {
    if (m.stress == null) return;

    const date = String(m.recorded_at).slice(0, 10);
    const existing = sleepStressMap.get(date) || {
      date,
      time: date.slice(5, 10),
      sleep_hours: null,
      stress: null
    };

    existing.stress = Number(m.stress);
    sleepStressMap.set(date, existing);
  });

  const sleepStress = Array.from(sleepStressMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  const hasSleepData = sleepStress.some(d => d.sleep_hours != null);
  const hasStressData = sleepStress.some(d => d.stress != null);

  return (
    <div className="page-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <LucideLineChart color="var(--cyan)" size={24} />
            Longitudinal Health Analytics & Trend Correlation
          </h1>
          <p className="page-subtitle">
            Aerospace physiological data modeling across multi-week mission timelines
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
            value={activeAstro?.id || ''}
            onChange={e => onSelectAstronaut(e.target.value)}
          >
            {crew.map(c => (
              <option key={c.id} value={c.id}>
                {c.display_name} ({c.callsign})
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: '4px' }}>
            {[7, 30, 90].map(days => (
              <button
                key={days}
                className={`btn btn-sm ${timeframeDays === days ? '' : 'btn-secondary'}`}
                onClick={() => setTimeframeDays(days)}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="glass-card" style={{ marginBottom: '20px', padding: '14px' }}>
          Loading analytics for {activeAstro?.display_name || 'astronaut'}...
        </div>
      )}

      {/* Cardiovascular Adaptation */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div className="card-title">
            <Heart size={16} color="var(--cyan)" />
            Cardiovascular Adaptation (Resting Heart Rate vs Autonomic HRV)
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Rolling {timeframeDays}-Day Window
          </span>
        </div>

        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vitals}>
              <CartesianGrid stroke="rgba(30, 58, 102, 0.4)" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-line)', borderRadius: 6, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="heart_rate" stroke="#00F0FF" strokeWidth={2} dot={false} name="Heart Rate (bpm)" />
              <Line type="monotone" dataKey="hrv" stroke="#3DDC97" strokeWidth={2} dot={false} name="HRV rMSSD (ms)" />
              <Line type="monotone" dataKey="spo2" stroke="#1D8CF8" strokeWidth={2} dot={false} name="SpO2 (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>

        {/* Sleep vs Stress */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Brain size={16} color="var(--cyan)" />
              Sleep Duration vs Cognitive Stress
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Neurobehavioral Adaptation
            </span>
          </div>

          <div style={{ height: 240 }}>
            {loading ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Loading sleep and stress records...
              </div>
            ) : !hasSleepData && !hasStressData ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                No sleep or cognitive stress records available for this astronaut in the selected period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sleepStress}>
                  <CartesianGrid stroke="rgba(30, 58, 102, 0.4)" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                  <YAxis yAxisId="sleep" stroke="#00F0FF" fontSize={10} domain={[0, 'auto']} label={{ value: 'Sleep (hours)', angle: -90, position: 'insideLeft', fill: '#00F0FF', fontSize: 10 }} />
                  <YAxis yAxisId="stress" orientation="right" stroke="#FF7A00" fontSize={10} domain={[0, 10]} label={{ value: 'Stress (/10)', angle: 90, position: 'insideRight', fill: '#FF7A00', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-line)', borderRadius: 6, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line yAxisId="sleep" type="monotone" dataKey="sleep_hours" stroke="#00F0FF" strokeWidth={2} connectNulls={false} dot={false} name="Sleep Duration (hours)" />
                  <Line yAxisId="stress" type="monotone" dataKey="stress" stroke="#FF7A00" strokeWidth={2} connectNulls={false} dot={{ r: 3 }} name="Cognitive Stress (/10)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {!loading && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              {hasStressData
                ? 'Sleep and stress are shown on separate scales. Only recorded measurements are plotted.'
                : 'Sleep records are available, but no cognitive stress check-ins have been recorded for this astronaut yet.'}
            </p>
          )}
        </div>

        {/* Respiratory & Core Temperature Stability */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={16} color="var(--cyan)" />
              Ventilation & Core Temperature Homeostasis
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Metabolic Regulation
            </span>
          </div>

          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vitals}>
                <CartesianGrid stroke="rgba(30, 58, 102, 0.4)" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-line)', borderRadius: 6, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="respiratory_rate" stroke="#00F0FF" strokeWidth={2} dot={false} name="Resp Rate (br/min)" />
                <Line type="monotone" dataKey="body_temperature" stroke="#FFB800" strokeWidth={2} dot={false} name="Core Temp (°C)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
