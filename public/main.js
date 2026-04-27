const statusEl = document.getElementById('status');
const loginForm = document.getElementById('loginForm');
const issueBtn = document.getElementById('issueBtn');

const setStatus = (text) => {
  statusEl.textContent = text;
};

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('Signing in...');

  const channel = document.getElementById('channel').value;
  const pin = document.getElementById('pin').value;

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, pin })
  });

  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || 'Login failed');
    return;
  }

  issueBtn.disabled = false;
  setStatus(`Signed in for ${data.channel}. Session expires in ${data.expiresInSeconds}s.`);
});

issueBtn.addEventListener('click', async () => {
  setStatus('Creating issue...');
  const response = await fetch('/api/github/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Sample pupil request',
      body: 'Please add a new button to my project.'
    })
  });

  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || 'Issue creation failed');
    return;
  }

  setStatus(`Issue created: ${data.issueUrl}`);
});
