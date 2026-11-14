import { createBehavioralHealthRouter } from './behavioral-health.js';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { q, pool } from './db.js';
import nasaRouter from './nasa.js';
import { analyze, getBaseline, buildBaseline, M, slope } from './analysis.js';
import { initSimulator, getSimulatorStatus, startSimulation, stopSimulation, triggerScenario, clearScenario } from './simulator.js';

const SECRET = process.env.JWT_SECRET || 'astrovital-mission-jwt-secret-2026';
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/nasa', nasaRouter);

const srv = createServer(app);
const io = new Server(srv, {
  cors: { origin: '*' }
});

// Start real-time simulation engine
initSimulator(io);

// Socket.IO authentication and room management
io.on('connection', socket => {
  try {
    const token = socket.handshake.auth.token;
    if (token) {
      const user = jwt.verify(token, SECRET);
      if (user.aid) socket.join(user.aid);
      if (user.role === 'medical') socket.join('mission');
    }
  } catch (err) {
    // Guest or unauthenticated socket still allowed for public telemetry stream
  }
});

// Middleware: Authentication & Role-Based Access Control
const auth = (requiredRole = null) => (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(authHeader.slice(7), SECRET);
    req.user = decoded;
    if (requiredRole && req.user.role !== requiredRole && req.user.role !== 'medical') {
      return res.status(403).json({ error: 'Access restricted to authorized mission personnel' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};


const wrap = fn => (req, res, next) => fn(req, res, next).catch(err => {
  console.error('[API Error]', err.stack || err.message);
  res.status(500).json({ error: err.message || 'Internal mission server error' });
});


// Behavioral Health Monitor — Member 1
app.use(
  '/api/behavioral-health',
  createBehavioralHealthRouter({ auth, q })
);

// Generate JWT token with user and astronaut identity
const generateAuthResponse = async user => {
  const [astro] = await q('SELECT * FROM astronauts WHERE user_id=$1', [user.id]);
  const token = jwt.sign(
    {
      uid: user.id,
      email: user.email,
      role: user.role,
      aid: astro?.id || null,
      callsign: astro?.callsign || null
    },
    SECRET,
    { expiresIn: '7d' }
  );
  return {
    token,
    role: user.role,
    user: { id: user.id, email: user.email, role: user.role },
    astronaut: astro || null
  };
};

/* ==========================================================================
   AUTHENTICATION ENDPOINTS
   ========================================================================== */

app.post('/api/auth/register', wrap(async (req, res) => {
  const { email, password, name, callsign, roleTitle } = req.body;
  if (!/^\S+@\S+$/.test(email || '') || (password || '').length < 6) {
    return res.status(400).json({ error: 'Valid email and minimum 6-character password required' });
  }

  const [existing] = await q('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: 'User account already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const [mission] = await q('SELECT id FROM missions WHERE status=\'active\' ORDER BY created_at DESC LIMIT 1');

  const [user] = await q(
    `INSERT INTO users(email, password_hash, role) VALUES($1, $2, 'astronaut') RETURNING *`,
    [email.toLowerCase(), passwordHash]
  );

  await q(
    `INSERT INTO astronauts(user_id, mission_id, display_name, callsign, role_title)
     VALUES($1, $2, $3, $4, $5)`,
    [user.id, mission?.id || null, name || email.split('@')[0], callsign || 'ASTRO', roleTitle || 'Mission Specialist']
  );

  res.json(await generateAuthResponse(user));
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const [user] = await q('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase().trim()]);
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Invalid mission credentials. Use demo accounts or verify password.' });
  }
  res.json(await generateAuthResponse(user));
}));

app.get('/api/auth/me', auth(), wrap(async (req, res) => {
  const [user] = await q('SELECT id, email, role, created_at FROM users WHERE id=$1', [req.user.uid]);
  const [astro] = req.user.aid
    ? await q('SELECT a.*, m.name as mission_name, m.code as mission_code FROM astronauts a LEFT JOIN missions m ON m.id=a.mission_id WHERE a.id=$1', [req.user.aid])
    : [null];
  res.json({ user, astronaut: astro });
}));

/* ==========================================================================
   CREW MANAGEMENT ENDPOINTS
   ========================================================================== */

app.get('/api/crew', auth(), wrap(async (req, res) => {
  const crew = await q(`
    SELECT a.*,
      m.name as mission_name,
      m.code as mission_code,
      (SELECT row_to_json(hm) FROM (
        SELECT heart_rate, hrv, spo2, respiratory_rate, systolic_bp, diastolic_bp, body_temperature, recorded_at
        FROM health_metrics WHERE astronaut_id=a.id ORDER BY recorded_at DESC LIMIT 1
      ) hm) as latest_vitals,
      (SELECT COUNT(*)::int FROM health_alerts WHERE astronaut_id=a.id AND status='open') as open_alerts,
      (SELECT severity FROM health_alerts WHERE astronaut_id=a.id AND status='open' ORDER BY CASE severity WHEN 'red' THEN 4 WHEN 'orange' THEN 3 WHEN 'yellow' THEN 2 ELSE 1 END DESC LIMIT 1) as max_severity,
      (SELECT score FROM anomaly_records WHERE astronaut_id=a.id ORDER BY detected_at DESC LIMIT 1) as latest_risk_score
    FROM astronauts a
    LEFT JOIN missions m ON m.id=a.mission_id
    ORDER BY a.created_at ASC
  `);
  res.json(crew);
}));

app.get('/api/crew/:id', auth(), wrap(async (req, res) => {
  const aid = req.params.id;
  const [astro] = await q(`
    SELECT a.*, m.name as mission_name, m.code as mission_code, m.start_at as mission_start
    FROM astronauts a
    LEFT JOIN missions m ON m.id=a.mission_id
    WHERE a.id=$1
  `, [aid]);

  if (!astro) return res.status(404).json({ error: 'Astronaut not found' });

  const baselines = await getBaseline(aid);
  const latestVitals = (await q('SELECT * FROM health_metrics WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 1', [aid]))[0] || null;
  const recentHistory = await q('SELECT * FROM health_metrics WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 30', [aid]);
  const openAlerts = await q("SELECT * FROM health_alerts WHERE astronaut_id=$1 AND status='open' ORDER BY created_at DESC", [aid]);
  const recentExercise = await q('SELECT * FROM exercise_records WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 10', [aid]);
  const recentMental = await q('SELECT * FROM mental_health_records WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 10', [aid]);
  const latestRisk = (await q('SELECT * FROM anomaly_records WHERE astronaut_id=$1 ORDER BY detected_at DESC LIMIT 1', [aid]))[0] || null;

  res.json({
    profile: astro,
    baselines,
    latestVitals,
    recentHistory,
    openAlerts,
    recentExercise,
    recentMental,
    latestRisk
  });
}));

app.post('/api/crew', auth('medical'), wrap(async (req, res) => {
  const { displayName, callsign, roleTitle, bloodType, flightHours, assignedSeat, avatarColor } = req.body;
  if (!displayName) return res.status(400).json({ error: 'Astronaut display name is required' });

  const [mission] = await q('SELECT id FROM missions WHERE status=\'active\' LIMIT 1');
  const [created] = await q(
    `INSERT INTO astronauts(mission_id, display_name, callsign, role_title, blood_type, flight_hours, assigned_seat, avatar_color, status)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'nominal')
     RETURNING *`,
    [mission?.id || null, displayName, callsign || 'NEW', roleTitle || 'Mission Specialist', bloodType || 'O+', flightHours || 0, assignedSeat || 'Seat TBA', avatarColor || '#00F0FF']
  );

  // Auto-build nominal baseline
  await buildBaseline(created.id);
  res.status(201).json(created);
}));

app.patch('/api/crew/:id', auth('medical'), wrap(async (req, res) => {
  const aid = req.params.id;
  const { displayName, callsign, roleTitle, bloodType, flightHours, assignedSeat, status, avatarColor } = req.body;

  const [updated] = await q(
    `UPDATE astronauts SET
      display_name = COALESCE($1, display_name),
      callsign = COALESCE($2, callsign),
      role_title = COALESCE($3, role_title),
      blood_type = COALESCE($4, blood_type),
      flight_hours = COALESCE($5, flight_hours),
      assigned_seat = COALESCE($6, assigned_seat),
      status = COALESCE($7, status),
      avatar_color = COALESCE($8, avatar_color)
     WHERE id=$9
     RETURNING *`,
    [displayName, callsign, roleTitle, bloodType, flightHours, assignedSeat, status, avatarColor, aid]
  );

  if (!updated) return res.status(404).json({ error: 'Astronaut not found' });
  res.json(updated);
}));

app.get('/api/astronauts/me', auth(), wrap(async (req, res) => {
  if (!req.user.aid) {
    const [first] = await q('SELECT * FROM astronauts ORDER BY created_at ASC LIMIT 1');
    return res.json(first || null);
  }
  const [astro] = await q(
    `SELECT a.*, m.name as mission_name, m.code as mission_code, m.start_at
     FROM astronauts a
     LEFT JOIN missions m ON m.id=a.mission_id
     WHERE a.id=$1`,
    [req.user.aid]
  );
  res.json(astro);
}));

/* ==========================================================================
   MISSION MANAGEMENT ENDPOINTS
   ========================================================================== */

app.get('/api/missions', auth(), wrap(async (req, res) => {
  const missions = await q(`
    SELECT m.*,
      (SELECT COUNT(*)::int FROM astronauts WHERE mission_id=m.id) as crew_count
    FROM missions m
    ORDER BY m.start_at DESC
  `);
  res.json(missions);
}));

app.get('/api/missions/current', auth(), wrap(async (req, res) => {
  const [mission] = await q(`
    SELECT m.*,
      (SELECT COUNT(*)::int FROM astronauts WHERE mission_id=m.id) as crew_count
    FROM missions m
    WHERE m.status='active'
    ORDER BY m.start_at DESC LIMIT 1
  `);
  if (!mission) return res.status(404).json({ error: 'No active mission configured' });

  const elapsedDays = Math.max(1, Math.floor((Date.now() - new Date(mission.start_at).getTime()) / 864e5) + 1);
  res.json({
    ...mission,
    missionElapsedDays: elapsedDays,
    telemetryStatus: 'NOMINAL (High-Rate Stream Active)'
  });
}));

app.post('/api/missions', auth('medical'), wrap(async (req, res) => {
  const { name, code, targetOrbit, inclination, startAt } = req.body;
  if (!name) return res.status(400).json({ error: 'Mission name is required' });

  const [created] = await q(
    `INSERT INTO missions(name, code, target_orbit, inclination, start_at, status)
     VALUES($1, $2, $3, $4, $5, 'active')
     RETURNING *`,
    [name, code || 'AV-EXP-NEW', targetOrbit || 'LEO / 420km ISS', inclination || '51.6Â°', startAt ? new Date(startAt) : new Date()]
  );
  res.status(201).json(created);
}));

/* ==========================================================================
   MISSION ACTIVITY TIMELINE
   ========================================================================== */

app.get('/api/timeline', auth(), wrap(async (req, res) => {
  const { limit = 50, eventType } = req.query;
  let sql = `
    SELECT e.*, a.display_name as astronaut_name, a.callsign as astronaut_callsign
    FROM mission_events e
    LEFT JOIN astronauts a ON a.id=e.astronaut_id
  `;
  const params = [];
  if (eventType) {
    sql += ` WHERE e.event_type=$1`;
    params.push(eventType);
  }
  sql += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1}`;
  params.push(Math.min(+limit || 50, 200));

  const events = await q(sql, params);
  res.json(events);
}));

app.post('/api/timeline', auth(), wrap(async (req, res) => {
  const { title, description, eventType, severity, astronautId } = req.body;
  if (!title || !eventType) return res.status(400).json({ error: 'Title and eventType required' });

  const [mission] = await q('SELECT id FROM missions WHERE status=\'active\' LIMIT 1');
  const [created] = await q(
    `INSERT INTO mission_events(mission_id, astronaut_id, event_type, title, description, severity)
     VALUES($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [mission?.id || null, astronautId || req.user.aid || null, eventType, title, description || null, severity || 'info']
  );
  res.status(201).json(created);
}));

/* ==========================================================================
   TELEMETRY & HEALTH CHECKIN PIPELINE
   ========================================================================== */

const RANGE = {
  heartRate: [20, 250],
  hrv: [0, 300],
  spo2: [50, 100],
  respiratoryRate: [5, 60],
  systolicBP: [50, 260],
  diastolicBP: [30, 160],
  temperature: [30, 43],
  sleepHours: [0, 24],
  activityLevel: [0, 10000]
};

async function saveCheckin(aid, idempotencyKey, p) {
  for (const [k, [lo, hi]] of Object.entries(RANGE)) {
    if (p[k] != null && !(Number.isFinite(+p[k]) && +p[k] >= lo && +p[k] <= hi)) {
      return { status: 'rejected', error: `${k} out of valid physiological range (${lo}-${hi})` };
    }
  }

  const ts = p.recordedAt ? new Date(p.recordedAt) : new Date();
  if (isNaN(ts.getTime())) {
    return { status: 'rejected', error: 'Invalid recordedAt timestamp' };
  }

  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return { status: 'rejected', error: 'A valid idempotency key is required' };
  }

  const n = x => (x == null || x === '' ? null : +x);
  const mental = { stress: n(p.stressScore) };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const ins = await client.query(
      `INSERT INTO sync_logs(astronaut_id, idempotency_key, status)
       VALUES($1, $2, 'synced')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [aid, idempotencyKey]
    );

    if (!ins.rows.length) {
      await client.query('COMMIT');
      return { status: 'duplicate', message: 'Record already synced via idempotency key' };
    }

    await client.query(
      `INSERT INTO health_metrics(
        astronaut_id, heart_rate, hrv, spo2, respiratory_rate, systolic_bp, diastolic_bp,
        body_temperature, sleep_hours, activity_level, recorded_at, source, data_quality
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'valid')`,
      [
        aid,
        n(p.heartRate),
        n(p.hrv),
        n(p.spo2),
        n(p.respiratoryRate),
        n(p.systolicBP),
        n(p.diastolicBP),
        n(p.temperature),
        n(p.sleepHours),
        n(p.activityLevel),
        ts,
        String(p.source || 'manual').slice(0, 30)
      ]
    );

    if (p.moodScore != null || p.stressScore != null || p.fatigueScore != null) {
      await client.query(
        `INSERT INTO mental_health_records(
          astronaut_id, mood, stress, fatigue, sleep_quality, notes, recorded_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7)`,
        [
          aid,
          n(p.moodScore),
          n(p.stressScore),
          n(p.fatigueScore),
          null,
          p.symptoms ? String(p.symptoms).slice(0, 500) : null,
          ts
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[Sync] Transaction rollback failed:', rollbackError);
    }
    throw err;
  } finally {
    client.release();
  }

  const cur = {
    heart_rate: n(p.heartRate),
    hrv: n(p.hrv),
    spo2: n(p.spo2),
    respiratory_rate: n(p.respiratoryRate),
    systolic_bp: n(p.systolicBP),
    diastolic_bp: n(p.diastolicBP),
    body_temperature: n(p.temperature),
    sleep_hours: n(p.sleepHours)
  };

  let analysis = null;
  let analysisError = null;

  try {
    analysis = await analyze(aid, cur, mental);

    if (analysis.alert) {
      io.to(aid).to('mission').emit('alert', analysis.alert);
      io.emit('alert', analysis.alert);
    }
  } catch (err) {
    analysisError = err.message;
    console.error('[Sync] Check-in saved, but analysis failed:', err);
  }

  return {
    status: 'synced',
    analysis,
    ...(analysisError ? { analysisError } : {})
  };
}

app.post('/api/health/checkin', auth(), wrap(async (req, res) => {
  const requestedAid = req.body.astronautId;
  if (req.user.role === 'astronaut' && requestedAid && requestedAid !== req.user.aid) {
    return res.status(403).json({ error: 'Astronaut accounts can only sync their own records' });
  }
  const aid = req.user.role === 'medical'
    ? (requestedAid || req.user.aid)
    : req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });
  const key = req.body.idempotencyKey || crypto.randomUUID();
  const result = await saveCheckin(aid, key, req.body);
  res.status(result.status === 'rejected' ? 400 : 200).json(result);
}));

app.post('/api/sync/upload', auth(), wrap(async (req, res) => {
  const requestedAid = req.body.astronautId;
  if (req.user.role === 'astronaut' && requestedAid && requestedAid !== req.user.aid) {
    return res.status(403).json({ error: 'Astronaut accounts can only sync their own records' });
  }
  const aid = req.user.role === 'medical'
    ? (requestedAid || req.user.aid)
    : req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });

  if (!Array.isArray(req.body.records)) {
    return res.status(400).json({ error: 'Records must be provided as an array' });
  }

  const results = [];
  for (const r of req.body.records.slice(0, 200)) {
    const key = r?.key;

    if (typeof key !== 'string' || !key.trim()) {
      results.push({ key: key ?? null, status: 'rejected', error: 'A valid record key is required' });
      continue;
    }

    if (!r.payload || typeof r.payload !== 'object' || Array.isArray(r.payload)) {
      results.push({ key, status: 'rejected', error: 'Record payload must be an object' });
      continue;
    }

    try {
      results.push({ key, ...(await saveCheckin(aid, key, r.payload)) });
    } catch (err) {
      results.push({ key, status: 'failed', error: err.message });
    }
  }

  res.json({ results, syncedAt: new Date() });
}));

/* ==========================================================================
   ANALYTICS, BASELINES & DIGITAL TWIN
   ========================================================================== */

app.get('/api/health/latest', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });
  const [latest] = await q('SELECT * FROM health_metrics WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 1', [aid]);
  res.json(latest || null);
}));

app.get('/api/health/baseline', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });
  res.json(await getBaseline(aid));
}));

app.get('/api/digital-twin', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });

  const base = await getBaseline(aid);
  const history = await q(
    `SELECT * FROM health_metrics WHERE astronaut_id=$1 AND data_quality='valid' ORDER BY recorded_at DESC LIMIT 30`,
    [aid]
  );

  const metrics = M.map(m => {
    const values = history.map(x => x[m]).filter(x => x != null && Number.isFinite(+x)).reverse().map(x => +x);
    const cur = values.at(-1);
    const bl = base[m];
    const r7 = values.slice(-7);
    const mean7 = r7.length ? +(r7.reduce((a, b) => a + b, 0) / r7.length).toFixed(2) : null;
    const std7 = r7.length > 1 ? +(Math.sqrt(r7.reduce((a, b) => a + (b - mean7) ** 2, 0) / (r7.length - 1))).toFixed(2) : null;
    const z = bl && bl.std_dev > 0 && cur != null ? +((cur - bl.mean) / bl.std_dev).toFixed(2) : null;

    return {
      metric: m,
      current: cur ?? null,
      baselineMean: bl ? +bl.mean.toFixed(2) : null,
      baselineStd: bl ? +bl.std_dev.toFixed(2) : null,
      zScore: z,
      rollingMean7: mean7,
      rollingStd7: std7,
      slope14: slope(values.slice(-14)),
      unit: m.includes('heart') ? 'bpm' : m.includes('hrv') ? 'ms' : m.includes('spo2') ? '%' : m.includes('temp') ? 'Â°C' : m.includes('sleep') ? 'h' : m.includes('resp') ? 'br/min' : 'mmHg'
    };
  });

  res.json({
    astronautId: aid,
    baselineVersion: Object.values(base)[0]?.version ?? 1,
    metrics,
    generatedAt: new Date().toISOString()
  });
}));

// Experimental Python ML analysis (non-clinical; telemetry provenance is preserved).
app.get('/api/ai/ml-analysis', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });
  if (req.user.role === 'astronaut' && req.user.aid !== aid) {
    return res.status(403).json({ error: 'Astronaut accounts can only analyze their own telemetry' });
  }

  const rows = await q(
    `SELECT heart_rate, hrv, spo2, respiratory_rate, sleep_hours,
            systolic_bp, body_temperature, recorded_at, source
     FROM health_metrics
     WHERE astronaut_id=$1 AND data_quality='valid'
     ORDER BY recorded_at DESC
     LIMIT 100`,
    [aid]
  );

  const keys = ['heart_rate', 'hrv', 'spo2', 'respiratory_rate', 'sleep_hours', 'systolic_bp', 'body_temperature'];
  const history = rows
    .filter(row => keys.every(key => row[key] !== null && row[key] !== undefined && Number.isFinite(Number(row[key]))))
    .reverse()
    .map(row => ({
      ...Object.fromEntries(keys.map(key => [key, Number(row[key])])),
      recorded_at: row.recorded_at,
      source: row.source
    }));

  if (!history.length) {
    return res.status(422).json({ error: 'No complete valid telemetry records are available for ML analysis' });
  }

  const current = history[history.length - 1];
  const aiBaseUrl = (process.env.AI_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const payload = JSON.stringify({ history, current });

  try {
    const paths = ['/anomaly/detect', '/baseline/create', '/trends/analyze'];
    const responses = await Promise.all(paths.map(path =>
      fetch(`${aiBaseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(10000)
      })
    ));

    if (responses.some(response => !response.ok)) {
      return res.status(502).json({ error: 'The experimental AI service returned an unsuccessful response' });
    }

    const [anomaly, baseline, trends] = await Promise.all(responses.map(response => response.json()));
    return res.json({
      dataType: 'EXPERIMENTAL_ML_ANALYSIS',
      experimental: true,
      clinicalUse: false,
      astronautId: aid,
      model: anomaly.model || 'isolation-forest-demo',
      anomaly,
      baseline,
      trends,
      historyPoints: history.length,
      currentRecordedAt: current.recorded_at,
      telemetrySource: current.source || 'unknown',
      telemetrySimulated: current.source === 'simulated',
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AI ML Analysis] Service request failed:', error.message);
    return res.status(503).json({ error: 'Experimental AI service is unavailable or timed out' });
  }
}));
// Generic history endpoints
const TB = {
  health: ['health_metrics', 'recorded_at'],
  mental: ['mental_health_records', 'recorded_at'],
  exercise: ['exercise_records', 'recorded_at'],
  environment: ['environmental_readings', 'recorded_at'],
  bone: ['bone_health_assessments', 'assessed_at']
};

