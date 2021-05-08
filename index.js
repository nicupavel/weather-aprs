const Config = require("./src/config");
const HTTP = require("./src/http");
const APRS = require("./src/lib/aprs").APRS;
const DB = require('./src/lib/db.js');


async function run() {
    HTTP.init();
    await DB.connect();
    const aprsConnection = new APRS(Config.APRS_SERVER, Config.APRS_PORT, Config.APRS_PASS, Config.APRS_FILTER);
    aprsConnection.connect();
    const cwopConnection = new APRS(Config.CWOP_SERVER, Config.CWOP_PORT, Config.CWOP_PASS, Config.CWOP_FILTER);
    cwopConnection.connect();
}

console.log("Starting ");
run();