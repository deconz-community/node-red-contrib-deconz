const dotProp = require("dot-prop");
const Utils = require("./Utils");

class Attribute {
    constructor() {
        this.requiredAttribute = [];
        this.requiredEventMeta = [];
        this.requiredDeviceMeta = [];
    }

    needAttribute(attribute) {
        this.requiredAttribute = this.requiredAttribute.concat(Utils.sanitizeArray(attribute));
        return this;
    }

    needEventMeta(event) {
        this.requiredEventMeta = this.requiredEventMeta.concat(Utils.sanitizeArray(event));
        return this;
    }

    needDeviceMeta(meta) {
        this.requiredDeviceMeta = this.requiredDeviceMeta.concat(Utils.sanitizeArray(meta));
        return this;
    }

    needColorCapabilities(value) {
        this.needDeviceMeta((deviceMeta) => Utils.supportColorCapability(deviceMeta, value));
        return this;
    }

    to(method) {
        this.toMethod = method;
        return this;
    }

    from(method) {
        this.fromMethod = method;
        return this;
    }

    targetIsValid(rawEvent, deviceMeta) {
        for (const meta of this.requiredEventMeta) {
            if (typeof meta === 'function') {
                if (meta(rawEvent) === false) return false;
            } else if (Attribute._checkProperties(rawEvent, meta) === false) {
                return false;
            }
        }
        for (const meta of this.requiredDeviceMeta) {
            if (typeof meta === 'function') {
                if (meta(deviceMeta) === false) return false;
            } else if (Attribute._checkProperties(deviceMeta, meta) === false) {
                return false;
            }
        }
        return true;
    }

    attributeIsValid(result) {
        for (let attribute of this.requiredAttribute) {
            if (!Object.keys(result).includes(attribute)) {
                return false;
            }
        }
        return true;
    }

    static _checkProperties(data, propertyMeta) {
        switch (typeof propertyMeta) {
            case 'string':
                return dotProp.has(data, propertyMeta);
            case 'object':
                for (const [k, v] of Object.entries(propertyMeta)) {
                    console.log({k, v});
                }
                break;
        }
        return true;
    }
}


