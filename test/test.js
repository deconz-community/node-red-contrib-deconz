let should = require("should");

const DevicesSample = require('./DevicesSample');
const DeviceList = require('../src/runtime/DeviceList');

const QueryParams = {
    includeNotMatched: true,
    extractValue: 'etag'
};

const SampleQuery = {
    GET_BY_UNIQUE_ID_AND_TYPE: {
        "device_type": "lights",
        "uniqueid": "00:11:22:33:44:55:66:77-01"
    },
    GET_BY_UNIQUE_ID: {
        "uniqueid": "00:11:22:33:44:55:66:77-01"
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


describe('Device List', function () {
    let deviceList;

    beforeEach('Parse without error', function () {
        deviceList = new DeviceList();
        should.doesNotThrow(() => deviceList.parse(DevicesSample));
    });

    afterEach(function () {
        deviceList = undefined;
    });

    describe('Get by unique ID', function () {
        it('Group', function () {
            let result = deviceList.getDeviceByUniqueID('33:44:55:66:77:88:99:00');
            should(result).have.property('etag', 'item01');
        });

        it('Light', function () {
            let result = deviceList.getDeviceByUniqueID('00:11:22:33:44:55:66:77-01');
            should(result).have.property('etag', 'item03');
        });

        it('Sensor', function () {
            let result = deviceList.getDeviceByUniqueID('44:55:66:77:88:99:00:11-01-0101');
            should(result).have.property('etag', 'item06');
        });

        it(`Not existing`, function () {
            let result = deviceList.getDeviceByUniqueID('NOT_EXISTING');
            should(result).be.undefined();
        });
    });

    describe('Get by path', function () {
        it('Group', function () {
            let result = deviceList.getDeviceByPath('groups/device_id/1');
            should(result).have.property('etag', 'item01');
        });

        it('Light with unique ID', function () {
            let result = deviceList.getDeviceByPath('lights/uniqueid/00:11:22:33:44:55:66:77-01');
            should(result).have.property('etag', 'item03');
        });

        it('Light with ID', function () {
            let result = deviceList.getDeviceByPath('lights/device_id/1');
            should(result).have.property('etag', 'item03');
        });

        it('Sensor', function () {
            let result = deviceList.getDeviceByPath('sensors/uniqueid/44:55:66:77:88:99:00:11-01-0101');
            should(result).have.property('etag', 'item06');
        });

        it(`Not existing`, function () {
            let result = deviceList.getDeviceByPath('NOT_EXISTING');
            should(result).be.undefined();
        });
    });

    describe('Queries', function () {

        describe('Create Query', function () {
            it('Path with unique ID', function () {
                let device = deviceList.getDeviceByPath('groups/device_id/1');
                should(device).have.property('etag', 'item01');
                should(deviceList.createQuery(device)).have.property('device_path', 'groups/uniqueid/33:44:55:66:77:88:99:00');
            });

            it('Path with device ID', function () {
                let device = deviceList.getDeviceByPath('groups/device_id/2');
                should(device).have.property('etag', 'item02');
                should(deviceList.createQuery(device)).have.property('device_path', 'groups/device_id/2');
            });

        });

        describe('Never Rule', function () {

            it('Should not return any device', function () {
                let result = deviceList.getDevicesByQuery({}, QueryParams);
                should(result).have.property('matched');
                result.matched.should.eql([]);
            });

        });

        describe('Always Rule', function () {
            it('Should return all devices', function () {
                let result = deviceList.getDevicesByQuery('all', QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.eql([]);
            });
        });

        describe('Invalid Rule', function () {
            it('Invalid query data type', function () {
                should.throws(() => {
                    let result = deviceList.getDevicesByQuery(42, QueryParams);
                });
            });

            it('Invalid query type value', function () {
                should.throws(() => {
                    let result = deviceList.getDevicesByQuery({"type": "DOES_NOT_EXIST"}, QueryParams);
                });
            });

        });

        describe('Query Basic Rule', function () {
            describe('Without rule type detection', function () {
                it('Get sensor with uniqueid and type', function () {
                    let result = deviceList.getDevicesByQuery({
                        "type": "basic",
                        "device_type": "lights",
                        "uniqueid": "00:11:22:33:44:55:66:77-01"
                    }, QueryParams);
                    should(result).have.property('matched');
                    result.matched.should.eql(['item03']);
                });

                it('Get sensor with uniqueid and type', function () {
                    let result = deviceList.getDevicesByQuery({
                        "type": "basic",
                        "uniqueid": "00:11:22:33:44:55:66:77-01"
                    }, QueryParams);
                    should(result).have.property('matched');
                    result.matched.should.eql(['item03']);
                });

                it('No result if only type provided', function () {
                    should.throws(() => {
                        let result = deviceList.getDevicesByQuery({
                            "type": "basic"
                        }, QueryParams);
                    });
                });

            });

            describe('With rule type detection', function () {
                it('Get sensor with uniqueid and type', function () {
                    let result = deviceList.getDevicesByQuery({
                        "device_type": "lights",
                        "uniqueid": "00:11:22:33:44:55:66:77-01"
                    }, QueryParams);
                    should(result).have.property('matched');
                    result.matched.should.eql(['item03']);
                });

                it('Get sensor with uniqueid and type', function () {
                    let result = deviceList.getDevicesByQuery({
                        "uniqueid": "00:11:22:33:44:55:66:77-01"
                    }, QueryParams);
                    should(result).have.property('matched');
                    result.matched.should.eql(['item03']);
                });

            });

        });
    });

});
