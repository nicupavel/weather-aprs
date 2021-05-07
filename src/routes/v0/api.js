const Router = require('express').Router();
const DB = require('../../lib/db.js');

Router.get("/stations", getAllStations);
Router.get("/stations/data", getAllStationsAndTodayData);
Router.get("/station/:name", getStationByName);
Router.get("/nearby/:lat/:lon/:dist", getNearbyStations);

async function getStationByName(req, res) {
    return httpJSONResponse(res, await DB.getStationByName(req.params.name));
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