// Same-origin, read-only proxy for supported song pages. Never forwards cookies.
const HOSTS = new Set(['cifraclub.com', 'www.cifraclub.com', 'cifraclub.com.br', 'www.cifraclub.com.br', 'lacuerda.net', 'www.lacuerda.net', 'acordes.lacuerda.net']);
const LIMIT = 2_000_000;
class ImportError extends Error {
    constructor(message, status = 422) { super(message); this.status = status; }
}
export function supportedURL(input) {
    let url;
    try { url = new URL(input); } catch { throw new ImportError('Introduce un enlace completo de Cifra Club o La Cuerda.', 400); }
    if (!HOSTS.has(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
        throw new ImportError('Solo se admiten páginas de canciones de Cifra Club y La Cuerda.', 400);
    }
    if (url.pathname.split('/').filter(Boolean).length < 2) throw new ImportError('El enlace está incompleto: abre una canción concreta y copia su dirección.', 400);
    url.protocol = 'https:';
    url.hash = '';
    return url;
}
async function limitedBytes(response, limit) {
    if (Number(response.headers.get('content-length')) > limit) throw new ImportError('El contenido supera el tamaño permitido.', 413);
    const reader = response.body?.getReader();
    if (!reader) return new Uint8Array();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > limit) throw new ImportError('El contenido supera el tamaño permitido.', 413);
            chunks.push(value);
        }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
}
function decode(bytes, type) {
    const sample = new TextDecoder('windows-1252').decode(bytes.slice(0, 8192));
    const charset = /charset\s*=\s*["']?([\w-]+)/i.exec(type)?.[1] || /charset\s*=\s*["']?([\w-]+)/i.exec(sample)?.[1];
    if (/^(?:iso-8859-1|latin-?1|windows-1252)$/i.test(charset || '')) return new TextDecoder('windows-1252').decode(bytes);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new ImportError('La fuente usa una codificación que no se pudo leer sin perder texto. Pega la canción manualmente.'); }
}
function json(value, status = 200) {
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export async function handleImport(request, fetcher = fetch, timeoutMs = 12000) {
    if (request.method !== 'POST') return json({ error: 'Usa POST para importar una canción.' }, 405);
    if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'La importación debe iniciarse desde esta aplicación.' }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Envía el enlace como JSON.' }, 415);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
        const body = new TextDecoder().decode(await limitedBytes(request, 4096));
        let input;
        try { input = JSON.parse(body); } catch { throw new ImportError('La solicitud no contiene un enlace válido.', 400); }
        let url = supportedURL(input?.url);
        let response, content, type, selectedVersion = false;
        const warnings = [];
        for (let redirects = 0; redirects <= 3; redirects++) {
            response = await fetcher(url.href, { signal: abort.signal, redirect: 'manual', headers: { Accept: 'text/html,text/plain;q=0.9', 'User-Agent': 'HoopWorship/2 (song importer)' } });
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get('location');
                await response.body?.cancel();
                if (!location || redirects === 3) throw new ImportError('La fuente redirige demasiadas veces o no indica una canción válida.');
                url = supportedURL(new URL(location, url).href);
                continue;
            }
            if (!response.ok) throw new ImportError(`La fuente respondió ${response.status}. No se pudo importar; puedes pegar la letra y los acordes.`, 502);
            type = response.headers.get('content-type') || '';
            if (!/^text\/(?:html|plain)\b|^application\/x-chordpro\b/i.test(type)) throw new ImportError('El enlace no contiene HTML o texto de una canción.');
            content = decode(await limitedBytes(response, LIMIT), type);
            // LaCuerda song indexes expose only truncated previews. Follow an actual
            // "Letra y Acordes" link, never construct or merge alternative versions.
            if (url.hostname.endsWith('lacuerda.net') && /id\s*=\s*['"]?rThumbs\b/i.test(content)) {
                const links = [...content.matchAll(/class\s*=\s*['"]rtLabel['"][^>]*>\s*<a\b[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>\s*Letra y Acordes\s*<\/a>/gi)].map(m => m[1]);
                if (!links.length || selectedVersion || redirects === 3) throw new ImportError('La fuente solo muestra vistas previas. Abre una versión completa de Letra y Acordes.');
                const base = url.pathname.split('/').filter(Boolean).pop();
                const link = links.find(href => href === base + '.shtml') || links[0];
                const directory = new URL(url);
                directory.pathname = '/' + url.pathname.split('/').filter(Boolean).slice(0, -1).join('/') + '/';
                directory.search = '';
                url = supportedURL(new URL(link, directory).href);
                selectedVersion = true;
                warnings.push('La Cuerda mostraba varias versiones. Se importó una versión completa de Letra y Acordes; revisa su fuente antes de guardar.');
                continue;
            }
            break;
        }
        if (!content.trim()) throw new ImportError('La fuente devolvió contenido vacío.');
        return json({ url: url.href, type: /^text\/html/i.test(type) ? 'text/html' : 'text/plain', content, warnings });
    } catch (error) {
        if (abort.signal.aborted || error.name === 'AbortError') return json({ error: 'La fuente tardó demasiado. Puedes reintentar o pegar el texto.' }, 504);
        return json({ error: error instanceof ImportError ? error.message : 'No se pudo conectar con la fuente. Tu canción no se modificó.' }, error.status || 502);
    } finally { clearTimeout(timer); }
}
export default {
    async fetch(request, env) {
        if (new URL(request.url).pathname === '/api/import-song') return handleImport(request);
        return env.ASSETS.fetch(request);
    }
};
