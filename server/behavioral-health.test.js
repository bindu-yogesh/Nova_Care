
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createBehavioralHealthRouter } from './behavioral-health.js';

const records = [];

const MOOD_SCORES = {
  'Very Good': 5,
  'Good': 4,
  'Neutral': 3,
  'Low': 2,
  'Very Low': 1
};

beforeEach(() => {
  records.length = 0;
});

const q = async (sql, params = []) => {
  if (sql.includes('SELECT id FROM astronauts')) {
    return params[0] === 'astro-1' && params[1] === 'user-1'
      ? [{ id: 'astro-1' }]
      : [];
  }

  if (sql.includes('INSERT INTO behavioral_health_checkins')) {
    const record = {
      id: `record-${records.length + 1}`,
      user_id: params[0],
      astronaut_id: params[1],
      mood: params[2],
      stress_level: params[3],
      journal_entry: params[4],
      sentiment: params[5],
      created_at: new Date().toISOString()
    };

    records.push(record);
    return [record];
  }

  if (sql.includes('FROM behavioral_health_checkins')) {
    const userRecords = records.filter(
      record => record.user_id === params[0]
    );

    if (sql.includes('GROUP BY DATE')) {
      const grouped = {};

      for (const record of userRecords) {
        const date = record.created_at.slice(0, 10);
        const score = MOOD_SCORES[record.mood];

        if (!grouped[date]) {
          grouped[date] = { count: 0, total: 0 };
        }

        grouped[date].count++;
        grouped[date].total += score;
      }

      return Object.entries(grouped).map(([date, values]) => ({
        date,
        checkin_count: values.count,
        average_mood_score: Number(
          (values.total / values.count).toFixed(2)
        )
      }));
    }

    if (sql.includes('COUNT(*)')) {
      const scores = userRecords.map(
        record => MOOD_SCORES[record.mood]
      );

      return [{
        total_checkins: scores.length,
        average_mood_score: scores.length
          ? Number(
              (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
            )
          : null
      }];
    }

    if (sql.includes('LIMIT $2')) {
      return userRecords
        .slice(-params[1])
        .reverse()
        .map(({
          id,
          mood,
          stress_level,
          journal_entry,
          sentiment,
          created_at
        }) => ({
          id,
          mood,
          stress_level,
          journal_entry,
          sentiment,
          created_at
        }));
    }

    if (sql.includes('LIMIT 3')) {
      return userRecords.slice(-3).reverse();
    }
  }

  throw new Error(`Unexpected SQL: ${sql}`);
};

// Default authenticated astronaut.
const auth = () => (req, res, next) => {
  req.user = {
    uid: 'user-1',
    aid: 'astro-1',
    role: 'astronaut'
  };
  next();
};

// Test server setup.
async function setup(authMiddleware = auth()) {
  const app = express();
  app.use(express.json());

  app.use(
    '/api/behavioral-health',
    createBehavioralHealthRouter({
      auth: () => authMiddleware,
      q
    })
  );

  const server = createServer(app);
  await new Promise(resolve => server.listen(0, resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    server,
    base,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

// TEST 1: Valid astronaut check-in.
test('valid check-in is stored with sentiment', async () => {
  const api = await setup();

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/checkins`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: 'Good',
          stressLevel: 3,
          journalEntry: 'I feel happy, calm and motivated today.'
        })
      }
    );

    assert.equal(response.status, 201);

    const data = await response.json();

    assert.equal(data.checkin.mood, 'Good');
    assert.equal(data.sentimentAnalysis.sentiment, 'positive');
  } finally {
    await api.close();
  }
});

// TEST 2: Flight Surgeon can submit without an astronaut profile.
test('Flight Surgeon can submit a check-in without an astronaut profile', async () => {
  const medicalAuth = (req, res, next) => {
    req.user = {
      uid: 'medical-user-1',
      aid: null,
      role: 'medical'
    };
    next();
  };

  const api = await setup(medicalAuth);

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/checkins`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: 'Good',
          stressLevel: 3,
          journalEntry: 'I feel calm and positive today.'
        })
      }
    );

    assert.equal(response.status, 201);

    const data = await response.json();
    assert.equal(data.checkin.mood, 'Good');
  } finally {
    await api.close();
  }
});

// TEST 3: Invalid mood.
test('invalid mood is rejected', async () => {
  const api = await setup();

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/checkins`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: 'Excellent' })
      }
    );

    assert.equal(response.status, 400);
  } finally {
    await api.close();
  }
});

// TEST 4: Invalid stress.
test('invalid stress level is rejected', async () => {
  const api = await setup();

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/checkins`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: 'Good',
          stressLevel: 15
        })
      }
    );

    assert.equal(response.status, 400);
  } finally {
    await api.close();
  }
});

// TEST 5: Oversized journal.
test('oversized journal is rejected', async () => {
  const api = await setup();

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/checkins`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: 'Neutral',
          journalEntry: 'x'.repeat(2001)
        })
      }
    );

    assert.equal(response.status, 400);
  } finally {
    await api.close();
  }
});

// TEST 6: History endpoint.
test('history returns only the authenticated user records', async () => {
  const api = await setup();

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/history`
    );

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.ok(Array.isArray(data.records));

    assert.ok(
      data.records.every(record => !('user_id' in record))
    );
  } finally {
    await api.close();
  }
});

