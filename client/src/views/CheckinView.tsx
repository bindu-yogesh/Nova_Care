import React, { useState, useEffect } from 'react';
import {
  ClipboardPenLine,
  Send,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertTriangle,
  Heart,
  Moon,
  Brain
} from 'lucide-react';
import { enqueue } from '../offline';
import { flushOfflineQueue, request } from '../api';
import { Astronaut } from '../types';

interface CheckinViewProps {
  currentAstronaut: Astronaut | null;
  isOnline: boolean;
  userRole: string;
  selectedAstronautId: string;
  onCheckinSuccess: (analysis: any) => void;
}

export const CheckinView: React.FC<CheckinViewProps> = ({
  currentAstronaut,
  isOnline,
  userRole,
  selectedAstronautId,
  onCheckinSuccess
}) => {
  const [form, setForm] = useState({
    heartRate: 68,
    hrv: 58,
    spo2: 98.5,
    respiratoryRate: 14,
    systolicBP: 118,
    diastolicBP: 76,
    temperature: 36.8,
    sleepHours: 7.2,
    activityLevel: 65,
    moodScore: 8,
    stressScore: 3,
    fatigueScore: 2,
    symptoms: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [readingsNotice, setReadingsNotice] = useState('');
  const targetAstronautId = userRole === 'medical' ? selectedAstronautId : (currentAstronaut?.id || '');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    const defaults = {
      heartRate: 68, hrv: 58, spo2: 98.5, respiratoryRate: 14,
      systolicBP: 118, diastolicBP: 76, temperature: 36.8,
      sleepHours: 7.2, activityLevel: 65, moodScore: 8,
      stressScore: 3, fatigueScore: 2, symptoms: ''
    };

    setForm(defaults);
    setStatusMessage(null);
    setLastAnalysis(null);
    setReadingsNotice('');

    if (!targetAstronautId) return;
    if (!isOnline) {
      setReadingsNotice('Offline — showing default values. Latest saved readings will load when online.');
      return;
    }

    setLoadingReadings(true);
    request('/api/health/checkin/latest', {
      params: { astronautId: targetAstronautId },
      cache: false
    }).then((data: any) => {
      if (cancelled) return;

      const v = data?.vitals || {};
      const m = data?.mental || {};
      const hasData = data?.vitals || data?.mental;

      if (hasData) {
        setForm({
          heartRate: v.heart_rate ?? defaults.heartRate,
          hrv: v.hrv ?? defaults.hrv,
          spo2: v.spo2 ?? defaults.spo2,
          respiratoryRate: v.respiratory_rate ?? defaults.respiratoryRate,
          systolicBP: v.systolic_bp ?? defaults.systolicBP,
          diastolicBP: v.diastolic_bp ?? defaults.diastolicBP,
          temperature: v.body_temperature ?? defaults.temperature,
          sleepHours: v.sleep_hours ?? defaults.sleepHours,
          activityLevel: v.activity_level ?? defaults.activityLevel,
          moodScore: m.mood ?? defaults.moodScore,
          stressScore: m.stress ?? defaults.stressScore,
          fatigueScore: m.fatigue ?? defaults.fatigueScore,
          symptoms: m.notes ?? defaults.symptoms
        });
        const latestDate = [v.recorded_at, m.recorded_at].filter(Boolean).sort().pop();
        setReadingsNotice(latestDate
          ? `Showing latest saved readings: ${new Date(latestDate).toLocaleString()}`
          : 'Showing latest saved readings.');
      } else {
        setReadingsNotice('No saved readings found. Enter today’s values.');
      }
    }).catch(() => {
      if (!cancelled) setReadingsNotice('Could not load saved readings. You can enter values manually.');
    }).finally(() => {
      if (!cancelled) setLoadingReadings(false);
    });

    return () => { cancelled = true; };
  }, [targetAstronautId, userRole, isOnline]);
  const localRuleCheck = (data: typeof form) => {
    const flags = [];
    if (data.sleepHours < 5) flags.push('Low Sleep Duration (<5h)');
    if (data.stressScore >= 8) flags.push('Elevated Subjective Stress (>=8/10)');
    if (data.spo2 < 93) flags.push('Reduced Oxygen Saturation (<93%)');
    if (data.temperature > 38) flags.push('Core Temperature Elevation (>38.0Â°C)');
    if (data.heartRate > 100) flags.push('Tachycardia (>100 bpm)');
    return flags;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    const idempotencyKey = crypto.randomUUID();
    const payload = {
      ...form,
      astronautId: targetAstronautId,
      recordedAt: new Date().toISOString(),
      source: 'astronaut_manual_checkin'
    };

    try {
      // 1. Enqueue in IndexedDB
      await enqueue({ key: idempotencyKey, payload });

      // 2. Local rule evaluation
      const localFlags = localRuleCheck(form);

      // 3. If online, attempt immediate flush
      if (isOnline) {
        const flushRes = await flushOfflineQueue();
        const record = flushRes.results?.find((r: any) => r.key === idempotencyKey);

        if (record?.status === 'rejected') {
          setStatusMessage(`Check-in rejected by mission server: ${record.error || 'Please review this record.'}`);
        } else if (record?.status === 'failed') {
          setStatusMessage(`Sync temporarily failed: ${record.error || 'Network or server error'}. Your check-in remains safely queued for retry.`);
        } else if (record?.status === 'synced' && record?.analysis) {
          setLastAnalysis(record.analysis);
          onCheckinSuccess(record.analysis);
          setStatusMessage(`Check-in synchronized! Risk Status: ${record.analysis.riskCategory} (${record.analysis.riskScore}/100)`);
        } else if (record?.status === 'synced' || record?.status === 'duplicate') {
          setStatusMessage('Check-in synchronized with the mission database. Analysis is currently unavailable.');
        } else {
          setStatusMessage('Check-in saved locally and waiting for synchronization. It will retry when connectivity is available.');
        }
      } else {
        setStatusMessage(
          `Offline: Check-in saved securely in local browser vault. ${
            localFlags.length ? 'Local warning: ' + localFlags.join(', ') : 'Local check: Nominal.'
          } Will automatically sync when connection returns.`
        );
      }
    } catch (err: any) {
      setStatusMessage('Submission error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ClipboardPenLine color="var(--cyan)" size={24} />
            Daily Biometrics & Wellness Check-in
          </h1>
          <p className="page-subtitle">
            Astronaut daily morning telemetry logging with offline-first local validation
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`badge ${isOnline ? 'badge-green' : 'badge-yellow'}`}>
            {isOnline ? <><Wifi size={12} /> ONLINE SYNCHRONIZATION ACTIVE</> : <><WifiOff size={12} /> OFFLINE MODE (QUEUED)</>}
          </span>
        </div>
      </div>

      {(loadingReadings || readingsNotice) && (<div style={{ marginBottom: '14px', color: 'var(--cyan)', fontSize: '13px' }}>{loadingReadings ? 'Loading latest saved readings...' : readingsNotice}</div>)}

      {statusMessage && (
        <div
          style={{
            background: lastAnalysis?.severity === 'red' ? 'rgba(255, 45, 85, 0.15)' : 'rgba(0, 240, 255, 0.12)',
            border: `1px solid ${lastAnalysis?.severity === 'red' ? 'var(--health-red)' : 'var(--cyan)'}`,
            padding: '14px 18px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <CheckCircle size={20} color="var(--cyan)" />
          <div style={{ fontSize: '13px', color: '#fff' }}>
            {statusMessage}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card">
        <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--cyan)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Heart size={16} /> 1. Vital Signs Telemetry
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div>
            <label>Heart Rate (bpm)</label>
            <input
              type="number"
              step="any"
              value={form.heartRate}
              onChange={e => setForm({ ...form, heartRate: +e.target.value })}
            />
          </div>

          <div>
            <label>HRV rMSSD (ms)</label>
            <input
              type="number"
              step="any"
              value={form.hrv}
              onChange={e => setForm({ ...form, hrv: +e.target.value })}
            />
          </div>

          <div>
            <label>Blood Oxygen SpOâ‚‚ (%)</label>
            <input
              type="number"
              step="any"
              value={form.spo2}
              onChange={e => setForm({ ...form, spo2: +e.target.value })}
            />
          </div>

          <div>
            <label>Respiratory Rate (br/min)</label>
            <input
              type="number"
              step="any"
              value={form.respiratoryRate}
              onChange={e => setForm({ ...form, respiratoryRate: +e.target.value })}
            />
          </div>

          <div>
            <label>Systolic BP (mmHg)</label>
            <input
              type="number"
              value={form.systolicBP}
              onChange={e => setForm({ ...form, systolicBP: +e.target.value })}
            />
          </div>

          <div>
            <label>Diastolic BP (mmHg)</label>
            <input
              type="number"
              value={form.diastolicBP}
              onChange={e => setForm({ ...form, diastolicBP: +e.target.value })}
            />
          </div>

          <div>
            <label>Core Temperature (Â°C)</label>
            <input
              type="number"
              step="0.1"
              value={form.temperature}
              onChange={e => setForm({ ...form, temperature: +e.target.value })}
            />
          </div>

          <div>
            <label>Sleep Duration (hours)</label>
            <input
              type="number"
              step="0.1"
              value={form.sleepHours}
              onChange={e => setForm({ ...form, sleepHours: +e.target.value })}
            />
          </div>
        </div>

        <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--cyan)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={16} /> 2. Psychophysiological Self-Report (Scale 1 - 10)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div>
            <label>Subjective Mood (1 - 10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.moodScore}
              onChange={e => setForm({ ...form, moodScore: +e.target.value })}
            />
          </div>

          <div>
            <label>Stress Level (1 - 10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.stressScore}
              onChange={e => setForm({ ...form, stressScore: +e.target.value })}
            />
          </div>

          <div>
            <label>Fatigue / Exhaustion (1 - 10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.fatigueScore}
              onChange={e => setForm({ ...form, fatigueScore: +e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label>Self-Reported Symptoms / Clinical Notes (Free Text)</label>
          <textarea
            rows={3}
            placeholder="Describe any dizziness, headache, orthostatic disorientation, space motion sickness, or unusual sensations..."
            value={form.symptoms}
            onChange={e => setForm({ ...form, symptoms: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="submit" className="btn" disabled={submitting}>
            <Send size={14} />
            {submitting ? 'Submitting Check-in...' : 'Submit Health Check-in'}
          </button>
        </div>
      </form>
    </div>
  );
};
