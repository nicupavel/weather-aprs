// MET Norway is loaded only for the open station. Observations remain independent.
const Forecast = {
    data: null,
    request: null,
    error: false,

    cancel() {
        this.request?.abort();
        this.request = null;
        this.data = null;
        this.error = false;
    },

    async load([lon, lat]) {
        this.request?.abort();
        const request = new AbortController();
        this.request = request;
        this.render();
        try {
            const response = await fetch(`${apiHost}/api/v0/forecast?${new URLSearchParams({ lat, lon })}`, { signal: request.signal });
            if (!response.ok) throw new Error('Forecast unavailable');
            const data = await response.json();
            if (request.signal.aborted) return;
            this.data = data;
        } catch (error) {
            if (request.signal.aborted) return;
            this.error = true;
        }
        this.render();
    },

    render() {
        const row = document.getElementById('station-forecast');
        const sky = document.getElementById('station-sky');
        if (!row || !sky) return;
        sky.replaceChildren();
        if (!this.data) {
            row.className = 'forecast-status';
            row.textContent = this.error ? 'Forecast unavailable. Reopen the station to retry.' : 'Loading forecast…';
            return;
        }
        const now = Date.now();
        const points = this.data.points.map(point => ({ ...point, timestamp: Date.parse(point.time) }));
        const current = points.slice().reverse().find(point => point.timestamp <= now && point.periods.some(period => point.timestamp + period.hours * 3600000 > now));
        const period = current?.periods.find(period => current.timestamp + period.hours * 3600000 > now);
        if (period) sky.innerHTML = skyIcon(period.symbol, 'Sky forecast · MET Norway');

        const days = [];
        for (let offset = 1; offset <= 5; offset++) {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() + offset);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            const samples = points.filter(point => point.timestamp >= +start && point.timestamp < +end);
            const temperatures = samples.map(point => point.temp).filter(Number.isFinite);
            const probabilities = [];
            samples.forEach(point => point.periods.forEach(period => {
                // Six-hour extremes supplement the coarser samples later in the forecast.
                if (point.timestamp + period.hours * 3600000 > +end) return;
                if (Number.isFinite(period.min)) temperatures.push(period.min);
                if (Number.isFinite(period.max)) temperatures.push(period.max);
                if (Number.isFinite(period.probability)) probabilities.push(period.probability);
            }));
            const noon = new Date(start);
            noon.setHours(12);
            const midday = samples.reduce((closest, point) => !closest || Math.abs(point.timestamp - noon) < Math.abs(closest.timestamp - noon) ? point : closest, null);
            const symbol = (midday?.periods.find(period => period.hours === 6) || midday?.periods[0])?.symbol;
            const temperature = value => `${Math.round(Convert.as(value, 'temp'))}°`;
            const min = temperatures.length ? temperature(Math.min(...temperatures)) : '—';
            const max = temperatures.length ? temperature(Math.max(...temperatures)) : '—';
            const chance = probabilities.length ? `${Math.round(Math.max(...probabilities))}%` : '—';
            const chanceLabel = probabilities.length ? 'Highest precipitation chance in a forecast interval' : 'Precipitation probability is not available for this day';
            const date = start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
            days.push(`<div class="forecast-day" title="${date}">
                <span class="forecast-weekday">${start.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                ${symbol ? skyIcon(symbol, 'Afternoon forecast') : '<span class="forecast-no-icon">—</span>'}
                <div class="forecast-temperatures" aria-label="High ${max}, low ${min}"><strong>${max}</strong><span>${min}</span></div>
                <div class="forecast-rain" title="${chanceLabel}" aria-label="${chanceLabel}: ${chance}">${metricIcon('rain')}<span>${chance}</span></div>
            </div>`);
        }
        row.className = 'station-forecast';
        row.innerHTML = `<div class="forecast-days">${days.join('')}</div>
            <p class="forecast-credit" title="Next five days in your local time. Highs and lows from forecast samples. Updated ${new Date(this.data.updated).toLocaleString()}.">Forecast · <a href="https://www.met.no/en" target="_blank" rel="noopener">MET Norway</a></p>`;
    },
};

function skyIcon(symbol, context) {
    if (!/^[a-z]+(?:_(?:day|night|polartwilight))?$/.test(symbol)) return '';
    const condition = skyConditions[symbol.split('_')[0]] || 'Weather';
    return `<img class="sky-icon" src="icons/weather/${symbol}.svg" alt="${condition}" title="${condition} · ${context}" width="40" height="40">`;
}

function metricIcon(name) {
    const paths = {
        wind: '<path d="M3 8h11a3 3 0 1 0-3-3M2 12h17a3 3 0 1 0-3-3M4 16h9a3 3 0 1 1-3 3"/>',
        gust: '<path d="M3 8h14M3 12h18M3 16h10m1-11 3 3-3 3m4-2 3 3-3 3"/>',
        rain: '<path d="M12 3S6 10 6 14a6 6 0 0 0 12 0c0-4-6-11-6-11Z"/>',
        humidity: '<path d="M12 3S5 10 5 14a7 7 0 0 0 14 0c0-4-7-11-7-11Z"/><path d="m9 16 6-5"/><circle cx="9" cy="11" r=".6"/><circle cx="15" cy="16" r=".6"/>',
        pressure: '<circle cx="12" cy="12" r="9"/><path d="m12 12 4-5M5 12h1m12 0h1M8 5l1 2m-1 12h8"/><circle cx="12" cy="12" r="1"/>',
    };
    return `<svg class="metric-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

const skyConditions = {
    "clearsky": "Clear sky",
    "fair": "Fair",
    "partlycloudy": "Partly cloudy",
    "cloudy": "Cloudy",
    "lightrainshowers": "Light rain showers",
    "rainshowers": "Rain showers",
    "heavyrainshowers": "Heavy rain showers",
    "lightrainshowersandthunder": "Light rain showers and thunder",
    "rainshowersandthunder": "Rain showers and thunder",
    "heavyrainshowersandthunder": "Heavy rain showers and thunder",
    "lightsleetshowers": "Light sleet showers",
    "sleetshowers": "Sleet showers",
    "heavysleetshowers": "Heavy sleet showers",
    "lightssleetshowersandthunder": "Light sleet showers and thunder",
    "sleetshowersandthunder": "Sleet showers and thunder",
    "heavysleetshowersandthunder": "Heavy sleet showers and thunder",
    "lightsnowshowers": "Light snow showers",
    "snowshowers": "Snow showers",
    "heavysnowshowers": "Heavy snow showers",
    "lightssnowshowersandthunder": "Light snow showers and thunder",
    "snowshowersandthunder": "Snow showers and thunder",
    "heavysnowshowersandthunder": "Heavy snow showers and thunder",
    "lightrain": "Light rain",
    "rain": "Rain",
    "heavyrain": "Heavy rain",
    "lightrainandthunder": "Light rain and thunder",
    "rainandthunder": "Rain and thunder",
    "heavyrainandthunder": "Heavy rain and thunder",
    "lightsleet": "Light sleet",
    "sleet": "Sleet",
    "heavysleet": "Heavy sleet",
    "lightsleetandthunder": "Light sleet and thunder",
    "sleetandthunder": "Sleet and thunder",
    "heavysleetandthunder": "Heavy sleet and thunder",
    "lightsnow": "Light snow",
    "snow": "Snow",
    "heavysnow": "Heavy snow",
    "lightsnowandthunder": "Light snow and thunder",
    "snowandthunder": "Snow and thunder",
    "heavysnowandthunder": "Heavy snow and thunder",
    "fog": "Fog"
};
