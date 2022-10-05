# Device queries

In the nodes you can set a json object or msg object to dynamically select devices.

You need to understand the `JSON` format before using queries. A [Json Array](https://www.javatpoint.com/json-array) is
not [Json Object](https://www.javatpoint.com/json-object).

A query is made of one or more rule.  
The root condition of query is `AND`, they need to match all rules of the query.

## Rules

A rule have always a `type`. The possibles values are `basic`, `match`. If the `type` is ommited, and will be detected
in this order:

- If a `device_type`, `device_id`, `device_path` or `uniqueid` value is present it's a `basic` rule.
- If a `match` value is present it's a `match` rule.

If you want to set more than one rule you need to put them in an array. A device need to match all rules to be valid. If
you want `OR` condition check [Sub Match](#sub-match).

```json
[
  {
    "type": "match",
    "match": {
      "type": "Color light"
    }
  },
  {
    "type": "match",
    "match": {
      "state.on": true
    }
  }
]
```

### Basic rule

In basic rule you can only use `device_type`, `device_id`, `device_path`, `uniqueid` to filter devices. They are faster
than advanced queries.

#### Get by unique id

To match this rule the device need to be a `sensors` and have his uniqueid set to `00:11:22:33:44:55:66:77-01-1000`.

```json
{
  "type": "basic",
  "device_type": "sensors",
  "uniqueid": "00:11:22:33:44:55:66:77-01-1000"
}
```

The `device_type` can be omitted but in rare cases there can be multiple devices with the same `uniqueid`.
See [#77](https://github.com/deconz-community/node-red-contrib-deconz/issues/77).

```json
{
  "uniqueid": "00:11:22:33:44:55:66:77-01-1000"
}
```

#### Get by id

To match this rule the device, need to be a `sensors` and have his id set to 1. This is not recommended because the id
can change.

```json
{
  "device_type": "sensors",
  "device_id": 1
}
```

#### Get by path

To match this rule the device, need to be a `sensors` and have his id set to 1. This is not recommended because the id
can change.

```json
{
  "device_path": "sensors/device_id/1"
}
```

To match this rule the device need to be a `sensors` and have his uniqueid set to `00:11:22:33:44:55:66:77-01-1000`.

```json
{
  "device_path": "sensors/uniqueid/00:11:22:33:44:55:66:77-01-1000"
}
```

#### Other params

For all other params you need to use an advanced query.

## Advanced rules

An advanced rule is made of one or more comparaison.

```json
{
  "type": "match",
  "match": {
    "type": "Color light"
  }
}
```

A field name can have a dot notation to go deeper inside data like `state.on`. If the key contain the dot character you
need to escape it like this : `name\\.lastname`. Currently you can do deeper inside an array but that
my [change](/sindresorhus/dot-prop/pull/82) later.

### Rules

#### Match rule

See also [Sub Match](#sub-match).

- `type` is `match`.
- `inverted` can be `true` or `false` the result of the rule will be inverted.
- `method` can be `AND` or `OR`. The method value is not case sensitive.
  - The methods `&&` and `||` are also valid.
  - The rule need to match all (`AND`) the condition listed in `match` or at least one (`OR`).
  - By default, the method is `AND`.
- `match` rule is a object of key-value rules to match the device data.
  - A value can be a `boolean`, `number` or `string`.
  - If the value is an array the value need to be strictly equal to one of the value. Theses values can only
    be `boolean`, `number` or `string`.
  - It the value is an object it's a [Complex comparaison](#complex-comparaison).

##### Note about match object

- The key can be a path like `state.on`.
- The value need to
  be [Strict equality](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality) to
  be able to match.
- If the value is an array the device value needs to be equal to at least one of the values.
- The value can be an array of mixed types of `boolean`, `number`, `string` or `object`
  for [Complex comparaison](#complex-comparaison).
- If `match` is equal to `true` all device will be matched.
- If `match` is equal to `false` or `undefined` none device will be matched.

##### Base format

```json
{
  "match": {
    "state.on": true,
    "state.alert": "none",
    "mode": 3,
    "type": ["Color temperature light", "Color light"]
  }
}
```

Same query with all options;

```json
{
  "type": "match",
  "method": "AND",
  "match": {
    "state.on": true,
    "state.alert": "none",
    "mode": 3,
    "type": ["Color temperature light", "Color light"]
  }
}
```

##### Object comparaison

You can set a more advanced comparaison using an object.

For all object comparaison the `type` can be ommited, and will be detected in this order:

- If a `value` value is present it's a `complex` comparaison.
- If a `after` or `before` value is present it's a `date` comparaison.
- If a `regex` value is present it's a `regex` comparaison.
- If a `version` value is present it's a `version` comparaison.

For example if you set a `regex` and `version` values, only the `regex` will be used.  
In case you want to set multiple comparaison on the same value define an array of objects.

###### Complex comparaison

In case strict compare is not for you, you can define more customizable comparaison.

- `type` always `complex`.
- `convertTo` a value type to convert the value, can be `boolean`, `number`, `string`, `date`. By default do not
  convert.
- `convertLeft` boolean, if you want to convert the device value. By default : true.
- `convertRight` boolean, if you want to convert the query value. By default : false.
- `operator` the operator, can be `===`, `!==`, `==`, `!=`, `>`, `>=`, `<`, `<=`. By default : `==`.
- `strict` do the comparaison is strict, if yes the value types need be the same, can be `true` or `false`. By
  default : `false`.
- `value` a value to compare to, can be `boolean`, `number`, `string`, `date`. It's can also be an `array` of values,
  see notes.

The comparaison is done in the order `device` `operator` `value`. Ex : `ctmax > 65000`;

###### Notes

- The `convertTo` will used on left side by default. Check `convertLeft` and `convertRight`.
- The `convertTo` `date` will use the method Date.parse.
- Try avoiding the operator `==` and `!=` because this may cause
  unexpected [type coercion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness).
- The `operator` `===` and `!==` are always strict.
- If the value is an array, each element of the array will converted and tested. To be matched the comparaisons need to
  be `true` at least one time.

```json
{
  "match": {
    "type": "Color temperature light",
    "ctmax": {
      "convertTo": "number",
      "convertRight": true,
      "operator": ">",
      "value": "65000"
    }
  }
}
```

###### Date comparaison

You can define a special comparaison that compare only dates.

- `type` always `date`.
- `after` the device value should be after or equal to the date set.
- `before` the device value should be before or equal to the date set.

###### Notes

- One of the two date options can be omitted.
- If booth settings set, he need to match all.
- If none valid, he return always false.
- The value can be anything supported by [Date.parse](https://www.w3schools.com/jsref/jsref_parse.asp) or a
  valid [Unix timestamp](https://en.wikipedia.org/wiki/Unix_time)\*1000. It's a number representing the milliseconds
  elapsed since January 1, 1970, 00:00:00 UTC. It's also can be a value of type `timestamp` from an node-red's input
  node.
- If the value is set to undefined it's will be ignored.

```json
{
  "match": {
    "state.lastupdated": {
      "type": "date",
      "after": "1969-07-21T02:56Z",
      "before": "1972-12-14T12:00Z"
    }
  }
}
```

Or with JSONata expression: Ex not updated in the last hour.

```jsonata
{
    "match":{
        "state.lastupdated":{
            "type":"date",
            "before":$millis()-60*60*1000
        }
    }
}
```

###### Regex comparaison

The regex will be compared to the device value with [match](https://www.w3schools.com/jsref/jsref_match.asp) method.

- `type` always `regex`.
- `regex` can be any value accepted
  by [RegExp constructor](https://www.w3schools.com/jsref/jsref_regexp_constructor.asp).
  - A `regex` needs to be a `string` otherwise it's will never match.
  - If the value is empty (`""`) it's will always match.
  - Don't forget to put `^` and `$` if you want to match the complete value.
- `flag` will be the second argument
  of [RegExp constructor](https://www.w3schools.com/jsref/jsref_regexp_constructor.asp). By default 'g'.

```json
{
  "match": {
    "state.on": false,
    "modelid": {
      "type": "regex",
      "regex": "^(.*)bulb E27(.*)$",
      "flag": "g"
    }
  }
}
```

###### Version comparaison

You can define a special comparaison that compare only [semver](https://semver.org/) versions.  
This method will use the method [compare-versions](https://www.npmjs.com/package/compare-versions).

- `type` always `version`.
- `operator` the operator, can be `===`, `!==`, `==`, `!=`, `>`, `>=`, `<`, `<=`. By default : '>='.
- `version` a [semver](https://semver.org/) version to compare to.

##### Notes

- If the version is not valid it's will always return false;
- Be carefull with big integer version like `123456` because it's superior to `2.0.0`.

Example : get all device with `swversion` superior or equal to 2.0.0

```json
{
  "match": {
    "type": "Color temperature light",
    "swversion": {
      "type": "version",
      "operator": ">=",
      "version": "2.0.0"
    }
  }
}
```

###### Array comparaison

For now you can't make query on devices values that is array like `devicemembership`.
See [#172](https://github.com/deconz-community/node-red-contrib-deconz/discussions/172).

##### Sub Match

In case you want to do more rules inside a rule you can use an array to define a list of rules instead of a pair key
value to check.  
To avoid infinite loops the depth is limited to 10 and will not match any devices if he reaches this limit.

```json
{
  "method": "OR",
  "match": [
    {
      "method": "OR",
      "match": {
        "state.on": true,
        "colorcapabilities": 0
      }
    },
    {
      "match": {
        "type": "Color temperature light",
        "swversion": "2.0.029"
      }
    }
  ]
}
```

This will result to this code in javascript.

```javascript
let result =
  device.state.on === true ||
  device.colorcapabilities === 0 ||
  (device.type === "Color temperature light" && device.swversion === "2.0.029");
```

:warning: You cannot mix rules and pair key-value inside the same match definition. It's also not a valid json format.

<!-- @formatter:off -->

```json
{
  "method": "OR",
  "match": [
    "hascolor": true,
    {
      "match": {
        "type": "Color temperature light",
        "colorcapabilities": 8
      }
    }
  ]
}
```

<!-- @formatter:on -->

## Special cases

### Empty queries

Theses query will not match any devices.

```json
{}
```

```json
{
  "match": false
}
```

### All device query

This query will match all devices.

```json
{
  "match": true
}
```
