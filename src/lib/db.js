const { MongoClient } = require("mongodb");
const Config = require("../config");

module.exports = (function() {
    "use strict";

    let client;
    let stationData;
    let stations;

    //----------------------------------------------------------------------------------------------------
    //
    //

    async function connect() {
        const uri = `mongodb://${Config.MONGO_DB_USER}:${Config.MONGO_DB_PASS}@${Config.MONGO_DB_HOST}:${Config.MONGO_DB_PORT}?writeConcern=majority`;
        client = new MongoClient(uri, { useUnifiedTopology: true });
        try {
            await client.connect();
            const database = client.db(Config.MONGO_DB_NAME);
            stationData = database.collection(Config.MONGO_DB_COL_DATA);
            stations = database.collection(Config.MONGO_DB_COL_STATIONS);

            let result = await stations.createIndex({ "location": "2dsphere" });
            result = await stations.createIndex({ stationName: "text" });
            result = await stationData.createIndex({ stationName: "text" });
            result = await stationData.createIndex({ stationName: 1, day: -1 });
            result = await stationData.createIndex({ day: 1 }, { expireAfterSeconds: 31622400 }); // Expire after 1 year

        } finally {
            console.log(`Connected to ${Config.MONGO_DB_NAME} DB`);
        }
    }

    //----------------------------------------------------------------------------------------------------
    //
    //

    async function getStationByName(stationName) {
        console.log(`Looking up ${stationName}`)
        let result = await stationData.findOne({ stationName: stationName }, { sort: { day: -1 } });
        if (result) {
            let weather = result.samples[result.samples.length - 1];
            return {
                stationName: result.stationName,
                comment: result.comment,
                location: result.location,
                receivedTime: result.receivedTime,
                weather: weather
            }
        }
        return {};
    }

    async function getStationHistory(stationName, period) {
        const hour = 60 * 60 * 1000;
        const periods = {
            day: { duration: 24 * hour, bucket: hour / 4, interval: "15-minute" },
            week: { duration: 7 * 24 * hour, bucket: hour, interval: "Hourly" },
            month: { duration: 30 * 24 * hour, bucket: 6 * hour, interval: "6-hour" },
            year: { duration: 365 * 24 * hour, bucket: 24 * hour, interval: "Daily" },
        };
        if (!Object.keys(periods).includes(period)) return { statusCode: 400, error: "Choose day, week, month or year." };
        const range = periods[period];

        const to = Date.now();
        const from = to - range.duration;
        const firstDay = new Date(new Date(from).setUTCHours(0, 0, 0, 0));
        const fields = ["temp", "wind_speed", "wind_gust", "rain_24h", "humidity", "pressure"];
        const values = {};
        for (const key of fields) {
            values[key] = { $convert: { input: `$samples.wx.${key}`, to: "double", onError: null, onNull: null } };
        }

        const points = await stationData.aggregate([
            { $match: { stationName, day: { $gte: firstDay, $lte: new Date(to) } } },
            { $project: { samples: 1 } },
            { $unwind: "$samples" },
            { $match: { "samples.timestamp": { $gte: from, $lte: to } } },
            { $project: { timestamp: "$samples.timestamp", ...values } },
            { $group: {
                _id: { $multiply: [{ $floor: { $divide: ["$timestamp", range.bucket] } }, range.bucket] },
                count: { $sum: 1 },
                temp: { $avg: "$temp" },
                wind_speed: { $avg: "$wind_speed" },
                wind_gust: { $max: "$wind_gust" },
                rain_24h: { $max: "$rain_24h" },
                humidity: { $avg: "$humidity" },
                pressure: { $avg: "$pressure" },
            } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, timestamp: "$_id", count: 1, temp: 1, wind_speed: 1, wind_gust: 1, rain_24h: 1, humidity: 1, pressure: 1 } },
        ]).toArray();

        return { stationName, period, from, to, bucket: range.bucket, interval: range.interval, points };
    }

    async function getAllStations() {
        console.log(`Getting all stations`);
        let result = await stations.find({});
        if (result) {
            let res = {};
            for await (const station of result) {
                res[station.stationName] = {
                    location: station.location,
                }
            }
            return res;
        }

        return {};
    }

    // Sends all station along with a loose data format
    async function getAllStationsAndTodayData() {
        const today = new Date(new Date().setUTCHours(0, 0, 0, 0));
        console.log(`Getting all stations and today data`);
        let result = await stationData.find({ day: today });

        if (result) {
            let res = {};
            for await (const station of result) {
                let weather = station.samples[station.samples.length - 1];
                res[station.stationName] = {
                    location: station.location,
                    weather: weather,
                }
            }
            return res;
        }
        return {};
    }


    // Sends all station along with a tight data format
    async function getAllStationsAndTodayTightData(weatherKeys) {
        const today = new Date(new Date().setUTCHours(0, 0, 0, 0));

        let keys;
        if (weatherKeys) {
            keys = weatherKeys.split(',')
        }

        console.log(`Getting all stations and today tight data with ${keys}`);
        const projection = { samples: { $slice: -1 } };
        const result = await stationData.find({ day: today }).project(projection);
        if (result) {
            let res = {};
            for await (const station of result) {
                const weather = station.samples[0];
                res[station.stationName] = [
                    ...station.location.coordinates.map(o => { return o ? parseFloat(o.toFixed(4)) : o }),
                ]

                __conditionalAddWeatherProp("wind_gust", res[station.stationName], keys, weather.wx);
                __conditionalAddWeatherProp("wind_direction", res[station.stationName], keys, weather.wx);
                __conditionalAddWeatherProp("wind_speed", res[station.stationName], keys, weather.wx);
                __conditionalAddWeatherProp("temp", res[station.stationName], keys, weather.wx);
                __conditionalAddWeatherProp("rain_1h", res[station.stationName], keys, weather.wx);
                __conditionalAddWeatherProp("rain_24h", res[station.stationName], keys, weather.wx);
                __conditionalAddWeatherProp("rain_midnight", res[station.stationName], keys, weather.wx);
                __conditionalAddWeatherProp("humidity", res[station.stationName], keys, weather.wx);
                __conditionalAddWeatherProp("pressure", res[station.stationName], keys, weather.wx);
            }
            return res;
        }
        return {};
    }

    function __conditionalAddWeatherProp(name, dest, keysList, keysValues, asFloat = true) {
        if (!keysList || (keysList.indexOf(name) !== -1)) {
            let val = keysValues[name];
            if (asFloat) {
                val = parseFloat(val);
                if (isNaN(val)) val = null;
            }
            dest.push(val);
        }
    }


    async function getNearbyStationsUnsorted(lat, lon, dist) {
        console.log(`Looking up nearby ${lat} latitude ${lon} longitude ${dist} distance`);
        let result = await stations.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [lon, lat]
                    },
                    $maxDistance: dist
                }
            }
        })
        if (result) {
            let res = {}
            for await (const station of result) {
                res[station.stationName] = {
                    comment: station.comment,
                    location: station.location,
                    receivedTime: station.receivedTime
                }
            }
            return res;
        }

        return {};
    }

    async function getNearbyStations(lat, lon, dist) {
        console.log(`Looking up nearby ${lat} latitude ${lon} longitude ${dist} distance`);
        let result = await stations.aggregate([{
            $geoNear: {
                near: {
                    type: "Point",
                    coordinates: [lon, lat]
                },
                distanceField: "distance",
                maxDistance: dist,
                spherical: true
            }
        }])

        if (result) {
            let res = {}
            for await (const station of result) {
                res[station.stationName] = {
                    comment: station.comment,
                    location: station.location,
                    receivedTime: station.receivedTime,
                    distance: station.distance
                }
            }
            return res;
        }

        return {};
    }

    //----------------------------------------------------------------------------------------------------
    //
    //


    async function setStationData(object) {
        try {
            if (!object.sourceCallsign || !object.longitude || !object.latitude || !object.wx) {
                //console.log(`Missing data for ${object.sourceCallsign} ${object.longitude}:${object.latitude} ${object.wx}`);
                return;
            }

            const today = new Date(new Date(object.receivedTime).setUTCHours(0, 0, 0, 0));
            const stationName = (object.objectname || object.sourceCallsign).trim();
            const filter = { stationName: stationName, day: today };
            const options = { upsert: true };

            const data = {
                $set: {
                    receivedTime: object.receivedTime,
                    timestamp: object.timestamp,
                    location: {
                        type: "Point",
                        coordinates: [object.longitude, object.latitude],
                    },
                },
                $push: { samples: { timestamp: object.receivedTime, wx: object.wx } },
                $setOnInsert: {
                    stationName: stationName,
                    day: today
                }
            };
            // console.log(`${object.aprsSource}:${stationName}`);
            const result = await stationData.updateOne(filter, data, options);
        } catch (e) {
            console.error(e);
        }
    }

    async function updateStations(object) {
        try {

            if (!object.sourceCallsign || !object.longitude || !object.latitude || !object.wx) {
                return;
            }

            const stationName = (object.objectname || object.sourceCallsign).trim();
            const filter = { stationName: stationName };

            const options = { upsert: true };
            const data = {
                stationName: stationName,
                receivedTime: object.receivedTime,
                timestamp: object.timestamp,
                type: object.type,
                posambiguity: object.posambiguity,
                posresolution: object.posresolution,
                comment: object.comment,
                altitude: object.altitude,
                location: {
                    type: "Point",
                    coordinates: [object.longitude, object.latitude],
                },
            }
            const result = await stations.replaceOne(filter, data, options);

        } catch (e) {
            console.error(e);
        }
    }

    //----------------------------------------------------------------------------------------------------
    //
    //

    return {
        connect: connect,
        getStationByName: getStationByName,
        getStationHistory: getStationHistory,
        setStationData: setStationData,
        updateStations: updateStations,
        getNearbyStations: getNearbyStations,
        getNearbyStationsUnsorted: getNearbyStationsUnsorted,
        getAllStations: getAllStations,
        getAllStationsAndTodayData: getAllStationsAndTodayData,
        getAllStationsAndTodayTightData: getAllStationsAndTodayTightData
    }

})();