const HomeKitFormat = (() => {

    let directMap = (direction, path) => {
        let attr = new Attribute();
        attr.needEventMeta(path);
        if (direction.includes('to')) attr.to((rawEvent, deviceMeta) => dotProp.get(rawEvent, path));
        if (direction.includes('from')) attr.from((value, result) => dotProp.set(result, path, value));
        return attr;
    };

    const HKF = {};
    //#region Switchs
    HKF.ServiceLabelIndex = new Attribute()
        .needAttribute('ProgrammableSwitchEvent')
        .needEventMeta('state.buttonevent')
        .to((rawEvent, deviceMeta) =>
            Math.floor(dotProp.get(rawEvent, 'state.buttonevent') / 1000)
        );
    HKF.ProgrammableSwitchEvent = new Attribute()
        .needAttribute('ServiceLabelIndex')
        .needEventMeta('state.buttonevent')
        //.needDeviceMeta({type:['Window covering controller', 'Window covering device']})
        .to((rawEvent, deviceMeta) => {
            switch (dotProp.get(rawEvent, 'state.buttonevent') % 1000) {
                case 1 : // Hold Down
                    return 2; // Long Press
                case 2: // Short press
                    return 0; // Single Press
                case 4 : // Double press
                case 5 : // Triple press
                case 6 : // Quadtruple press
                case 10 : // Many press
                    /*
                     * Merge all many press event to 1 because homekit only support double press events.
                     */
                    return 1; // Double Press
            }
        });
    //#endregion
    //#region Sensors
    HKF.CurrentTemperature = new Attribute()
        .needEventMeta('state.temperature')
        .to((rawEvent, deviceMeta) =>
            dotProp.get(rawEvent, 'state.temperature') / 100
        );
    HKF.CurrentRelativeHumidity = new Attribute()
        .needEventMeta('state.humidity')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'state.humidity') / 100);
    HKF.CurrentAmbientLightLevel = directMap(['to'], 'state.lux');
    HKF.SmokeDetected = directMap(['to'], 'state.fire');
    HKF.OutletInUse = new Attribute()
        .needEventMeta('state.power')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'state.power') > 0);
    HKF.LeakDetected = new Attribute()
        .needEventMeta('state.water')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'state.water') ? 1 : 0);
    HKF.MotionDetected = directMap(['to'], 'state.presence');
    HKF.ContactSensorState = new Attribute()
        .needEventMeta((rawEvent) =>
            dotProp.has(rawEvent, 'state.open') ||
            dotProp.has(rawEvent, 'state.vibration')
        )
        .to((rawEvent, deviceMeta) => {
            if (dotProp.has(rawEvent, 'state.vibration')) {
                return dotProp.has(rawEvent, 'state.vibration') ? 1 : 0;
            }
            if (dotProp.has(rawEvent, 'state.open')) {
                return dotProp.has(rawEvent, 'state.open') ? 1 : 0;
            }
        });
    //#endregion
    //#region Lights
    HKF.On = directMap(['to'], 'state.on');
    HKF.Brightness = new Attribute()
        .needEventMeta('state.bri')
        .to((rawEvent, deviceMeta) => {
            if (dotProp.get(rawEvent, 'state.on') !== true) return;
            return Utils.convertRange(dotProp.get(rawEvent, 'state.bri'), [0, 255], [0, 100], true, true);
        })
        .from((value, result) => {
            let bri = Utils.convertRange(value, [0, 100], [0, 255], true, true);
            dotProp.set(result, 'state.bri', bri);
            dotProp.set(result, 'state.on', bri > 0);
        });
    HKF.Hue = new Attribute()
        .needEventMeta('state.hue')
        .needColorCapabilities('hs', 'xy', 'unknown')
        .to((rawEvent, deviceMeta) => {
            if (dotProp.get(rawEvent, 'state.on') !== true) return;
            return Utils.convertRange(dotProp.get(rawEvent, 'state.hue'), [0, 65535], [0, 360], false, true);
        })
        .from((value, result) => {
            dotProp.set(result, 'state.hue', Utils.convertRange(value, [0, 360], [0, 65535], true, true));
        });
    HKF.Saturation = new Attribute()
        .needEventMeta('state.sat')
        .needColorCapabilities('hs', 'xy', 'unknown')
        .to((rawEvent, deviceMeta) => {
            if (dotProp.get(rawEvent, 'state.on') !== true) return;
            return Utils.convertRange(dotProp.get(rawEvent, 'state.sat'), [0, 255], [0, 100], false, true);
        })
        .from((value, result) => {
            dotProp.set(result, 'state.sat', Utils.convertRange(value, [0, 100], [0, 255], true, true));
        });
    HKF.ColorTemperature = new Attribute()
        .needEventMeta('state.ct')
        .needColorCapabilities('ct', 'unknown')
        .to((rawEvent, deviceMeta) => {
            return dotProp.get(rawEvent, 'state.ct');
        })
        .from((value, result) => dotProp.set(result, 'state.ct', value));
    //#endregion
    //#region Window cover
    HKF.CurrentPosition = new Attribute()
        .needEventMeta('state.lift')
        .to((rawEvent, deviceMeta) =>
            Utils.convertRange(dotProp.get(rawEvent, 'state.lift'), [0, 100], [100, 0])
        );
    HKF.TargetPosition = HKF.CurrentPosition;
    HKF.CurrentHorizontalTiltAngle = new Attribute()
        .needEventMeta('state.tilt')
        .to((rawEvent, deviceMeta) =>
            Utils.convertRange(dotProp.get(rawEvent, 'state.tilt'), [0, 100], [-90, 90])
        );
    HKF.TargetHorizontalTiltAngle = HKF.CurrentHorizontalTiltAngle;
    HKF.CurrentVerticalTiltAngle = HKF.CurrentHorizontalTiltAngle;
    HKF.TargetVerticalTiltAngle = HKF.CurrentHorizontalTiltAngle;
    //#endregion
    //#region Battery
    HKF.BatteryLevel = directMap(['to'], 'config.battery');
    HKF.StatusLowBattery = new Attribute()
        .needEventMeta('config.battery')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'config.battery') <= 15 ? 1 : 0);
    //#endregion
    return HKF;
})();

class BaseFormatter {
    constructor(options) {
        this.propertyList = Object.keys(HomeKitFormat);

        this.options = Object.assign({
            attributeWhitelist: [],
            attributeBlacklist: [],
        }, options);

        this.options.attributeWhitelist = Utils.sanitizeArray(this.options.attributeWhitelist);
        if (this.options.attributeWhitelist.length > 0) {
            this.propertyList = this.propertyList.filter((property) =>
                this.options.attributeWhitelist.includes(property)
            );
        }

        this.options.attributeBlacklist = Utils.sanitizeArray(this.options.attributeBlacklist);
        if (this.options.attributeBlacklist.length > 0) {
            this.propertyList = this.propertyList.filter((property) =>
                !this.options.attributeBlacklist.includes(property)
            );
        }
    }
}

class fromDeconz extends BaseFormatter {
    parse(rawEvent, deviceMeta) {
        let result = {};
        for (const property of this.propertyList) {
            if (!HomeKitFormat[property].targetIsValid(rawEvent, deviceMeta)) continue;
            if (HomeKitFormat[property].toMethod === undefined) continue;
            result[property] = HomeKitFormat[property].toMethod(rawEvent, deviceMeta);
        }
        // Cleanup undefined values or invalid attributes
        for (const property of Object.keys(result)) {
            if (result[property] === undefined || !HomeKitFormat[property].attributeIsValid(result)) {
                delete result[property];
            }
        }
        return result;
    }

}

class toDeconz extends BaseFormatter {
    parse(values, result) {
        if (result === undefined) result = {};
        for (const [property, value] of Object.entries(values)) {
            if (!this.propertyList.includes(property)) continue;
            if (HomeKitFormat[property].fromMethod === undefined) continue;
            HomeKitFormat[property].fromMethod(value, result);
        }
        // TODO remove undefined values
        return result;
    }

}

module.exports = {fromDeconz, toDeconz};
