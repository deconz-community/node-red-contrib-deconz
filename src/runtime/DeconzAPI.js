const got = require('got');
const dns = require('dns');
const Utils = require("./Utils");
const dnsPromises = dns.promises;


class DeconzAPI {

    constructor(options) {
        options = Object.assign({}, this.defaultOptions, options);
        this.name = options.name;
        this.bridge_id = options.bridge_id;
        this.ip = options.ip;
        this.port = isNaN(options.port) ? undefined : Number(options.port);
        this.ws_port = isNaN(options.ws_port) ? undefined : Number(options.ws_port);
        this.apikey = options.apikey !== undefined ? options.apikey : '<nouser>';
        this.secured = options.secured;
        this.version = options.version;
        this.polling = options.polling;
        this.enableLogs = options.enableLogs === undefined ? true : options.enableLogs;
        this.versions = [
            '1', '1.1', '2'
        ];

        this.url = {
            discover: () => 'https://phoscon.de/discover',
            api: () => `http${this.secured ? 's' : ''}://${this.ip}:${this.port}/api`,
            challenge: () => `${this.url.api()}/challenge`, // Undocumented
            main: () => `${this.url.api()}/${this.apikey}`,
            config: {
                main: () => `/config`,
                whitelist: (api_key) => `${this.url.config.main()}/whitelist${api_key !== undefined ? `/${api_key}` : ''}`,
                update: () => `${this.url.config.main()}/update`,
                updatefirmware: () => `${this.url.config.main()}/updatefirmware`,
                reset: () => `${this.url.config.main()}/reset`,
                restart: () => `${this.url.config.main()}/restart`, // Undocumented
                restartapp: () => `${this.url.config.main()}/restartapp`, // Undocumented
                shutdown: () => `${this.url.config.main()}/shutdown`, // Undocumented
                export: () => `${this.url.config.main()}/export`, // Undocumented
                import: () => `${this.url.config.main()}/import`, // Undocumented
                password: () => `${this.url.config.main()}/password`,
                zigbee: (zigbee_id) => `${this.url.config.main()}/zigbee${zigbee_id !== undefined ? `/${zigbee_id}` : ''}`,
                // Beta endpoint
                wifi: {
                    main: () => `${this.url.config.main()}/wifi`,
                    restore: () => `${this.url.config.wifi.main()}/restore`,
                },
                wifiscan: () => `${this.url.config.main()}/wifiscan`, // Undocumented
            },
            capabilities: {
                main: () => `/capabilities`,
            },
            info: {
                main: () => `/info`,
                timezones: () => `${this.url.info.main()}/timezones`,
            },
            groups: {
                main: (group_id) => `/groups${group_id !== undefined ? `/${group_id}` : ''}`,
                action: (group_id) => `${this.url.groups.main(group_id)}/action`,
                scenes: {
                    main: (group_id, scene_id) => `${this.url.groups.main(group_id)}/scenes${scene_id !== undefined ? `/${scene_id}` : ''}`,
                    store: (group_id, scene_id) => `${this.url.groups.scenes.main(group_id, scene_id)}/store`,
                    recall: (group_id, scene_id) => `${this.url.groups.scenes.main(group_id, scene_id)}/recall`,
                    recallnext: (group_id) => `${this.url.groups.scenes.main(group_id, 'next')}/recall`,
                    recallprev: (group_id) => `${this.url.groups.scenes.main(group_id, 'prev')}/recall`,
                    light: {
                        main: (group_id, scene_id, light_id) => `${this.url.groups.scenes.main(group_id, scene_id)}/lights${light_id !== undefined ? `/${light_id}/state` : ''}`,
                        action: (group_id, scene_id, light_id) => `${this.url.groups.scenes.light.main(group_id, scene_id, light_id)}/state`
                    }
                }
            },
            lights: {
                main: (light_id) => `/lights${light_id !== undefined ? `/${light_id}` : ''}`,
                action: (light_id) => `${this.url.lights.main(light_id)}/state`,
                groups: (light_id) => `${this.url.lights.main(light_id)}/groups`,
                scenes: (light_id) => `${this.url.lights.main(light_id)}/scenes`,
                connectivity: (light_id) => `${this.url.lights.main(light_id)}/connectivity` // Undocumented and can crash deconz
            },
            resourcelinks: {
                main: (resourcelink_id) => `/resourcelinks${resourcelink_id !== undefined ? `/${resourcelink_id}` : ''}`
            },
            rules: {
                main: (rule_id) => `/rules${rule_id !== undefined ? `/${rule_id}` : ''}`
            },
            schedules: {
                main: (schedule_id) => `/schedules${schedule_id !== undefined ? `/${schedule_id}` : ''}`
            },
            sensors: {
                main: (sensor_id) => `/sensors${sensor_id !== undefined ? `/${sensor_id}` : ''}`,
                config: (sensor_id) => `${this.url.sensors.main(sensor_id)}/config`,
                action: (sensor_id) => `${this.url.sensors.main(sensor_id)}/state`
            },
            touchlink: {
                main: () => `/touchlink`,
                scan: () => `${this.url.touchlink.main()}/scan`,
                identify: (result_id) => `${this.url.touchlink.main()}${result_id !== undefined ? `/${result_id}` : ''}/identify`,
                reset: (result_id) => `${this.url.touchlink.main()}${result_id !== undefined ? `/${result_id}` : ''}/reset`
            },
            device: {
                // Beta endpoint
                main: (device_id) => `/devices${device_id !== undefined ? `/${device_id}` : ''}`,
            },
            userparameter: {
                main: (userparameter_id) => `/userparameters${userparameter_id !== undefined ? `/${userparameter_id}` : ''}`,
            }
        };
    }

