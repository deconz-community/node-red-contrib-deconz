const REDUtil = require("@node-red/util/lib/util");

class Utils {
    static sleep(ms) {
        return new Promise((resolve) => setTimeout(() => resolve(), ms));
    }


    static getNodeProperty(property, node, message_in) {
        if (property.type === 'jsonata') {
            return REDUtil.evaluateJSONataExpression(
                REDUtil.prepareJSONataExpression(property.value, node),
                message_in,
                undefined
            );
        } else if (['msg', 'flow', 'global'].includes(property.type)) {
            return REDUtil.evaluateNodeProperty(property.value, property.type, node, message_in);
        }
    }

}

module.exports = Utils;
