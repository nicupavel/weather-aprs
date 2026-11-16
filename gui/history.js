// Load recent history first, then extend the charts with older JSON pages.
const History = {
    data: null,
    request: null,
    station: null,
    period: 'day',
    loading: false,
    error: null,
    metrics: [
        { key: 'temp', title: 'Temperature', color: '#cc7045' },
        { key: 'wind_speed', title: 'Wind speed', color: '#278d87' },
        { key: 'wind_gust', title: 'Wind gusts', color: '#527e9c', peak: true },
        { key: 'rain_24h', title: 'Rain · rolling 24 hours', color: '#397bbf', peak: true },
        { key: 'humidity', title: 'Humidity', color: '#8a64ad', unit: '%' },
        { key: 'pressure', title: 'Pressure', color: '#667a8c', unit: 'hPa' },
    ],

    show() {
        this.station = selectedStation;
        document.getElementById('history-title').textContent = this.station;
        document.getElementById('history-dialog').showModal();
        this.load('day');
    },

    close() {
        document.getElementById('history-dialog').close();
    },

    cancel() {
        this.request?.abort();
        this.data = null;
        this.loading = false;
    },

    async load(period) {
        this.request?.abort();
        const request = new AbortController();
        this.request = request;
        this.period = period;
        this.data = null;
        this.loading = true;
        this.error = null;
        document.querySelectorAll('[data-period]').forEach(button => {
            button.setAttribute('aria-pressed', button.dataset.period === period);
        });
        const description = document.getElementById('history-description');
        const charts = document.getElementById('history-charts');
        description.textContent = 'Loading observations…';
        charts.replaceChildren();
        charts.setAttribute('aria-busy', 'true');
        try {
            let next = null;
            do {
                const query = new URLSearchParams({ period });
                if (next !== null) {
                    query.set('to', this.data.to);
                    query.set('before', next);
                }
                const response = await fetch(`${apiHost}/api/v0/station/${encodeURIComponent(this.station)}/history?${query}`, { signal: request.signal });
                if (!response.ok) throw new Error('Could not load history.');
                const page = await response.json();
                if (request.signal.aborted) return;
                this.data = { ...page, points: [...page.points, ...(this.data?.points || [])] };
                next = page.next ?? null;
                this.render();
            } while (next !== null && !request.signal.aborted);
        } catch (error) {
            if (!request.signal.aborted) {
                this.error = this.data?.points.length
                    ? 'Older observations could not be loaded. Showing partial history. Select a period to retry.'
                    : 'Could not load history. Select a period to try again.';
            }
        } finally {
            if (this.request === request) {
                this.loading = false;
                charts.setAttribute('aria-busy', 'false');
                this.render();
            }
        }
    },

    render() {
        const description = document.getElementById('history-description');
        if (!this.data) {
            if (this.error) description.textContent = this.error;
            return;
        }
        const { points, interval, to, chunkFrom, availableFrom } = this.data;
        const charts = document.getElementById('history-charts');
        const dialog = document.getElementById('history-dialog');
        const scrollTop = dialog.scrollTop;
        charts.replaceChildren();
        const day = 24 * 60 * 60 * 1000;
        const total = Math.max(1, Math.ceil((to - availableFrom) / day));
        const loaded = Math.min(total, Math.ceil((to - chunkFrom) / day));
        const progress = this.loading ? `Loading history: ${loaded} of ${total} days…` : '';
        if (!points.length) {
            description.textContent = this.error || progress || 'No observations for this station in this period. Try a longer range.';
            return;
        }
        const date = timestamp => new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const count = points.reduce((sum, point) => sum + point.count, 0);
        description.textContent = `${date(points[0].timestamp)} – ${date(points.at(-1).timestamp)} · ${count.toLocaleString()} observations · ${interval.toLowerCase()} averages / peaks`;
        if (progress || this.error) description.textContent += ` · ${this.error || progress}`;
        for (const metric of this.metrics) charts.append(this.chart(metric));
        dialog.scrollTop = scrollTop;
    },

    linePath(points, smooth) {
        let path = `M${points[0][0]},${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
            const [x, y] = points[i];
            const [previousX, previousY] = points[i - 1];
            // Midpoint controls smooth the line without overshooting either reading.
            const middle = (previousX + x) / 2;
            path += smooth ? ` C${middle},${previousY} ${middle},${y} ${x},${y}` : ` L${x},${y}`;
        }
        return path;
    },

    chart(metric) {
        const { points, bucket } = this.data;
        const values = points.map(point => point[metric.key] === null ? null : Number(Convert.as(point[metric.key], metric.key)));
        const available = values.filter(value => value !== null && Number.isFinite(value));
        const unit = metric.unit || Convert.units(metric.key);
        const card = document.createElement('section');
        card.className = 'history-chart';
        card.style.setProperty('--chart-color', metric.color);
        card.innerHTML = `<div class="chart-heading"><h3>${metric.title}</h3><span>${unit} · ${metric.peak ? 'peak' : 'average'}</span></div>`;
        if (!available.length) {
            const empty = document.createElement('p');
            empty.className = 'chart-empty';
            empty.textContent = 'No readings for this measurement.';
            card.append(empty);
            return card;
        }

        // Phone charts use screen-sized coordinates so labels stay readable.
        const mobile = window.matchMedia('(max-width: 900px)').matches;
        const width = mobile ? document.getElementById('history-charts').clientWidth - 50 : 600;
        const height = mobile ? 250 : 210;
        const left = mobile ? 46 : 56, right = width - 16, top = 16, bottom = height - 34;
        const start = points[0].timestamp;
        const end = points.at(-1).timestamp;
        const minimum = Math.min(...available), maximum = Math.max(...available);
        const padding = Math.max((maximum - minimum) * 0.15, metric.key === 'rain_24h' ? 0.1 : 1);
        const lower = metric.key === 'temp' || metric.key === 'pressure' ? minimum - padding : Math.max(0, minimum - padding);
        const upper = maximum + padding;
        const smallestStep = metric.key === 'rain_24h' ? (unitsMetric ? 0.1 : 0.01) : 1;
        const roughStep = Math.max((upper - lower) / 3, smallestStep);
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const step = [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= roughStep);
        const low = Math.floor(lower / step) * step;
        const high = Math.ceil(upper / step) * step;
        const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + i * step);
        const x = index => start === end ? (left + right) / 2 : left + (points[index].timestamp - start) / (end - start) * (right - left);
        const y = value => bottom - (value - low) / (high - low) * (bottom - top);
        const format = value => formatMeasurement(value, metric.key);
        const label = timestamp => new Date(timestamp).toLocaleString([], this.period === 'day' ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' });

        // Break the line at missing readings or missing time buckets.
        const segments = [];
        let segment = [];
        values.forEach((value, index) => {
            if (index && points[index].timestamp - points[index - 1].timestamp > bucket * 1.5) {
                if (segment.length) segments.push(segment);
                segment = [];
            }
            if (value === null || !Number.isFinite(value)) {
                if (segment.length) segments.push(segment);
                segment = [];
            } else segment.push([x(index), y(value)]);
        });
        if (segment.length) segments.push(segment);
        const path = segment => this.linePath(segment, this.period === 'day');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('tabindex', '0');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `${metric.title}, ${unit}. Range ${format(minimum)} to ${format(maximum)}. Use left and right arrow keys to inspect readings.`);
        svg.innerHTML = ticks.map(value => {
            return `<line class="chart-grid" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis" x="${left - 8}" y="${y(value) + 4}" text-anchor="end">${format(value)}</text>`;
        }).join('') + segments.map(segment => segment.length === 1
            ? `<circle cx="${segment[0][0]}" cy="${segment[0][1]}" r="3" fill="currentColor"/>`
            : `<path d="${path(segment)} L${segment.at(-1)[0]},${bottom} L${segment[0][0]},${bottom} Z" fill="currentColor" opacity=".08"/><path d="${path(segment)}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>`).join('') +
            `<text class="chart-axis" x="${left}" y="${height - 8}">${label(start)}</text><text class="chart-axis" x="${right}" y="${height - 8}" text-anchor="end">${label(end)}</text><circle class="chart-cursor" r="4" fill="currentColor" stroke="white" stroke-width="2" visibility="hidden"/>`;
        const readout = document.createElement('p');
        readout.className = 'chart-readout';
        readout.textContent = `${metric.peak ? 'Peak' : 'Average'} range: ${format(minimum)}–${format(maximum)} ${unit}`;
        let selected = 0;
        const inspect = index => {
            selected = index;
            const value = values[index];
            const cursor = svg.querySelector('.chart-cursor');
            cursor.setAttribute('visibility', value === null ? 'hidden' : 'visible');
            cursor.setAttribute('cx', x(index));
            cursor.setAttribute('cy', value === null ? bottom : y(value));
            readout.textContent = `${new Date(points[index].timestamp).toLocaleString()} · ${value === null ? 'No reading' : `${format(value)} ${unit}`}`;
        };
        svg.addEventListener('pointermove', event => {
            const rect = svg.getBoundingClientRect();
            const position = (event.clientX - rect.left) / rect.width * width;
            let nearest = 0;
            for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - position) < Math.abs(x(nearest) - position)) nearest = i;
            inspect(nearest);
        });
        svg.addEventListener('keydown', event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            inspect(Math.max(0, Math.min(points.length - 1, selected + (event.key === 'ArrowRight' ? 1 : -1))));
        });
        svg.addEventListener('focus', () => inspect(selected));
        card.append(svg, readout);
        return card;
    },
};

// Rebuild only when the available width changes, including phone rotation.
let historyWidth = 0;
new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    if (width === historyWidth) return;
    historyWidth = width;
    if (width > 0) History.render();
}).observe(document.getElementById('history-charts'));