for (const [key, [table, timeCol]] of Object.entries(TB)) {
  app.get(`/api/${key}/history`, auth(), wrap(async (req, res) => {
    const aid = req.query.astronautId || req.user.aid;
    const limit = Math.min(+req.query.limit || 100, 500);
    let sql = `SELECT * FROM ${table}`;
    const params = [];
    if (key !== 'environment' || aid) {
      sql += ` WHERE astronaut_id=$1`;
      params.push(aid);
    }
    sql += ` ORDER BY ${timeCol} DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const rows = await q(sql, params);
    res.json(rows);
  }));
}

// Module submission endpoints
app.post('/api/mental/checkin', auth(), wrap(async (req, res) => {
  const aid = req.body.astronautId || req.user.aid;
  const { mood, stress, fatigue, sleep_quality, isolation, concentration, notes } = req.body;
  const [row] = await q(
    `INSERT INTO mental_health_records(astronaut_id, mood, stress, fatigue, sleep_quality, isolation, concentration, notes)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [aid, mood, stress, fatigue, sleep_quality, isolation, concentration, notes]
  );
  res.json(row);
}));

app.post('/api/exercise', auth(), wrap(async (req, res) => {
  const aid = req.body.astronautId || req.user.aid;
  const { exercise_type, duration_min, completed, discomfort } = req.body;
  const [row] = await q(
    `INSERT INTO exercise_records(astronaut_id, exercise_type, duration_min, completed, discomfort)
     VALUES($1, $2, $3, $4, $5) RETURNING *`,
    [aid, exercise_type || 'ARED Countermeasure', duration_min || 45, completed ?? true, discomfort || 0]
  );
  res.json(row);
}));

