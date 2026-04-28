import { readState, submitToChannel, statusOrder } from './channel-store.js';

const channel = location.pathname.replace('/', '') || 'pupil-01';
const supported = new Set(['pupil-01', 'pupil-02', 'pupil-03']);
const currentChannel = supported.has(channel) ? channel : 'pupil-01';

const titleEl = document.getElementById('channelTitle');
const linkEl = document.getElementById('projectLink');
const badgesEl = document.getElementById('badges');
const statusTextEl = document.getElementById('statusText');
const releaseNoticeEl = document.getElementById('releaseNotice');
const submitBtn = document.getElementById('submitBtn');
const promptEl = document.getElementById('prompt');
const submitMsgEl = document.getElementById('submitMsg');

async function renderStatus() {
  const state = await readState();
  const channelState = state.channels[currentChannel];
  const status = channelState.status;
  const decision = channelState.release?.decision || 'hold';
  const hasSubmission = channelState.submissions.length > 0;

  badgesEl.innerHTML = '';
  for (const step of statusOrder()) {
    const badge = document.createElement('span');
    badge.className = `badge${step === status ? ' active' : ''}`;
    badge.textContent = step;
    badgesEl.appendChild(badge);
  }

  statusTextEl.textContent = `Current status: ${status}`;

  if (decision === 'approve') {
    linkEl.href = `/projects/${currentChannel}/`;
    linkEl.textContent = `/projects/${currentChannel}/`;
    linkEl.classList.remove('disabled-link');
    linkEl.removeAttribute('aria-disabled');
    releaseNoticeEl.textContent = 'Latest update is approved and released.';
  } else {
    linkEl.removeAttribute('href');
    linkEl.textContent = 'Awaiting teacher release';
    linkEl.classList.add('disabled-link');
    linkEl.setAttribute('aria-disabled', 'true');

    if (hasSubmission) {
      releaseNoticeEl.textContent = 'A new version exists, but it is on hold until the teacher approves release.';
    } else {
      releaseNoticeEl.textContent = 'No updates submitted yet.';
    }
  }
}

titleEl.textContent = currentChannel;
renderStatus();

submitBtn.addEventListener('click', async () => {
  const message = promptEl.value.trim();
  if (!message) {
    submitMsgEl.textContent = 'Please enter a request first.';
    return;
  }

  try {
    await submitToChannel(currentChannel, message);
    promptEl.value = '';
    submitMsgEl.textContent = 'Submitted to teacher inbox.';
    await renderStatus();
  } catch (error) {
    submitMsgEl.textContent = error.message;
  }
});

setInterval(renderStatus, 2000);