    get defaultOptions() {
        return {
            secured: false
        };
    }

    async discoverSettings(opt) {
        let options = Object.assign({}, {
            targetGatewayID: undefined,
            devicetype: 'Unknown'
        }, opt);

        //TODO check if the current values are valid.

        let response = {log: []};

        response.log.push(`Fetching data from '${this.url.discover()}'.`);
        let discoverResult = await this.getDiscoveryData();
        if (discoverResult === undefined) {
            response.log.push(`No data fetched from '${this.url.discover()}'.`);
        } else {
            response.log.push(`Found ${discoverResult.length} gateways from '${this.url.discover()}'.`);
        }

        let guesses = [];
        if (typeof this.ip === 'string' && this.ip.length > 0 && this.port !== undefined) {
            let ports = [80, 443, 8080];
            if (!ports.includes(this.port)) ports.unshift(this.port);
            guesses.push({
                secured: this.secured || false,
                ip: this.ip,
                ports,
                skipIdCheck: true,
                logError: true
            });
        }
        if (Array.isArray(discoverResult) && discoverResult.length > 0) {
            for (const result of discoverResult) {
                guesses.push({secured: false, ip: result.internalipaddress, ports: [result.internalport]});
            }
        }
        if (this.ip !== 'localhost') {
            guesses.push({secured: false, ip: 'localhost', ports: [80, 443, 8080]});
            guesses.push({secured: true, ip: 'localhost', ports: [80, 443, 8080]});
        }
        for (const ip of ['core-deconz.local.hass.io', 'homeassistant.local']) {
            if (this.ip !== ip) {
                let ports = [40850];
                if (!ports.includes(this.port)) ports.unshift(this.port);
                guesses.push({secured: false, ip, ports});
            }
        }

        let tryGuess = async (secured, ip, port, logError) => {
            const invalid = [undefined, '', 0];
            if (invalid.includes(ip) || invalid.includes(port)) return;
            let api = new DeconzAPI({
                secured: secured || false,
                ip: ip,
                port: port,
                apikey: '<nouser>',
                enableLogs: false
            });
            let config = await api.getConfig(undefined, 1000);
            if (config === undefined) {
                if (logError === true) response.log.push(`Requesting api key at ${api.url.main()}... Failed.`);
                return;
            }
            response.log.push(`Found gateway ID "${config.bridgeid}" at "${api.url.main()}".`);
            return {
                bridge_id: config.bridgeid,
                name: config.name,
                secured: secured,
                ip: ip,
                port: port
            };
        };

        let requests = [];
        response.log.push(`Looking for gateways at ${guesses.length} locations.`);
        for (const guess of guesses) {
            for (const port of guess.ports) {
                requests.push(tryGuess(guess.secured, guess.ip, port, guess.logError));
            }
        }

        let results = await Promise.all(requests);
        // Clean up results
        results = results.filter((r) => r !== undefined);
        response.log.push(`Found ${results.length} gateways.`);

        // If no gateway found, send error
        if (results.length === 0) {
            response.error = {
                code: 'NO_GATEWAY_FOUND',
                description: 'No gateway found, please try to set an IP-Address.'
            };
            return response;
        }

        let bridgeIds = [];
        results = results.filter((result) => {
            if (!bridgeIds.includes(result.bridge_id)) {
                bridgeIds.push(result.bridge_id);
                return true;
            }
            return false;
        });

        // If multiple gateway found, let the user select.
        if (results.length > 1 && options.targetGatewayID === undefined) {
            response.log.push("Got mutiple result and no choice has already been made.");
            response.log.push(JSON.stringify(results));
            response.error = {
                code: 'GATEWAY_CHOICE',
                description: 'Multiple gateways founds.',
                gateway_list: results
            };
            response.currentSettings = this.settings;
            response.currentSettings.discoverParam = options;
            return response;
        }

        // If there is only one result use it.
        if (options.targetGatewayID === undefined && results.length === 1)
            options.targetGatewayID = results[0].bridge_id;

        response.log.push(`Trying to configure gateway "${options.targetGatewayID}"`);

        let gatewaySettings = results.filter((r) => r.bridge_id === options.targetGatewayID).shift();
        if (gatewaySettings === undefined) {
            response.log.push("Gateway settings not found.");
            response.error = {
                code: 'GATEWAY_NO_DATA',
                description: "Can't fetch gateway settings."
            };
            return response;
        }

        for (const [k, v] of Object.entries(gatewaySettings)) {
            this[k] = v;
        }

        response.log.push(`Checking api key ${this.apikey}`);
        if (
            (this.apikey === undefined || String(this.apikey).length === 0) ||
            this.apikey === '<nouser>' ||
            await this.getApiKeyMeta() === undefined
        ) {
            response.log.push("No valid API key provided, trying acquiring one.");
            this.apikey = '<nouser>';
            let apiQuery;
            apiQuery = await this.getAPIKey(options.devicetype);
            if (apiQuery.error) {
                response.log.push("Error while requesting api key.");
                response.log.push(apiQuery.error.description);
                response.error = {
                    code: 'DECONZ_ERROR',
                    type: apiQuery.error.type,
                    description: apiQuery.error.description
                };
                response.currentSettings = this.settings;
                response.currentSettings.discoverParam = options;
                return response;
            }

            if (apiQuery.success) {
                response.log.push("Successfully got a key.");
                this.apikey = apiQuery.success.username;
            }

        }

        if (Utils.isIPAddress(this.ip)) {
            let oldIP = this.ip;
            try {
                response.log.push(`Trying to get a dns name for fetched IP "${this.ip}".`);
                let dnsNames = await dnsPromises.reverse(this.ip);
                if (dnsNames.length === 0) {
                    response.log.push("No domain name found.");
                } else if (dnsNames.length === 1) {
                    this.ip = dnsNames[0];
                    response.log.push(`Found domain name "${this.ip}".`);
                } else {
                    this.ip = dnsNames[0];
                    response.log.push(`Found multiple domain name "${dnsNames.toString()}".`);
                    response.log.push(`Using domain name "${this.ip}".`);
                }
            } catch (e) {
                response.log.push("No domain name found.");
            }

            if (oldIP !== this.ip) {
                let oldEnableLogs = this.enableLogs;
                this.enableLogs = false;
                let newBridgeId = await this.getConfig('bridgeid', 1000);
                this.enableLogs = oldEnableLogs;
                if (newBridgeId === this.bridge_id) {
                    response.log.push(`The domain name seems to be valid. Using the domain name.`);
                } else {
                    response.log.push(`The domain name seems to be invalid. Using the IP address.`);
                    this.ip = oldIP;
                }
            }
        }

        // TODO check if the websocket port is valid
        if ((this.ws_port === undefined || this.ws_port === 0)) {
            this.ws_port = await this.getConfig('websocketport');
        }

        response.success = true;
        response.currentSettings = this.settings;
        return response;

    }

