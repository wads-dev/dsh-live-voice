import { ChatterboxHttpHost } from '../../modules/speak/engines/chatterbox/ChatterboxHttpHost.js';
import { wavToM4aAac } from '../../modules/speak/engines/audio/M4aAacTranscoder.js';

/** DSH owns browser authentication and propagates cancellation through Request.signal. */
export function registerChatterboxRoutes(
  ctx: any,
  { host = new ChatterboxHttpHost(), encode = wavToM4aAac } = {},
) {
  const disposers = ['voices', 'capabilities', 'speech'].map((endpoint) =>
    ctx.connection.fetch.register({
      path: '/api/dsh-live-voice/chatterbox/' + endpoint,
      methods: [endpoint === 'speech' ? 'POST' : 'GET'],
      requestBody: 'buffered',
      fetch: async (request: Request) => {
        const headers = { 'cache-control': 'no-store' };
        try {
          if (endpoint !== 'speech')
            return Response.json(
              {
                ok: true,
                value: await (endpoint === 'voices'
                  ? host.voices(request.signal)
                  : host.capability(request.signal)),
              },
              { headers },
            );
          const text = await request.text();
          if (new TextEncoder().encode(text).byteLength > 64000)
            return Response.json(
              { ok: false, error: { code: 'invalid-request' } },
              { status: 413, headers },
            );
          let body;
          try {
            body = JSON.parse(text);
          } catch {
            return Response.json(
              { ok: false, error: { code: 'invalid-request' } },
              { status: 400, headers },
            );
          }
          const wav = await host.synthesize(body?.text, {
            voice: body?.voice,
            lang: body?.lang,
            signal: request.signal,
          });
          const audio = await (encode as any)(wav, { signal: request.signal });
          return new Response(audio, { headers: { ...headers, 'content-type': 'audio/mp4' } });
        } catch (error: any) {
          return Response.json(
            {
              ok: false,
              error: {
                code: request.signal.aborted ? 'cancelled' : 'chatterbox-unavailable',
                message: request.signal.aborted
                  ? 'Speech was cancelled.'
                  : error?.message || 'Chatterbox service unavailable.',
              },
            },
            { status: request.signal.aborted ? 499 : 502, headers },
          );
        }
      },
    }),
  );
  ctx.effect(
    () => () => {
      host.dispose();
      for (const dispose of disposers) dispose();
    },
    'dsh-live-voice: remove Chatterbox bridge',
  );
}
