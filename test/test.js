let assert = require('assert');


const SampleQuery = {
    GET_BY_UNIQUE_ID_AND_TYPE: {
        "device_type": "sensors",
        "uniqueid": "00:11:22:33:44:55:66:77-01-1000"
    },
    GET_BY_UNIQUE_ID: {
        "uniqueid": "00:11:22:33:44:55:66:77-01-1000"
    },
    GET_BY_ID: {
        "device_type": "sensors",
        "device_id": 1
    },
    MATCH_LIGHTS: {
        "match": {
            "type": [
                "Color temperature light",
                "Color light"
            ]
        }
    },
    MATCH_SINGLE_LIGHTS_ON: {
        "match": {
            "state.on": true,
            "type": [
                "Color temperature light",
                "Color light"
            ]
        }
    },
    MATCH_MULTIPLE_LIGHTS_ON: [
        {
            "type": "match",
            "match": {
                "type": [
                    "Color temperature light",
                    "Color light"
                ]
            }
        },
        {
            "type": "match",
            "match": {
                "state.on": true
            }
        }
    ]
};


describe('Query', function () {
    describe('Basic format', function () {
        it('foo === foo', function () {
            assert.strictEqual('foo', 'foo');
        });
    });
});