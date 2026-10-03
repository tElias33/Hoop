function MusicApp() {

    return {

        // --------------------------------
        // DATA
        // --------------------------------

        items: [],

        userItems: [],

        organization: { favorites: [], order: [], deleted: [], purged: [], groups: [], archivedGroups: [] },
        collection: "all",
        arranging: false,
        groupItem: null,
        showGroupForm: false,
        editingGroupId: null,
        groupName: "",
        organizationError: "",

        search: "",

        filter: "all",

        selectedItem: null,

        editingItemId: null,

        transposeSteps: 0,

        chartFullscreen: false,

        nativeChartFullscreen: false,

        previousPageOverflow: "",

        presentationFontSize: 24,

        presentationAutoFit: true,

        ocrBusy: false,

        ocrProgress: 0,

        ocrStatus: "",

        ocrLanguage: "eng",

        ocrError: "",

        linkError: "",

        linkNotice: "",
        linkBusy: false,
        importRun: 0,
        importedDraft: null,
        imageTarget: "",
        photoError: "",
        photoBusy: false,

        showAddForm: false,


        // --------------------------------
        // FORM
        // --------------------------------

        form: {
            type: "song",
            title: "",
            artist: "",
            level: "Beginner",
            key: "",
            chords: "",
            tags: "",
            description: "",
            content: "",
            originalImageData: "",
            sourceUrl: "",
            chordImages: []
        },


        // --------------------------------
        // INITIALIZE
        // --------------------------------

        init() {

            // Keep the bundled examples and persist songs added by the user.
            try {
                const savedItems = JSON.parse(
                    localStorage.getItem("musicians-library-items") || "[]"
                );
                this.userItems = Array.isArray(savedItems) ? savedItems : [];
            } catch (error) {
                console.warn("Saved songs could not be loaded:", error);
                this.userItems = [];
            }
            try {
                const saved = JSON.parse(localStorage.getItem("hoop-worship-library-organization") || "{}");
                const ids = value => Array.isArray(value) ? [...new Set(value.filter(id => typeof id === "string" || typeof id === "number").map(String))] : [];
                const groups = value => Array.isArray(value) ? value.filter(group => group && typeof group.id === "string" && typeof group.name === "string").map(group => ({ id: group.id, name: group.name, itemIds: ids(group.itemIds) })) : [];
                this.organization = { favorites: ids(saved.favorites), order: ids(saved.order), deleted: ids(saved.deleted), purged: ids(saved.purged), groups: groups(saved.groups), archivedGroups: groups(saved.archivedGroups) };
            } catch {
                this.organizationError = "No se pudo leer la organización guardada. Las canciones siguen disponibles.";
            }
            const overrides = new Set(this.userItems.map(item => String(item.id)));
            this.items = [...this.userItems, ...musicData.filter(item => !overrides.has(String(item.id)))].filter(item => !this.organization.purged.includes(String(item.id)));

            document.addEventListener("fullscreenchange", () => {
                if (!this.chartFullscreen) return;
                if (document.fullscreenElement?.id === "chart-presentation") {
                    this.nativeChartFullscreen = true;
                    if (this.presentationAutoFit) requestAnimationFrame(() => this.fitChartToScreen());
                } else if (this.nativeChartFullscreen) {
                    this.exitChartFullscreen();
                }
            });

            try {
                const reading = JSON.parse(localStorage.getItem("hoop-worship-reading-preferences") || "null");
                if (reading && Number.isFinite(reading.size)) {
                    this.presentationFontSize = Math.min(48, Math.max(8, Math.round(reading.size)));
                    this.presentationAutoFit = reading.autoFit !== false;
                }
            } catch {
                // Invalid preferences do not prevent opening a song.
            }
            window.addEventListener("resize", () => {
                if (this.chartFullscreen && this.presentationAutoFit) requestAnimationFrame(() => this.fitChartToScreen());
            });

            console.log(
                "Music library loaded:",
                this.items.length
            );

        },


        // --------------------------------
        // FILTERED DATA
        // --------------------------------

        get filteredItems() {

            let result = [...this.collectionItems];


            // Type filter
            if (this.filter !== "all") {

                result = result.filter(
                    item => item.type === this.filter
                );

            }


            // Search
            const query = this.search
                .trim()
                .toLowerCase();


            if (query) {

                result = result.filter(item => {

                    const searchableText = [

                        item.title,

                        item.artist,

                        item.description,

                        item.type,

                        item.level,

                        item.key,

                        ...(item.chords || []),

                        ...(item.tags || [])

                    ]
                    .join(" ")
                    .toLowerCase();


                    return searchableText.includes(query);

                });

            }


            return result;

        },


        // --------------------------------
        // FILTER TITLE
        // --------------------------------

        get filterTitle() {

            if (this.collection === "favorites") return "Favoritas";
            if (this.collection === "trash") return "Papelera";
            const group = this.organization.groups.find(group => group.id === this.collection);
            if (group) return group.name;

            if (this.filter === "song") {
                return "Songs";
            }

            if (this.filter === "lesson") {
                return "Lessons";
            }

            return "Todas";

        },

        get activeItems() {
            return this.items.filter(item => !this.organization.deleted.includes(String(item.id)));
        },

        get favoriteCount() {
            return this.activeItems.filter(item => this.isFavorite(item)).length;
        },

        get collectionItems() {
            if (this.collection === "trash") return this.items.filter(item => this.organization.deleted.includes(String(item.id)));
            let order = this.organization.order;
            let available = this.activeItems;
            if (this.collection === "favorites") {
                order = this.organization.favorites;
                available = available.filter(item => order.includes(String(item.id)));
            } else if (this.collection !== "all") {
                order = this.organization.groups.find(group => group.id === this.collection)?.itemIds || [];
                available = available.filter(item => order.includes(String(item.id)));
            }
            const positions = new Map(order.map((id, index) => [id, index]));
            return [...available].sort((a, b) => (positions.get(String(a.id)) ?? Infinity) - (positions.get(String(b.id)) ?? Infinity));
        },

        selectCollection(collection) {
            this.collection = collection;
            this.filter = "all";
            this.search = "";
        },

        updateOrganization(change) {
            const next = JSON.parse(JSON.stringify(this.organization));
            change(next);
            try {
                localStorage.setItem("hoop-worship-library-organization", JSON.stringify(next));
                this.organization = next;
                this.organizationError = "";
                return true;
            } catch {
                this.organizationError = "No se pudo guardar el cambio. Puede que el navegador no tenga espacio disponible.";
                return false;
            }
        },

        isFavorite(item) {
            return this.organization.favorites.includes(String(item.id));
        },

        toggleFavorite(item) {
            const id = String(item.id);
            this.updateOrganization(next => {
                next.favorites = next.favorites.includes(id) ? next.favorites.filter(value => value !== id) : [...next.favorites, id];
            });
        },

        groupContains(group, item) {
            return group.itemIds.includes(String(item.id));
        },

        groupCount(group) {
            return this.activeItems.filter(item => this.groupContains(group, item)).length;
        },

        toggleGroup(group, item) {
            const id = String(item.id);
            this.updateOrganization(next => {
                const target = next.groups.find(value => value.id === group.id);
                target.itemIds = target.itemIds.includes(id) ? target.itemIds.filter(value => value !== id) : [...target.itemIds, id];
            });
        },

        startGroupForm(group = null) {
            this.editingGroupId = group?.id || null;
            this.groupName = group?.name || "";
            this.showGroupForm = true;
            this.organizationError = "";
        },

        saveGroup() {
            const name = this.groupName.trim();
            if (!name || name.length > 80) {
                this.organizationError = "Escribe un nombre de entre 1 y 80 caracteres.";
                return;
            }
            if (this.organization.groups.some(group => group.id !== this.editingGroupId && group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
                this.organizationError = "Ya existe un grupo con ese nombre.";
                return;
            }
            const id = this.editingGroupId || `group-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
            if (!this.updateOrganization(next => {
                const existing = next.groups.find(group => group.id === id);
                if (existing) existing.name = name;
                else next.groups.push({ id, name, itemIds: [] });
            })) return;
            this.showGroupForm = false;
            this.editingGroupId = null;
            this.groupName = "";
        },

        moveGroup(group, direction) {
            const index = this.organization.groups.findIndex(value => value.id === group.id);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= this.organization.groups.length) return;
            this.updateOrganization(next => {
                [next.groups[index], next.groups[target]] = [next.groups[target], next.groups[index]];
            });
        },

        deleteGroup(group) {
            if (!this.updateOrganization(next => {
                next.archivedGroups.push(next.groups.find(value => value.id === group.id));
                next.groups = next.groups.filter(value => value.id !== group.id);
            })) return;
            if (this.collection === group.id) this.selectCollection("all");
        },

        restoreGroup(group) {
            this.updateOrganization(next => {
                const restored = next.archivedGroups.find(value => value.id === group.id);
                if (!restored) return;
                const originalName = restored.name;
                let suffix = 2;
                while (next.groups.some(value => value.name.toLocaleLowerCase() === restored.name.toLocaleLowerCase())) restored.name = `${originalName} (${suffix++})`;
                next.groups.push(restored);
                next.archivedGroups = next.archivedGroups.filter(value => value.id !== group.id);
            });
        },

        deleteItem(item) {
            const id = String(item.id);
            if (!this.updateOrganization(next => { if (!next.deleted.includes(id)) next.deleted.push(id); })) return;
            if (String(this.selectedItem?.id) === id) this.closeItem();
            if (String(this.groupItem?.id) === id) this.groupItem = null;
        },

        restoreItem(item) {
            this.updateOrganization(next => { next.deleted = next.deleted.filter(id => id !== String(item.id)); });
        },

        emptyTrash() {
            const removed = new Set(this.organization.deleted);
            if (!removed.size) return;
            if (!this.updateOrganization(next => {
                next.purged = [...new Set([...next.purged, ...next.deleted])];
                next.deleted = [];
                next.favorites = next.favorites.filter(id => !removed.has(id));
                next.order = next.order.filter(id => !removed.has(id));
                next.groups.forEach(group => { group.itemIds = group.itemIds.filter(id => !removed.has(id)); });
                next.archivedGroups.forEach(group => { group.itemIds = group.itemIds.filter(id => !removed.has(id)); });
            })) return;
            this.userItems = this.userItems.filter(item => !removed.has(String(item.id)));
            this.items = this.items.filter(item => !removed.has(String(item.id)));
            try {
                localStorage.setItem("musicians-library-items", JSON.stringify(this.userItems));
            } catch {
                this.organizationError = "La Papelera se vació, pero no se pudo actualizar el respaldo local de canciones.";
            }
        },

        canMoveItem(item, direction) {
            const index = this.filteredItems.findIndex(value => String(value.id) === String(item.id));
            return this.collection !== "trash" && index >= 0 && index + direction >= 0 && index + direction < this.filteredItems.length;
        },

        moveItem(item, direction) {
            if (!this.canMoveItem(item, direction)) return;
            const shown = this.filteredItems;
            const index = shown.findIndex(value => String(value.id) === String(item.id));
            const neighborId = String(shown[index + direction].id);
            this.updateOrganization(next => {
                let order;
                if (this.collection === "favorites") order = next.favorites;
                else if (this.collection === "all") {
                    const known = new Set(next.order);
                    next.order.push(...this.items.map(value => String(value.id)).filter(id => !known.has(id)));
                    order = next.order;
                } else order = next.groups.find(group => group.id === this.collection).itemIds;
                const from = order.indexOf(String(item.id));
                const to = order.indexOf(neighborId);
                [order[from], order[to]] = [order[to], order[from]];
            });
        },


        // --------------------------------
        // OPEN ITEM
        // --------------------------------

        openItem(item) {

            this.selectedItem = item;
            this.transposeSteps = 0;

        },


        // --------------------------------
        // CLOSE ITEM
        // --------------------------------

        closeItem() {

            if (this.chartFullscreen) this.exitChartFullscreen();

            this.selectedItem = null;
            this.transposeSteps = 0;

        },

        openChartFullscreen() {
            if (!this.selectedItem?.content || this.chartFullscreen) return;
            const stage = document.getElementById("chart-presentation");
            if (!stage) return;
            this.previousPageOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            this.chartFullscreen = true;
            // Make the existing element visible during the initiating user gesture.
            stage.style.display = "block";
            stage.scrollTop = 0;
            stage.scrollLeft = 0;
            stage.focus({ preventScroll: true });
            if (this.presentationAutoFit) requestAnimationFrame(() => this.fitChartToScreen());
            if (stage.requestFullscreen && !document.fullscreenElement) {
                try {
                    Promise.resolve(stage.requestFullscreen()).catch(() => {
                        // The full-window reading view also works without native fullscreen.
                    });
                } catch {
                    // Keep the reading view available in browsers without fullscreen support.
                }
            }
        },

        saveReadingPreferences() {
            try {
                localStorage.setItem("hoop-worship-reading-preferences", JSON.stringify({ size: this.presentationFontSize, autoFit: this.presentationAutoFit }));
            } catch {
                // Reading controls remain usable when browser storage is unavailable.
            }
        },

        changePresentationSize(direction) {
            this.presentationAutoFit = false;
            this.presentationFontSize = Math.min(48, Math.max(8, this.presentationFontSize + direction));
            this.saveReadingPreferences();
        },

        fitChartToScreen() {
            if (!this.chartFullscreen) return;
            const stage = document.getElementById("chart-presentation");
            const chart = stage?.querySelector(".presentation-lyrics");
            if (!chart || !stage.clientWidth || !stage.clientHeight) return;
            this.presentationAutoFit = true;
            const stageStyle = getComputedStyle(stage);
            const availableWidth = stage.clientWidth - parseFloat(stageStyle.paddingLeft) - parseFloat(stageStyle.paddingRight);
            const availableHeight = stage.clientHeight - parseFloat(stageStyle.paddingTop) - parseFloat(stageStyle.paddingBottom);
            const bounds = chart.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            const size = parseFloat(getComputedStyle(chart).fontSize);
            const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
            this.presentationFontSize = Math.min(48, Math.max(8, Math.floor(size * scale * 0.99)));
            // Apply now so resize/fullscreen events measure the current size.
            chart.style.fontSize = `${this.presentationFontSize}px`;
            stage.scrollTop = 0;
            stage.scrollLeft = 0;
            this.saveReadingPreferences();
        },

        exitChartFullscreen() {
            if (!this.chartFullscreen) return;
            this.chartFullscreen = false;
            this.nativeChartFullscreen = false;
            document.body.style.overflow = this.previousPageOverflow;
            if (document.fullscreenElement?.id === "chart-presentation") {
                Promise.resolve(document.exitFullscreen()).catch(() => {});
            }
            requestAnimationFrame(() => {
                document.getElementById("chart-fullscreen-button")?.focus({ preventScroll: true });
            });
        },


        // --------------------------------
        // RESET SEARCH
        // --------------------------------

        resetSearch() {

            this.search = "";

            this.collection = "all";

            this.filter = "all";

        },


        // --------------------------------
        // CLOSE ADD FORM
        // --------------------------------

        closeAddForm() {

            this.showAddForm = false;
            this.editingItemId = null;
            this.resetForm();

        },

        openAddForm() {

            this.editingItemId = null;
            this.resetForm();
            this.ocrError = "";
            this.showAddForm = true;

        },

        editItem(item) {
            this.resetForm();
            this.editingItemId = item.id;
            this.form = {
                type: item.type || "song",
                title: item.title || "",
                artist: item.artist || "",
                level: item.level || "Beginner",
                key: item.key || "",
                chords: (item.chords || []).join(", "),
                tags: (item.tags || []).join(", "),
                description: item.description || "",
                content: item.content || "",
                originalImageData: item.originalImageData || "",
                sourceUrl: item.sourceUrl || "",
                chordImages: SongEngine.resolveImages(item.chordImages, item.content || "")
            };
            this.ocrError = "";
            this.linkError = "";
            this.linkNotice = "";
            this.selectedItem = null;
            this.showAddForm = true;

        },


        // --------------------------------
        // ADD ITEM
        // --------------------------------

        addItem() {
            if (this.linkBusy || this.ocrBusy || this.photoBusy) return;
            if (!this.form.title.trim()) { this.linkError = "Escribe un título antes de guardar."; return; }
            const source = this.sourceInfo(this.form.sourceUrl);
            if (this.form.sourceUrl.trim() && !source) {
                this.linkError = "Introduce un enlace válido que empiece por https:// o http://.";
                return;
            }
            const newItem = {
                ...(this.items.find(item => String(item.id) === String(this.editingItemId)) || {}),

                id: this.editingItemId || globalThis.crypto?.randomUUID?.() || String(Date.now()),

                type: this.form.type,

                title: this.form.title,

                artist: this.form.artist,

                level: this.form.level,

                key: this.form.key,

                chords: this.form.chords
                    .split(",")
                    .map(chord => chord.trim())
                    .filter(Boolean),

                tags: this.form.tags
                    .split(",")
                    .map(tag => tag.trim())
                    .filter(Boolean),

                description: this.form.description,

                content: this.form.content,

                originalImageData: this.form.originalImageData || "",

                sourceUrl: source?.url || "",
                schemaVersion: 2,
                chordImages: SongEngine.resolveImages(this.form.chordImages, this.form.content)

            };


            newItem.chords = [...new Set([...newItem.chords, ...this.extractChords(newItem.content)])];

            const isEditing = this.editingItemId !== null;
            if (isEditing) {
                const savedIndex = this.userItems.findIndex(
                    item => String(item.id) === String(this.editingItemId)
                );
                const libraryIndex = this.items.findIndex(
                    item => String(item.id) === String(this.editingItemId)
                );
                if (libraryIndex < 0) {
                    alert("This saved song could not be found. Reopen the library and try again.");
                    return;
                }
                const previousSaved = this.userItems[savedIndex];
                const previousLibrary = this.items[libraryIndex];
                if (savedIndex < 0) this.userItems.unshift(newItem);
                else this.userItems.splice(savedIndex, 1, newItem);
                this.items.splice(libraryIndex, 1, newItem);
                if (!this.saveUserItems()) {
                    if (savedIndex < 0) this.userItems.shift();
                    else this.userItems.splice(savedIndex, 1, previousSaved);
                    this.items.splice(libraryIndex, 1, previousLibrary);
                    return;
                }
            } else {
                // Save the original chart so it can be transposed again later.
                this.userItems.unshift(newItem);
                this.items.unshift(newItem);
                if (!this.saveUserItems()) {
                    this.userItems.shift();
                    this.items.shift();
                    return;
                }
            }


            // Reset form
            this.resetForm();
            this.editingItemId = null;


            // Close modal
            this.showAddForm = false;

        },


        // --------------------------------
        // RESET FORM
        // --------------------------------

        resetForm() {

            this.linkError = "";
            this.linkNotice = "";
            this.importRun++;
            this.linkBusy = false;
            this.importedDraft = null;
            this.imageTarget = "";
            this.photoError = "";
            this.photoBusy = false;
            this.ocrBusy = false;

            this.form = {

                type: "song",

                title: "",

                artist: "",

                level: "Beginner",

                key: "",

                chords: "",

                tags: "",

                description: "",

                content: "",

                originalImageData: "",

                sourceUrl: "",
                chordImages: []

            };

        },

        sourceInfo(value) {
            return SongEngine.sourceInfo(value);
        },

        applySourceLink() {
            this.linkError = "";
            this.linkNotice = "";
            if (!this.form.sourceUrl.trim()) return;
            const source = this.sourceInfo(this.form.sourceUrl);
            if (!source) {
                this.linkError = "Introduce un enlace válido que empiece por https:// o http://.";
                return;
            }
            this.form.sourceUrl = source.url;
            if (!this.form.title.trim()) this.form.title = source.title;
            if (!this.form.artist.trim()) this.form.artist = source.artist;
            this.linkNotice = "Fuente guardada. Pulsa Importar canción para leer la letra y los acordes.";
        },

        async importSourceLink() {
            if (this.linkBusy || this.ocrBusy || this.photoBusy) { this.linkNotice = 'Espera a que termine la lectura actual antes de importar otro contenido.'; return; }
            this.linkError = "";
            this.linkNotice = "";
            this.importedDraft = null;
            const source = this.sourceInfo(this.form.sourceUrl);
            if (!source) { this.linkError = "Introduce un enlace completo http:// o https:// válido."; return; }
            const run = ++this.importRun;
            const contentBefore = this.form.content;
            this.linkBusy = true;
            const abort = new AbortController();
            const timeout = setTimeout(() => abort.abort(), 15000);
            try {
                let imported;
                const known = /^(?:https?:\/\/)(?:www\.)?(?:cifraclub\.com(?:\.br)?|(?:acordes\.)?lacuerda\.net)\//i.test(source.url);
                if (known) {
                    const response = await fetch('./api/import-song', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: source.url }), signal: abort.signal });
                    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('El servicio de importación todavía no está instalado en este sitio. Puedes pegar la letra con acordes.');
                    const payload = await response.json();
                    if (!response.ok) throw new Error(payload.error || 'La fuente no está disponible.');
                    imported = payload.type === 'text/plain' ? SongEngine.importText(payload.content) : SongEngine.importHTML(payload.content, payload.url);
                    imported.warnings.push(...(payload.warnings || []));
                    imported.sourceUrl = payload.url;
                } else imported = await SongEngine.fetchSong(source.url, fetch, abort.signal);
                if (run !== this.importRun || this.sourceInfo(this.form.sourceUrl)?.url !== source.url) return;
                if (!imported.title) imported.title = source.title;
                if (!imported.artist) imported.artist = source.artist;
                this.importedDraft = imported;
                if (!contentBefore.trim() && this.form.content === contentBefore) this.applyImportedSong();
                else this.linkNotice = 'Importación lista. Revisa el texto antes de reemplazar tu contenido actual.';
            } catch (error) {
                if (run !== this.importRun) return;
                const isCifraClub = /https?:\/\/(?:www\.)?cifraclub\.com(?:\.br)?(?:\/|$)/i.test(source.url);
                this.linkError = isCifraClub
                    ? 'Cifra Club bloqueó la importación automática. Abre la canción allí, copia la letra junto con sus acordes, pégala en Contenido y completa o corrige el título manualmente. Tu contenido actual se conservó.'
                    : error.name === 'AbortError'
                        ? 'La fuente tardó demasiado. Tu contenido se conservó; puedes volver a intentar o pegar su texto.'
                        : error instanceof TypeError
                            ? 'No se pudo acceder a la fuente. Puede haber un bloqueo de red o de lectura desde el navegador. Tu contenido se conservó; puedes pegar la letra y los acordes.'
                            : error.message || 'No se pudo leer el enlace. Pega la letra y los acordes de la fuente.';
            } finally {
                clearTimeout(timeout);
                if (run === this.importRun) this.linkBusy = false;
            }
        },

        applyImportedSong() {
            const imported = this.importedDraft;
            if (!imported) return;
            this.form.content = imported.content;
            if (imported.title) this.form.title = imported.title;
            if (imported.artist) this.form.artist = imported.artist;
            if (imported.key) this.form.key = imported.key;
            if (this.sourceInfo(imported.sourceUrl)) this.form.sourceUrl = this.sourceInfo(imported.sourceUrl).url;
            this.form.chords = imported.chords.join(', ');
            this.form.chordImages = SongEngine.resolveImages(this.form.chordImages, imported.content);
            const positions = SongEngine.chartRows(imported.content).reduce((count, row) => count + row.tokens.length, 0);
            this.linkNotice = `${positions} posiciones de acordes importadas (${imported.chords.length} acordes distintos). Revisa la canción completa antes de guardar. ${imported.warnings.join(' ')}`;
            this.importedDraft = null;
        },

        pasteChart(event) {
            const files = [...(event.clipboardData?.files || [])];
            if (files.some(file => file.type.startsWith('image/'))) {
                event.preventDefault();
                const file = files.find(file => file.type.startsWith('image/'));
                return this.attachChordPhoto(file);
            }
            const html = event.clipboardData?.getData('text/html');
            if (html && /<pre\b|data-chord|chord-chart|cifra_cnt/i.test(html)) {
                try {
                    const imported = SongEngine.importHTML(html, this.form.sourceUrl);
                    event.preventDefault();
                    this.importedDraft = imported;
                    this.linkNotice = 'Texto con formato leído. Pulsa Usar contenido importado para reemplazar el editor.';
                } catch { /* The browser can still paste the plain text representation. */ }
            }
        },

        get photoTargets() {
            return SongEngine.chartRows(this.form.content).flatMap(row => row.tokens.map(t => ({
                value: `${t.line}:${t.column}`, label: `Línea ${t.line + 1}, columna ${t.column + 1}: ${t.chord}`, ...t, sourceLine: row.source
            })));
        },

        get formPhotos() { return SongEngine.resolveImages(this.form.chordImages, this.form.content); },

        async attachChordPhoto(file) {
            if (this.photoBusy || this.ocrBusy || this.linkBusy) { this.photoError = 'Espera a que termine la lectura actual antes de añadir la foto.'; return; }
            this.photoError = '';
            const target = this.photoTargets.find(t => t.value === this.imageTarget);
            if (!target) { this.photoError = 'Selecciona primero la posición del acorde para esta foto.'; return; }
            if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(file.type) || file.size > 3_000_000) {
                this.photoError = 'Usa una imagen JPG, PNG, WebP o BMP de hasta 3 MB.'; return;
            }
            const run = this.importRun;
            this.photoBusy = true;
            try {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
                });
                if (run !== this.importRun) return;
                const image = { id: globalThis.crypto?.randomUUID?.() || `photo-${Date.now()}`, line: target.line, column: target.column, chord: target.chord, sourceLine: target.sourceLine, dataUrl };
                // One diagram per occurrence prevents photos from covering one another.
                this.form.chordImages = this.formPhotos.filter(p => !(p.line === image.line && p.column === image.column)).concat(image);
            } catch { this.photoError = 'No se pudo leer la foto. No se modificaron los acordes.'; }
            finally { if (run === this.importRun) this.photoBusy = false; }
        },

        relocatePhoto(image) {
            const target = this.photoTargets.find(t => t.value === this.imageTarget);
            if (!target) { this.photoError = 'Selecciona el acorde de destino.'; return; }
            this.form.chordImages = this.formPhotos.filter(p => p.id === image.id || !(p.line === target.line && p.column === target.column)).map(p => p.id === image.id ? { ...p, line: target.line, column: target.column, chord: target.chord, sourceLine: target.sourceLine } : p);
        },

        saveUserItems() {
            try {
                localStorage.setItem(
                    "musicians-library-items",
                    JSON.stringify(this.userItems)
                );
                return true;
            } catch (error) {
                alert("No se pudo guardar la canción. El navegador puede estar sin espacio; reduce el tamaño de las fotos. Tus datos anteriores se conservaron.");
                console.error("Could not save library:", error);
                return false;
            }
        },

        async readImage(event) {
            if (this.ocrBusy || this.photoBusy || this.linkBusy) return;
            const file = event.target.files?.[0];
            if (!file) return;
            this.ocrError = "";
            if (!["image/jpeg", "image/png", "image/bmp", "image/webp"].includes(file.type) || file.size > 3_000_000) {
                this.ocrError = "Usa una foto JPG, PNG, BMP o WebP de hasta 3 MB.";
                return;
            }

            this.ocrBusy = true;
            const run = this.importRun;
            const before = this.form.content;
            this.ocrProgress = 0;
            this.ocrStatus = "Preparing image reader…";
            try {
                const originalImageData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ""));
                    reader.onerror = () => reject(new Error("Image could not be attached."));
                    reader.readAsDataURL(file);
                });
                if (run !== this.importRun) return;
                this.form.originalImageData = originalImageData;

                if (!globalThis.Tesseract) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
                        script.onload = resolve;
                        script.onerror = () => reject(new Error("OCR library could not be loaded."));
                        document.head.appendChild(script);
                    });
                }

                const result = await Tesseract.recognize(file, this.ocrLanguage, {
                    logger: message => {
                        if (run !== this.importRun) return;
                        this.ocrStatus = message.status.replace(/\b\w/g, letter => letter.toUpperCase());
                        if (message.status === "recognizing text") {
                            this.ocrProgress = Math.round(message.progress * 100);
                        }
                    }
                });
                if (run !== this.importRun) return;
                const text = result.data.text.trim();
                if (!text) {
                    this.ocrError = "No text was found. Try a clearer, well-lit image.";
                } else {
                    this.importedDraft = SongEngine.importText(text);
                    this.importedDraft.warnings.push('La lectura de fotos puede confundir letras, acordes y espacios. Compárala con la imagen original.');
                    if (!before.trim() && this.form.content === before) this.applyImportedSong();
                    else this.linkNotice = 'Foto leída. Revisa la vista previa antes de reemplazar el texto actual.';
                }
            } catch (error) {
                if (run !== this.importRun) return;
                console.error("Image text recognition failed:", error);
                this.ocrError = "Could not read this image. Check your internet connection and try again, or paste the chart as text.";
            } finally {
                if (run === this.importRun) { this.ocrBusy = false; this.ocrStatus = ""; }
                event.target.value = "";
            }
        },

        chordParts(token) {
            return SongEngine.parseChord(token);
        },

        transposeChord(token, steps) {
            return SongEngine.transposeChord(token, steps, this.selectedItem?.key || '');
        },

        transposeText(content, steps, chords) {
            return SongEngine.transposeText(content, steps, this.selectedItem?.key || '');
        },

        extractChords(content) {
            return SongEngine.extractChords(content);
        },

        get displayedRows() {
            const item = this.selectedItem;
            if (!item) return [];
            return SongEngine.renderRows(item.content, this.transposeSteps, item.key, SongEngine.resolveImages(item.chordImages, item.content));
        },

        get unresolvedPhotos() {
            return SongEngine.resolveImages(this.selectedItem?.chordImages, this.selectedItem?.content).filter(p => p.line < 0);
        },

        get chartWidth() { return Math.max(1, ...this.displayedRows.map(row => row.width)); },

        get displayedContent() {
            return this.selectedItem
                ? this.transposeText(this.selectedItem.content, this.transposeSteps, this.selectedItem.chords)
                : "";
        },

        get displayedChords() {
            return this.selectedItem
                ? [...new Set([...(this.selectedItem.chords || []), ...this.extractChords(this.selectedItem.content)])].map(chord => this.transposeChord(chord, this.transposeSteps))
                : [];
        },

        get displayedKey() {
            return this.selectedItem?.key
                ? this.transposeChord(this.selectedItem.key, this.transposeSteps)
                : "";
        },


        // --------------------------------
        // JSON FETCH EXAMPLE
        // --------------------------------

        async loadFromJSON() {

            /*
             * Example for when music-data.json
             * becomes a separate file.
             */

            try {

                const response =
                    await fetch("music-data.json");


                if (!response.ok) {
                    throw new Error(
                        "Unable to load JSON"
                    );
                }


                const data =
                    await response.json();


                this.items = data;


                console.log(
                    "Loaded from JSON:",
                    data.length
                );


            } catch (error) {

                console.error(
                    "JSON loading error:",
                    error
                );

            }

        },


        // --------------------------------
        // GOOGLE SHEETS FETCH EXAMPLE
        // --------------------------------

        async loadFromGoogleSheet() {

            /*
             * DUMMY GOOGLE SHEETS FUNCTION
             *
             * A Google Sheet can be published as CSV.
             *
             * Example:
             *
             * https://docs.google.com/spreadsheets/d/
             * SHEET_ID/export?format=csv
             *
             * Replace SHEET_ID with your actual ID.
             */


            const sheetId = "YOUR_GOOGLE_SHEET_ID";


            const url =
                `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;


            try {

                const response =
                    await fetch(url);


                if (!response.ok) {
                    throw new Error(
                        "Unable to fetch Google Sheet"
                    );
                }


                const csv =
                    await response.text();


                console.log(
                    "Google Sheet CSV:",
                    csv
                );


                /*
                 * CSV needs to be converted into
                 * JavaScript objects here.
                 *
                 * For production you could use
                 * a CSV parser such as Papa Parse.
                 */


                const rows =
                    this.parseCSV(csv);


                this.items = rows.map(
                    (row, index) => ({

                        id: index + 1,

                        type: row.type || "song",

                        title: row.title || "",

                        artist: row.artist || "",

                        level: row.level || "Beginner",

                        key: row.key || "",

                        chords: row.chords
                            ? row.chords
                                .split(",")
                                .map(x => x.trim())
                            : [],

                        tags: row.tags
                            ? row.tags
                                .split(",")
                                .map(x => x.trim())
                            : [],

                        description:
                            row.description || "",

                        content:
                            row.content || ""

                    })
                );


            } catch (error) {

                console.error(
                    "Google Sheet error:",
                    error
                );

            }

        },


        // --------------------------------
        // SIMPLE CSV PARSER
        // --------------------------------

        parseCSV(csv) {

            const lines =
                csv.trim().split("\n");


            if (lines.length < 2) {
                return [];
            }


            const headers =
                lines[0]
                    .split(",")
                    .map(header =>
                        header.trim()
                    );


            return lines
                .slice(1)
                .map(line => {

                    const values =
                        line.split(",");


                    const row = {};


                    headers.forEach(
                        (header, index) => {

                            row[header] =
                                values[index]
                                    ? values[index].trim()
                                    : "";

                        }
                    );


                    return row;

                });

        }

    };

}


// Start Petite Vue
PetiteVue
    .createApp()
    .mount();