// TEST 7: Invalid statistics period.
test('invalid statistics period is rejected', async () => {
  const api = await setup();

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/stats?period=year`
    );

    assert.equal(response.status, 400);
  } finally {
    await api.close();
  }
});

// TEST 8: Alerts endpoint.
test('alerts endpoint returns an array', async () => {
  const api = await setup();

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/alerts`
    );

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.ok(Array.isArray(data.alerts));
  } finally {
    await api.close();
  }
});

// TEST 9: Unauthenticated request.
test('unauthenticated request is rejected', async () => {
  const api = await setup((req, res) => {
    res.status(401).json({
      error: 'Authentication required'
    });
  });

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/history`
    );

    assert.equal(response.status, 401);
  } finally {
    await api.close();
  }
});

// TEST 10: Unsupported role.
test('unsupported role cannot access behavioral health', async () => {
  const otherRoleAuth = (req, res, next) => {
    req.user = {
      uid: 'other-user',
      aid: null,
      role: 'admin'
    };
    next();
  };

  const api = await setup(otherRoleAuth);

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/history`
    );

    assert.equal(response.status, 403);
  } finally {
    await api.close();
  }
});

// TEST 11: Another astronaut cannot access records.
test('another astronaut cannot access behavioral records', async () => {
  const api = await setup((req, res, next) => {
    req.user = {
      uid: 'user-2',
      aid: 'astro-2',
      role: 'astronaut'
    };
    next();
  });

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/history`
    );

    assert.equal(response.status, 403);
  } finally {
    await api.close();
  }
});

// TEST 12: Three consecutive low moods.
test('three consecutive low moods trigger a wellness alert', async () => {
  const api = await setup();

  try {
    for (let i = 0; i < 3; i++) {
      const response = await fetch(
        `${api.base}/api/behavioral-health/checkins`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mood: 'Low',
            journalEntry: 'I feel lonely, anxious and overwhelmed.'
          })
        }
      );

      assert.equal(response.status, 201);
    }

    const response = await fetch(
      `${api.base}/api/behavioral-health/alerts`
    );

    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.alerts.length, 1);
    assert.equal(data.alerts[0].type, 'repeated_low_mood');
  } finally {
    await api.close();
  }
});

// TEST 13: Weekly statistics.
test('weekly statistics return mood averages and trends', async () => {
  const api = await setup();

  try {
    const response = await fetch(
      `${api.base}/api/behavioral-health/stats?period=week`
    );

    assert.equal(response.status, 200);

    const data = await response.json();

    assert.equal(data.period, 'week');
    assert.equal(data.days, 7);
    assert.ok(Array.isArray(data.trends));
    assert.ok(Number.isInteger(data.summary.total_checkins));
  } finally {
    await api.close();
  }
});

// TEST 14: Flight Surgeon cannot see astronaut records.
test('Flight Surgeon cannot see astronaut check-ins', async () => {
  const astronautApi = await setup();

  const medicalAuth = (req, res, next) => {
    req.user = {
      uid: 'medical-user-1',
      aid: null,
      role: 'medical'
    };
    next();
  };

  const medicalApi = await setup(medicalAuth);

  try {
    const submitResponse = await fetch(
      `${astronautApi.base}/api/behavioral-health/checkins`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: 'Good',
          journalEntry: 'Astronaut private check-in.'
        })
      }
    );

    assert.equal(submitResponse.status, 201);

    const historyResponse = await fetch(
      `${medicalApi.base}/api/behavioral-health/history`
    );

    assert.equal(historyResponse.status, 200);

    const data = await historyResponse.json();
    assert.equal(data.records.length, 0);
  } finally {
    await astronautApi.close();
    await medicalApi.close();
  }
});

// TEST 15: Medical accounts cannot access each other's records.
test('medical accounts cannot access each other records', async () => {
  const medicalAuth1 = (req, res, next) => {
    req.user = {
      uid: 'medical-user-1',
      aid: null,
      role: 'medical'
    };
    next();
  };

  const medicalAuth2 = (req, res, next) => {
    req.user = {
      uid: 'medical-user-2',
      aid: null,
      role: 'medical'
    };
    next();
  };

  const api1 = await setup(medicalAuth1);
  const api2 = await setup(medicalAuth2);

  try {
    const submitResponse = await fetch(
      `${api1.base}/api/behavioral-health/checkins`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: 'Good',
          journalEntry: 'Private medical account check-in.'
        })
      }
    );

    assert.equal(submitResponse.status, 201);

    const historyResponse = await fetch(
      `${api2.base}/api/behavioral-health/history`
    );

    assert.equal(historyResponse.status, 200);

    const data = await historyResponse.json();
    assert.equal(data.records.length, 0);
  } finally {
    await api1.close();
    await api2.close();
  }
});
