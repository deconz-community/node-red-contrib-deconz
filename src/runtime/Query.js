/**
 * @typedef {Object} Query
 *
 */

/**
 * @typedef {Object} MatchComparaison
 * @property {String} type - can be 'complex', 'date', 'regex', 'version'
 */

/**
 * @typedef {Object} MatchComparaisonDate
 * @template MatchComparaison
 * @property {String} after - any value supported by Date.parse.
 * @property {String} before - any value supported by Date.parse.
 */

/**
 * @typedef {Object} MatchComparaisonComplex
 * @template MatchComparaison
 * @property {String} convertTo - can be 'boolean', 'number', 'bigint', 'float', 'string', 'date', 'version'.
 * @property {Boolean|undefined} convertLeft - Convert device value. Default : true.
 * @property {Boolean|undefined} convertRight - Convert query value. Default : true.
 * @property {String} operator - can be '===', '!==', '==', '!=', '>', '>=', '<', '<='.
 * @property {String|Number|Boolean} value - a value to compare to.
 */

/**
 * @typedef {Object} MatchComparaisonRegex
 * @template MatchComparaison
 * @property {String} regex - any value accepted by RegExp constructor as first argument.
 * @property {String|undefined} flag - any value accepted by RegExp constructor as second argument. By default 'g'
 */

/**
 * @typedef {Object} MatchComparaisonVersion
 * @template MatchComparaison
 * @property {String} operator - can be '===', '!==', '==', '!=', '>', '>=', '<', '<='.
 * @property {String} version - any semver value.
 */


const getRuleConstructor = (rule) => {
    if (rule === 'all') return RuleAlways;
    if (typeof rule !== 'object') throw Error("A rule should be an object. Got : " + rule.toString());

    switch (rule.type) {
        case 'basic':
            return RuleBasic;
        case 'match':
            return RuleMatch;
        case undefined:
            // Detect rule type
            if (rule.device_type || rule.device_id || rule.device_path || rule.uniqueid) {
                return RuleBasic;
            } else if (rule.match) {
                return RuleMatch;
            }
            return RuleNever;
        default:
            throw Error("Invalid rule type provided. Got : " + rule.toString());
    }
};

class Query {

    constructor(query) {
        // Make sure that the query is an array
        if (Array.isArray(query)) this.query = query;
        else this.query = [query];

        // Create rule
        this.createRules(this.query);
    }

    match(device) {
        return this.rules.every((rule) => rule.match(device));
    }

    createRules(rules) {
        this.rules = [];
        try {
            for (const rule of rules) {
                let constructor = getRuleConstructor(rule);
                this.rules.push(new constructor(rule));
            }
        } catch (e) {
            throw Error(e.toString() + '\nQuery: ' + JSON.stringify(this.query));
        }

    }

}


class Rule {

    constructor(options) {
        this.options = options;
    }

    /**
     * Check if the device match the rule.
     * @abstract
     * @param device
     * @return {boolean}
     */
    match(device) {
        throw new Error('must be implemented by subclass!');
    }

    throw(message) {
        throw Error(message);
    }

}


class RuleNever extends Rule {
    match(device) {
        return false;
    }
}

class RuleAlways extends Rule {
    match(device) {
        return true;
    }
}

/**
 * @typedef {Object} BaseRule
 * @property {String|undefined} device_type - the device type, can be 'groups', 'lights', 'sensors'.
 * @property {Number|undefined} device_id - the device id.
 * @property {String|undefined} uniqueid - the device uniqueid.
 */

class RuleBasic extends Rule {
    constructor(options) {
        super(options);
        let acceptedKeys = [
            'device_type',
            'device_id',
            'device_path',
            'uniqueid'
        ];

        this.keys = Object.keys(this.options).filter((key) => {
            return acceptedKeys.includes(key);
        });

        if (this.keys.length === 0) {
            this.throw(`Invalid query, the Basic rule expect at least one of the values ${acceptedKeys.join(',')}.`);
        }

    }

    match(device) {
        return this.keys.every((key) => {
            return (key === 'type') || this.options[key] === device[key];
        });
    }
}


/**
 * @typedef {Object} RuleMatch
 * @property {String} type - need to be 'match' or ommited.
 * @property {String} method - can be `AND` or `OR`. The method value is not case sensitive. The methods `&&` and `||` are also valid.
 * @property {Boolean||Object.<String,String|Number|Boolean|RuleMatch[]|MatchComparaison>} match - list of key - values to check.
 */


class RuleMatch extends Rule {
    constructor(options) {
        super(options);


    }

    match(device) {
        return false;
    }
}

module.exports = Query;