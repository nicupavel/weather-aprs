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

        } finally {
            console.log(`Connected to ${Config.MONGO_DB_NAME} DB`);
        }
    }

    //----------------------------------------------------------------------------------------------------
    //
    //

    async function getStationByName(stationName) {
        console.log(`Looking up ${stationName}`)
        let result = await stationData.findOne({ stationName: stationName });
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

    async function getAllStations() {
        const today = new Date(new Date().setUTCHours(0, 0, 0, 0));
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
            console.log(stationName);
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
        setStationData: setStationData,
        updateStations: updateStations,
        getNearbyStations: getNearbyStations,
        getNearbyStationsUnsorted: getNearbyStationsUnsorted,
        getAllStations: getAllStations,
    }

})();