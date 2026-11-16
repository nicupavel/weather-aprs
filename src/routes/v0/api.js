const Router = require('express').Router();
const DB = require('../../lib/db.js');

Router.get("/stations", getAllStations);
Router.get("/stations/data", getAllStationsAndTodayData);
Router.get("/stations/data/tight/:keys?", getAllStationsAndTodayTightData);
Router.get("/station/:name", getStationByName);
Router.get("/station/:name/history", getStationHistory);
Router.get("/nearby/:lat/:lon/:dist", getNearbyStations);

async function getStationByName(req, res) {
    return httpJSONResponse(res, await DB.getStationByName(req.params.name));
}

async function getStationHistory(req, res) {
    let cursor;
    const stopQuery = () => {
        if (cursor) cursor.close().catch(error => console.error("Could not close history query", error));
    };
    res.once("close", stopQuery);
    try {
        const history = await DB.getStationHistory(req.params.name, req.query.period || "day", {
            to: req.query.to, before: req.query.before,
            onCursor: value => {
                cursor = value;
                if (res.destroyed) stopQuery();
            }
        });
        if (!res.destroyed) return httpJSONResponse(res, history);
    } catch (error) {
        if (res.destroyed) return;
        console.error("Could not load station history", error);
        return res.status(error.code === 50 ? 504 : 500).json({ error: "Could not load station history." });
    } finally {
        res.removeListener("close", stopQuery);
    }
}

async function getNearbyStations(req, res) {
    let lat = +req.params.lat;
    let lon = +req.params.lon;
    let dist = +req.params.dist;

    return httpJSONResponse(res, await DB.getNearbyStationsUnsorted(lat, lon, dist));
}

async function getAllStations(req, res) {
    return httpJSONResponse(res, await DB.getAllStations());
}

async function getAllStationsAndTodayData(req, res) {
    return httpJSONResponse(res, await DB.getAllStationsAndTodayData());
}

async function getAllStationsAndTodayTightData(req, res) {
    return httpJSONResponse(res, await DB.getAllStationsAndTodayTightData(req.params.keys));
}

//----------------------------------------------------------------------------------------------------
//
//
function httpJSONResponse(res, param) {
    if (param && param.statusCode) {
        res.statusCode = param.statusCode
    }
    return res.json(param);
}

function logRequest(req, res) {
    logger.info(req);
    res.end(ERRORS.SUCCESS);
}

module.exports = Router;