app.post('/api/environment', auth(), wrap(async (req, res) => {
  const aid = req.body.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID is required' });
  const { radiation_usv_h, cumulative_dose_msv, cabin_temp_c, humidity_pct, co2_ppm, cabin_pressure_kpa, oxygen_pct, instrument } = req.body;
  const [row] = await q(
    `INSERT INTO environmental_readings(astronaut_id, radiation_usv_h, cumulative_dose_msv, cabin_temp_c, humidity_pct, co2_ppm, cabin_pressure_kpa, oxygen_pct, instrument, source)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual') RETURNING *`,
    [aid, radiation_usv_h, cumulative_dose_msv, cabin_temp_c, humidity_pct, co2_ppm, cabin_pressure_kpa || 101.3, oxygen_pct || 20.9, instrument || 'Flight Surgeon Manual Log']
  );
  res.json(row);
}));

app.post('/api/bone', auth(), wrap(async (req, res) => {
  const aid = req.body.astronautId || req.user.aid;
  const { assessment_type, value, unit, source } = req.body;
  const [row] = await q(
    `INSERT INTO bone_health_assessments(astronaut_id, assessment_type, value, unit, source)
     VALUES($1, $2, $3, $4, $5) RETURNING *`,
    [aid, assessment_type || 'Ultrasound Bone Mineral Index', value, unit || 'index', source || 'clinical']
  );
  res.json(row);
}));

