import { readState, setChannelStatus, setReleaseDecision, statusOrder } from './channel-store.js';

const inboxEl = document.getElementById('inbox');
const channels = ['pupil-01', 'pupil-02', 'pupil-03'];

async function render() {
  const state = await readState();
  inboxEl.innerHTML = '<h2>Inbox</h2>';

  for (const channel of channels) {
    const data = state.channels[channel];
    const latest = data.submissions[0] || null;

    const wrap = document.createElement('article');
    wrap.className = 'inbox-item';

    const header = document.createElement('div');
    header.className = 'row';
    header.innerHTML = `<h3>${channel}</h3><span class="small">Status: ${data.status}</span>`;

    const statusControls = document.createElement('div');
    statusControls.className = 'row';
    for (const status of statusOrder()) {
      const btn = document.createElement('button');
      btn.textContent = status;
      if (status === data.status) btn.disabled = true;
      btn.addEventListener('click', async () => {
        await setChannelStatus(channel, status);
        await render();
      });
      statusControls.appendChild(btn);
    }

    const releaseControls = document.createElement('div');
    releaseControls.className = 'row';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'primary';
    approveBtn.textContent = 'Approve for release';
    approveBtn.disabled = !latest || data.release?.decision === 'approve';
    approveBtn.addEventListener('click', async () => {
      await setReleaseDecision(channel, 'approve');
      await render();
    });

    const holdBtn = document.createElement('button');
    holdBtn.textContent = 'Hold';
    holdBtn.disabled = !latest || data.release?.decision === 'hold';
    holdBtn.addEventListener('click', async () => {
      await setReleaseDecision(channel, 'hold');
      await render();
    });

    const releaseText = document.createElement('span');
    releaseText.className = 'small';
    const decision = data.release?.decision || 'hold';
    releaseText.textContent = `Release decision: ${decision}`;

    releaseControls.append(approveBtn, holdBtn, releaseText);

    const submissionBlock = document.createElement('div');
    submissionBlock.className = 'small';
    submissionBlock.innerHTML = latest
      ? `<p><b>Latest submission:</b> ${latest.message}</p><p>At: ${new Date(latest.submittedAt).toLocaleString()}</p>`
      : '<p>No submissions yet.</p>';

    wrap.append(header, statusControls, releaseControls, submissionBlock);
    inboxEl.appendChild(wrap);
  }
}

render();
setInterval(render, 2000);
