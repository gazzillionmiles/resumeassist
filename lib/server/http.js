export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  return Response.json(data, { ...init, headers });
}

export function noContent() {
  const headers = new Headers({
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  });
  return new Response(null, { status: 204, headers });
}

export function options() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    },
  });
}

export function handleError(error) {
  console.error('[api]', error);
  if (error.name === 'FetchBlockedError') return json({ error: 'fetch_blocked', reason: error.reason, message: "We couldn't read that page. Paste the job description text instead." }, { status: 422 });
  if (error.name === 'BedrockJSONParseError') return json({ error: 'llm_parse_failed', message: 'The AI response could not be parsed. Try again, or paste the job text manually.' }, { status: 502 });
  if (error.name === 'ZodError') return json({ error: 'invalid_input', details: error.errors }, { status: 400 });
  if (error.status === 401) return json({ error: error.message }, { status: 401 });
  return json({ error: 'internal_error' }, { status: 500 });
}
