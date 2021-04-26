/**
 * @typedef {Object} Query
 *
 */

/**
 * @typedef {Object} BaseRule
 * @property {String|undefined} device_type - the device type, can be 'groups', 'lights', 'sensors'.
 * @property {Number|undefined} device_id - the device id.
 * @property {String|undefined} uniqueid - the device uniqueid.
 */

/**
 * @typedef {Object} RuleMatch
 * @property {String} type - need to be 'match' or ommited.
 * @property {String} method - can be `AND` or `OR`. The method value is not case sensitive. The methods `&&` and `||` are also valid.
 * @property {Boolean||Object.<String,String|Number|Boolean|RuleMatch[]|MatchComparaison>} match - list of key - values to check.
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


class Query {

    constructor(query) {

    }

}


module.exports = Query;