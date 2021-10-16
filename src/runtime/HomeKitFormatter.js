const dotProp = require("dot-prop");
const Utils = require("./Utils");

class Format {
    constructor() {
        this.requiredAttribute = [];
        this.requiredEventMeta = [];
        this.requiredDeviceMeta = [];
    }

    needAttribute(attribute) {
        this.requiredAttribute = Utils.sanitizeArray(attribute);
        return this;
    }

    needEventMeta(event) {
        this.requiredEventMeta = Utils.sanitizeArray(event);
        return this;
    }

    needDeviceMeta(meta) {
        this.requiredDeviceMeta = Utils.sanitizeArray(meta);
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
            if (Format._checkProperties(rawEvent, meta) === false) {
                return false;
            }
        }
        for (const meta of this.requiredDeviceMeta) {
            if (Format._checkProperties(deviceMeta, meta) === false) {
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


const HomeKitFormat = {
    ProgrammableSwitchEvent: new Format()
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
        })
        .from((value, result) => {
            let newValue;
            switch (value) {
                case 0: // Short press
                    newValue = 2;
                    break;
                case 1 : // Double press
                    newValue = 4;
                    break;
                case 2 : // Hold Down
                    newValue = 1;
                    break;
            }
            dotProp.set(result, 'state.buttonevent',
                newValue === undefined ?
                    undefined :
                    newValue + dotProp.get(result, 'state.buttonevent', 0)
            );
        }),
    ServiceLabelIndex: new Format()
        .needAttribute('ProgrammableSwitchEvent')
        .needEventMeta('state.buttonevent')
        .to((rawEvent, deviceMeta) =>
            Math.floor(dotProp.get(rawEvent, 'state.buttonevent') / 1000)
        )
        .from((value, result) => {
            dotProp.set(result, 'state.buttonevent',
                value * 1000 + dotProp.get(result, 'state.buttonevent', 0)
            );
        }),
};


class BaseFormatter {
    constructor(options) {
        this.propertyList = Object.keys(HomeKitFormat);

        this.options = Object.assign({
            propertyWhitelist: [],
            propertyBlacklist: [],
        }, options);

        this.options.propertyWhitelist = Utils.sanitizeArray(this.options.propertyWhitelist);
        if (this.options.propertyWhitelist.length > 0) {
            this.propertyList = this.propertyList.filter((property) =>
                this.options.propertyWhitelist.includes(property)
            );
        }

        this.options.propertyBlacklist = Utils.sanitizeArray(this.options.propertyBlacklist);
        if (this.options.propertyBlacklist.length > 0) {
            this.propertyList = this.propertyList.filter((property) =>
                !this.options.propertyBlacklist.includes(property)
            );
        }
    }
}

class fromDeconz extends BaseFormatter {
    parse(rawEvent, deviceMeta) {
        let result = {};
        for (const property of this.propertyList) {
            if (HomeKitFormat[property] === undefined) {
                throw new Error('Got invalid HomeKit format : "' + property + '"');
            }
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
    parse(values) {
        let result = {};
        for (const [property, value] of Object.entries(values)) {
            if (!this.propertyList.includes(property)) continue;
            HomeKitFormat[property].fromMethod(value, result);
        }
        // TODO remove undefined values
        return result;
    }

}

module.exports = {fromDeconz, toDeconz};
