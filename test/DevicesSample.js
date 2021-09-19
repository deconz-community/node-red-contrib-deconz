module.exports = {
    "groups": {
        "1": {
            "action": {
                "alert": "none",
                "bri": 127,
                "colormode": "hs",
                "ct": 0,
                "effect": "none",
                "hue": 0,
                "on": true,
                "sat": 127,
                "scene": null,
                "xy": [
                    0,
                    0
                ]
            },
            "devicemembership": [
                "1"
            ],
            "etag": "item01",
            "id": "1",
            "lights": [],
            "name": "Motion sensor",
            "scenes": [],
            "state": {
                "all_on": false,
                "any_on": false
            },
            "type": "LightGroup",
            "uniqueid": "33:44:55:66:77:88:99:00"
        },
        "2": {
            "action": {
                "alert": "none",
                "bri": 127,
                "colormode": "hs",
                "ct": 0,
                "effect": "none",
                "hue": 0,
                "on": true,
                "sat": 127,
                "scene": null,
                "xy": [
                    0,
                    0
                ]
            },
            "devicemembership": [
                "2",
                "3"
            ],
            "etag": "item02",
            "id": "2",
            "lights": [],
            "name": "Group 2",
            "scenes": [],
            "state": {
                "all_on": false,
                "any_on": false
            },
            "type": "LightGroup"
        }
    },
    "lights": {
        "1": {
            "colorcapabilities": 4,
            "etag": "item03",
            "hascolor": false,
            "lastannounced": "2021-04-21T21:00:24Z",
            "lastseen": "2021-04-27T16:43Z",
            "manufacturername": "Homestead",
            "modelid": "Light bulb E27 600lm",
            "anumberinstring": "50",
            "name": "Light 1",
            "state": {
                "alert": "none",
                "bri": 50,
                "colormode": "xy",
                "effect": "0",
                "hue": 0,
                "on": false,
                "reachable": true,
                "sat": 0,
                "xy": [
                    0.525,
                    0.39
                ]
            },
            "swversion": "1.2.3",
            "type": "Color light",
            "uniqueid": "00:11:22:33:44:55:66:77-01"
        },
        "2": {
            "colorcapabilities": 8,
            "etag": "item04",
            "hascolor": true,
            "lastannounced": "2021-04-21T21:10:24Z",
            "lastseen": "2021-04-28T16:53Z",
            "manufacturername": "Homestead",
            "modelid": "Light bulb E27 600lm",
            "anumberinstring": "130",
            "name": "Light 2",
            "state": {
                "alert": "none",
                "bri": 100,
                "colormode": "xy",
                "effect": "0",
                "hue": 0,
                "on": true,
                "reachable": true,
                "sat": 0,
                "xy": [
                    0.525,
                    0.39
                ]
            },
            "swversion": "3.2.1",
            "type": "Color light",
            "uniqueid": "11:22:33:44:55:66:77:88-01"
        },
        "3": {
            "colorcapabilities": 8,
            "etag": "item05",
            "hascolor": true,
            "lastannounced": "2021-04-21T21:20:24Z",
            "lastseen": "2021-04-29T17:03Z",
            "manufacturername": "Homestead",
            "modelid": "Light bulb E14 400lm",
            "anumberinstring": "200",
            "name": "Light 3",
            "state": {
                "alert": "none",
                "bri": 100,
                "colormode": "xy",
                "effect": "0",
                "hue": 0,
                "on": true,
                "reachable": true,
                "sat": 0,
                "xy": [
                    0.525,
                    0.39
                ]
            },
            "swversion": "3.2.1",
            "type": "Color temperature light",
            "uniqueid": "22:33:44:55:66:77:88:99-01"
        }
    },
    "sensors": {
        "1": {
            "config": {
                "battery": 100,
                "on": true,
                "pending": [],
                "reachable": true,
                "sensitivity": 11,
                "sensitivitymax": 21,
                "temperature": 3000
            },
            "ep": 1,
            "etag": "item06",
            "lastseen": "2021-04-30T16:35Z",
            "manufacturername": "Homestead",
            "modelid": "vibration",
            "name": "Vibration Sensor",
            "state": {
                "lastupdated": "2021-04-27T16:35:22.431",
                "orientation": [
                    -8,
                    1,
                    82
                ],
                "tiltangle": 8,
                "vibration": false,
                "vibrationstrength": 0
            },
            "swversion": "123456",
            "type": "ZHAVibration",
            "uniqueid": "44:55:66:77:88:99:00:11-01-0101"
        },
        "2": {
            "config": {
                "alert": "none",
                "battery": 5,
                "group": "25",
                "on": true,
                "reachable": true
            },
            "ep": 1,
            "etag": "item07",
            "lastseen": "2021-05-01T16:45Z",
            "manufacturername": "Homestead",
            "mode": 1,
            "modelid": "on/off switch",
            "name": "Swith 1",
            "state": {
                "buttonevent": 2002,
                "lastupdated": "2021-04-26T22:12:26.912"
            },
            "swversion": "2.0.020",
            "type": "ZHASwitch",
            "uniqueid": "55:66:77:88:99:00:11:22-01-1000"
        },
        "3": {
            "config": {
                "on": true,
                "reachable": false
            },
            "ep": 1,
            "etag": "item08",
            "lastseen": null,
            "manufacturername": "Homestead",
            "modelid": "Power Meter",
            "name": "Power Engine",
            "state": {
                "consumption": 102610,
                "lastupdated": "2021-04-20T12:42:11.098"
            },
            "type": "ZHAConsumption",
            "uniqueid": "66:77:88:99:00:11:22:33-01-0702"
        }
    }
};
