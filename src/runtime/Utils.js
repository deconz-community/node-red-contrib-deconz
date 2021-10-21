const REDUtil = require("@node-red/util/lib/util");
const dotProp = require("dot-prop");
const Colorspace = require("./Colorspace");

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
        if (property.type === 'num' && property.value === '') return;
        return Array.isArray(noValueTypes) && noValueTypes.includes(property.type) ?
            property.type :
            REDUtil.evaluateNodeProperty(property.value, property.type, node, message_in);
    }

    static convertRange(value, r1, r2, roundValue = false, limitValue = false) {
        if (typeof value !== 'number') return;
        if (limitValue) {
            value = Math.max(value, r1[0]);
            value = Math.min(value, r1[1]);
        }
        let result = (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
        return roundValue ? Math.ceil(result) : result;
    }

    static isDeviceCover(device) {
        if (typeof device !== 'object') return;
        return device.type === 'Window covering controller' ||
            device.type === 'Window covering device';
    }

    static clone(object) {
        return Object.assign({}, object);
    }

    static sanitizeArray(value) {
        if (value === undefined || value === null) return [];
        if (!Array.isArray(value)) return [value];
        return value;
    }

    static isIPAddress(address) {
        const ipv4RegexExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
        const ipv6RegexExp = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/gi;
        return ipv4RegexExp.test(address) || ipv6RegexExp.test(address);
    }

    static async waitForReady(target, maxDelay = 10000, pauseDelay = 100) {
        let pauseCount = 0;
        while (target.ready === false) {
            await Utils.sleep(pauseDelay);
            pauseCount++;
            if (pauseCount * pauseDelay >= maxDelay) {
                break;
            }
        }
    }

    static async waitForEverythingReady(node) {
        if (node.config.statustext_type === 'auto')
            clearTimeout(node.cleanStatusTimer);
        // Wait until the server is ready
        if (node.server.ready === false) {
            node.status({
                fill: "yellow",
                shape: "dot",
                text: "node-red-contrib-deconz/server:status.wait_for_server_start"
            });
            await this.waitForReady(node.server.state, 30000);
            if (node.server.ready === false) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/server:status.server_node_error"
                });
                console.error('Timeout, the server node is not ready after 30 seconds.');
                return "node-red-contrib-deconz/server:status.server_node_error";
            } else {
                node.status({});
            }
        }

        await this.waitForReady(node, 30000);

        if (node.ready === false) {
            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-deconz/server:status.node_error"
            });
            console.error('Timeout, the node is not ready after 30 seconds.');
            return "node-red-contrib-deconz/server:status.node_error";
        }
    }

    static convertColorCapabilities(mask) {
        let result = [];
        if (mask === 0) result.push('unknown');
        if ((mask & 0x1) === 0x1 || (mask & 0x2) === 0x2) result.push('hs');
        if ((mask & 0x8) === 0x8) result.push('xy');
        if ((mask & 0x4) === 0x4) result.push('effect');
        if ((mask & 0x10) === 0x10) result.push('ct');
        return result;
    }

    static supportColorCapability(deviceMeta, value) {
        let deviceCapabilities = Utils.convertColorCapabilities(deviceMeta.colorcapabilities);
        if (deviceMeta.colorcapabilities === 0) return deviceCapabilities.includes('unknown');
        let values = Utils.sanitizeArray(value);
        for (const v of values) {
            if (deviceCapabilities.includes(v)) return true;
        }
        return false;
    }

    static convertLightsValues(deviceMeta) {
        if (deviceMeta.colorcapabilities !== undefined) {
            deviceMeta.device_colorcapabilities = Utils.convertColorCapabilities(deviceMeta.colorcapabilities);
        }
    }

}

module.exports = Utils;
