const fetchOriginal = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url)
  if (url.hostname !== '127.0.0.1') return Promise.resolve(new Response('', { status: 503 }))
  return fetchOriginal(input, init)
}
