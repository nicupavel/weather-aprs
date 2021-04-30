const Config = require("./src/config");
const HTTP = require("./src/http");
const APRS = require("./src/lib/aprs");
const DB = require('./src/lib/db.js');


async function run() {
    HTTP.init();
    await DB.connect();
    APRS.connect();
}

console.log("Starting ");
run();