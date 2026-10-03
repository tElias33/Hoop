import { handleImport } from '../server/import-service.mjs';

// Vercel's Web Request handler uses the same validated importer as Cloudflare.
export default {
    fetch(request) {
        return handleImport(request);
    }
};
