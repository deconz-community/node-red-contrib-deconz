let should = require("should");

const DevicesSample = require('./DevicesSample');
const DeviceList = require('../src/runtime/DeviceList');
const ConfigMigration = require("../src/migration/ConfigMigration");
const HomeKitFormatter = require("../src/runtime/HomeKitFormatter");

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
                let result = deviceList.getDevicesByQuery({
                    "match": false
                }, QueryParams);
                should(result).have.property('matched');
                result.matched.should.be.empty();
            });

            it('Should not return any device', function () {
                let result = deviceList.getDevicesByQuery({}, QueryParams);
                should(result).have.property('matched');
                result.matched.should.be.empty();
            });

            it('match false inverted', function () {
                let result = deviceList.getDevicesByQuery({
                    match: false,
                    inverted: true
                }, QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.be.empty();
            });

            it('empty inverted', function () {
                let result = deviceList.getDevicesByQuery({
                    inverted: true
                }, QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.be.empty();
            });

        });

        describe('Always Rule', function () {
            it('Should return all devices', function () {
                let result = deviceList.getDevicesByQuery('all', QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.be.empty();
            });

            it('Should return all devices', function () {
                let result = deviceList.getDevicesByQuery({
                    "match": true
                }, QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.be.empty();
            });

            it('match true inverted', function () {
                let result = deviceList.getDevicesByQuery({
                    match: true,
                    inverted: true
                }, QueryParams);
                should(result).have.property('matched');
                result.matched.should.be.empty();
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

        describe('Basic Rule', function () {
            describe('Without rule type detection', function () {
                it('Get sensor with uniqueid and type', function () {
                    let result = deviceList.getDevicesByQuery({
                        "type": "basic",
                        "device_type": "lights",
                        "uniqueid": "00:11:22:33:44:55:66:77-01"
                    }, QueryParams);
                    should(result).have.property('matched');
                    result.matched.should.containDeep(['item03']);
                });

                it('Get sensor with uniqueid and type', function () {
                    let result = deviceList.getDevicesByQuery({
                        "type": "basic",
                        "uniqueid": "00:11:22:33:44:55:66:77-01"
                    }, QueryParams);
                    should(result).have.property('matched');
                    result.matched.should.containDeep(['item03']);
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
                    result.matched.should.containDeep(['item03']);
                });

                it('Get sensor with uniqueid and type', function () {
                    let result = deviceList.getDevicesByQuery({
                        "uniqueid": "00:11:22:33:44:55:66:77-01"
                    }, QueryParams);
                    should(result).have.property('matched');
                    result.matched.should.containDeep(['item03']);
                });

            });

        });

        describe('Match Rule', function () {
            describe('Without rule type detection', function () {
                describe('match by value', function () {
                    it('String', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "type": "Color light"
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03', 'item04']);
                    });

                    it('Number', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "colorcapabilities": 8
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05']);
                    });

                    it('Boolean', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "hascolor": false
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03', 'item09']);
                    });

                    it('Dot notation', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "state.on": true
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05']);
                    });

                });

                describe('match by array', function () {
                    it('Array String', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "modelid": ['vibration', 'on/off switch']
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item06', 'item07']);
                    });

                    it('Array with incorect types', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "hascolor": ['true', 'false']
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.be.empty();
                    });

                    it('Array with valid types', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "hascolor": [true, false]
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03', 'item04', 'item05', 'item09']);
                    });

                    it('All in one', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "hascolor": [true, false],
                                "manufacturername": "Homestead",
                                "state.reachable": true,
                                "colorcapabilities": 8
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05']);
                    });

                    it('match inverted by value', function () {
                        let resultA = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "type": "Color light"
                            }
                        }, QueryParams);
                        let resultB = deviceList.getDevicesByQuery({
                            "type": "match",
                            "inverted": true,
                            "match": {
                                "type": "Color light"
                            }
                        }, QueryParams);
                        should(resultA).have.property('matched');
                        should(resultA).have.property('rejected');
                        should(resultB).have.property('matched');
                        should(resultB).have.property('rejected');
                        resultA.matched.should.containDeep(['item03', 'item04']);
                        resultA.matched.should.containDeep(resultB.rejected);
                        resultB.matched.should.containDeep(resultA.rejected);
                    });

                });

                describe('Complex comparaison', function () {
                    it('Convert query value', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "state.bri": {
                                    "convertTo": "number",
                                    "convertRight": true,
                                    "operator": ">",
                                    "value": "80"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05']);
                    });

                    it('Convert query value by default', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "state.bri": {
                                    "convertTo": "number",
                                    "operator": ">",
                                    "value": "80"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05']);
                    });

                    it(`Don't convert query value by default with strict compare and bad type`, function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "state.bri": {
                                    "convertTo": "number",
                                    "convertRight": false,
                                    "strict": true,
                                    "operator": ">",
                                    "value": "80"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.be.empty();
                    });

                    it(`Don't convert query value by default with strict compare and good type`, function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "state.bri": {
                                    "convertTo": "number",
                                    "convertRight": false,
                                    "strict": true,
                                    "operator": ">",
                                    "value": 80
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05']);
                    });

                    it(`Don't convert query value by default without strict compare`, function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "state.bri": {
                                    "convertTo": "number",
                                    "convertRight": false,
                                    "operator": ">",
                                    "value": "80"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05']);
                    });


                    it('Convert device value', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "anumberinstring": {
                                    "convertTo": "number",
                                    "convertLeft": true,
                                    "convertRight": true,
                                    "operator": "===",
                                    "value": "130"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04']);
                    });

                    it('Convert device value in array', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "anumberinstring": {
                                    "convertTo": "number",
                                    "convertLeft": true,
                                    "convertRight": true,
                                    "operator": "===",
                                    "value": ["130", "50"]
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03', 'item04']);
                    });

                    //TODO Find when device have array value ex devicemembership
                });

                describe('Date comparaison', function () {
                    it('after date', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "lastseen": {
                                    "type": "date",
                                    "after": "2021-04-29T00:00Z"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item05', 'item06', 'item07', 'item09']);
                    });

                    it('after timestamp', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "lastseen": {
                                    "type": "date",
                                    "after": 1619654400000 // "2021-04-29T00:00Z"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item05', 'item06', 'item07', 'item09']);
                    });

                    it('before date', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "lastseen": {
                                    "type": "date",
                                    "before": "2021-04-29T00:00Z"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03', 'item04', 'item08']);
                    });

                    it('before timestamp', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "lastseen": {
                                    "type": "date",
                                    "before": 1619654400000 // "2021-04-29T00:00Z"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03', 'item04', 'item08']);
                    });

                    it('between date', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "lastseen": {
                                    "type": "date",
                                    "after": "2021-04-28T00:00Z",
                                    "before": "2021-04-30T00:00Z"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05', 'item09']);
                    });

                    it('between timestamp', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "lastseen": {
                                    "type": "date",
                                    "after": 1619568000000, // "2021-04-28T00:00Z"
                                    "before": 1619740800000 // "2021-04-30T00:00Z"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05', 'item09']);
                    });

                    it('between timestamp inverted', function () {
                        let result = deviceList.getDevicesByQuery({
                            "inverted": true,
                            "match": {
                                "lastseen": {
                                    "type": "date",
                                    "after": 1619568000000, // "2021-04-28T00:00Z"
                                    "before": 1619740800000 // "2021-04-30T00:00Z"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('rejected');
                        result.rejected.should.containDeep(['item04', 'item05', 'item09']);
                    });

                });

                describe('Regex comparaison', function () {
                    it('global match', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "modelid": {
                                    "type": "regex",
                                    "regex": "^(.*)bulb E27(.*)$",
                                    "flag": "g"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03', 'item04']);
                    });

                    it('contain match', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "modelid": {
                                    "regex": "bulb E27"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03', 'item04']);
                    });

                    it('contain match inverted', function () {
                        let result = deviceList.getDevicesByQuery({
                            "inverted": true,
                            "match": {
                                "modelid": {
                                    "regex": "bulb E27"
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('rejected');
                        result.rejected.should.containDeep(['item03', 'item04']);
                    });

                });

                describe('Version comparaison', function () {
                    it('after', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "swversion": {
                                    "type": "version",
                                    "operator": ">=",
                                    "version": "2.0.0",
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item04', 'item05', 'item06', 'item07', 'item09']);
                    });

                    it('before', function () {
                        let result = deviceList.getDevicesByQuery({
                            "match": {
                                "swversion": {
                                    "type": "version",
                                    "operator": "<=",
                                    "version": "2.0.0",
                                }
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item03']);
                    });

                });

                describe('Sub queries', function () {
                    it('1 level', function () {
                        let result = deviceList.getDevicesByQuery({
                            "method": "OR",
                            "queries": [
                                {
                                    "match": {
                                        "type": ["ZHASwitch", "ZHAConsumption"] // item07 and item08
                                    }
                                },
                                {
                                    "match": {
                                        "type": "Color temperature light", // item05
                                        "swversion": "3.2.1" // item04 and item05
                                    }
                                }
                            ]
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item05', 'item07', 'item08']);
                    });

                    it('2 levels', function () {
                        let result = deviceList.getDevicesByQuery({
                            "method": "OR",
                            "queries": [
                                {
                                    "method": "OR",
                                    "queries": [
                                        {
                                            "match": {
                                                "type": "ZHASwitch" // item07
                                            }
                                        },
                                        {
                                            "match": {
                                                "type": "ZHAConsumption" // item08
                                            }
                                        }
                                    ]
                                },
                                {
                                    "match": {
                                        "type": "Color temperature light", // item05
                                        "swversion": "3.2.1" // item04 and item05
                                    }
                                }
                            ]
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.containDeep(['item05', 'item07', 'item08']);
                    });

                    it('too many levels', function () {
                        try {
                            let query = {"match": {"type": "ZHASwitch"}};
                            for (let i = 0; i < 20; i++) {
                                query = {
                                    "method": "AND",
                                    "queries": [query]
                                };
                            }
                            deviceList.getDevicesByQuery(query, QueryParams);
                        } catch (e) {
                            should(e).have.property('message', "Query depth limit reached.");
                        }
                    });

                });

            });

        });

    });

    describe('Configuration Migration', function () {
        let server;
        beforeEach('Parse without error', function () {
            server = {device_list: deviceList};
        });

        afterEach(function () {
            deviceList = undefined;
        });

        describe('Input Node', function () {
            it('Switch with buttonevent state', function () {
                let node = {
                    config: {
                        type: "deconz-input",
                        name: "",
                        server: "SERVER_ID",
                        device: "55:66:77:88:99:00:11:22-01-1000",
                        device_name: "Swith 1 : ZHASwitch",
                        topic: "",
                        state: "buttonevent",
                        output: "always",
                        outputAtStartup: false,
                    }
                };
                let migrationResult;

                should.doesNotThrow(() => {
                    let configMigration = new ConfigMigration(node.config.type, node.config, server);
                    migrationResult = configMigration.applyMigration(node.config, node);
                });

                should(migrationResult.new.search_type).equal('device');
                should(migrationResult.new.query).equal('{}');
                should(migrationResult.new.device_list).containDeep(['sensors/uniqueid/55:66:77:88:99:00:11:22-01-1000']);
                should(migrationResult.new.outputs).equal(2);
                should(migrationResult.new.output_rules).containDeep([
                    {
                        format: 'single',
                        type: 'state',
                        payload: ['buttonevent'],
                        output: 'always',
                        onstart: false
                    },
                    {
                        type: 'homekit',
                        onstart: true,
                        onerror: true
                    }
                ]);
                should(migrationResult.new.config_version).equal(1);
                should(migrationResult.delete).containDeep(['device', 'state', 'output', 'outputAtStartup']);
                should(migrationResult.errors).have.length(0);
            });

            it('Vibration sensor with full payload and on start', function () {
                let node = {
                    config: {
                        type: "deconz-input",
                        name: "",
                        server: "SERVER_ID",
                        device: "44:55:66:77:88:99:00:11-01-0101",
                        device_name: "Vibration Sensor : ZHAVibration",
                        topic: "",
                        state: "0",
                        output: "onchange",
                        outputAtStartup: true,
                    }
                };
                let migrationResult;

                should.doesNotThrow(() => {
                    let configMigration = new ConfigMigration(node.config.type, node.config, server);
                    migrationResult = configMigration.applyMigration(node.config, node);
                });

                should(migrationResult.new.search_type).equal('device');
                should(migrationResult.new.query).equal('{}');
                should(migrationResult.new.device_list).containDeep(['sensors/uniqueid/44:55:66:77:88:99:00:11-01-0101']);
                should(migrationResult.new.outputs).equal(2);
                should(migrationResult.new.output_rules).containDeep([
                    {
                        format: 'single',
                        type: 'state',
                        payload: ['__complete__'],
                        output: 'onchange',
                        onstart: true
                    },
                    {
                        type: 'homekit',
                        onstart: true,
                        onerror: true
                    }
                ]);
                should(migrationResult.new.config_version).equal(1);
                should(migrationResult.delete).containDeep(['device', 'state', 'output', 'outputAtStartup']);
                should(migrationResult.errors).have.length(0);
            });
        });

        describe('Get Node', function () {
            it('Light on state', function () {
                let node = {
                    config: {
                        type: "deconz-get",
                        name: "",
                        server: "SERVER_ID",
                        device: "22:33:44:55:66:77:88:99-01",
                        device_name: "Light 3 : Color temperature light",
                        topic: "",
                        state: "on",
                    }
                };
                let migrationResult;

                should.doesNotThrow(() => {
                    let configMigration = new ConfigMigration(node.config.type, node.config, server);
                    migrationResult = configMigration.applyMigration(node.config, node);
                });

                should(migrationResult.new.search_type).equal('device');
                should(migrationResult.new.query).equal('{}');
                should(migrationResult.new.device_list).containDeep(['lights/uniqueid/22:33:44:55:66:77:88:99-01']);
                should(migrationResult.new.outputs).equal(1);
                should(migrationResult.new.output_rules).containDeep([
                    {
                        type: 'state',
                        format: 'single',
                        payload: ['on']
                    }
                ]);
                should(migrationResult.new.config_version).equal(1);
                should(migrationResult.delete).containDeep(['device', 'state']);
                should(migrationResult.errors).have.length(0);
            });

            it('Light full state', function () {
                let node = {
                    config: {
                        type: "deconz-get",
                        name: "",
                        server: "SERVER_ID",
                        device: "22:33:44:55:66:77:88:99-01",
                        device_name: "Light 3 : Color temperature light",
                        topic: "",
                        state: "0",
                    }
                };
                let migrationResult;

                should.doesNotThrow(() => {
                    let configMigration = new ConfigMigration(node.config.type, node.config, server);
                    migrationResult = configMigration.applyMigration(node.config, node);
                });

                should(migrationResult.new.search_type).equal('device');
                should(migrationResult.new.query).equal('{}');
                should(migrationResult.new.device_list).containDeep(['lights/uniqueid/22:33:44:55:66:77:88:99-01']);
                should(migrationResult.new.outputs).equal(1);
                should(migrationResult.new.output_rules).containDeep([
                    {
                        type: 'state',
                        format: 'single',
                        payload: ['__complete__']
                    }
                ]);
                should(migrationResult.new.config_version).equal(1);
                should(migrationResult.delete).containDeep(['device', 'state']);
                should(migrationResult.errors).have.length(0);
            });
        });

        describe('Battery Node', function () {
            it('Vibration sensor with on start', function () {
                let node = {
                    config: {
                        type: "deconz-battery",
                        name: "",
                        server: "SERVER_ID",
                        device: "44:55:66:77:88:99:00:11-01-0101",
                        device_name: "Vibration Sensor : ZHAVibration",
                        outputAtStartup: true,
                    }
                };
                let migrationResult;

                should.doesNotThrow(() => {
                    let configMigration = new ConfigMigration(node.config.type, node.config, server);
                    migrationResult = configMigration.applyMigration(node.config, node);
                });

                should(migrationResult.new.search_type).equal('device');
                should(migrationResult.new.query).equal('{}');
                should(migrationResult.new.device_list).containDeep(['sensors/uniqueid/44:55:66:77:88:99:00:11-01-0101']);
                should(migrationResult.new.outputs).equal(2);
                should(migrationResult.new.output_rules).containDeep([
                    {type: 'config', format: 'single', onstart: true},
                    {type: 'homekit', format: 'single', onstart: true}
                ]);
                should(migrationResult.new.config_version).equal(1);
                should(migrationResult.delete).containDeep(['device', 'state', 'output', 'outputAtStartup']);
                should(migrationResult.errors).have.length(0);
            });

            it('Vibration sensor without on start', function () {
                let node = {
                    config: {
                        type: "deconz-battery",
                        name: "",
                        server: "SERVER_ID",
                        device: "44:55:66:77:88:99:00:11-01-0101",
                        device_name: "Vibration Sensor : ZHAVibration",
                        outputAtStartup: false,
                    }
                };
                let migrationResult;

                should.doesNotThrow(() => {
                    let configMigration = new ConfigMigration(node.config.type, node.config, server);
                    migrationResult = configMigration.applyMigration(node.config, node);
                });

                should(migrationResult.new.search_type).equal('device');
                should(migrationResult.new.query).equal('{}');
                should(migrationResult.new.device_list).containDeep(['sensors/uniqueid/44:55:66:77:88:99:00:11-01-0101']);
                should(migrationResult.new.outputs).equal(2);
                should(migrationResult.new.output_rules).containDeep([
                    {type: 'config', format: 'single', onstart: false},
                    {type: 'homekit', format: 'single', onstart: false}
                ]);
                should(migrationResult.new.config_version).equal(1);
                should(migrationResult.delete).containDeep(['device', 'state', 'output', 'outputAtStartup']);
                should(migrationResult.errors).have.length(0);
            });
        });

        describe('Output Node', function () {
            describe('Device type', function () {
                it('Light 1 turn on with deconz cmd', function () {
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            command: "on",
                            commandType: "deconz_cmd",
                            payload: "1",
                            payloadType: "deconz_payload",
                            transitionTime: "",
                            transitionTimeType: undefined
                        }
                    };
                    let migrationResult;

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['lights/uniqueid/00:11:22:33:44:55:66:77-01']);
                    should(migrationResult.new.commands).containDeep([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            transition: {type: 'num'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });

                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

                it('Group Light 1 turn off with deconz cmd with transition', function () {
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "group_1",
                            device_name: "Group 1 : LightGroup",
                            command: "on",
                            commandType: "deconz_cmd",
                            payload: "0",
                            payloadType: "deconz_payload",
                            transitionTime: "20",
                            transitionTimeType: "num"
                        }
                    };
                    let migrationResult;

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['groups/uniqueid/33:44:55:66:77:88:99:00']);
                    should(migrationResult.new.commands).containDeep([{
                        type: 'deconz_state',
                        domain: 'groups',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'false'},
                            transition: {type: 'num', value: '20'},
                            aftererror: {type: 'continue'}
                        }
                    }
                    ]);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });
                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

                it('Windows cover custom open command', function () {
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "22:88:44:11:66:22:88:99-01",
                            device_name: "Windows cover : Window covering controller",
                            command: "open",
                            commandType: "str",
                            payload: "true",
                            payloadType: "str",
                            transitionTime: "20",
                            transitionTimeType: "num"
                        }
                    };
                    let migrationResult;

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['lights/uniqueid/22:88:44:11:66:22:88:99-01']);
                    should(migrationResult.new.commands).containDeep([{
                        type: 'deconz_state',
                        domain: 'covers',
                        target: 'state',
                        arg: {
                            open: {type: 'set', value: 'true'},
                            transition: {type: 'num', value: '20'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });
                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

                it('Windows cover custom open from msg command', function () {
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "22:88:44:11:66:22:88:99-01",
                            device_name: "Windows cover : Window covering controller",
                            command: "open",
                            commandType: "str",
                            payload: "payload",
                            payloadType: "msg",
                            transitionTime: "20",
                            transitionTimeType: "num"
                        }
                    };
                    let migrationResult;

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['lights/uniqueid/22:88:44:11:66:22:88:99-01']);
                    should(migrationResult.new.commands).containDeep([{
                        type: 'deconz_state',
                        domain: 'covers',
                        target: 'state',
                        arg: {
                            open: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '20'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });
                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

                it('Windows cover custom lift command', function () {
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "22:88:44:11:66:22:88:99-01",
                            device_name: "Windows cover : Window covering controller",
                            command: "lift",
                            commandType: "str",
                            payload: "50",
                            payloadType: "num",
                            transitionTime: "20",
                            transitionTimeType: "num"
                        }
                    };
                    let migrationResult;

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['lights/uniqueid/22:88:44:11:66:22:88:99-01']);
                    should(migrationResult.new.commands).containDeep([{
                        type: 'deconz_state',
                        domain: 'covers',
                        target: 'state',
                        arg: {
                            lift: {type: 'num', value: '50'},
                            transition: {type: 'num', value: '20'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });
                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

                it('Windows cover custom lift stop command', function () {
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "22:88:44:11:66:22:88:99-01",
                            device_name: "Windows cover : Window covering controller",
                            command: "lift",
                            commandType: "str",
                            payload: "stop",
                            payloadType: "str",
                            transitionTime: "20",
                            transitionTimeType: "num"
                        }
                    };
                    let migrationResult;

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['lights/uniqueid/22:88:44:11:66:22:88:99-01']);
                    should(migrationResult.new.commands).containDeep([{
                        type: 'deconz_state',
                        domain: 'covers',
                        target: 'state',
                        arg: {
                            lift: {type: 'stop'},
                            transition: {type: 'num', value: '20'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });
                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

                it('Windows cover custom tilt stop command', function () {
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "22:88:44:11:66:22:88:99-01",
                            device_name: "Windows cover : Window covering controller",
                            command: "tilt",
                            commandType: "str",
                            payload: "60",
                            payloadType: "str",
                            transitionTime: "20",
                            transitionTimeType: "num"
                        }
                    };
                    let migrationResult;

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['lights/uniqueid/22:88:44:11:66:22:88:99-01']);
                    should(migrationResult.new.commands).containDeep([{
                        type: 'deconz_state',
                        domain: 'covers',
                        target: 'state',
                        arg: {
                            tilt: {type: 'num', value: '60'},
                            transition: {type: 'num', value: '20'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });
                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

            });

            describe('Deconz command on light', function () {

                let migrationResult;
                let node;

                beforeEach(function () {
                    node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "",
                            command: "",
                            payloadType: "",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };
                });

                afterEach(function () {
                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['lights/uniqueid/00:11:22:33:44:55:66:77-01']);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });

                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

                it('Light 1 turn on with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'on';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = '1';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 turn off with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'on';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = '0';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'false'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 toggle with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'toggle';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'toggle', value: ''},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 on with msg', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'on';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 on with str true', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'on';
                    node.config.payloadType = 'str';
                    node.config.payload = 'true';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 on with str false', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'on';
                    node.config.payloadType = 'str';
                    node.config.payload = 'false';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'false'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 on with num 1', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'on';
                    node.config.payloadType = 'num';
                    node.config.payload = '1';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 on with num 0', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'on';
                    node.config.payloadType = 'num';
                    node.config.payload = '0';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'false'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 custom command on with deconz cmd', function () {
                    node.config.commandType = 'str';
                    node.config.command = 'on';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = '1';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 brightness with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'bri';
                    node.config.payloadType = 'num';
                    node.config.payload = '150';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            bri: {direction: 'set', type: 'num', value: '150'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 brightness with msg', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'bri';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            bri: {direction: 'set', type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 hue with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'hue';
                    node.config.payloadType = 'num';
                    node.config.payload = '10000';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            hue: {direction: 'set', type: 'num', value: '10000'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 sat with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'sat';
                    node.config.payloadType = 'num';
                    node.config.payload = '120';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            sat: {direction: 'set', type: 'num', value: '120'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 ct by value with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'ct';
                    node.config.payloadType = 'num';
                    node.config.payload = '320';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            ct: {direction: 'set', type: 'num', value: '320'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 ct by deconz_payload cold with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'ct';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = '153';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            ct: {direction: 'set', type: 'deconz', value: 'cold'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 ct by deconz_payload white with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'ct';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = '320';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            ct: {direction: 'set', type: 'deconz', value: 'white'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 ct by deconz_payload warm with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'ct';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = '500';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            ct: {direction: 'set', type: 'deconz', value: 'warm'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 ct by unknown deconz_payload with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'ct';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = '250';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            ct: {direction: 'set', type: 'num', value: '250'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 ct bymsg', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'ct';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            ct: {direction: 'set', type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 xy by msg.payload with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'xy';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            on: {type: 'set', value: 'true'},
                            xy: {direction: 'set', type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 alert none with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'alert';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = 'none';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            alert: {type: 'deconz', value: 'none'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 alert blink short with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'alert';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = 'select';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            alert: {type: 'deconz', value: 'select'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 alert blink long with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'alert';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = 'lselect';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            alert: {type: 'deconz', value: 'lselect'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 alert from msg', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'alert';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            alert: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 alert with well known str value', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'alert';
                    node.config.payloadType = 'str';
                    node.config.payload = 'none';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            alert: {type: 'deconz', value: 'none'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 alert with str value', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'alert';
                    node.config.payloadType = 'str';
                    node.config.payload = 'unkwnon-alert';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            alert: {type: 'str', value: 'unkwnon-alert'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 effect none with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'effect';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = 'none';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            effect: {type: 'deconz', value: 'none'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 effect color loop with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'effect';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = 'colorloop';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            effect: {type: 'deconz', value: 'colorloop'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 effect color loop with well known str', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'effect';
                    node.config.payloadType = 'str';
                    node.config.payload = 'colorloop';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            effect: {type: 'deconz', value: 'colorloop'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 effect from msg', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'effect';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            effect: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 color loop speed with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'colorloopspeed';
                    node.config.payloadType = 'num';
                    node.config.payload = '15';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            colorloopspeed: {type: 'num', value: '15'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 color loop speed from msg', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'colorloopspeed';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'lights',
                        target: 'state',
                        arg: {
                            colorloopspeed: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 homekit with deconz cmd', function () {
                    node.config.commandType = 'homekit';
                    node.config.command = 'homekit';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'homekit',
                        arg: {
                            payload: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 custom command with deconz cmd', function () {
                    node.config.commandType = 'msg';
                    node.config.command = 'command';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'custom',
                        arg: {
                            target: {type: 'state'},
                            command: {type: 'msg', value: 'command'},
                            payload: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Light 1 custom json object command with deconz cmd', function () {
                    node.config.commandType = 'object';
                    node.config.command = 'json';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'custom',
                        arg: {
                            target: {type: 'state'},
                            command: {type: 'object'},
                            payload: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: '10'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

            });

            describe('Deconz command on light group', function () {
                let migrationResult;
                let node;

                beforeEach(function () {
                    node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "group_1",
                            device_name: "Group 1 : LightGroup",
                            commandType: "",
                            command: "",
                            payloadType: "",
                            payload: "",
                            transitionTime: "",
                            transitionTimeType: "num"
                        }
                    };
                });

                afterEach(function () {
                    should(migrationResult.new.search_type).equal('device');
                    should(migrationResult.new.query).equal('{}');
                    should(migrationResult.new.device_list).containDeep(['groups/uniqueid/33:44:55:66:77:88:99:00']);
                    should(migrationResult.new.specific).deepEqual({
                        delay: {type: 'num', value: 50},
                        result: {type: 'at_end'}
                    });

                    should(migrationResult.new.config_version).equal(1);
                    should(migrationResult.delete).containDeep([
                        'device',
                        'command',
                        'commandType',
                        'payload',
                        'payloadType',
                        'transitionTime',
                        'transitionTimeType'
                    ]);
                    should(migrationResult.errors).have.length(0);
                });

                it('Group 1 scene call from deconz_payload with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'scene';
                    node.config.payloadType = 'deconz_payload';
                    node.config.payload = '2';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'scene_call',
                        target: 'state',
                        arg: {
                            group: {type: 'num', value: '1'},
                            scene: {type: 'num', value: '2'},
                            transition: {type: 'num', value: ''},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Group 1 scene call from num with deconz cmd', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'scene';
                    node.config.payloadType = 'num';
                    node.config.payload = '2';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'scene_call',
                        target: 'state',
                        arg: {
                            group: {type: 'num', value: '1'},
                            scene: {type: 'num', value: '2'},
                            transition: {type: 'num', value: ''},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Group 1 scene call from msg', function () {
                    node.config.commandType = 'deconz_cmd';
                    node.config.command = 'scene';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'deconz_state',
                        domain: 'scene_call',
                        target: 'state',
                        arg: {
                            group: {type: 'num', value: '1'},
                            scene: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: ''},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Custom command', function () {
                    node.config.commandType = 'str';
                    node.config.command = 'custom-command';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'custom',
                        arg: {
                            target: {type: 'state'},
                            command: {type: 'str', value: 'custom-command'},
                            payload: {type: 'msg', value: 'payload'},
                            transition: {type: 'num', value: ''},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

                it('Custom command with transition from msg', function () {
                    node.config.commandType = 'str';
                    node.config.command = 'custom-command';
                    node.config.payloadType = 'msg';
                    node.config.payload = 'payload';
                    node.config.transitionTimeType = 'msg';
                    node.config.transitionTime = 'transitiontime';

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });

                    should(migrationResult.new.commands).deepEqual([{
                        type: 'custom',
                        arg: {
                            target: {type: 'state'},
                            command: {type: 'str', value: 'custom-command'},
                            payload: {type: 'msg', value: 'payload'},
                            transition: {type: 'msg', value: 'transitiontime'},
                            aftererror: {type: 'continue'}
                        }
                    }]);
                });

            });

            describe('Misc', function () {

                it('update not needed', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-input",
                            config_version: 1
                        }
                    };
                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult).have.property('notNeeded', true);
                });

            });

            describe('Errors handling', function () {

                it('invalid node type ID', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-does-not-exist",
                            name: "",
                            server: "SERVER_ID",
                            device: "invalid_device_id",
                            device_name: "Group 1 : LightGroup",
                            commandType: "deconz_cmd",
                            command: "on",
                            payloadType: "deconz_payload",
                            payload: "1",
                            transitionTime: "",
                            transitionTimeType: "num"
                        }
                    };
                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Configuration migration handler not found for node type 'deconz-does-not-exist'."
                    ]);
                });

                it('invalid device ID', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "invalid_device_id",
                            device_name: "Group 1 : LightGroup",
                            commandType: "deconz_cmd",
                            command: "on",
                            payloadType: "deconz_payload",
                            payload: "1",
                            transitionTime: "",
                            transitionTimeType: "num"
                        }
                    };
                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Could not find the device 'Group 1 : LightGroup' with uniqueID 'invalid_device_id'."
                    ]);
                });

                it('invalid on str value', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "on",
                            payloadType: "str",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option Switch (true/false)"
                    ]);
                });

                it('invalid on num value', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "on",
                            payloadType: "num",
                            payload: "2",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value '2' for option Switch (true/false)"
                    ]);
                });


                it('invalid on value type', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "on",
                            payloadType: "timestamp",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'timestamp' for option Switch (true/false)"
                    ]);
                });

                it('invalid bri str value', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "bri",
                            payloadType: "str",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option 'bri'"
                    ]);
                });

                it('invalid bri value type', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "bri",
                            payloadType: "timestamp",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'timestamp' for option 'bri'"
                    ]);
                });

                it('invalid ct deconz_payload value', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "ct",
                            payloadType: "deconz_payload",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option 'ct'"
                    ]);
                });

                it('invalid ct num value', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "ct",
                            payloadType: "num",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option 'ct'"
                    ]);
                });

                it('invalid ct value type', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "ct",
                            payloadType: "timestamp",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'timestamp' for option 'ct'"
                    ]);
                });

                it('invalid xy value type', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "xy",
                            payloadType: "timestamp",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'timestamp' for option 'xy'"
                    ]);
                });

                it('invalid value type calling scene', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "scene",
                            payloadType: "timestamp",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'timestamp' for calling scene"
                    ]);
                });

                it('invalid calling scene device and scene', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "group_",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "scene",
                            payloadType: "deconz_payload",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(3);
                    should(migrationResult.errors).deepEqual([
                        "Could not find the device 'Light 1 : Color light' with uniqueID 'group_'.",
                        "Invalid group ID 'group_' for calling scene",
                        "Invalid scene ID 'invalid' for calling scene"
                    ]);
                });

                it('invalid value alert', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "alert",
                            payloadType: "deconz_payload",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'deconz_payload' for option 'alert'"
                    ]);
                });

                it('invalid value type alert', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "alert",
                            payloadType: "invalid",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'invalid' for option 'alert'"
                    ]);
                });

                it('invalid value effect', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "effect",
                            payloadType: "deconz_payload",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'deconz_payload' for option 'effect'"
                    ]);
                });

                it('invalid value type effect', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "effect",
                            payloadType: "invalid",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'invalid' for option 'effect'"
                    ]);
                });

                it('invalid value colorloopspeed', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "colorloopspeed",
                            payloadType: "num",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option 'colorloopspeed'"
                    ]);
                });

                it('invalid value colorloopspeed', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "colorloopspeed",
                            payloadType: "invalid",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'invalid' for option 'colorloopspeed'"
                    ]);
                });

                it('invalid value open', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "open",
                            payloadType: "str",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option 'open'"
                    ]);
                });

                it('invalid value type open', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "open",
                            payloadType: "invalid",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'invalid' for option 'open'"
                    ]);
                });

                it('invalid value lift', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "lift",
                            payloadType: "str",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option 'lift'"
                    ]);
                });

                it('invalid value type lift', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "lift",
                            payloadType: "invalid",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'invalid' for option 'lift'"
                    ]);
                });

                it('invalid value tilt', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "tilt",
                            payloadType: "str",
                            payload: "invalid",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option 'tilt'"
                    ]);
                });

                it('invalid value type tilt', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "tilt",
                            payloadType: "invalid",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'invalid' for option 'tilt'"
                    ]);
                });

                it('invalid value homekit', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "homekit",
                            command: "",
                            payloadType: "num",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "The type 'num' was not valid in legacy version, he has been converted to 'msg'."
                    ]);
                });

                it('invalid value type homekit', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "homekit",
                            command: "",
                            payloadType: "invalid",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'invalid' for homekit command"
                    ]);
                });

                it('invalid command', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "invalid",
                            command: "",
                            payloadType: "",
                            payload: "",
                            transitionTime: "10",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid command type 'invalid' for migration"
                    ]);
                });

                it('invalid value transition time', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "on",
                            payloadType: "deconz_payload",
                            payload: "on",
                            transitionTime: "invalid",
                            transitionTimeType: "num"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value 'invalid' for option 'transition'"
                    ]);
                });

                it('invalid type value transition time', function () {
                    let migrationResult;
                    let node = {
                        config: {
                            type: "deconz-output",
                            name: "",
                            server: "SERVER_ID",
                            device: "00:11:22:33:44:55:66:77-01",
                            device_name: "Light 1 : Color light",
                            commandType: "deconz_cmd",
                            command: "on",
                            payloadType: "deconz_payload",
                            payload: "on",
                            transitionTime: "",
                            transitionTimeType: "invalid"
                        }
                    };

                    should.doesNotThrow(() => {
                        let configMigration = new ConfigMigration(node.config.type, node.config, server);
                        migrationResult = configMigration.applyMigration(node.config, node);
                    });
                    should(migrationResult.errors).have.length(1);
                    should(migrationResult.errors).deepEqual([
                        "Invalid value type 'invalid' for option 'transition'"
                    ]);
                });

            });

        });

        describe('Server Node', function () {
            it('Migrate from legacy', function () {
                let node = {
                    config: {
                        type: "deconz-server",
                        apikey: 'SECRET_KEY'
                    }
                };
                let migrationResult;

                should.doesNotThrow(() => {
                    let configMigration = new ConfigMigration(node.config.type, node.config, server);
                    migrationResult = configMigration.applyMigration(node.config, node);
                });
                should(migrationResult.new.config_version).equal(1);
                should(migrationResult.controller.new['credentials.secured_apikey']).equal('SECRET_KEY');
                should(migrationResult.delete).containDeep(['apikey']);
            });

        });

    });

    describe('HomeKitFormatter', function () {
        it('buttonevent', function () {
            let result = deviceList.getDeviceByUniqueID('55:66:77:88:99:00:11:22-01-1000');
            let homeKitResult = (new HomeKitFormatter.fromDeconz()).parse({state: result.state}, result);
            should(homeKitResult).have.property('ProgrammableSwitchEvent', 0);
            should(homeKitResult).have.property('ServiceLabelIndex', 2);
        });

    });
});
