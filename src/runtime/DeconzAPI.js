const got = require('got');

class DeconzAPI {

    constructor(options) {
        Object.assign({}, this.defaultOptions, options);
        this.name = options.name;
        this.ip = options.ip;
        this.port = options.port;
        this.ws_port = options.ws_port;
        this.key = options.key !== undefined ? options.key : '<nouser>';
        this.secured = options.secured;
        this.version = options.version;
        this.polling = options.polling;
        this.versions = [
            '1', '1.1', '2'
        ];

        this.url = {
            discover: () => 'https://phoscon.de/discover',
            api: () => `http${this.secured ? 's' : ''}://${this.ip}:${this.port}/api`,
            challenge: () => `${this.url.api()}/challenge`, // Undocumented
            main: () => `${this.url.api()}/${this.key}`,
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
            discoverResultID: undefined,
            devicetype: 'Unknown'
        }, opt);

        let response = {log: []};

        response.log.push(`Fetching data from '${this.url.discover()}'.`);
        let discoverResult = await this.getDiscoveryData(options.discoverResultID);

        if (Array.isArray(discoverResult) && discoverResult.length === 1) options.discoverResultID = 0;
        let discoverData;
        if (discoverResult === undefined) {
            response.log.push(`No data fetched from '${this.url.discover()}'.`);
        } else {
            if (Array.isArray(discoverResult) &&
                discoverResult.length > 1 &&
                discoverResult[options.discoverResultID] === undefined
            ) {
                response.log.push("Got mutiple result and no choice has already been made.");
                response.log.push(JSON.stringify(discoverResult));
                response.error = {
                    code: 'GATEWAY_CHOICE',
                    description: 'Multiple gateways founds.',
                    gateway_list: discoverResult
                };
                response.currentSettings = this.settings;
                response.currentSettings.discoverParam = options;
                return response;
            } else {
                discoverData = discoverResult[options.discoverResultID];
                response.log.push(`Using result #${options.discoverResultID + 1}: ` + JSON.stringify(discoverData));
            }
        }

        if (discoverData) {
            if (this.name === undefined || String(this.name).length === 0) this.name = discoverData.name;
            if (this.ip === undefined || String(this.ip).length === 0) this.ip = discoverData.internalipaddress;
            if (this.port === undefined || String(this.port).length === 0) this.port = discoverData.internalport;
        }

        if ((this.key === undefined || String(this.key).length === 0)) {
            response.log.push("No API key provided, trying acquiring one.");
            let apiQuery;

            // First try to get an api key
            response.log.push(`Requesting api key at ${this.url.main()}`);
            apiQuery = await this.getAPIKey(options.devicetype);

            let guesses = [
                {secured: false, ip: 'core-deconz.local.hass.io'},
                {secured: true, ip: 'core-deconz.local.hass.io'},
                {secured: false, ip: 'homeassistant.local'},
                {secured: true, ip: 'homeassistant.local'},
                {secured: this.secured, ip: this.ip}
            ];

            if (apiQuery === undefined) {
                for (const guess of guesses) {
                    this.secured = guess.secured;
                    this.ip = guess.ip;
                    response.log.push(`Requesting api key at ${this.url.main()}.`);
                    apiQuery = await this.getAPIKey(options.devicetype);
                    if (apiQuery !== undefined) break;
                }
            }

            if (apiQuery === undefined) {
                response.log.push("No response from the server.");
                response.error = {
                    code: 'SERVER_TIMEOUT',
                    description: 'No response from the server, please try to set an IP-Address.'
                };
                return response;
            }

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
                this.key = apiQuery.success.username;
            }

        }

        if ((this.ws_port === undefined || String(this.ws_port).length === 0)) {
            this.ws_port = await this.getWebSocketPort();
        }

        response.success = true;
        response.currentSettings = this.settings;
        return response;

    }

    async getDiscoveryData(resultID) {
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
            if (resultID !== undefined) return [discover.body[resultID]];
            return discover.body;
        } catch (e) {
            console.warn(e.toString());
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
                console.warn(e.toString());
            }
        }
    }

    async getWebSocketPort() {
        try {
            const discover = await got(
                this.url.main() + this.url.config.main(),
                {
                    method: 'GET',
                    retry: 1,
                    responseType: 'json',
                    timeout: 2000
                }
            );
            return discover.body.websocketport;
        } catch (e) {
            console.warn(e.toString());
        }
    }

    get settings() {
        return {
            name: this.name,
            ip: this.ip,
            port: this.port,
            apikey: this.key,
            ws_port: this.ws_port,
            secure: this.secured,
            polling: this.polling
        };
    }
}


module.exports = DeconzAPI;