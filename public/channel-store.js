const STATUS_ORDER = ['submitted', 'processing', 'ready', 'released'];

const EMPTY_STATE = {
  channels: {
    'pupil-01': { status: 'submitted', submissions: [], release: { decision: 'hold', approvedRequestId: null } },
    'pupil-02': { status: 'submitted', submissions: [], release: { decision: 'hold', approvedRequestId: null } },
    'pupil-03': { status: 'submitted', submissions: [], release: { decision: 'hold', approvedRequestId: null } }
  }
};

export async function readState() {
  try {
    const res = await fetch('/api/channels/state', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load state');
    return await res.json();
  } catch {
    return EMPTY_STATE;
  }
}

export async function submitToChannel(channel, message) {
  const res = await fetch(`/api/channels/${encodeURIComponent(channel)}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to submit request');
  }

  return res.json();
}

export async function setChannelStatus(channel, status) {
  const res = await fetch(`/api/channels/${encodeURIComponent(channel)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update status');
  }
}

export async function setReleaseDecision(channel, decision) {
  const res = await fetch(`/api/channels/${encodeURIComponent(channel)}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update release decision');
  }
}

export function statusOrder() {
  return [...STATUS_ORDER];
}
