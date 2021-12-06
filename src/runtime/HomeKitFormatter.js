const dotProp = require("dot-prop");
const Utils = require("./Utils");
const Colorspace = require("./Colorspace");

class Attribute {
    constructor() {
        this.requiredAttribute = [];
        this.requiredEventMeta = [];
        this.requiredDeviceMeta = [];
        this.servicesList = [];
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
        if (this._name !== undefined) {
            console.error("Can't use name with from method");
        }
        this.fromMethod = method;
        return this;
    }

    services(services) {
        this.servicesList = this.servicesList.concat(Utils.sanitizeArray(services));
        return this;
    }

    name(name) {
        if (this.fromMethod !== undefined) {
            console.error("Can't use name with from method");
        }
        this._name = name;
        return this;
    }

    priority(priority) {
        this._priority = priority;
        return this;
    }

    targetIsValid(rawEvent, deviceMeta) {
        for (const meta of this.requiredEventMeta) {
            if (typeof meta === 'function') {
                if (meta(rawEvent, deviceMeta) === false) return false;
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
        let resultList = Array.isArray(result) ? result : Object.keys(result);
        for (let attribute of this.requiredAttribute) {
            if (!resultList.includes(attribute)) {
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
                for (const [propertyName, expectedValue] of Object.entries(propertyMeta)) {
                    if (!dotProp.has(data, propertyName)) return false;
                    const currentValue = dotProp.get(data, propertyName);
                    if (Array.isArray(expectedValue)) {
                        if (expectedValue.includes(currentValue) === false) {
                            return false;
                        }
                    } else {
                        if (currentValue !== expectedValue) return false;
                    }
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
        if (direction.includes('from')) attr.from((value, allValues, result) => dotProp.set(result, path, value));
        return attr;
    };

    const HKF = {};
    //#region Switchs
    HKF.ServiceLabelIndex = new Attribute()
        .services('Stateless Programmable Switch')
        .needAttribute('ProgrammableSwitchEvent')
        .needEventMeta('state.buttonevent')
        .to((rawEvent, deviceMeta) =>
            Math.floor(dotProp.get(rawEvent, 'state.buttonevent') / 1000)
        );
    HKF.ProgrammableSwitchEvent = new Attribute()
        .services('Stateless Programmable Switch')
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
        .services(['Heater Cooler', 'Thermostat', 'Temperature Sensor'])
        .needEventMeta('state.temperature')
        .to((rawEvent, deviceMeta) =>
            dotProp.get(rawEvent, 'state.temperature') / 100
        );
    HKF.CurrentRelativeHumidity = new Attribute()
        .services(['Thermostat', 'Humidity Sensor'])
        .needEventMeta('state.humidity')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'state.humidity') / 100);
    HKF.CurrentAmbientLightLevel = directMap(['to'], 'state.lux')
        .services('Light Sensor');
    HKF.SmokeDetected = directMap(['to'], 'state.fire')
        .services('Smoke Sensor');
    HKF.OutletInUse = new Attribute()
        .services('Outlet')
        .needEventMeta('state.power')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'state.power') > 0);
    HKF.LeakDetected = new Attribute()
        .services('Leak Sensor')
        .needEventMeta('state.water')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'state.water') ? 1 : 0);
    HKF.MotionDetected = directMap(['to'], 'state.presence')
        .services('Motion Sensor');
    HKF.ContactSensorState = new Attribute()
        .services('Contact Sensor')
        .needEventMeta((rawEvent, deviceMeta) =>
            dotProp.has(rawEvent, 'state.open') ||
            dotProp.has(rawEvent, 'state.vibration')
        )
        .to((rawEvent, deviceMeta) => {
            if (dotProp.has(rawEvent, 'state.vibration')) {
                return dotProp.get(rawEvent, 'state.vibration') ? 1 : 0;
            }
            if (dotProp.has(rawEvent, 'state.open')) {
                return dotProp.get(rawEvent, 'state.open') ? 1 : 0;
            }
        });
    //#endregion
    //#region ZHAThermostat
    HKF.HeatingThresholdTemperature = new Attribute()
        .services(['Heater Cooler', 'Thermostat'])
        .needDeviceMeta({type: 'ZHAThermostat'})
        .needEventMeta('config.heatsetpoint')
        .to((rawEvent, deviceMeta) =>
            dotProp.get(rawEvent, 'config.heatsetpoint') / 100
        )
        .from((value, allValues, result, deviceMeta) => {
            dotProp.set(result, 'config.heatsetpoint', value * 100);
        });
    HKF.CoolingThresholdTemperature = new Attribute()
        .services(['Heater Cooler', 'Thermostat'])
        .needDeviceMeta({type: 'ZHAThermostat'})
        .needEventMeta('config.coolsetpoint')
        .to((rawEvent, deviceMeta) =>
            dotProp.get(rawEvent, 'config.coolsetpoint') / 100
        )
        .from((value, allValues, result, deviceMeta) => {
            dotProp.set(result, 'config.coolsetpoint', value * 100);
        });
    HKF.TargetTemperature = new Attribute()
        .services('Thermostat')
        .needDeviceMeta({type: 'ZHAThermostat'})
        .needEventMeta((rawEvent, deviceMeta) =>
            dotProp.has(rawEvent, 'config.heatsetpoint') ||
            dotProp.has(rawEvent, 'config.coolsetpoint')
        )
        .to((rawEvent, deviceMeta) => {
            // Device have only a heatsetpoint.
            if (!dotProp.has(rawEvent, 'config.coolsetpoint')) {
                return dotProp.get(rawEvent, 'config.heatsetpoint') / 100;
            }
            // Device have only a coolsetpoint.
            if (!dotProp.has(rawEvent, 'config.heatsetpoint')) {
                return dotProp.get(rawEvent, 'config.coolsetpoint') / 100;
            }
            // Device have heat and cool set points.
            let currentTemp = HKF.CurrentTemperature.toMethod(rawEvent, deviceMeta);
            // It's too cold.
            if (currentTemp <= dotProp.get(rawEvent, 'config.heatsetpoint')) {
                return dotProp.get(rawEvent, 'config.heatsetpoint') / 100;
            }
            // It's too hot.
            if (currentTemp >= dotProp.get(rawEvent, 'config.coolsetpoint')) {
                return dotProp.get(rawEvent, 'config.coolsetpoint') / 100;
            }
            // It's in the range I can't determine what the device is doing.
        })
        .from((value, allValues, result, deviceMeta) => {
            if (!dotProp.has(deviceMeta, 'config.coolsetpoint')) {
                // Device have only a heatsetpoint.
                dotProp.set(result, 'config.heatsetpoint', value * 100);
            } else if (!dotProp.has(deviceMeta, 'config.heatsetpoint')) {
                // Device have only a coolsetpoint.
                dotProp.set(result, 'config.coolsetpoint', value * 100);
            } else {
                // Don't know what to do with that.
            }
        });
    HKF.Active = new Attribute()
        .services('Heater Cooler')
        .needDeviceMeta({type: 'ZHAThermostat'})
        .needEventMeta('state.on')
        .to((rawEvent, deviceMeta) => {
            return dotProp.get(rawEvent, 'state.on') === true ? 1 : 0;
        }).from((value, allValues, result, deviceMeta) => {
            if (value === 1) dotProp.set(result, 'state.on', true);
            if (value === 0) dotProp.set(result, 'state.on', false);
        });
    HKF.CurrentHeatingCoolingState = new Attribute()
        .services('Thermostat')
        .needDeviceMeta({type: 'ZHAThermostat'})
        .needEventMeta('state.on')
        .to((rawEvent, deviceMeta) => {
            if (dotProp.get(rawEvent, 'state.on') === false) return 0; // Off.

            // Device have only a heatsetpoint.
            if (dotProp.has(deviceMeta, 'config.heatsetpoint') &&
                !dotProp.has(deviceMeta, 'config.coolsetpoint')
            ) return 1; // Heat. The Heater is currently on

            // Device have only a coolsetpoint.
            if (dotProp.has(deviceMeta, 'config.coolsetpoint') &&
                !dotProp.has(deviceMeta, 'config.heatsetpoint')
            ) return 2; // Cool. Cooler is currently on

            // Device can heat and cool
            let targetTemp = HKF.TargetTemperature.toMethod(rawEvent, deviceMeta);
            let currentTemp = HKF.CurrentTemperature.toMethod(rawEvent, deviceMeta);
            if (targetTemp === undefined || currentTemp === undefined) return;
            if (currentTemp < targetTemp) return 1; // Heat. The Heater is currently on
            if (currentTemp > targetTemp) return 2; // Cool. Cooler is currently on
        });
    HKF.TargetHeatingCoolingState = new Attribute()
        .services('Thermostat')
        .needDeviceMeta({type: 'ZHAThermostat'})
        .needEventMeta('config.mode')
        .to((rawEvent, deviceMeta) => {
            switch (dotProp.get(rawEvent, 'config.mode')) {
                case 'off':
                case 'sleep':
                case 'fan only':
                case 'dry':
                    return 0; // Off
                case 'heat':
                case 'emergency heating':
                    return 1; // Heat
                case 'cool':
                case 'precooling':
                    return 2; // Cool
                case 'auto':
                    return 3; // Auto
            }
        });
    HKF.LockPhysicalControls = new Attribute()
        .services('Heater Cooler')
        .needDeviceMeta({type: 'ZHAThermostat'})
        .needEventMeta('config.locked')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'config.locked') === true ? 1 : 0)
        .from((value, allValues, result, deviceMeta) => {
            if (value === 0) dotProp.set(result, 'config.locked', false);
            if (value === 1) dotProp.set(result, 'config.locked', true);
        });
    HKF.TemperatureDisplayUnits_Celsius = new Attribute()
        .services(['Heater Cooler', 'Thermostat'])
        .name('TemperatureDisplayUnits')
        .priority(10)
        .needDeviceMeta({type: 'ZHAThermostat'})
        .to((rawEvent, deviceMeta) => 0); // Celsius
    HKF.TemperatureDisplayUnits_Fahrenheit = new Attribute()
        .services(['Heater Cooler', 'Thermostat'])
        .name('TemperatureDisplayUnits')
        .priority(0)
        .needDeviceMeta({type: 'ZHAThermostat'})
        .to((rawEvent, deviceMeta) => 1); // Fahrenheit
    //#endregion
    //#region Lights
    HKF.On = directMap(['to', 'from'], 'state.on')
        .services(['Lightbulb', 'Outlet']);
    HKF.Brightness = new Attribute()
        .services('Lightbulb')
        .needEventMeta('state.bri')
        .to((rawEvent, deviceMeta) => {
            if (dotProp.get(rawEvent, 'state.on') !== true) return;
            let bri = dotProp.get(rawEvent, 'state.bri');
            return Utils.convertRange(bri, [0, 255], [0, 100], true, true);
        })
        .from((value, allValues, result, deviceMeta) => {
            let bri = Utils.convertRange(value, [0, 100], [0, 255], true, true);
            dotProp.set(result, 'state.bri', bri);
            dotProp.set(result, 'state.on', bri > 0);
        });
    HKF.Hue = new Attribute()
        .services('Lightbulb')
        .needEventMeta('state.hue')
        .needColorCapabilities(['hs', 'unknown'])
        .needDeviceMeta({'state.colormode': 'hs'})
        .to((rawEvent, deviceMeta) => {
            if (dotProp.get(rawEvent, 'state.on') !== true) return;
            let hue = dotProp.get(rawEvent, 'state.hue');
            return Utils.convertRange(hue, [0, 65535], [0, 360], true, true);
        })
        .from((value, allValues, result, deviceMeta) => {
            let hue = Utils.convertRange(value, [0, 360], [0, 65535], true, true);
            dotProp.set(result, 'state.hue', hue);
        });
    HKF.Saturation = new Attribute()
        .services('Lightbulb')
        .needEventMeta('state.sat')
        .needColorCapabilities(['hs', 'unknown'])
        .needDeviceMeta({'state.colormode': 'hs'})
        .to((rawEvent, deviceMeta) => {
            if (dotProp.get(rawEvent, 'state.on') !== true) return;
            let sat = dotProp.get(rawEvent, 'state.sat');
            return Utils.convertRange(sat, [0, 255], [0, 100], true, true);
        })
        .from((value, allValues, result) => {
            let sat = Utils.convertRange(value, [0, 100], [0, 255], true, true);
            dotProp.set(result, 'state.sat', sat);
        });
    HKF.ColorTemperature = directMap(['from', 'to'], 'state.ct')
        .services('Lightbulb')
        .needColorCapabilities(['ct', 'unknown'])
        .needDeviceMeta({'state.colormode': 'ct'});
    //#endregion
    //#region Window cover
    HKF.CurrentPosition = new Attribute()
        .services('Window Covering')
        .needEventMeta('state.lift')
        .to((rawEvent, deviceMeta) =>
            Utils.convertRange(dotProp.get(rawEvent, 'state.lift'), [0, 100], [100, 0], true, true)
        );
    HKF.TargetPosition = HKF.CurrentPosition;
    HKF.CurrentHorizontalTiltAngle = new Attribute()
        .services('Window Covering')
        .needEventMeta('state.tilt')
        .to((rawEvent, deviceMeta) =>
            Utils.convertRange(dotProp.get(rawEvent, 'state.tilt'), [0, 100], [-90, 90], true, true)
        );
    HKF.TargetHorizontalTiltAngle = HKF.CurrentHorizontalTiltAngle;
    HKF.CurrentVerticalTiltAngle = HKF.CurrentHorizontalTiltAngle;
    HKF.TargetVerticalTiltAngle = HKF.CurrentHorizontalTiltAngle;
    //#endregion
    //#region Battery
    HKF.BatteryLevel = directMap(['to'], 'config.battery')
        .services('Battery');
    HKF.StatusLowBattery = new Attribute()
        .services('Battery')
        .needEventMeta('config.battery')
        .to((rawEvent, deviceMeta) => dotProp.get(rawEvent, 'config.battery') <= 15 ? 1 : 0);
    //#endregion
    return HKF;
})();

