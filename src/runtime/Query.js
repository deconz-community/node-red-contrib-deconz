const dotProp = require('dot-prop');
const compareVersion = require('compare-versions');

const getRuleConstructor = (rule) => {
    if (rule === 'all') return RuleAlways;
    if (rule === 'none') return RuleNever;
    if (typeof rule !== 'object') throw Error("A rule should be an object. Got : " + rule.toString());

    switch (rule.type) {
        case 'basic':
            return RuleBasic;
        case 'match':
            return RuleMatch;
        case 'queries':
            return RuleQueries;
        case undefined:
            // Detect rule type
            if (rule.device_type || rule.device_id || rule.device_path || rule.uniqueid) {
                return RuleBasic;
            } else if (rule.match) {
                return RuleMatch;
            } else if (rule.queries) {
                return RuleQueries;
            }
            return RuleNever;
        default:
            throw Error("Invalid rule type provided. Got : " + rule.toString());
    }
};

const getComparaisonConstructor = (field, value) => {
    switch (typeof value) {
        case "undefined":
        case "boolean":
        case "number":
        case "bigint":
        case "string":
            return ComparaisonStrictEqual;
        case "object":
            if (Array.isArray(value)) {
                return ComparaisonArray;
            } else {
                if (value.type === undefined) {
                    if (value.value !== undefined) value.type = 'complex';
                    if (value.after !== undefined || value.before !== undefined) value.type = 'date';
                    if (value.regex !== undefined) value.type = 'regex';
                    if (value.version !== undefined) value.type = 'version';
                }

                switch (value.type) {
                    case 'complex':
                        return ComparaisonComplex;
                    case 'date':
                        return ComparaisonDate;
                    case 'regex':
                        return ComparaisonRegex;
                    case 'version':
                        return ComparaisonVersion;

                    default:
                        throw Error("Invalid comparaison type provided. Got : " + (typeof value.type).toString());
                }

            }
            break;
        default:
            throw Error("Invalid comparaison type provided. Got : " + (typeof value).toString());
    }
};

class Query {
    constructor(query, depth) {
        this.depth = depth + 1 || 0;
        if (this.depth > 10) {
            throw Error("Query depth limit reached.");
        }
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
        for (const rule of rules) {
            let constructor = getRuleConstructor(rule);
            this.rules.push(new constructor(rule, this.depth));
        }
    }

}


class Rule {

    constructor(options, depth) {
        this.options = Object.assign({}, this.defaultOptions, options);
        this.depth = depth;
        this.comparaisons = [];

        if (this.options.method) {
            switch (this.options.method.toUpperCase()) {
                case 'AND':
                case '&&':
                    this.matchFunction = this.options.inverted === true ? this.matchAndInverted : this.matchAnd;
                    break;
                case 'OR':
                case '||':
                    this.matchFunction = this.options.inverted === true ? this.matchOrInverted : this.matchOr;
                    break;
                default:
                    throw Error(`Invalid match method expected 'AND' or 'OR' and got ${this.options.method}`);
            }
        }

    }

    get defaultOptions() {
        return {};
    }

    match(device) {
        return this.matchFunction(device);
    }

    matchAnd(device) {
        return this.comparaisons.every((key) => {
            return key.match(device);
        });
    }

    matchAndInverted(device) {
        return !this.matchAnd(device);
    }

    matchOr(device) {
        return this.comparaisons.some((key) => {
            return key.match(device);
        });
    }

    matchOrInverted(device) {
        return !this.matchOr(device);
    }

    throw(message) {
        throw Error(message);
    }

}

class RuleNever extends Rule {

    match(device) {
        return this.options.inverted === true;
    }

}

class RuleAlways extends Rule {

    match(device) {
        return this.options.inverted !== true;
    }

}

class RuleBasic extends Rule {