/* ==========================================================================
   AI RISK ENGINE & ANOMALY DETECTION
   ========================================================================== */

app.post('/api/analysis/run', auth(), wrap(async (req, res) => {
  const aid = req.body.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });

  const [curVitals] = await q('SELECT * FROM health_metrics WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 1', [aid]);
  if (!curVitals) return res.status(404).json({ error: 'No biometric telemetry recorded for this astronaut' });

  const [curMental] = await q('SELECT * FROM mental_health_records WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 1', [aid]);

  const analysis = await analyze(aid, curVitals, { stress: curMental?.stress });

  if (analysis.alert) {
    io.to(aid).to('mission').emit('alert', analysis.alert);
    io.emit('alert', analysis.alert);
  }

  res.json(analysis);
}));

app.get('/api/analysis/history', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  const limit = Math.min(+req.query.limit || 30, 100);
  let sql = 'SELECT * FROM anomaly_records';
  const params = [];
  if (aid) {
    sql += ' WHERE astronaut_id=$1';
    params.push(aid);
  }
  sql += ` ORDER BY detected_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const rows = await q(sql, params);
  res.json(rows);
}));

/* ==========================================================================
   REAL-TIME ALERTS & NOTIFICATIONS
   ========================================================================== */

app.get('/api/alerts', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || (req.user.role === 'astronaut' ? req.user.aid : null);
  const status = req.query.status;
  const severity = req.query.severity;

  let sql = `
    SELECT h.*, a.display_name as astronaut_name, a.callsign as astronaut_callsign
    FROM health_alerts h
    LEFT JOIN astronauts a ON a.id=h.astronaut_id
    WHERE 1=1
  `;
  const params = [];
  if (aid) {
    sql += ` AND h.astronaut_id=$${params.length + 1}`;
    params.push(aid);
  }
  if (status) {
    sql += ` AND h.status=$${params.length + 1}`;
    params.push(status);
  }
  if (severity) {
    sql += ` AND h.severity=$${params.length + 1}`;
    params.push(severity);
  }
  sql += ' ORDER BY h.created_at DESC LIMIT 100';

  const alerts = await q(sql, params);
  res.json(alerts);
}));

app.patch('/api/alerts/:id/acknowledge', auth(), wrap(async (req, res) => {
  const { notes } = req.body;
  const ackUser = req.user.callsign || req.user.email || 'Flight Surgeon';

  const [alert] = await q(
    `UPDATE health_alerts
     SET status='acknowledged',
         acknowledged_at=now(),
         acknowledged_by=$1,
         clinician_notes=COALESCE($2, clinician_notes)
     WHERE id=$3
     RETURNING *`,
    [ackUser, notes || 'Alert acknowledged via Mission Control Console', req.params.id]
  );

  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  io.emit('alert_acknowledged', alert);
  res.json(alert);
}));

app.patch('/api/alerts/:id/resolve', auth('medical'), wrap(async (req, res) => {
  const { notes } = req.body;
  const [alert] = await q(
    `UPDATE health_alerts
     SET status='resolved',
         clinician_notes=COALESCE($1, clinician_notes)
     WHERE id=$2
     RETURNING *`,
    [notes || 'Resolved by Flight Surgeon', req.params.id]
  );
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  io.emit('alert_resolved', alert);
  res.json(alert);
}));

/* ==========================================================================
   AI MEDICAL ASSISTANT (CONVERSATIONAL & PERSISTENT)
   ========================================================================== */

app.get('/api/assistant/history', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });

  const messages = await q(
    'SELECT * FROM assistant_messages WHERE astronaut_id=$1 ORDER BY created_at ASC LIMIT 100',
    [aid]
  );
  res.json(messages);
}));

app.delete('/api/assistant/history', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });

  await q('DELETE FROM assistant_messages WHERE astronaut_id=$1', [aid]);
  res.json({ success: true, message: 'Conversation history cleared' });
}));

app.post('/api/assistant/query', auth(), wrap(async (req, res) => {
  const question = String(req.body.question || '').trim();
  const aid = req.body.astronautId || req.user.aid;
  if (!question) return res.status(400).json({ error: 'Question cannot be empty' });
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });

  const lower = question.toLowerCase();

  // Safety Gate: Emergency symptoms check
  if (/chest pain|can'?t breathe|cannot breathe|unconscious|faint|severe bleeding|seizure|stroke|paralysis/.test(lower)) {
    const emergencyAnswer = 'CRITICAL MEDICAL WARNING: These reported symptoms indicate a potential high-acuity in-flight medical emergency. Immediately notify the Mission Commander and Flight Surgeon via Space-to-Ground 1 Audio. Don emergency breathing apparatus if hypoxia is suspected. This AI assistant is an informational tool and cannot perform emergency medical triage.';
    await q(
      `INSERT INTO assistant_messages(astronaut_id, user_id, role, content, sources)
       VALUES($1, $2, 'user', $3, '[]'), ($1, $2, 'assistant', $4, '["NASA Emergency Protocols"]')`,
      [aid, req.user.uid, question, emergencyAnswer]
    );
    return res.json({ answer: emergencyAnswer, sources: ['NASA Emergency Protocol MED-EMERG-01'] });
  }

  // Fetch contextual telemetry
  const [latestVitals] = await q('SELECT * FROM health_metrics WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 1', [aid]);
  const [latestMental] = await q('SELECT * FROM mental_health_records WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 1', [aid]);
  const [latestAlert] = await q("SELECT * FROM health_alerts WHERE astronaut_id=$1 AND status='open' ORDER BY created_at DESC LIMIT 1", [aid]);
  const [latestEnv] = await q('SELECT * FROM environmental_readings ORDER BY recorded_at DESC LIMIT 1');
  const base = await getBaseline(aid);
  const protocols = await q('SELECT protocol_code, title, approved_content FROM mission_protocols WHERE active=true');

  let answer = '';
  const sources = [];

  if (/heart|hr\b|pulse|cardiac/.test(lower)) {
    sources.push('health_metrics', 'health_baselines');
    const hr = latestVitals?.heart_rate;
    const baseHr = base.heart_rate?.mean ? +base.heart_rate.mean.toFixed(1) : '65';
    answer = hr
      ? `Your latest recorded resting heart rate is ${hr} bpm (baseline average: ${baseHr} bpm). ${hr > 100 ? 'Note: Elevated heart rate observed above nominal flight range.' : 'Cardiac rate is currently stable within personal tolerances.'}`
      : 'No recent heart rate telemetry recorded on your profile.';
  } else if (/oxygen|spo2|o2\b|hypox/.test(lower)) {
    sources.push('health_metrics');
    const spo2 = latestVitals?.spo2;
    answer = spo2
      ? `Your latest blood oxygen saturation (SpO2) is ${spo2}%. ${spo2 < 95 ? 'Caution: Reading is slightly depressed below nominal 97-100% threshold.' : 'Arterial oxygenation is optimal for microgravity operations.'}`
      : 'No recent SpO2 data available.';
  } else if (/sleep|fatigue|tired|exhaust/.test(lower)) {
    sources.push('health_metrics', 'mental_health_records', 'DEMO-SLEEP-01');
    const sleep = latestVitals?.sleep_hours;
    const fatigue = latestMental?.fatigue;
    answer = `Recent recorded sleep is ${sleep ?? 'N/A'} hours, with self-reported fatigue level at ${fatigue ?? 'N/A'}/10. Under NASA Protocol DEMO-SLEEP-01, maintain consistent dark-cycle sleep quarters and consider 0.3mg melatonin if circadian rhythm is disrupted.`;
  } else if (/alert|warning|risk|danger/.test(lower)) {
    sources.push('health_alerts');
    if (latestAlert) {
      answer = `Active Alert [${latestAlert.severity.toUpperCase()}]: ${latestAlert.title}. Explanation: ${latestAlert.explanation}. Recommended action: ${Array.isArray(latestAlert.actions) ? latestAlert.actions.join('; ') : 'Consult Flight Surgeon'}.`;
    } else {
      answer = 'There are currently NO active medical alerts logged for your profile. All indicators remain within nominal flight tolerances.';
    }
  } else if (/environment|radiation|co2|cabin|temp|pressure/.test(lower)) {
    sources.push('environmental_readings');
    if (latestEnv) {
      answer = `Current Station Environment: Cabin Temp ${latestEnv.cabin_temp_c}Â°C, Humidity ${latestEnv.humidity_pct}%, CO2 ${latestEnv.co2_ppm} ppm, Pressure ${latestEnv.cabin_pressure_kpa} kPa, Ambient Radiation ${latestEnv.radiation_usv_h} ÂµSv/h (Cumulative Mission Dose: ${latestEnv.cumulative_dose_msv} mSv).`;
    } else {
      answer = 'Atmospheric life support sensors are streaming nominally.';
    }
  } else if (/protocol|guideline|procedure/.test(lower)) {
    sources.push('mission_protocols');
    answer = `Approved Mission Health Protocols available:\n` +
      protocols.map(p => `â€¢ ${p.protocol_code} (${p.title}): ${p.approved_content}`).join('\n\n');
  } else if (/summary|status|how am i|report/.test(lower)) {
    sources.push('health_metrics', 'health_alerts');
    const hr = latestVitals?.heart_rate ?? 'â€”';
    const spo2 = latestVitals?.spo2 ?? 'â€”';
    const sleep = latestVitals?.sleep_hours ?? 'â€”';
    const alertCount = latestAlert ? '1 open alert' : '0 alerts';
    answer = `Astronaut Health Summary:\nâ€¢ Resting HR: ${hr} bpm\nâ€¢ SpO2: ${spo2}%\nâ€¢ Sleep: ${sleep} h\nâ€¢ Alert Status: ${alertCount}\nMission Status: Active telemetry streaming. Decision support only; contact Flight Surgeon for clinical orders.`;
  } else {
    sources.push('AstroVital Knowledgebase');
    answer = `I am the AstroVital Mission Medical AI Assistant. I can answer inquiries regarding your live biometrics (heart rate, SpO2, sleep, temperature, respiratory rate), station atmospheric conditions, active alerts, risk assessments, and approved NASA medical protocols. How can I assist your mission today?`;
  }

  // Persist conversation
  await q(
    `INSERT INTO assistant_messages(astronaut_id, user_id, role, content, sources)
     VALUES($1, $2, 'user', $3, '[]'), ($1, $2, 'assistant', $4, $5)`,
    [aid, req.user.uid, question, answer, JSON.stringify(sources)]
  );

  res.json({ answer, sources, timestamp: new Date().toISOString() });
}));

/* ==========================================================================
   MISSION CONTROL & DASHBOARD OVERVIEW
   ========================================================================== */

app.get('/api/dashboard/overview', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  const [mission] = await q('SELECT * FROM missions WHERE status=\'active\' ORDER BY start_at DESC LIMIT 1');
  const [astronaut] = aid ? await q('SELECT * FROM astronauts WHERE id=$1', [aid]) : [null];

  const missionDay = mission?.start_at ? Math.max(1, Math.floor((Date.now() - new Date(mission.start_at).getTime()) / 864e5) + 1) : 30;

  const [latest] = aid ? await q('SELECT * FROM health_metrics WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 1', [aid]) : [null];
  const [mental] = aid ? await q('SELECT * FROM mental_health_records WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 1', [aid]) : [null];
  const [env] = await q('SELECT * FROM environmental_readings ORDER BY recorded_at DESC LIMIT 1');
  const alerts = aid ? await q("SELECT * FROM health_alerts WHERE astronaut_id=$1 AND status='open' ORDER BY created_at DESC LIMIT 5", [aid]) : [];
  const history = aid ? await q('SELECT * FROM health_metrics WHERE astronaut_id=$1 ORDER BY recorded_at DESC LIMIT 30', [aid]) : [];
  const [latestAnomaly] = aid ? await q('SELECT * FROM anomaly_records WHERE astronaut_id=$1 ORDER BY detected_at DESC LIMIT 1', [aid]) : [null];

  const maxSeverity = alerts.reduce((acc, a) => {
    const rank = { red: 4, orange: 3, yellow: 2, green: 1 };
    return (rank[a.severity] || 0) > (rank[acc] || 0) ? a.severity : acc;
  }, 'green');

  res.json({
    missionDay,
    mission,
    astronaut,
    latest,
    mental,
    env,
    alerts,
    level: maxSeverity,
    latestRisk: latestAnomaly?.evidence || null,
    history
  });
}));

app.get('/api/mission/overview', auth(), wrap(async (req, res) => {
  const crew = await q(`
    SELECT
      a.id,
      a.display_name,
      a.callsign,
      a.role_title,
      a.assigned_seat,
      a.avatar_color,
      a.status,
      (SELECT MAX(recorded_at) FROM health_metrics WHERE astronaut_id=a.id) as last_reading,
      (SELECT MAX(synced_at) FROM sync_logs WHERE astronaut_id=a.id) as last_sync,
      COALESCE((
        SELECT severity FROM health_alerts
        WHERE astronaut_id=a.id AND status='open'
        ORDER BY CASE severity WHEN 'red' THEN 4 WHEN 'orange' THEN 3 WHEN 'yellow' THEN 2 ELSE 1 END DESC
        LIMIT 1
      ), 'green') as level,
      (SELECT COUNT(*)::int FROM health_alerts WHERE astronaut_id=a.id AND status='open') as open_alerts,
      (SELECT row_to_json(hm) FROM (
        SELECT heart_rate, hrv, spo2, respiratory_rate, systolic_bp, diastolic_bp, body_temperature
        FROM health_metrics WHERE astronaut_id=a.id ORDER BY recorded_at DESC LIMIT 1
      ) hm) as vitals,
      (SELECT score FROM anomaly_records WHERE astronaut_id=a.id ORDER BY detected_at DESC LIMIT 1) as risk_score
    FROM astronauts a
    ORDER BY a.created_at ASC
  `);

  const [env] = await q('SELECT * FROM environmental_readings ORDER BY recorded_at DESC LIMIT 1');
  const [mission] = await q('SELECT * FROM missions WHERE status=\'active\' LIMIT 1');
  const openAlertsCount = crew.reduce((sum, c) => sum + (c.open_alerts || 0), 0);

  res.json({
    mission,
    crew,
    environment: env || null,
    totalCrew: crew.length,
    openAlertsCount,
    fleetHealthScore: Math.round(100 - (openAlertsCount * 12)),
    systemTime: new Date().toISOString()
  });
}));

/* ==========================================================================
   REPORTS & EXPORT ENGINE (CSV & ANALYTICS)
   ========================================================================== */

app.get('/api/reports/weekly', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  if (!aid) return res.status(400).json({ error: 'Astronaut ID required' });

  const [h] = await q(`
    SELECT COUNT(*)::int as readings_count,
           ROUND(AVG(heart_rate)::numeric, 1) as avg_heart_rate,
           ROUND(AVG(hrv)::numeric, 1) as avg_hrv,
           ROUND(AVG(spo2)::numeric, 1) as avg_spo2,
           ROUND(AVG(respiratory_rate)::numeric, 1) as avg_respiratory_rate,
           ROUND(AVG(sleep_hours)::numeric, 1) as avg_sleep_hours,
           ROUND(AVG(activity_level)::numeric, 1) as avg_activity_level
    FROM health_metrics
    WHERE astronaut_id=$1 AND recorded_at > now() - interval '7 days'
  `, [aid]);

  const [m] = await q(`
    SELECT ROUND(AVG(mood)::numeric, 1) as avg_mood,
           ROUND(AVG(stress)::numeric, 1) as avg_stress,
           ROUND(AVG(fatigue)::numeric, 1) as avg_fatigue,
           ROUND(AVG(sleep_quality)::numeric, 1) as avg_sleep_quality
    FROM mental_health_records
    WHERE astronaut_id=$1 AND recorded_at > now() - interval '7 days'
  `, [aid]);

  const [e] = await q(`
    SELECT ROUND(MAX(radiation_usv_h)::numeric, 1) as max_radiation_usv,
           ROUND(MAX(cumulative_dose_msv)::numeric, 3) as cumulative_dose_msv,
           ROUND(AVG(co2_ppm)::numeric, 0) as avg_co2_ppm
    FROM environmental_readings
    WHERE recorded_at > now() - interval '7 days'
  `);

  const [alertsSummary] = await q(`
    SELECT COUNT(*)::int as total_alerts,
           COUNT(*) FILTER (WHERE severity IN ('orange', 'red'))::int as high_severity_alerts
    FROM health_alerts
    WHERE astronaut_id=$1 AND created_at > now() - interval '7 days'
  `, [aid]);

  const [astro] = await q('SELECT * FROM astronauts WHERE id=$1', [aid]);

  res.json({
    astronaut: astro,
    generatedAt: new Date().toISOString(),
    period: 'Past 7 Days (Telemetry Rolling Window)',
    health: h,
    wellness: m,
    environment: e,
    alerts: alertsSummary,
    disclaimer: 'Official NASA Mission Health Telemetry Summary. Decision support analysis only; not an independent clinical diagnostic device.'
  });
}));

app.get('/api/reports/analytics', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  const days = Math.min(+req.query.days || 30, 90);

  const vitalsHistory = await q(
    `SELECT recorded_at, heart_rate, hrv, spo2, respiratory_rate, systolic_bp, diastolic_bp, body_temperature, sleep_hours, activity_level
     FROM health_metrics
     WHERE astronaut_id=$1 AND recorded_at > now() - ($2 || ' days')::interval
     ORDER BY recorded_at ASC`,
    [aid, days]
  );

  const mentalHistory = await q(
    `SELECT recorded_at, mood, stress, fatigue, sleep_quality
     FROM mental_health_records
     WHERE astronaut_id=$1 AND recorded_at > now() - ($2 || ' days')::interval
     ORDER BY recorded_at ASC`,
    [aid, days]
  );

  const envHistory = await q(
    `SELECT recorded_at, radiation_usv_h, cumulative_dose_msv, cabin_temp_c, co2_ppm
     FROM environmental_readings
     WHERE recorded_at > now() - ($1 || ' days')::interval
     ORDER BY recorded_at ASC`,
    [days]
  );

  res.json({
    timeframeDays: days,
    vitalsHistory,
    mentalHistory,
    envHistory
  });
}));

// Real CSV Telemetry Exporter
app.get('/api/reports/export/csv', auth(), wrap(async (req, res) => {
  const aid = req.query.astronautId || req.user.aid;
  if (!aid) return res.status(400).send('Astronaut ID required');

  const [astro] = await q('SELECT display_name, callsign FROM astronauts WHERE id=$1', [aid]);
  const rows = await q(
    `SELECT recorded_at, heart_rate, hrv, spo2, respiratory_rate, systolic_bp, diastolic_bp, body_temperature, sleep_hours, activity_level, source, data_quality
     FROM health_metrics
     WHERE astronaut_id=$1
     ORDER BY recorded_at DESC LIMIT 500`,
    [aid]
  );

  let csv = 'Timestamp,Astronaut,Callsign,Heart_Rate_BPM,HRV_ms,SpO2_Percent,Resp_Rate_bpm,Systolic_BP,Diastolic_BP,Body_Temp_C,Sleep_Hours,Activity_Score,Source,Data_Quality\r\n';

  const name = astro?.display_name || 'Astronaut';
  const callsign = astro?.callsign || 'ASTRO';

  for (const r of rows) {
    csv += `"${new Date(r.recorded_at).toISOString()}","${name}","${callsign}",${r.heart_rate ?? ''},${r.hrv ?? ''},${r.spo2 ?? ''},${r.respiratory_rate ?? ''},${r.systolic_bp ?? ''},${r.diastolic_bp ?? ''},${r.body_temperature ?? ''},${r.sleep_hours ?? ''},${r.activity_level ?? ''},"${r.source}","${r.data_quality}"\r\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ASTROVITAL_Telemetry_${callsign}_${Date.now()}.csv"`);
  res.send(csv);
}));

