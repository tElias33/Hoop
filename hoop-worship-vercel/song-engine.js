(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SongEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const pitches = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const solfege = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
    const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const notePattern = '(?:Sol|Do|Re|Mi|Fa|La|Si|[A-G])(?:##|bb|♯♯|♭♭|𝄪|𝄫|[#b♯♭x])?';
    const suffixToken = /(?:maj|min|dim|aug|sus|add|omit|no|alt|m|Δ|∆|△|ø|°|º|o|\+|-|\d+|[#b♯♭]\d+|\/(?:9|11|13)|[(),])/iy;
    function validSuffix(suffix) {
        let offset = 0;
        while (offset < suffix.length) {
            suffixToken.lastIndex = offset;
            if (!suffixToken.exec(suffix)) return false;
            offset = suffixToken.lastIndex;
        }
        return balanced(suffix);
    }

    function noteParts(note) {
        const match = new RegExp('^(' + notePattern + ')$', 'i').exec(note);
        if (!match) return null;
        const parts = /^(Sol|Do|Re|Mi|Fa|La|Si|[A-G])(.*)$/i.exec(note);
        const letter = solfege[parts[1].toLowerCase()] || parts[1].toUpperCase();
        const accidental = parts[2].replace(/♯/g, '#').replace(/♭/g, 'b');
        const offset = { '': 0, '#': 1, '##': 2, b: -1, bb: -2, x: 2, '𝄪': 2, '𝄫': -2 }[accidental];
        if (offset === undefined) return null;
        return { pitch: (pitches[letter] + offset + 12) % 12, letter, accidental, solfege: parts[1].length > 1 };
    }

    function parseChord(value) {
        if (typeof value !== 'string' || !value || value.length > 128 || /\s/.test(value)) return null;
        const patterns = [notePattern, '(?:[A-G])(?:##|bb|♯♯|♭♭|𝄪|𝄫|[#b♯♭x])?'];
        for (const pattern of patterns) {
            const rootMatch = new RegExp('^(' + pattern + ')(.*)$', 'i').exec(value);
            if (!rootMatch) continue;
            let suffix = rootMatch[2], bass = '';
            const bassMatch = new RegExp('/(' + notePattern + ')$', 'i').exec(suffix);
            if (bassMatch) { bass = bassMatch[1]; suffix = suffix.slice(0, bassMatch.index); }
            if (!validSuffix(suffix) || !noteParts(rootMatch[1]) || (bass && !noteParts(bass))) continue;
            return { root: rootMatch[1], suffix, bass };
        }
        return null;
    }

    function balanced(text) {
        let depth = 0;
        for (const char of text) { if (char === '(') depth++; if (char === ')' && --depth < 0) return false; }
        return depth === 0;
    }

    function transposeChord(chord, steps, key = '') {
        const parsed = parseChord(chord);
        if (!parsed || !Number.isInteger(steps) || steps % 12 === 0) return chord;
        const keyChord = parseChord(key);
        const keyRoot = keyChord && noteParts(keyChord.root);
        const flat = keyChord
            ? /b|𝄫/u.test(keyRoot.accidental) || (!keyRoot.accidental && (keyRoot.letter === 'F' || (keyRoot.letter === 'D' && keyChord.suffix === 'm')))
            : /b|♭|𝄫/u.test(parsed.root + parsed.bass);
        const names = flat ? flats : sharps;
        const shift = note => {
            const p = noteParts(note);
            let name = names[(p.pitch + steps % 12 + 12) % 12];
            if (p.solfege) name = Object.entries(solfege).find(([, letter]) => letter === name[0])[0].replace(/^./, c => c.toUpperCase()) + name.slice(1);
            if (/[♯♭]/.test(note)) name = name.replace(/#/g, '♯').replace(/b/g, '♭');
            return name;
        };
        return shift(parsed.root) + parsed.suffix + (parsed.bass ? '/' + shift(parsed.bass) : '');
    }

    function expandTabs(line) {
        let column = 0;
        return line.replace(/[^\t]|\t/g, char => {
            if (char !== '\t') { column++; return char; }
            const count = 8 - column % 8; column += count; return ' '.repeat(count);
        });
    }

    function chartRows(content) {
        return String(content || '').split(/\r\n|\n|\r/).map((source, line) => {
            const text = expandTabs(source.replace(/\u00a0/g, ' '));
            const bracketed = [...text.matchAll(/\[([^\]\n]+)\]/g)].filter(m => parseChord(m[1]));
            let tokens = bracketed.map(m => ({ line, column: m.index, length: m[0].length, chord: m[1], bracket: true }));
            if (!tokens.length) {
                const words = [...text.matchAll(/[^\s|:]+/g)].map(m => {
                    const stripped = m[0].replace(/^\/\/|\/\/$/g, '');
                    return Object.assign([stripped], { index: m.index + (m[0].startsWith('//') ? 2 : 0) });
                }).filter(m => m[0]);
                const meaningful = words.filter(m => !/^(?:\/\/|[-–—]|[()\[\]]|x\d+|\d+x|N\.?C\.?)$/i.test(m[0]) && !(m.index === 0 && /^(?:Intro|Interludio|Instrumental|Final|Solo)$/i.test(m[0]) && text[m[0].length] === ':'));
                const candidates = meaningful.map(m => ({ ...m, parsed: parseChord(m[0]) }));
                if (candidates.length && candidates.every(m => m.parsed)) {
                    tokens = candidates.map(m => ({ line, column: m.index, length: m[0].length, chord: m[0], bracket: false }));
                }
            }
            return { line, source, text, tokens };
        });
    }

    function extractChords(content) {
        return [...new Set(chartRows(content).flatMap(row => row.tokens.map(token => token.chord)))];
    }

    function transposeText(content, steps, key = '') {
        if (!steps || steps % 12 === 0) return content;
        const separators = String(content).match(/\r\n|\n|\r/g) || [];
        return chartRows(content).map((row, index) => {
            if (!row.tokens.length) return row.source + (separators[index] || '');
            let result = '', cursor = 0;
            for (const token of row.tokens) {
                // Spaces compensate for longer/shorter roots without shifting later anchors.
                result += row.text.slice(cursor, token.column);
                const changed = transposeChord(token.chord, steps, key);
                result += token.bracket ? '[' + changed + ']' : changed;
                cursor = token.column + token.length;
                const growth = changed.length - token.chord.length;
                if (!token.bracket && growth > 0) {
                    for (let count = 0; count < growth && row.text[cursor] === ' '; count++) cursor++;
                } else if (!token.bracket && growth < 0 && cursor < row.text.length) result += ' '.repeat(-growth);
            }
            return result + row.text.slice(cursor) + (separators[index] || '');
        }).join('');
    }

    function renderRows(content, steps = 0, key = '', images = []) {
        const rows = chartRows(content).map(row => {
            const inline = row.tokens.some(t => t.bracket);
            let cursor = 0, removed = 0, segments = [], lyric = '';
            for (const token of row.tokens) {
                if (inline) lyric += row.text.slice(cursor, token.column);
                else if (token.column > cursor) segments.push({ text: row.text.slice(cursor, token.column), column: cursor, chord: false });
                const name = transposeChord(token.chord, steps, key);
                const reservedWidth = Math.max(...Array.from({ length: 12 }, (_, delta) => transposeChord(token.chord, delta, key).length));
                segments.push({ text: name, reservedWidth, column: token.column - removed, sourceColumn: token.column, chord: true });
                cursor = token.column + token.length;
                if (inline) removed += token.length;
            }
            if (inline) segments.push({ text: lyric + row.text.slice(cursor), column: 0, chord: false });
            else if (cursor < row.text.length) segments.push({ text: row.text.slice(cursor), column: cursor, chord: false });
            if (!segments.length) segments = [{ text: row.text || ' ', column: 0, chord: false }];
            // Keep the chord starts fixed; wrap crowded labels into separate visual lanes.
            let ends = [];
            for (const segment of segments.filter(s => s.chord)) {
                let lane = ends.findIndex(end => end < segment.column);
                if (lane < 0) lane = ends.length;
                ends[lane] = segment.column + segment.reservedWidth;
                segment.lane = lane;
            }
            const attached = images.filter(image => validImage(image.dataUrl) && row.source === image.sourceLine)
                .filter(image => image.line === row.line)
                .filter(image => row.tokens.some(t => t.column === image.column && t.chord === image.chord))
                .map(image => ({ ...image, displayColumn: segments.find(s => s.chord && s.sourceColumn === image.column).column }));
            return { ...row, inline, segments, lanes: Math.max(1, ends.length), width: Math.max(1, ...segments.map(s => s.column + (s.reservedWidth || s.text.length)), ...attached.map(p => p.displayColumn + 12)), images: attached };
        });
        rows.forEach(row => { row.displayImages = []; });
        rows.forEach((row, index) => {
            const next = rows[index + 1];
            // Chords above lyrics stay adjacent. Put their photos after that lyric.
            const target = !row.inline && row.tokens.length && next && !next.tokens.length && next.text.trim() && !next.text.startsWith('{') ? next : row;
            target.displayImages.push(...row.images);
        });
        return rows;
    }

    function validImage(data) { return typeof data === 'string' && /^data:image\/(?:png|jpeg|webp|bmp);base64,[A-Za-z0-9+/=\s]+$/.test(data); }

    function resolveImages(images, content) {
        const rows = chartRows(content);
        return (Array.isArray(images) ? images : []).map(image => {
            if (!image || typeof image !== 'object') return null;
            const matching = rows.filter(row => row.source === image.sourceLine && row.tokens.some(t => t.column === image.column && t.chord === image.chord));
            const exact = matching.find(row => row.line === image.line);
            const row = exact || (matching.length === 1 ? matching[0] : null);
            return { ...image, line: row ? row.line : -1 };
        }).filter(Boolean);
    }

    function sourceInfo(value) {
        const input = String(value || '').trim();
        if (!input) return null;
        try {
            const url = new URL(/^(?:www\.|(?:acordes\.)?lacuerda\.net\/|cifraclub\.com(?:\.br)?\/)/i.test(input) ? 'https://' + input : input);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
            const host = url.hostname.toLowerCase().replace(/^www\./, '');
            const cifra = ['cifraclub.com', 'cifraclub.com.br'].includes(host);
            const cuerda = ['lacuerda.net', 'acordes.lacuerda.net'].includes(host);
            const parts = url.pathname.split('/').filter(Boolean);
            const label = slug => decodeURIComponent(slug).replace(/\.(?:s?html?)$/i, '').replace(/[-_]+/g, ' ').replace(/\b\p{L}/gu, l => l.toLocaleUpperCase('es'));
            return { url: url.href, name: cifra ? 'Cifra Club' : cuerda ? 'La Cuerda' : host,
                title: (cifra || cuerda) && parts.length >= 2 ? label(parts[1]) : '',
                artist: (cifra || cuerda) && parts.length >= 2 ? label(parts[0]) : '' };
        } catch { return null; }
    }

    function importText(text) {
        let title = '', artist = '', key = '', warnings = [];
        text = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
        const lines = text.split('\n').filter(line => {
            const directive = /^\{(title|t|artist|subtitle|st|key|capo):\s*(.*?)\}$/i.exec(line.trim());
            if (!directive) return true;
            const name = directive[1].toLowerCase();
            if (['title', 't'].includes(name)) title = directive[2];
            else if (['artist', 'subtitle', 'st'].includes(name)) artist = directive[2];
            else if (name === 'key') key = directive[2];
            else return true; // Keep capo instructions: sounding transposition is separate.
            return false;
        });
        const content = lines.join('\n').replace(/^```(?:text|chordpro)?\n|\n```\s*$/g, '');
        if (!content.trim()) throw new Error('No se encontró letra ni acordes en el contenido.');
        const chords = extractChords(content);
        if (!chords.length) warnings.push('No se reconocieron acordes. Revisa si la fuente contiene solo letra o tablatura.');
        const uncertain = chartRows(content).filter(row => {
            if (row.tokens.length) return false;
            const words = [...row.text.matchAll(/\S+/g)].map(m => m[0]);
            const possible = words.filter(word => parseChord(word));
            const explicit = possible.some(word => { const c = parseChord(word); return c.suffix || c.bass || noteParts(c.root).accidental; });
            const symbols = words.filter(word => !parseChord(word)).every(word => /^[^\p{L}]+$/u.test(word));
            return possible.length >= 2 && possible.length / words.length >= 0.6 && (explicit || symbols);
        });
        if (uncertain.length) warnings.push('Estas líneas mezclan posibles acordes con texto o símbolos no reconocidos: ' + uncertain.map(row => row.line + 1).join(', ') + '. Usa [acordes] para indicar sus posiciones sin confundirlos con la letra.');
        return { title, artist, key, content, chords, warnings };
    }

    // Detached DOM only: remote markup is never inserted into the live page.
    function importHTML(html, url = '', Parser = globalThis.DOMParser) {
        if (!Parser) throw new Error('No hay un lector HTML disponible.');
        const doc = new Parser().parseFromString(String(html), 'text/html');
        doc.querySelectorAll('script,style,noscript,iframe,[hidden],[aria-hidden="true"]').forEach(n => n.remove());
        if (doc.querySelector('#rThumbs .rtLabel a')) throw new Error('Este enlace muestra versiones resumidas. Abre una versión «Letra y Acordes» y copia su enlace completo.');
        const selector = '.cifra_cnt pre, .js-tab-content pre, #acordes pre, #chords pre, pre.chord-chart, [data-chord-chart], [data-chord-content], .chord-chart, #t_body, pre';
        const candidates = [...doc.querySelectorAll(selector)].filter(n => !n.parentElement?.closest(selector));
        const readable = node => {
            if (node.nodeType === 3) return node.nodeValue;
            if (node.nodeType !== 1) return '';
            if (node.tagName === 'BR') return '\n';
            const chord = node.getAttribute('data-chord');
            if (chord && parseChord(chord)) return '[' + chord + ']' + (node.textContent.trim() === chord ? '' : [...node.childNodes].map(readable).join(''));
            const inner = [...node.childNodes].map(readable).join('');
            return inner && /^(DIV|P|LI)$/.test(node.tagName) && !inner.endsWith('\n') ? inner + '\n' : inner;
        };
        const scored = candidates.map(node => ({ node, text: readable(node) })).filter(c => c.text.trim());
        const main = scored.filter(c => c.node.matches('.cifra_cnt pre, .js-tab-content pre, #acordes pre, #chords pre, pre.chord-chart, [data-chord-chart], [data-chord-content], .chord-chart, #t_body'));
        const selected = main.length ? main : scored.sort((a, b) => extractChords(b.text).length - extractChords(a.text).length || b.text.length - a.text.length).slice(0, 1);
        const candidate = { text: selected.map(c => c.text).join('\n\n') };
        if (!candidate?.text.trim()) throw new Error('La página no contiene un bloque de letra con acordes reconocible. Pega el texto de la canción.');
        const result = importText(candidate.text);
        const title = doc.querySelector('h1');
        result.title = (title && [...title.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()) || title?.textContent.trim() || result.title || sourceInfo(url)?.title || '';
        result.artist = doc.querySelector('.t3 a, .cifra-header h2 a, [itemprop="byArtist"], .artist, #r_head h1 a, #tH1 h2 a')?.textContent.trim() || doc.querySelector('h1 + a h2')?.textContent.trim() || result.artist || sourceInfo(url)?.artist || '';
        const key = doc.querySelector('#cifra_tom a, .tone a, [data-song-key]');
        result.key = key?.getAttribute('data-song-key') || key?.textContent.trim() || doc.querySelector('[aria-label="Reducir tono"] + span')?.textContent.trim() || result.key;
        if (!parseChord(result.key)) result.key = '';
        if (scored.length > selected.length) result.warnings.push(`Se importaron ${selected.length} bloques de canción. Se omitieron ${scored.length - selected.length} bloques secundarios; revisa si contienen tablaturas o versiones alternativas.`);
        const marked = selected.flatMap(c => [...c.node.querySelectorAll('b, [data-chord-name], [data-chord], #t_body a')]).map(n => n.getAttribute('data-chord') || n.getAttribute('data-chord-name') || n.textContent.trim()).filter(Boolean);
        const unsupported = marked.filter(c => !parseChord(c));
        if (unsupported.length) result.warnings.push('Revisa estas marcas de la fuente: ' + [...new Set(unsupported)].join(', '));
        const recognized = chartRows(result.content).flatMap(row => row.tokens.map(token => token.chord));
        const counts = recognized.reduce((map, name) => (map[name] = (map[name] || 0) + 1, map), {});
        let missing = 0;
        for (const chord of marked.filter(parseChord)) { if (counts[chord]) counts[chord]--; else missing++; }
        if (missing) result.warnings.push(`${missing} acordes marcados por la fuente no pudieron asociarse a una posición. El texto se conserva; revisa esas marcas antes de guardar.`);
        return result;
    }

    async function fetchSong(url, fetcher = globalThis.fetch, signal) {
        const source = sourceInfo(url);
        if (!source) throw new Error('Introduce un enlace completo http:// o https:// válido.');
        const response = await fetcher(source.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('La fuente respondió con un error (' + response.status + '). Pega su texto para continuar.');
        const type = response.headers.get('content-type') || '';
        if (!/text\/(?:html|plain)|application\/(?:x-chordpro|octet-stream)/i.test(type)) throw new Error('Este enlace no contiene una página HTML o texto compatible.');
        const length = Number(response.headers.get('content-length'));
        if (length > 2_000_000) throw new Error('La página supera el límite de importación de 2 MB.');
        const text = await response.text();
        if (text.length > 2_000_000) throw new Error('La página supera el límite de importación de 2 MB.');
        return /text\/html/i.test(type) ? importHTML(text, source.url) : importText(text);
    }

    return { parseChord, noteParts, transposeChord, chartRows, extractChords, transposeText, renderRows, resolveImages, validImage, sourceInfo, importText, importHTML, fetchSong };
});
