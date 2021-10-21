const Query = require('./Query');
const Utils = require("./Utils");


class DeviceList {

    constructor() {
        this.domains = ['groups', 'lights', 'sensors'];
        this.devices = {};
        this.all_group_real_id = undefined;
        for (const resource of this.domains) this.devices[resource] = {
            ById: {},
            ByUniqueID: {}
        };
    }

    parse(data, onNewDevice = undefined) {
        //TODO find a better way than recreate all object from scratch each time
        let newDevices = {};
        for (const resourceName of this.domains) {
            if (data[resourceName] === undefined) continue;
            newDevices[resourceName] = {
                ById: {},
                ByUniqueID: {}
            };

            for (const [id, device] of Object.entries(data[resourceName])) {
                device.device_type = resourceName;
                device.device_id = Number(id);
                let idPath = this.getIDPathByDevice(device, true);
                let uniquePath = this.getUniqueIDPathByDevice(device, true);
                device.device_path = uniquePath || idPath;
                Utils.convertLightsValues(device);
                if (idPath) newDevices[resourceName].ById[device.device_id] = device;
                if (uniquePath) newDevices[resourceName].ByUniqueID[device.uniqueid] = device;
                if (this.getDeviceByPath(device.device_path) === undefined && typeof onNewDevice === 'function') {
                    onNewDevice(device);
                }
            }
        }
        this.devices = newDevices;
    }

    getDeviceByPath(path) {
        let parts = path.split("/");
        let resourceName = parts.shift();
        let domain = parts.shift();
        if (resourceName === 'uniqueid') return this.getDeviceByUniqueID(domain);
        let sub_path = parts.join("/");
        switch (domain) {
            case 'device_id':
                return this.devices[resourceName].ById[sub_path];
            case 'uniqueid':
                return this.devices[resourceName].ByUniqueID[sub_path];
        }

    }

    /**
     * Get the device from his unique ID.
     * Warning, some devices have the same uniqueID.
     * @param uniqueID
     * @returns device
     */
    getDeviceByUniqueID(uniqueID) {
        for (const domain of Object.values(this.devices)) {
            let found = domain.ByUniqueID[uniqueID];
            if (found) return found;
        }
    }

    /**
     * Get the device from his domain and his ID.
     * @param domain string {'groups', 'lights', 'sensors'}
     * @param deviceID string
     * @returns device
     */
    getDeviceByDomainID(domain, deviceID) {
        return this.domains.includes(domain) ? this.devices[domain].ById[deviceID] : undefined;
    }

    createQuery(device) {
        return {device_path: this.getPathByDevice(device)};
    }

    getAllDevices() {
        return this.getDevicesByQuery("all");
    }

    getDevicesByQuery(queryParams, options = {}) {

        let opt = {
            includeNotMatched: options.includeNotMatched || false,
            extractValue: options.extractValue
        };

        let query = new Query(queryParams);
        let result = {
            matched: [],
            rejected: [],
        };
        for (const domain of Object.values(this.devices)) {
            for (const device of Object.values(domain.ById)) {
                let value = opt.extractValue ? device[opt.extractValue] : device;
                if (query.match(device)) {
                    result.matched.push(value);
                } else {
                    result.rejected.push(value);
                }
            }
        }
        return result;
    }


    getPathByDevice(device, includeDeviceType = true) {
        return this.getUniqueIDPathByDevice(device, includeDeviceType) || this.getIDPathByDevice(device, includeDeviceType);
    }

    getIDPathByDevice(device, includeDeviceType = true) {
        let path = "";
        if (includeDeviceType) path += device.device_type + "/";
        path += "device_id/" + device.device_id;
        return path;
    }

    getUniqueIDPathByDevice(device, includeDeviceType = true) {
        if (device.uniqueid === undefined) return;
        let path = "";
        if (includeDeviceType) path += device.device_type + "/";
        path += "uniqueid/" + device.uniqueid;
        return path;
    }

    get count() {
        let result = 0;
        for (const resource of this.domains) {
            result += Object.keys(this.devices[resource].ById).length;
        }
        return result;
    }

}


module.exports = DeviceList;