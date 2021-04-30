const ISSocket = require("js-aprs-is").ISSocket;
const aprsParser = require("js-aprs-fap").aprsParser;
const DB = require('./db');
const Config = require("../config");

module.exports = (function() {
    "use strict";

    const timeout = 60 * 1000;
    let connectionTimer;
    let lastPacketTimestamp = Date.now();
    let connectionHandle;
    let parser = new aprsParser();

    //----------------------------------------------------------------------------------------------------
    //
    //

    function connect() {
        if (connectionHandle && connectionHandle.isConnected()) {
            console.log("APRS: Connection still up, disconnecting");
            connectionHandle.disconnect()
        }
        console.log("APRS: Connecting to APRS")
        setTimeout(() => {
            init();
            connectionHandle.connect();
        }, 3000);
    }

    //----------------------------------------------------------------------------------------------------
    //
    //

    function CALLSIGN() {
        return "NOCALL-" + Math.floor(Math.random() * (99 - 10) + 10);
    }


    function onPacket(data) {
        if (data.charAt(0) != "#" && !data.startsWith("user")) {
            const packet = parser.parseaprs(data);
            DB.updateStations(packet);
            DB.setStationData(packet);
            lastPacketTimestamp = Date.now();
        } else {
            console.log(data);
            if (data === "# Login by user not allowed") {
                connectionHandle.disconnect();
            }
        }
    }

    function init() {
        const callsign = CALLSIGN()
        connectionHandle = new ISSocket(Config.APRS_SERVER, Config.APRS_PORT, callsign, Config.APRS_PASS, Config.APRS_FILTER, "RainMachine APRS v1");
        console.log(`APRS: Initialised: ${Config.APRS_SERVER}:${Config.APRS_PORT} as ${callsign}`);

        connectionHandle.on("connect", () => {
            console.log("APRS: Connected");
            connectionHandle.sendLine(connectionHandle.userLogin);
        });

        connectionHandle.on("packet", onPacket);

        connectionHandle.on("error", (err) => {
            console.log("APRS: Error: " + err);
        });

        connectionHandle.on("close", (err) => {
            console.log("APRS: Connection closed: " + err);
        });

        clearInterval(connectionTimer);
        connectionTimer = setInterval(() => {
            if (Date.now() - lastPacketTimestamp > timeout) {
                console.error(`APRS: No packet received in ${timeout / 1000} seconds reconnecting`);
                connect();
            }
        }, timeout * 2);

    }

    //----------------------------------------------------------------------------------------------------
    //
    //

    return {
        connect: connect
    }

})();