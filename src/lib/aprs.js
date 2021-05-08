const ISSocket = require("js-aprs-is").ISSocket;
const aprsParser = require("js-aprs-fap").aprsParser;
const DB = require('./db');
const Config = require("../config");

"use strict";

class APRS {
    constructor(host, port, pass, filter, timeout) {
        this.host = host;
        this.port = port;
        this.pass = pass;
        this.filter = filter;

        this.connectionTimer = null;
        this.timeout = timeout || 60 * 1000;
        this.lastPacketTimestamp = Date.now();
        this.connectionHandle = null;

        this.parser = new aprsParser();
    }

    connect() {
        if (this.connectionHandle && this.connectionHandle.isConnected()) {
            console.log(`APRS (${this.host}): Connection still up, disconnecting`);
            this.connectionHandle.disconnect()
        }
        console.log(`APRS: Connecting to APRS ${this.host}:${this.port}`);
        setTimeout(() => {
            this.init();
            this.connectionHandle.connect();
        }, 3000);
    }

    disconnect() {
        this.connectionHandle.disconnect();
        clearInterval(this.connectionTimer);
    }

    //----------------------------------------------------------------------------------------------------
    //
    //

    init() {
        const callsign = this.CALLSIGN()
        this.connectionHandle = new ISSocket(this.host, this.port, callsign, this.pass, this.filter, "RainMachine APRS v1");
        console.log(`APRS: Initialised: ${this.host}:${this.port} as ${callsign}`);

        this.connectionHandle.on("connect", () => {
            console.log(`APRS (${this.host}): Connected`);
            this.connectionHandle.sendLine(this.connectionHandle.userLogin);
        });

        this.connectionHandle.on("packet", (data) => { return this.onPacket(data) });

        this.connectionHandle.on("error", (err) => {
            console.log(`APRS (${this.host}): Error: ${err}`);
        });

        this.connectionHandle.on("close", (err) => {
            console.log(`APRS (${this.host}): Connection closed: ${err}`);
        });

        clearInterval(this.connectionTimer);
        this.connectionTimer = setInterval(() => {
            if (Date.now() - this.lastPacketTimestamp > this.timeout) {
                console.error(`APRS (${this.host}): No packet received in ${this.timeout / 1000} seconds reconnecting`);
                this.connect();
            }
        }, this.timeout * 2);
    }

    onPacket(data) {
        if (data.charAt(0) != "#" && !data.startsWith("user")) {
            const packet = this.parser.parseaprs(data);
            DB.updateStations(packet);
            DB.setStationData(packet);
            this.lastPacketTimestamp = Date.now();
        } else {
            console.log(data);
            if (data === "# Login by user not allowed") {
                this.connectionHandle.disconnect();
            }
        }
    }

    //----------------------------------------------------------------------------------------------------
    //
    //
    CALLSIGN() {
        return "NOCALL-" + Math.floor(Math.random() * (99 - 10) + 10);
    }
}

exports.APRS = APRS;