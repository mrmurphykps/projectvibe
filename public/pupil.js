import { readState, submitToChannel, statusOrder } from './channel-store.js';

const channel = location.pathname.replace('/', '') || 'pupil-01';
const supported = new Set(['pupil-01', 'pupil-02', 'pupil-03']);
const currentChannel = supported.has(channel) ? channel : 'pupil-01';

const titleEl = document.getElementById('channelTitle');
const linkEl = document.getElementById('projectLink');
const badgesEl = document.getElementById('badges');
const statusTextEl = document.getElementById('statusText');
const submitBtn = document.getElementById('submitBtn');
const promptEl = document.getElementById('prompt');
const submitMsgEl = document.getElementById('submitMsg');

function renderStatus() {
  const state = readState();
  const status = state.channels[currentChannel].status;

  badgesEl.innerHTML = '';
  for (const step of statusOrder()) {
    const badge = document.createElement('span');
    badge.className = `badge${step === status ? ' active' : ''}`;
    badge.textContent = step;
    badgesEl.appendChild(badge);
  }

  statusTextEl.textContent = `Current status: ${status}`;
}

titleEl.textContent = currentChannel;
linkEl.href = `/projects/${currentChannel}/`;
linkEl.textContent = `/projects/${currentChannel}/`;
renderStatus();

submitBtn.addEventListener('click', () => {
  const message = promptEl.value.trim();
  if (!message) {
    submitMsgEl.textContent = 'Please enter a request first.';
    return;
  }

  submitToChannel(currentChannel, message);
  promptEl.value = '';
  submitMsgEl.textContent = 'Submitted to teacher inbox.';
  renderStatus();
});

setInterval(renderStatus, 2000);
