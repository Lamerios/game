/**
 * Progress sync for «Кругосветка юнги»: Yandex Cloud Function + Object Storage.
 * No dependencies; runtime nodejs22, entry point index.handler.
 *
 *   GET  ?code=<family code>                 → { devices: { <device>: "<snapshot>" } }
 *   PUT  ?code=<family code>&device=<device> body: snapshot text (≤ 3 MB) → 204
 *
 * The family code is the only key: 16+ random letters, so nobody can guess it,
 * and there is no way to list other families. Each device writes only its own
 * object <code>/<device>, so devices never overwrite each other.
 *
 * Environment: BUCKET = bucket name. The function's service account needs the
 * role storage.editor on that bucket. See docs/sync.md for the setup.
 */

const S3 = 'https://storage.yandexcloud.net';
const CODE = /^[a-z0-9]{16,64}$/;
const DEVICE = /^[a-z0-9]{4,40}$/;
const MAX_BODY = 3_000_000;
const MAX_DEVICES = 8;

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const reply = (statusCode, body) => ({
  statusCode,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: body === undefined ? '' : JSON.stringify(body),
});

function s3(token, method, path, body) {
  return fetch(`${S3}/${process.env.BUCKET}${path}`, {
    method,
    headers: { 'X-YaCloud-SubjectToken': token, ...(body !== undefined ? { 'Content-Type': 'text/plain; charset=utf-8' } : {}) },
    body,
  });
}

module.exports.handler = async (event, context) => {
  const method = event.httpMethod;
  if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  const token = context.token && context.token.access_token;
  if (!token || !process.env.BUCKET) return reply(500, { error: 'function is not set up: service account or BUCKET missing' });

  const q = event.queryStringParameters || {};
  const code = String(q.code || '');
  if (!CODE.test(code)) return reply(400, { error: 'bad code' });

  if (method === 'GET') {
    const list = await s3(token, 'GET', `?list-type=2&prefix=${code}/&max-keys=100`);
    if (!list.ok) return reply(502, { error: `storage list ${list.status}` });
    const xml = await list.text();
    const items = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)]
      .map((m) => ({ key: (/<Key>(.*?)<\/Key>/.exec(m[1]) || [])[1], at: (/<LastModified>(.*?)<\/LastModified>/.exec(m[1]) || [])[1] || '' }))
      .filter((x) => x.key)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, MAX_DEVICES);
    const devices = {};
    await Promise.all(
      items.map(async ({ key }) => {
        const r = await s3(token, 'GET', `/${key}`);
        if (r.ok) devices[key.slice(code.length + 1)] = await r.text();
      }),
    );
    return reply(200, { devices });
  }

  if (method === 'PUT') {
    const device = String(q.device || '');
    if (!DEVICE.test(device)) return reply(400, { error: 'bad device' });
    const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
    if (!body || body.length > MAX_BODY) return reply(413, { error: 'empty or too large' });
    if (!/^[gj]:/.test(body)) return reply(400, { error: 'bad snapshot' });
    const r = await s3(token, 'PUT', `/${code}/${device}`, body);
    if (!r.ok) return reply(502, { error: `storage put ${r.status}` });
    return { statusCode: 204, headers: cors, body: '' };
  }

  return reply(405, { error: 'method not allowed' });
};
