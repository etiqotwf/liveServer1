import fetch from 'node-fetch';

const simulate = async () => {
  const res = await fetch('http://localhost:3000/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      ip: '123.45.67.89',
      method: 'POST',
      threatType: 'attack'
    })
  });

  const data = await res.json();
  console.log(data);
};

simulate();
