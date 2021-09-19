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
                let result = deviceList.getDevicesByQuery({
                    "match": false
                }, QueryParams);
                should(result).have.property('matched');
                result.matched.should.eql([]);
            });

            it('Should not return any device', function () {
                let result = deviceList.getDevicesByQuery({}, QueryParams);
                should(result).have.property('matched');
                result.matched.should.eql([]);
            });

            it('match false inverted', function () {
                let result = deviceList.getDevicesByQuery({
                    match: false,
                    inverted: true
                }, QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.eql([]);
            });

            it('empty inverted', function () {
                let result = deviceList.getDevicesByQuery({
                    inverted: true
                }, QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.eql([]);
            });

        });

        describe('Always Rule', function () {
            it('Should return all devices', function () {
                let result = deviceList.getDevicesByQuery('all', QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.eql([]);
            });

            it('Should return all devices', function () {
                let result = deviceList.getDevicesByQuery({
                    "match": true
                }, QueryParams);
                should(result).have.property('rejected');
                result.rejected.should.eql([]);
            });

            it('match true inverted', function () {
                let result = deviceList.getDevicesByQuery({
                    match: true,
                    inverted: true
                }, QueryParams);
                should(result).have.property('matched');
                result.matched.should.eql([]);
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
                        result.matched.should.eql(['item03', 'item04']);
                    });

                    it('Number', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "colorcapabilities": 8
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.eql(['item04', 'item05']);
                    });

                    it('Boolean', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "hascolor": false
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.eql(['item03']);
                    });

                    it('Dot notation', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "state.on": true
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.eql(['item04', 'item05']);
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
                        result.matched.should.eql(['item06', 'item07']);
                    });

                    it('Array with incorect types', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "hascolor": ['true', 'false']
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.eql([]);
                    });

                    it('Array with valid types', function () {
                        let result = deviceList.getDevicesByQuery({
                            "type": "match",
                            "match": {
                                "hascolor": [true, false]
                            }
                        }, QueryParams);
                        should(result).have.property('matched');
                        result.matched.should.eql(['item03', 'item04', 'item05']);
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
                        result.matched.should.eql(['item04', 'item05']);
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
                        resultA.matched.should.eql(['item03', 'item04']);
                        resultA.matched.should.eql(resultB.rejected);
                        resultB.matched.should.eql(resultA.rejected);
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
                        result.matched.should.eql(['item04', 'item05']);
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
                        result.matched.should.eql(['item04', 'item05']);
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
                        result.matched.should.eql([]);
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
                        result.matched.should.eql(['item04', 'item05']);
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
                        result.matched.should.eql(['item04', 'item05']);
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
                        result.matched.should.eql(['item04']);
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
                        result.matched.should.eql(['item03', 'item04']);
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
                        result.matched.should.eql(['item05', 'item06', 'item07']);
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
                        result.matched.should.eql(['item05', 'item06', 'item07']);
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
                        result.matched.should.eql(['item03', 'item04', 'item08']);
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
                        result.matched.should.eql(['item03', 'item04', 'item08']);
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
                        result.matched.should.eql(['item04', 'item05']);
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
                        result.matched.should.eql(['item04', 'item05']);
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
                        result.rejected.should.eql(['item04', 'item05']);
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
                        result.matched.should.eql(['item03', 'item04']);
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
                        result.matched.should.eql(['item03', 'item04']);
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
                        result.rejected.should.eql(['item03', 'item04']);
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
                        result.matched.should.eql(['item04', 'item05', 'item06', 'item07']);
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
                        result.matched.should.eql(['item03']);
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
                        result.matched.should.eql(['item05', 'item07', 'item08']);
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
                        result.matched.should.eql(['item05', 'item07', 'item08']);
                    });

                });

            });

        });

    });

});
