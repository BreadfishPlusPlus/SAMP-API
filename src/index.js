"use strict";

const debug = require("debug")("api");

import express from "express";
import {isIP, isInt} from "validator";
import {getClientIp} from "request-ip";
import Promise from "bluebird";
const SAMPQuery = Promise.promisify(require("samp-query"));
const resolve4 = Promise.promisify(require("dns").resolve4);
import ApiCache from "apicache";
const apicache = ApiCache.options({ debug: true }).middleware;

const start = async () => {
    debug("start");

    const webserver = express();

    webserver.set("case sensitive routing", true);
    webserver.set("json spaces", 2);
    webserver.set("trust proxy", true);
    webserver.set("x-powered-by", false);

    webserver.use(apicache("5 minutes"));

    webserver.use(async (req, res) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Expose-Headers", "Content-Type");
        debug(`serving reqeust ${req.url} from ${getClientIp(req)}`);

        try {
            let {host, port} = req.query;

            if (!host) {
                throw new Error(`Parameter "host" wird benötigt.`);
            }
            if (!isIP(host, 4)) {
                try {
                    const ip = await resolve4(host);
                    host = ip[0];
                } catch(error) {
                    debug(error.message);
                    throw new Error(`"${host}" ist kein gültiger Host.`);
                }
            }

            if (!port) {
                port = "7777";
            }
            if (!isInt(port, { min: 1, max: 65535 })) {
                throw new Error(`"${port}" ist kein gültiger Port.`);
            }
            port = parseInt(port, 10);

            debug({host, port});

            const sampData = await SAMPQuery({host, port});
            let { gamemode, hostname, mapname, rules, passworded, maxplayers, online, players } = sampData;
            let { lagcomp, version, weather, weburl, worldtime } = rules;

            maxplayers = maxplayers || 0;
            online = online || 0;
            weather = weather || 0;
            const error = null;

            const data = { host, port, error, gamemode, hostname, mapname, lagcomp, passworded, maxplayers, online, players,
                version, weather, weburl, worldtime };
            debug(data);

            res.status(200).json(data);
        } catch (error) {
            debug(error.message);
            res.status(500).json({error: error.message});
        }
    });

    const svr = webserver.listen(process.env.PORT || 5000, "0.0.0.0", (error) => {
        if (error) {
            throw error;
        }
        debug(`webserver started: ${JSON.stringify(svr.address())}`);
    });
};

start();

process.on("unhandledRejection", (error) => {
    console.error(error.stack);
    process.exit(1);
});