    async getDiscoveryData() {
        try {
            const discover = await got(
                this.url.discover(),
                {
                    method: 'GET',
                    retry: 1,
                    responseType: 'json',
                    timeout: 2000
                }
            );
            return discover.body;
        } catch (e) {
            if (this.enableLogs) console.warn(e);
        }
    }

    async getAPIKey(devicetype) {
        try {
            const discover = await got(
                this.url.api(),
                {
                    method: 'POST',
                    retry: 1,
                    json: {devicetype: devicetype},
                    responseType: 'json',
                    timeout: 2000
                }
            );
            return discover.body[0];
        } catch (e) {
            if (e instanceof got.RequestError &&
                e.response !== undefined &&
                e.response.statusCode === 403
            ) {
                if (Array.isArray(e.response.body)) {
                    return e.response.body[0];
                }
            } else {
                if (this.enableLogs) console.warn(e);
            }
        }
    }

    async getConfig(keyName, timeout) {
        try {
            const discover = await got(
                this.url.main() + this.url.config.main(),
                {
                    method: 'GET',
                    retry: 1,
                    responseType: 'json',
                    timeout: timeout || 2000
                }
            );
            return keyName === undefined ? discover.body : discover.body[keyName];
        } catch (e) {
            if (this.enableLogs) console.warn(e);
        }
    }

    async getApiKeyMeta() {
        let whitelist = await this.getConfig('whitelist');
        return (whitelist === undefined) ? undefined : whitelist[this.apikey];
    }

    get settings() {
        return {
            name: this.name,
            ip: this.ip,
            port: this.port,
            apikey: this.apikey,
            ws_port: this.ws_port,
            secure: this.secured,
            polling: this.polling
        };
    }
}


module.exports = DeconzAPI;