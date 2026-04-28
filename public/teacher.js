import { readState, setChannelStatus, statusOrder } from './channel-store.js';

const inboxEl = document.getElementById('inbox');
const channels = ['pupil-01', 'pupil-02', 'pupil-03'];

function render() {
  const state = readState();
  inboxEl.innerHTML = '<h2>Inbox</h2>';

  for (const channel of channels) {
    const data = state.channels[channel];
    const wrap = document.createElement('article');
    wrap.className = 'inbox-item';

    const header = document.createElement('div');
    header.className = 'row';
    header.innerHTML = `<h3>${channel}</h3><span class="small">Status: ${data.status}</span>`;

    const controls = document.createElement('div');
    controls.className = 'row';
    for (const status of statusOrder()) {
      const btn = document.createElement('button');
      btn.textContent = status;
      if (status === data.status) btn.disabled = true;
      btn.addEventListener('click', () => {
        setChannelStatus(channel, status);
        render();
      });
      controls.appendChild(btn);
    }

    const submissionBlock = document.createElement('div');
    const latest = data.submissions[0];
    submissionBlock.className = 'small';
    submissionBlock.innerHTML = latest
      ? `<p><b>Latest submission:</b> ${latest.message}</p><p>At: ${new Date(latest.submittedAt).toLocaleString()}</p>`
      : '<p>No submissions yet.</p>';

    wrap.append(header, controls, submissionBlock);
    inboxEl.appendChild(wrap);
  }
}

render();
setInterval(render, 2000);
