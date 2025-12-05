class SimpleDatasetViewer {
    constructor() {
        this.currentPage = 0;
        this.isLoading = false;
        this.selectedUuid = null;
        this.lookupData = [];
        this.totalRecords = 0;
        this.visibleStartIndex = 0;
        this.visibleEndIndex = 0;
        this.itemsPerView = 15; // Approximate items visible at once
        this.isDragging = false;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const pathInput = document.getElementById('pathInput');
        const loadBtn = document.getElementById('loadBtn');
        const uuidList = document.getElementById('uuidList');
        const scrollThumb = document.getElementById('scrollThumb');
        const customScrollbar = document.getElementById('customScrollbar');

        // Load button
        loadBtn.addEventListener('click', () => this.loadLookupFile());

        // Enter key on path input
        pathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadLookupFile();
            }
        });

        // Mouse wheel scrolling on UUID list
        uuidList.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = Math.sign(e.deltaY) * 3; // Scroll 3 items at a time
            this.scrollToIndex(this.visibleStartIndex + delta);
        });

        // Custom scrollbar dragging
        scrollThumb.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragStartY = e.clientY;
            this.dragStartTop = parseInt(scrollThumb.style.top) || 0;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();

            const scrollbarHeight = customScrollbar.clientHeight;
            const thumbHeight = scrollThumb.clientHeight;
            const maxTop = scrollbarHeight - thumbHeight;

            const deltaY = e.clientY - this.dragStartY;
            let newTop = this.dragStartTop + deltaY;
            newTop = Math.max(0, Math.min(maxTop, newTop));

            const percentage = newTop / maxTop;
            const targetIndex = Math.floor(percentage * (this.totalRecords - this.itemsPerView));

            this.scrollToIndex(targetIndex);
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Click on scrollbar track
        customScrollbar.addEventListener('click', (e) => {
            if (e.target === scrollThumb) return;

            const rect = customScrollbar.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const percentage = clickY / rect.height;
            const targetIndex = Math.floor(percentage * (this.totalRecords - this.itemsPerView));

            this.scrollToIndex(targetIndex);
        });
    }

    async loadLookupFile() {
        const pathInput = document.getElementById('pathInput');
        const filePath = pathInput.value.trim();

        if (!filePath) {
            this.showStatus('Please enter a file path', 'error');
            return;
        }

        this.showStatus('Loading lookup file...', 'loading');

        try {
            const response = await fetch('/load_lookup_path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filePath })
            });

            const result = await response.json();

            if (result.success) {
                this.totalRecords = result.summary.total_records;
                this.showStatus(`Loaded ${result.summary.total_records.toLocaleString()} records successfully!`, 'success');
                this.displayStats(result.summary);

                // Hide the input section and show the main container
                document.querySelector('.input-section').classList.add('hidden');
                document.getElementById('mainContainer').classList.remove('hidden');

                this.initializeVirtualScroll();
                this.scrollToIndex(0);
            } else {
                this.showStatus(`Error: ${result.error}`, 'error');
            }

        } catch (error) {
            this.showStatus(`Failed to load: ${error.message}`, 'error');
        }
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('status');
        statusDiv.className = `status ${type}`;
        statusDiv.textContent = message;
    }

    displayStats(summary) {
        const statsDiv = document.getElementById('stats');
        statsDiv.innerHTML = `
            <div style="font-size: 0.9em; margin-top: 0.5rem;">
                ${summary.total_records.toLocaleString()} records<br>
                ${summary.unique_filepaths} unique files
            </div>
        `;
    }

    async loadMoreUuids() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const response = await fetch(`/get_uuid_page/${this.currentPage}`);
            const records = await response.json();

            if (records.length > 0) {
                records.forEach(record => {
                    this.lookupData.push(record);
                    this.createUuidItem(record);
                });
                this.currentPage++;
            }

        } catch (error) {
            console.error('Error loading UUIDs:', error);
        } finally {
            this.isLoading = false;
        }
    }

    createUuidItem(record) {
        const uuidList = document.getElementById('uuidList');
        const item = document.createElement('div');
        item.className = 'uuid-item';
        item.textContent = record.uuid;
        item.dataset.uuid = record.uuid;
        item.dataset.filepath = record.filepath;

        item.addEventListener('click', () => this.selectUuid(record));
        uuidList.appendChild(item);
    }

    async selectUuid(record) {
        // Update selection UI
        document.querySelectorAll('.uuid-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.uuid === record.uuid);
        });

        this.selectedUuid = record.uuid;

        // Show loading state
        const imageViewer = document.getElementById('imageViewer');
        const metadataContent = document.getElementById('metadataContent');

        imageViewer.innerHTML = '<div class="loading">Loading image...</div>';
        metadataContent.innerHTML = '<div class="loading">Loading metadata...</div>';

        // Load image and metadata in parallel
        const [imageResult, metadataResult] = await Promise.all([
            this.loadImage(record),
            this.loadMetadata(record)
        ]);

        // Display image
        if (imageResult.success) {
            this.displayImage(record, imageResult.data);
        } else {
            imageViewer.innerHTML = `<div class="error">Error loading image: ${imageResult.error}</div>`;
        }

        // Display metadata
        if (metadataResult.success) {
            this.displayMetadata(metadataResult.data);
        } else {
            metadataContent.innerHTML = `<div class="error">Error loading metadata: ${metadataResult.error}</div>`;
        }
    }

    async loadImage(record) {
        try {
            const response = await fetch('/get_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uuid: record.uuid,
                    filepath: record.filepath
                })
            });

            const result = await response.json();

            if (result.image_b64) {
                return { success: true, data: result };
            } else {
                return { success: false, error: result.error };
            }

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async loadMetadata(record) {
        try {
            const response = await fetch('/get_metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uuid: record.uuid,
                    filepath: record.filepath
                })
            });

            const result = await response.json();

            if (result.error) {
                return { success: false, error: result.error };
            } else {
                return { success: true, data: result };
            }

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    displayImage(record, imageData) {
        const imageViewer = document.getElementById('imageViewer');

        imageViewer.innerHTML = `
            <img src="data:image/webp;base64,${imageData.image_b64}" alt="${record.uuid}">
            <div class="image-info">
                <strong>UUID:</strong> ${record.uuid}<br>
                <strong>Fetch Time:</strong> ${imageData.fetch_time_ms.toFixed(2)} ms<br>
                <strong>Source File:</strong> ${record.filepath}_images.h5
            </div>
        `;
    }

    displayMetadata(metadata) {
        const metadataContent = document.getElementById('metadataContent');

        let tableHTML = '<table class="metadata-table"><tbody>';

        Object.entries(metadata).forEach(([key, value]) => {
            let displayValue = value;
            if (typeof value === 'object' && value !== null) {
                displayValue = JSON.stringify(value, null, 2);
            } else if (typeof value === 'string' && value.length > 100) {
                displayValue = value.substring(0, 100) + '...';
            }

            tableHTML += `
                <tr>
                    <th>${key}</th>
                    <td>${displayValue}</td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        metadataContent.innerHTML = tableHTML;
    }

    initializeVirtualScroll() {
        const scrollThumb = document.getElementById('scrollThumb');
        const customScrollbar = document.getElementById('customScrollbar');

        // Calculate thumb size based on visible vs total ratio
        const visibleRatio = this.itemsPerView / this.totalRecords;
        const thumbHeight = Math.max(20, customScrollbar.clientHeight * visibleRatio);
        scrollThumb.style.height = `${thumbHeight}px`;

        this.updateScrollThumb();
    }

    updateScrollThumb() {
        const scrollThumb = document.getElementById('scrollThumb');
        const customScrollbar = document.getElementById('customScrollbar');

        const scrollableRange = this.totalRecords - this.itemsPerView;
        if (scrollableRange <= 0) {
            scrollThumb.style.top = '0px';
            return;
        }

        const percentage = this.visibleStartIndex / scrollableRange;
        const thumbHeight = scrollThumb.clientHeight;
        const maxTop = customScrollbar.clientHeight - thumbHeight;
        const top = percentage * maxTop;

        scrollThumb.style.top = `${top}px`;
    }

    async scrollToIndex(targetIndex) {
        // Clamp to valid range
        const maxStart = Math.max(0, this.totalRecords - this.itemsPerView);
        targetIndex = Math.max(0, Math.min(maxStart, targetIndex));

        this.visibleStartIndex = targetIndex;
        this.visibleEndIndex = Math.min(targetIndex + this.itemsPerView - 1, this.totalRecords - 1);

        // Show what we have immediately, then load missing data
        this.renderVisibleItems();
        this.updateScrollThumb();

        // Load any missing data in background
        await this.ensureDataLoaded(this.visibleStartIndex, this.visibleEndIndex);

        // Re-render once data is loaded
        this.renderVisibleItems();
    }

    async ensureDataLoaded(startIndex, endIndex) {
        const startPage = Math.floor(startIndex / 100);
        const endPage = Math.floor(endIndex / 100);

        for (let page = startPage; page <= endPage; page++) {
            const pageStartIndex = page * 100;
            if (!this.lookupData[pageStartIndex] && !this.isLoading) {
                await this.loadPage(page);
            }
        }
    }

    async loadPage(page) {
        this.isLoading = true;
        try {
            const response = await fetch(`/get_uuid_page/${page}`);
            const records = await response.json();

            const startIndex = page * 100;
            records.forEach((record, i) => {
                this.lookupData[startIndex + i] = record;
            });

        } catch (error) {
            console.error('Error loading page:', error);
        } finally {
            this.isLoading = false;
        }
    }

    renderVisibleItems() {
        const uuidList = document.getElementById('uuidList');
        uuidList.innerHTML = '';

        let hasData = false;
        for (let i = this.visibleStartIndex; i <= this.visibleEndIndex; i++) {
            if (this.lookupData[i]) {
                this.createUuidItem(this.lookupData[i]);
                hasData = true;
            }
        }

        // Show loading placeholder if no data is available yet
        if (!hasData) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'uuid-item';
            loadingDiv.style.textAlign = 'center';
            loadingDiv.style.fontStyle = 'italic';
            loadingDiv.style.color = '#666';
            loadingDiv.textContent = 'Loading...';
            uuidList.appendChild(loadingDiv);
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new SimpleDatasetViewer();
});