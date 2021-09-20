const REDUtil = require("@node-red/util/lib/util");

class Utils {
    static sleep(ms, defaultValue) {
        if (typeof ms !== 'number') ms = defaultValue;
        return new Promise((resolve) => setTimeout(() => resolve(), ms));
    }

    static cloneMessage(message_in, moveData) {
        if (moveData === undefined) moveData = [];
        if (!Array.isArray(moveData)) moveData = [moveData];
        let msg = REDUtil.cloneMessage(message_in);
        for (const key of moveData) {
            if (msg[key] !== undefined) {
                msg[key + '_in'] = msg[key];
                delete msg[key];
            }
        }
        return msg;
    }

    static getNodeProperty(property, node, message_in, noValueTypes) {
        if (typeof property !== 'object') return;
        return Array.isArray(noValueTypes) && noValueTypes.includes(property.type) ?
            property.type :
            REDUtil.evaluateNodeProperty(property.value, property.type, node, message_in);
    }

    static convertRange(value, r1, r2) {
        return Math.ceil((value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0]);
    }

    static isDeviceCover(device) {
        if (typeof device !== 'object') return;
        return device.type === 'Window covering controller' ||
            device.type === 'Window covering device';
    }

    static clone(object) {
        return Object.assign({}, object);
    }
}

module.exports = Utils;
