const NODE_PATH = '/node-red-contrib-deconz/';
const path = require('path');
const ConfigMigration = require("./src/migration/ConfigMigration");
const DeconzAPI = require("./src/runtime/DeconzAPI");
const CommandParser = require("./src/runtime/CommandParser");
const got = require("got");
const Utils = require("./src/runtime/Utils");
const CompareVersion = require('compare-versions');
const HomeKitFormatter = require("./src/runtime/HomeKitFormatter");

module.exports = function (RED) {

    /**
     * Static files route because some users are using Node-Red 1.3.0 or lower
     */
    if (RED.version === undefined || CompareVersion.compare(RED.version(), '1.3.0', '<')) {
        RED.httpAdmin.get('/resources' + NODE_PATH + '*', function (req, res) {
            try {
                let options = {
                    root: __dirname + '/resources',
                    dotfiles: 'deny'
                };
                res.sendFile(req.params[0], options);
            } catch (e) {
                console.error(e);
                res.status(500).end();
            }
        });
    }

    /**
     * Enable http route to multiple-select static files
     */
    RED.httpAdmin.get(NODE_PATH + 'multiple-select/*', function (req, res) {
        try {
            let options = {
                root: path.dirname(require.resolve('multiple-select')),
                dotfiles: 'deny'
            };
            res.sendFile(req.params[0], options);
        } catch (e) {
            console.error(e);
            res.status(500).end();
        }
    });

    /**
     * Enable http route to JSON itemlist for each controller (controller id passed as GET query parameter)
     */
    RED.httpAdmin.get(NODE_PATH + 'itemlist', function (req, res) {
        try {
            let config = req.query;
            let controller = RED.nodes.getNode(config.controllerID);
            let forceRefresh = config.forceRefresh ? ['1', 'yes', 'true'].includes(config.forceRefresh.toLowerCase()) : false;
            let query;
            let queryType = req.query.queryType || 'json';

            try {
                if (req.query.query !== undefined && ['json', 'jsonata'].includes(queryType)) {
                    query = RED.util.evaluateNodeProperty(
                        req.query.query,
                        queryType,
                        RED.nodes.getNode(req.query.nodeID),
                        {}, undefined
                    );
                }
            } catch (e) {
                return res.json({
                    error_message: e.message,
                    error_stack: e.stack
                });
            }

            if (controller && controller.constructor.name === "ServerNode") {
                (async () => {
                    try {
                        if (forceRefresh) await controller.discoverDevices({forceRefresh: true});
                        if (query === undefined) {
                            res.json({items: controller.device_list.getAllDevices()});
                        } else {
                            res.json({items: controller.device_list.getDevicesByQuery(query)});
                        }
                    } catch (e) {
                        return res.json({
                            error_message: e.message,
                            error_stack: e.stack
                        });
                    }
                })();
            } else {
                return res.json({
                    error_message: "Can't find the server node. Did you press deploy ?"
                });
            }
        } catch (e) {
            console.error(e);
            res.status(500).end();
        }
    });

    ['attribute', 'state', 'config'].forEach(function (type) {
        RED.httpAdmin.get(NODE_PATH + type + 'list', function (req, res) {
            try {
                let config = req.query;
                let controller = RED.nodes.getNode(config.controllerID);
                let devicesIDs = JSON.parse(config.devices);
                const isAttribute = type === 'attribute';
                if (controller && controller.constructor.name === "ServerNode" && devicesIDs) {

                    let type_list = (isAttribute) ? ['state', 'config'] : [type];

                    let sample = {};
                    let count = {};

                    for (const _type of type_list) {
                        sample[_type] = {};
                        count[_type] = {};
                    }

                    if (isAttribute) {
                        sample[type] = {};
                        count[type] = {};
                    }

                    for (const deviceID of devicesIDs) {
                        let device = controller.device_list.getDeviceByPath(deviceID);
                        if (!device) continue;

                        if (isAttribute) {
                            for (const value of Object.keys(device)) {
                                if (type_list.includes(value)) continue;
                                count[type][value] = (count[type][value] || 0) + 1;
                                sample[type][value] = device[value];
                            }
                        }

                        for (const _type of type_list) {
                            if (!device[_type]) continue;
                            for (const value of Object.keys(device[_type])) {
                                count[_type][value] = (count[_type][value] || 0) + 1;
                                sample[_type][value] = device[_type][value];
                            }
                        }
                    }

                    res.json({count: count, sample: sample});
                } else {
                    res.status(404).end();
                }
            } catch (e) {
                console.error(e);
                res.status(500).end();
            }
        });
    });

    RED.httpAdmin.get(NODE_PATH + 'homekitlist', function (req, res) {
        try {
            let config = req.query;
            let controller = RED.nodes.getNode(config.controllerID);
            let devicesIDs = JSON.parse(config.devices);
            if (controller && controller.constructor.name === "ServerNode" && devicesIDs) {

                let sample = {homekit: {}};
                let count = {homekit: {}};

                const formatter = (new HomeKitFormatter.fromDeconz({}));

                for (const deviceID of devicesIDs) {
                    let device = controller.device_list.getDeviceByPath(deviceID);
                    if (!device) continue;

                    let propertiesList = formatter.getValidPropertiesList(device);
                    let characteristics = formatter.parse(device, device);

                    for (const property of propertiesList) {
                        count.homekit[property] = (count.homekit[property] || 0) + 1;
                        const propertyName = formatter.format[property]._name !== undefined ?
                            formatter.format[property]._name :
                            property;
                        if (characteristics[propertyName] !== undefined) {
                            sample.homekit[property] = characteristics[propertyName];
                        }
                    }
                }

                res.json({count, sample});
            } else {
                res.status(404).end();
            }
        } catch (e) {
            console.error(e);
            res.status(500).end();
        }
    });

    /**
     * @deprecated getScenesByDevice
     */
    RED.httpAdmin.get(NODE_PATH + 'getScenesByDevice', function (req, res) {
        try {
            let config = req.query;
            let controller = RED.nodes.getNode(config.controllerID);
            if (controller && controller.constructor.name === "ServerNode") {
                if ("scenes" in controller.items[config.device] && config.device in controller.items) {
                    res.json(controller.items[config.device].scenes);
                } else {
                    res.json({});
                }
            } else {
                res.status(404).end();
            }
        } catch (e) {
            console.error(e);
            res.status(500).end();
        }
    });

    RED.httpAdmin.get(NODE_PATH + 'configurationMigration', function (req, res) {
        try {
            let data = req.query;
            let config = JSON.parse(data.config);
            let server = RED.nodes.getNode(data.type === 'deconz-server' ? data.id : config.server);
            if (server === undefined) {
                res.json({errors: [`Could not find the server node.`]});
                return;
            }
            if (server.state.ready === true || (data.type === 'deconz-server')) {
                let configMigration = new ConfigMigration(data.type, config, server);
                let result = configMigration.migrate(config);
                res.json(result);
            } else {
                res.json({errors: [`The server node is not ready. Please check the server configuration.`]});
            }
        } catch (e) {
            console.error(e);
            res.status(500).end();
        }
    });

    RED.httpAdmin.get(NODE_PATH + 'serverAutoconfig', async function (req, res) {
        try {
            let data = req.query;
            let config = JSON.parse(data.config);
            let api = new DeconzAPI(config);
            let result = await api.discoverSettings(config.discoverParam || {});
            res.json(result);
        } catch (e) {
            console.error(e);
            res.status(500).end();
        }
    });

    RED.httpAdmin.post(NODE_PATH + 'testCommand', async function (req, res) {
        try {
            let config = req.body;
            let controller = RED.nodes.getNode(config.controllerID);
            if (controller && controller.constructor.name === "ServerNode") {
                let fakeNode = {server: controller};
                let cp = new CommandParser(config.command, {}, fakeNode);
                let devices = [];
                for (let path of config.device_list) {
                    let device = controller.device_list.getDeviceByPath(path);
                    if (device) {
                        devices.push({data: device});
                    } else {
                        console.warn(`Error : Device not found : '${path}'`);
                    }
                }
                let requests = cp.getRequests(fakeNode, devices);
                for (const [request_id, request] of requests.entries()) {
                    const response = await got(
                        controller.api.url.main() + request.endpoint,
                        {
                            method: 'PUT',
                            retry: Utils.getNodeProperty(config.command.arg.retryonerror, this, {}) || 0,
                            json: request.params,
                            responseType: 'json',
                            timeout: 2000 // TODO make configurable ?
                        }
                    );
                    await Utils.sleep(Utils.getNodeProperty(config.delay, this, {}) || 50);
                }
                res.status(200).end();
            } else {
                res.status(404).end();
            }
        } catch (e) {
            console.warn("Error when running command : " + e.toString());
            res.status(500).end();
        }
    });
};
