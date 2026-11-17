const https = require('https');
const zlib = require('zlib');

// Forecasts are fetched on demand, shared by nearby stations, and never stored in MongoDB.
const cache = new Map();
const threeHours = 3 * 60 * 60 * 1000;

async function getForecast(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const previous = cache.get(key);
    if (previous && previous.expires > Date.now()) return previous.data;
    if (previous && previous.pending) return previous.pending;

    // Keep memory bounded on small servers. No background refresh is needed.
    if (cache.size >= 500 && !previous) cache.delete(cache.keys().next().value);
    const entry = { ...previous };
    cache.set(key, entry);
    entry.pending = requestForecast(key, entry.modified).then(result => {
        if (result.data) entry.data = result.data;
        if (result.modified) entry.modified = result.modified;
        entry.expires = Math.max(Date.now() + threeHours, Date.parse(result.expires) || 0);
        return entry.data;
    }).catch(error => {
        // Briefly cache failures too, so repeated clicks don't hammer an unavailable service.
        entry.expires = Date.now() + 60 * 1000;
        throw error;
    }).finally(() => { entry.pending = null; });
    return entry.pending;
}

function requestForecast(coordinates, modified) {
    const [lat, lon] = coordinates.split(',');
    const headers = {
        'User-Agent': 'meteoglance.com github.com/nicupavel/weather-aprs',
        'Accept-Encoding': 'gzip',
    };
    if (modified) headers['If-Modified-Since'] = modified;
    return new Promise((resolve, reject) => {
        const request = https.get(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`, { headers }, response => {
            const metadata = { expires: response.headers.expires, modified: response.headers['last-modified'] };
            if (response.statusCode === 304) {
                response.resume();
                return resolve(metadata);
            }
            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error(`MET Norway returned ${response.statusCode}`));
            }
            const body = response.headers['content-encoding'] === 'gzip' ? response.pipe(zlib.createGunzip()) : response;
            let json = '';
            body.setEncoding('utf8');
            body.on('data', chunk => { json += chunk; });
            body.on('error', reject);
            response.on('error', reject);
            body.on('end', () => {
                try {
                    const forecast = JSON.parse(json).properties;
                    // Send only the fields used by the popup, rather than the complete model output.
                    const points = forecast.timeseries.map(({ time, data }) => ({
                        time,
                        temp: data.instant.details.air_temperature,
                        periods: [1, 6, 12].filter(hours => data[`next_${hours}_hours`]).map(hours => {
                            const period = data[`next_${hours}_hours`];
                            return {
                                hours,
                                symbol: period.summary.symbol_code,
                                min: period.details.air_temperature_min,
                                max: period.details.air_temperature_max,
                                probability: period.details.probability_of_precipitation,
                            };
                        }),
                    }));
                    resolve({ ...metadata, data: { updated: forecast.meta.updated_at, points } });
                } catch (error) { reject(error); }
            });
        });
        request.setTimeout(12000, () => request.destroy(new Error('MET Norway request timed out')));
        request.on('error', reject);
    });
}

module.exports = { getForecast };