/* ==========================================================================
   SIMULATION CONTROLS (DEMO MODE)
   ========================================================================== */

app.get('/api/simulator/status', wrap(async (req, res) => {
  res.json(getSimulatorStatus());
}));

app.post('/api/simulator/toggle', auth(), wrap(async (req, res) => {
  const current = getSimulatorStatus().isRunning;
  if (current) {
    stopSimulation();
  } else {
    startSimulation();
  }
  const status = getSimulatorStatus();
  io.emit('simulator_status', status);
  res.json(status);
}));

app.post('/api/simulator/inject', auth(), wrap(async (req, res) => {
  const { scenario, astronautId } = req.body;
  if (!scenario) return res.status(400).json({ error: 'Scenario name is required (e.g. hypoxia, cardiac_stress, hyperthermia, cabin_co2_spike)' });

  const result = triggerScenario(scenario, astronautId);
  io.emit('simulator_anomaly_injected', result);
  res.json(result);
}));

app.post('/api/simulator/clear', auth(), wrap(async (req, res) => {
  const result = clearScenario();
  io.emit('simulator_anomaly_cleared', result);
  res.json(result);
}));

/* ==========================================================================
   MISSION PROTOCOLS
   ========================================================================== */

app.get('/api/protocols', auth(), wrap(async (req, res) => {
  const protocols = await q('SELECT * FROM mission_protocols WHERE active=true ORDER BY protocol_code ASC');
  res.json(protocols);
}));

// Start HTTP & WebSocket Server
srv.listen(PORT, () => {
  console.log(`[AstroVital Mission API] Online and listening on port ${PORT}`);
  console.log(`[AstroVital Mission API] WebSocket server initialized with live telemetry broadcasting`);
});