class BaseFormatter {
    constructor(options = {}) {
        this.format = HomeKitFormat;
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

        // Sort properties by name
        const get = (property, key) => HomeKitFormat[property][key] !== undefined ?
            HomeKitFormat[property][key] :
            property;
        const getName = (property) => get(property, '_name');
        const getPriority = (property) => get(property, '_priority');
        this.propertyList.sort((propertyA, propertyB) => {
            const aName = getName(propertyA);
            const bName = getName(propertyB);
            if (aName === bName) {
                const aPriority = getPriority(propertyA);
                const bPriority = getPriority(propertyB);
                return (aPriority === undefined || bPriority === undefined) ? 0 : aPriority - bPriority;
            } else {
                return aName < bName ? -1 : 1;
            }
        });
    }
}

class fromDeconz extends BaseFormatter {

    parse(rawEvent, deviceMeta) {
        let result = {};
        let propertyMap = {};

        for (const property of this.propertyList) {
            const propertyName = HomeKitFormat[property]._name !== undefined ?
                HomeKitFormat[property]._name :
                property;
            if (!HomeKitFormat[property].targetIsValid(rawEvent, deviceMeta)) continue;
            if (HomeKitFormat[property].toMethod === undefined) continue;
            propertyMap[propertyName] = property;
            const resultValue = HomeKitFormat[property].toMethod(rawEvent, deviceMeta);
            if (resultValue !== undefined) result[propertyName] = resultValue;
        }

        // Cleanup invalid attributes
        for (const property of Object.keys(result)) {
            if (!HomeKitFormat[propertyMap[property]].attributeIsValid(result)) {
                delete result[property];
            }
        }

        return result;
    }

    getValidPropertiesList(deviceMeta) {
        let result = [];
        for (const property of this.propertyList) {
            if (!HomeKitFormat[property].targetIsValid(deviceMeta, deviceMeta)) continue;
            if (HomeKitFormat[property].toMethod === undefined) continue;
            result.push(property);
        }

        // Cleanup invalid attributes
        result = result.filter((value) => HomeKitFormat[value].attributeIsValid(result));
        return result;
    }

}

class toDeconz extends BaseFormatter {

    parse(values, allValues, result, deviceMeta) {
        if (result === undefined) result = {};
        for (const [property, value] of Object.entries(values)) {
            if (!this.propertyList.includes(property)) continue;
            if (HomeKitFormat[property].fromMethod === undefined) continue;
            HomeKitFormat[property].fromMethod(value, allValues, result, deviceMeta);
        }

        for (const property of Object.keys(result)) {
            if (result[property] === undefined) {
                delete result[property];
            }
        }

        return result;
    }

}

module.exports = {fromDeconz, toDeconz};
