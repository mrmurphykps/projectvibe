const STORE_KEY = 'projectvibe:mvp-state';
const STATUS_ORDER = ['submitted', 'processing', 'ready', 'released'];

function getInitialState() {
  return {
    channels: {
      'pupil-01': { status: 'submitted', submissions: [] },
      'pupil-02': { status: 'submitted', submissions: [] },
      'pupil-03': { status: 'submitted', submissions: [] }
    }
  };
}

export function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const state = getInitialState();
    if (parsed?.channels && typeof parsed.channels === 'object') {
      for (const channel of Object.keys(state.channels)) {
        const fromDisk = parsed.channels[channel];
        if (!fromDisk) continue;
        state.channels[channel].status = STATUS_ORDER.includes(fromDisk.status)
          ? fromDisk.status
          : state.channels[channel].status;
        state.channels[channel].submissions = Array.isArray(fromDisk.submissions)
          ? fromDisk.submissions
          : [];
      }
    }
    return state;
  } catch {
    return getInitialState();
  }
}

export function writeState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export function submitToChannel(channel, message) {
  const state = readState();
  if (!state.channels[channel]) return;
  state.channels[channel].submissions.unshift({
    message,
    submittedAt: new Date().toISOString()
  });
  state.channels[channel].status = 'submitted';
  writeState(state);
}

export function setChannelStatus(channel, status) {
  if (!STATUS_ORDER.includes(status)) return;
  const state = readState();
  if (!state.channels[channel]) return;
  state.channels[channel].status = status;
  writeState(state);
}

export function statusOrder() {
  return [...STATUS_ORDER];
}
