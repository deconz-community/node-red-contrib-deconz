const got = require('got');

class DeconzAPI {

    constructor(options) {
        Object.assign({}, this.defaultOptions, options);
        this.ip = options.ip;
        this.port = options.port;
        this.key = options.key !== undefined ? options.key : '<nouser>';
        this.secured = options.secured;
        this.version = options.version;
        this.versions = [
            '1', '1.1', '2'
        ];

        this.url = {
            discover: 'https://phoscon.de/discover',
            api: () => `http${this.secured ? 's' : ''}://${this.ip}:${this.port}/api`,
            challenge: () => `${this.url.api()}/challenge`, // Undocumented
            main: () => `${this.url.api()}/${this.key}`,
            config: {
                main: () => `${this.url.main()}/config`,
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
                main: () => `${this.url.main()}/capabilities`,
            },
            info: {
                main: () => `${this.url.main()}/info`,
                timezones: () => `${this.url.info.main()}/timezones`,
            },
            groups: {
                main: (group_id) => `${this.url.main()}/groups${group_id !== undefined ? `/${group_id}` : ''}`,
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
                main: (light_id) => `${this.url.main()}/lights${light_id !== undefined ? `/${light_id}` : ''}`,
                action: (light_id) => `${this.url.lights.main(light_id)}/state`,
                groups: (light_id) => `${this.url.lights.main(light_id)}/groups`,
                scenes: (light_id) => `${this.url.lights.main(light_id)}/scenes`,
                connectivity: (light_id) => `${this.url.lights.main(light_id)}/connectivity` // Undocumented and can crash deconz
            },
            resourcelinks: {
                main: (resourcelink_id) => `${this.url.main()}/resourcelinks${resourcelink_id !== undefined ? `/${resourcelink_id}` : ''}`
            },
            rules: {
                main: (rule_id) => `${this.url.main()}/rules${rule_id !== undefined ? `/${rule_id}` : ''}`
            },
            schedules: {
                main: (schedule_id) => `${this.url.main()}/schedules${schedule_id !== undefined ? `/${schedule_id}` : ''}`
            },
            sensors: {
                main: (sensor_id) => `${this.url.main()}/sensors${sensor_id !== undefined ? `/${sensor_id}` : ''}`,
                config: (sensor_id) => `${this.url.sensors.main(sensor_id)}/config`,
                action: (sensor_id) => `${this.url.sensors.main(sensor_id)}/state`
            },
            touchlink: {
                main: () => `${this.url.main()}/touchlink`,
                scan: () => `${this.url.touchlink.main()}/scan`,
                identify: (result_id) => `${this.url.touchlink.main()}${result_id !== undefined ? `/${result_id}` : ''}/identify`,
                reset: (result_id) => `${this.url.touchlink.main()}${result_id !== undefined ? `/${result_id}` : ''}/reset`
            },
            device: {
                // Beta endpoint
                main: (device_id) => `${this.url.main()}/devices${device_id !== undefined ? `/${device_id}` : ''}`,
            },
            userparameter: {
                main: (userparameter_id) => `${this.url.main()}/userparameters${userparameter_id !== undefined ? `/${userparameter_id}` : ''}`,
            }
        };
    }

    get defaultOptions() {
        return {
            secured: false
        };
    }

}


module.exports = DeconzAPI;