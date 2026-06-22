const { getStore } = require('@netlify/blobs');

function emptyMonth() {
  return { comunes: [], extras: [], salarios: [] };
}

exports.handler = async function (event) {
  const store = getStore('gastos');

  if (event.httpMethod === 'GET') {
    const month = event.queryStringParameters && event.queryStringParameters.month;
    if (!month) return { statusCode: 400, body: JSON.stringify({ error: 'falta month' }) };
    const data = (await store.get(month, { type: 'json' })) || emptyMonth();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { action, month, section, entry, id } = body;
    if (!month || !['comunes', 'extras', 'salarios'].includes(section)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'datos inválidos' }) };
    }
    const data = (await store.get(month, { type: 'json' })) || emptyMonth();

    if (action === 'add') {
      const newEntry = { ...entry, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) };
      data[section] = [...data[section], newEntry];
    } else if (action === 'delete') {
      data[section] = data[section].filter((e) => e.id !== id);
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'acción inválida' }) };
    }

    await store.setJSON(month, data);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ list: data[section] }) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
