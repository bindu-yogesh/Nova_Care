
import React, { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Heart,
  Send,
  Activity,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  CalendarDays,
  MessageCircle,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { request } from '../api';

type Mood = 'Very Good' | 'Good' | 'Neutral' | 'Low' | 'Very Low';
type Period = 'week' | 'month';

interface Checkin {
  id: string;
  mood: Mood;
  stress_level: number | null;
  journal_entry: string;
  sentiment: string | null;
  created_at: string;
}

interface Trend {
  date: string;
  checkin_count: number;
  average_mood_score: number;
}

interface Alert {
  type: string;
  severity: string;
  title: string;
  message: string;
  informational?: boolean;
}

const MOODS: {
  value: Mood;
  emoji: string;
  description: string;
  score: number;
}[] = [
  { value: 'Very Good', emoji: '😄', description: 'Excellent', score: 5 },
  { value: 'Good', emoji: '🙂', description: 'Doing well', score: 4 },
  { value: 'Neutral', emoji: '😐', description: 'Just okay', score: 3 },
  { value: 'Low', emoji: '😔', description: 'Having a hard day', score: 2 },
  { value: 'Very Low', emoji: '😞', description: 'Struggling today', score: 1 }
];

const moodColor = (mood: Mood) => {
  switch (mood) {
    case 'Very Good': return '#3DDC97';
    case 'Good': return '#00F0FF';
    case 'Neutral': return '#FFB800';
    case 'Low': return '#FF9A55';
    case 'Very Low': return '#FF476D';
  }
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

export const BehavioralHealthView: React.FC = () => {
  const [mood, setMood] = useState<Mood | ''>('');
  const [stressLevel, setStressLevel] = useState('');
  const [journalEntry, setJournalEntry] = useState('');

  const [period, setPeriod] = useState<Period>('week');
  const [history, setHistory] = useState<Checkin[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [summary, setSummary] = useState<{
    total_checkins: number;
    average_mood_score: number | null;
  } | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sentimentResult, setSentimentResult] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [historyData, statsData, alertData] = await Promise.all([
        request<{ records: Checkin[] }>(
          '/api/behavioral-health/history?limit=30'
        ),
        request<{
          summary: {
            total_checkins: number;
            average_mood_score: number | null;
          };
          trends: Trend[];
        }>(
          `/api/behavioral-health/stats?period=${period}`
        ),
        request<{ alerts: Alert[] }>(
          '/api/behavioral-health/alerts'
        )
      ]);

      setHistory(historyData.records || []);
      setTrends(statsData.trends || []);
      setSummary(statsData.summary || null);
      setAlerts(alertData.alerts || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load behavioral health data.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!mood) {
      setError('Please select your mood before submitting.');
      return;
    }

    if (journalEntry.length > 2000) {
      setError('Your journal entry must be 2000 characters or fewer.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    setSentimentResult('');

    try {
      const result = await request<{
        checkin: Checkin;
        sentimentAnalysis: {
          sentiment: string;
          analyzed: boolean;
        };
      }>('/api/behavioral-health/checkins', {
        method: 'POST',
        body: {
          mood,
          stressLevel: stressLevel ? Number(stressLevel) : null,
          journalEntry: journalEntry.trim()
        }
      });

      setSuccess('Your wellness check-in was recorded successfully.');

      if (result.sentimentAnalysis?.analyzed) {
        setSentimentResult(
          `Journal sentiment: ${result.sentimentAnalysis.sentiment}`
        );
      } else if (journalEntry.trim()) {
        setSentimentResult(
          'Your journal entry was too short for sentiment analysis.'
        );
      }

      setMood('');
      setStressLevel('');
      setJournalEntry('');

      await loadData();
    } catch (err: any) {
      setError(err.message || 'Check-in submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const latestCheckin = history[0];

  const chartData = trends.map(item => ({
    date: formatDate(item.date),
    moodScore: Number(item.average_mood_score),
    checkins: item.checkin_count
  }));

  const averageMood = summary?.average_mood_score;
  const moodLabel = averageMood == null
    ? 'No data'
    : averageMood >= 4
      ? 'Positive'
      : averageMood >= 3
        ? 'Balanced'
        : 'Lower than usual';

  return (
    <div className="page-view">
      <div className="page-header behavioral-header">
        <div>
          <h1 className="page-title">
            <Brain color="var(--cyan)" size={24} />
            Behavioral Health Monitor
          </h1>
          <p className="page-subtitle">
            Daily emotional wellness tracking and behavioral trend monitoring
            for long-duration space missions
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={loadData}
          disabled={loading}
          type="button"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: 18,
            borderRadius: 8,
            border: '1px solid rgba(255,45,85,0.4)',
            background: 'rgba(255,45,85,0.1)',
            color: '#ff8298',
            fontSize: 13
          }}
        >
          <AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            marginBottom: 18,
            borderRadius: 8,
            border: '1px solid rgba(61,220,151,0.35)',
            background: 'rgba(61,220,151,0.08)',
            color: '#3DDC97',
            fontSize: 13
          }}
        >
          <CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {success}
          {sentimentResult && (
            <div style={{ marginTop: 7, color: 'var(--text-secondary)' }}>
              {sentimentResult}
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 14,
          marginBottom: 20
        }}
      >
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            CHECK-INS ({period.toUpperCase()})
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, marginTop: 9 }}>
            {loading ? '—' : summary?.total_checkins ?? 0}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Recorded wellness entries
          </div>
        </div>

        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            AVERAGE MOOD SCORE
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, marginTop: 9 }}>
            {loading || averageMood == null
              ? '—'
              : `${Number(averageMood).toFixed(1)} / 5`}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {moodLabel}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            LATEST CHECK-IN
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 9 }}>
            {latestCheckin?.mood || '—'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {latestCheckin
              ? formatDate(latestCheckin.created_at)
              : 'No entries yet'}
          </div>
        </div>
      </div>

      {/* Mood check-in form */}
      <form
        className="glass-card behavioral-form"
        onSubmit={handleSubmit}
        style={{ padding: 22, marginBottom: 20 }}
      >
        <div className="card-header">
          <div className="card-title">
            <Heart size={17} color="var(--cyan)" />
            Daily Wellness Check-in
          </div>
          <span className="badge badge-green">PRIVATE CHECK-IN</span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 17 }}>
          How are you feeling today? Your response helps you understand your
          own wellness patterns over time.
        </p>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Select your current mood
        </label>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: 9,
            marginBottom: 23
          }}
        >
          {MOODS.map(option => {
            const selected = mood === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setMood(option.value)}
                style={{
                  padding: '14px 8px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  border: selected
                    ? `1px solid ${moodColor(option.value)}`
                    : '1px solid var(--border-line)',
                  background: selected
                    ? `${moodColor(option.value)}18`
                    : 'rgba(255,255,255,0.02)',
                  color: selected ? moodColor(option.value) : '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 7
                }}
              >
                <span style={{ fontSize: 27 }}>{option.emoji}</span>
                <strong style={{ fontSize: 12 }}>{option.value}</strong>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 21 }}>
          <label htmlFor="behavioral-stress">
            Optional stress level (1–10)
          </label>
          <select
            id="behavioral-stress"
            value={stressLevel}
            onChange={event => setStressLevel(event.target.value)}
            style={{ marginTop: 8, maxWidth: 260 }}
          >
            <option value="">Not recorded</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map(value => (
              <option key={value} value={value}>
                {value} / 10 {value <= 3 ? '(Low)' : value <= 6 ? '(Moderate)' : '(High)'}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label htmlFor="behavioral-journal">
            <MessageCircle
              size={14}
              style={{ verticalAlign: 'middle', marginRight: 6 }}
            />
            Personal journal (optional)
          </label>
          <textarea
            id="behavioral-journal"
            rows={4}
            maxLength={2000}
            value={journalEntry}
            onChange={event => setJournalEntry(event.target.value)}
            placeholder="Write about how your day has been, what is on your mind, or anything you would like to reflect on..."
            style={{
              width: '100%',
              marginTop: 9,
              resize: 'vertical'
            }}
          />
          <div style={{
            textAlign: 'right',
            color: 'var(--text-muted)',
            fontSize: 11,
            marginTop: 4
          }}>
            {journalEntry.length}/2000 characters
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Your check-in is associated with your authenticated account.
          </span>

          <button
            className="btn"
            type="submit"
            disabled={submitting || !mood}
          >
            <Send size={14} />
            {submitting ? 'Submitting...' : 'Submit Check-in'}
          </button>
        </div>
      </form>

      {/* Trends */}
      <div className="glass-card behavioral-chart-card" style={{ padding: 22, marginBottom: 20 }}>
        <div
          className="card-header"
          style={{ flexWrap: 'wrap', gap: 12 }}
        >
          <div className="card-title">
            <TrendingUp size={17} color="var(--cyan)" />
            Mood Trends
          </div>

          <div style={{ display: 'flex', gap: 5 }}>
            {(['week', 'month'] as Period[]).map(value => (
              <button
                key={value}
                type="button"
                className={`btn btn-sm ${period === value ? '' : 'btn-secondary'}`}
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
              >
                {value === 'week' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>

        <p style={{
          color: 'var(--text-muted)',
          fontSize: 11,
          marginBottom: 18
        }}>
          Average daily mood score. Higher values represent more positive
          self-reported moods.
        </p>

        <div className="behavioral-chart-area" style={{ height: 260 }}>
          {loading ? (
            <div style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-muted)',
              fontSize: 13
            }}>
              Loading mood trends...
            </div>
          ) : chartData.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-muted)',
              fontSize: 13
            }}>
              <div style={{ textAlign: 'center' }}>
                <Activity size={28} style={{ marginBottom: 9 }} />
                <div>No mood trends available yet.</div>
                <div style={{ marginTop: 5 }}>Submit your first check-in to begin.</div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  stroke="rgba(30,58,102,0.4)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--text-muted)"
                  fontSize={10}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  stroke="var(--text-muted)"
                  fontSize={10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-panel)',
                    borderColor: 'var(--border-line)',
                    borderRadius: 7,
                    fontSize: 12
                  }}
                  formatter={(value: number | undefined) => [
                    value == null ? '—' : `${value.toFixed(2)} / 5`,
                    'Average mood'
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="moodScore"
                  name="Average mood"
                  stroke="#00F0FF"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#00F0FF' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Wellness alerts */}
      <div className="glass-card behavioral-chart-card" style={{ padding: 22, marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <AlertCircle size={17} color="var(--cyan)" />
            Behavioral Wellness Alerts
          </div>
          <span className="badge badge-yellow">INFORMATIONAL</span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Checking wellness patterns...
          </p>
        ) : alerts.length === 0 ? (
          <div style={{
            padding: 14,
            borderRadius: 7,
            background: 'rgba(61,220,151,0.06)',
            color: 'var(--text-secondary)',
            fontSize: 12
          }}>
            <CheckCircle2
              size={15}
              color="#3DDC97"
              style={{ verticalAlign: 'middle', marginRight: 8 }}
            />
            No repeated low-mood pattern detected in your last three check-ins.
          </div>
        ) : (
          alerts.map((alert, index) => (
            <div
              key={`${alert.type}-${index}`}
              style={{
                padding: 15,
                borderRadius: 8,
                border: '1px solid rgba(255,184,0,0.3)',
                background: 'rgba(255,184,0,0.07)',
                marginBottom: 9
              }}
            >
              <strong style={{ color: '#FFB800', fontSize: 13 }}>
                {alert.title}
              </strong>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: 12,
                marginTop: 7,
                lineHeight: 1.6
              }}>
                {alert.message}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Recent history */}
      <div className="glass-card behavioral-history-card" style={{ padding: 22 }}>
        <div className="card-header">
          <div className="card-title">
            <CalendarDays size={17} color="var(--cyan)" />
            Recent Check-in History
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Latest 30 records
          </span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Loading check-in history...
          </p>
        ) : history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            No check-ins recorded yet. Your history will appear here.
          </p>
        ) : (
          <div>
            {history.map(record => (
              <div
                key={record.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  padding: '13px 0',
                  borderBottom: '1px solid var(--border-line)'
                }}
              >
                <div>
                  <div style={{
                    color: moodColor(record.mood),
                    fontWeight: 700,
                    fontSize: 13
                  }}>
                    {MOODS.find(item => item.value === record.mood)?.emoji}{' '}
                    {record.mood}
                  </div>
                  <div style={{
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    marginTop: 5
                  }}>
                    {formatDateTime(record.created_at)}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 11,
                  color: 'var(--text-secondary)'
                }}>
                  {record.stress_level != null && (
                    <span>Stress: {record.stress_level}/10</span>
                  )}
                  {record.sentiment && (
                    <span className="badge badge-green">
                      {record.sentiment}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{
        marginTop: 17,
        color: 'var(--text-muted)',
        fontSize: 10,
        lineHeight: 1.6
      }}>
        This monitor supports personal wellness reflection and trend awareness.
        It is not a medical diagnostic tool or a substitute for professional
        support.
      </p>
    </div>
  );
};
