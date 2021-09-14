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

    static getNodeProperty(property, node, message_in) {
        return REDUtil.evaluateNodeProperty(property.value, property.type, node, message_in);
    }

}

module.exports = Utils;
