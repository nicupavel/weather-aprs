const apiV0 = require('./routes/v0/api.js')
const Express = require('express');
const HttpUtils = require('./lib/http-utils');
const Config = require("./config");
const Compression = require('compression')

function init() {
    let apiServer = Express();
    apiServer.use(Compression())
    apiServer.use(HttpUtils.allowCORS);
    apiServer.use(Express.json());
    apiServer.use("/api/v0/", apiV0);

    apiServer.listen(Config.API_HTTP_PORT, () => {
        console.log(`API HTTP Server started on ${Config.API_HTTP_PORT}`)
    });

    apiServer.on('close', () => {
        console.log("API HTTP Server stopped");
    });
}

module.exports = {
    init: init
};