    constructor(options, depth) {
        super(options, depth);
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

class RuleMatch extends Rule {

    constructor(options, depth) {
        super(options, depth);


        this.createComparaisons(options.match);
    }

    get defaultOptions() {
        return {
            inverted: false,
            method: 'AND'
        };
    }

    createComparaisons(comparaisons) {
        if (comparaisons === undefined) throw Error('No match data found');
        for (const [field, value] of Object.entries(comparaisons)) {
            let constructor = getComparaisonConstructor(field, value);
            this.comparaisons.push(new constructor(field, value));
        }
    }

}

class RuleQueries extends Rule {

    constructor(options, depth) {
        super(options, depth);
        this.createComparaisons(options.queries);
    }

    get defaultOptions() {
        return {
            inverted: false,
            method: 'AND'
        };
    }

    createComparaisons(queries) {
        if (queries === undefined) throw Error('No match data found');
        if (!Array.isArray(queries)) queries = [queries];
        for (const query of queries) {
            this.comparaisons.push(new Query(query, this.depth));
        }
    }

}

class Comparaison {
    constructor(field, value) {
        this.field = field;
        this.target = value;
    }

    /**
     * Check if the device match the rule.
     * @abstract
     * @param device
     * @return {boolean}
     */
    match(device) {
        throw new Error('Rule match method called, this should not happen.');
    }
}

class ComparaisonStrictEqual extends Comparaison {
    match(device) {
        return dotProp.get(device, this.field) === this.target;
    }
}

class ComparaisonArray extends Comparaison {
    match(device) {
        return this.target.includes(dotProp.get(device, this.field));
    }
}

class ComparaisonComplex extends Comparaison {

    constructor(field, value) {
        super(field, value);

        if ((value.convertLeft !== undefined || value.convertRight !== undefined) && value.convertTo === undefined) {
            throw Error(`You ask for convertion but do not provide any conversion method.`);
        }

        this.target = Array.isArray(value.value) ? value.value : [value.value];

        if (value.convertTo) {
            let conversionMethod = this.getConvertionMethod(value.convertTo);

            if (value.convertRight === true) {
                this.target = this.target.map(target => target !== undefined ? conversionMethod(target) : target);
            }

            if (value.convertLeft === true) {
                this.conversionMethod = conversionMethod;
            }
        }

        if (value.strict === true) {
            this.strictCompareTo = this.target.map(target => typeof target);
            this.matchMethod = this.strictMatch;
        } else {
            this.matchMethod = this.notStrictMatch;
        }

        this.operator = this.getOperatorMethod(value.operator);
    }

    getConvertionMethod(target) {
        if (target && typeof target === 'string') {
            switch (target.toLowerCase()) {
                case 'boolean':
                    return Boolean;
                case 'number':
                    return Number;
                case 'string':
                    return String;
                case 'date':
                    return Date.parse;
            }
        }
    }

    getOperatorMethod(operator) {
        switch (operator) {
            case '===':
            case undefined:
                return (a, b) => a === b;
            case '!==':
                return (a, b) => a !== b;
            case '==':
                // noinspection EqualityComparisonWithCoercionJS
                return (a, b) => a == b;
            case '!=':
                // noinspection EqualityComparisonWithCoercionJS
                return (a, b) => a != b;
            case '>':
                return (a, b) => a > b;
            case '>=':
                return (a, b) => a >= b;
            case '<':
                return (a, b) => a < b;
            case '<=':
                return (a, b) => a <= b;
            default:
                throw Error(`Invalid operator, got ${operator}`);
        }
    }

    strictMatch(value) {
        return this.target.some((target, index) => {
            if (this.strictCompareTo[index] !== undefined && this.strictCompareTo[index] !== typeof value) return false;
            return this.operator(value, target);
        });
    }

    notStrictMatch(value) {
        return this.target.some((target) => {
            return this.operator(value, target);
        });
    }

    match(device) {
        let value = dotProp.get(device, this.field);
        if (this.conversionMethod !== undefined) value = this.conversionMethod(value);
        return this.matchMethod(value);
    }

}

class ComparaisonDate extends Comparaison {

    constructor(field, value) {
        super(field, value);
        for (const side of ['before', 'after']) {
            switch (typeof value[side]) {
                case 'string':
                    let result = Date.parse(value[side]);
                    if (Number.isNaN(result)) {
                        throw Error(`Invalid value provided for date comparaison, can't parse '${typeof value[side]}'`);
                    } else {
                        this[side] = result;
                        this.valid = true;
                    }
                    break;
                case 'number':
                    this[side] = value[side];
                    this.valid = true;
                    break;
                case 'undefined':
                    break;
                default:
                    throw Error(`Invalid value type provided for date comparaison, got '${typeof value[side]}' and expect 'string' or 'number'`);
            }
        }

    }

    match(device) {
        if (this.valid !== true) return false;
        let value = dotProp.get(device, this.field);
        if (value === undefined) return false;
        if (typeof value === 'string') value = Date.parse(value);
        return !(
            Number.isNaN(value) ||
            this.after !== undefined && value < this.after ||
            this.before !== undefined && value > this.before
        );
    }
}

class ComparaisonRegex extends Comparaison {

    constructor(field, value) {
        super(field, value);
        if (typeof value.regex !== 'string') return;
        this.patt = new RegExp(value.regex, value.flag);
    }

    match(device) {
        if (this.patt === undefined) return false;
        this.patt.lastIndex = 0;
        return this.patt.test(dotProp.get(device, this.field));
    }
}

class ComparaisonVersion extends Comparaison {

    constructor(field, value) {
        super(field, value);

        this.version = compareVersion.validate(value.version) ? value.version : undefined;
        switch (value.operator) {
            case "===":
            case "==":
                this.operator = "=";
                break;
            case "!==":
            case "!=":
                this.operator = "!=";
                break;
            case undefined:
                this.operator = '>=';
                break;
            default:
                this.operator = value.operator;
                break;
        }
    }

    match(device) {
        let value = String(dotProp.get(device, this.field));
        if (this.version === undefined || compareVersion.validate(value) === false) return false;
        if (this.operator === '!=') return value !== this.version;
        return compareVersion.compare(value, this.version, this.operator);
    }

}

module.exports = Query;