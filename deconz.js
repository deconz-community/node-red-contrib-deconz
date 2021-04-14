const NODE_PATH = '/node-red-contrib-deconz/';
const path = require('path');
const ConfigMigration = require("./lib/config-migration");

module.exports = function (RED) {

    /**
     * Enable http route to multiple-select static files
     */
    RED.httpAdmin.get(NODE_PATH + 'multiple-select/*', function (req, res) {
        let options = {
            root: path.dirname(require.resolve('multiple-select')),
            dotfiles: 'deny'
        };
        res.sendFile(req.params[0], options);
    });

    /**
     * Enable http route to JSON itemlist for each controller (controller id passed as GET query parameter)
     */
    RED.httpAdmin.get(NODE_PATH + 'itemlist', function (req, res) {
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
            return res.json({error_message: e.toString()});
        }

        if (controller && controller.constructor.name === "ServerNode") {
            controller.getItemsList((items) => {
                res.json({items: items || []});
            }, query, forceRefresh);
        } else {
            return res.json({error_message: "Can't find the server node. Did you press deploy ?"});
        }
    });

    ['state', 'config', 'state_config'].forEach(function (type) {
        RED.httpAdmin.get(NODE_PATH + type + 'list', function (req, res) {
            let config = req.query;
            let controller = RED.nodes.getNode(config.controllerID);
            let devicesIDs = JSON.parse(config.devices);
            if (controller && controller.constructor.name === "ServerNode" && devicesIDs) {

                let type_list = (type === 'state_config') ? ['state', 'config'] : [type];

                let sample = {};
                let count = {};

                for (const type of type_list) {
                    sample[type] = {};
                    count[type] = {};
                }

                for (const deviceID of devicesIDs) {
                    let device = controller.getDeviceByPath(deviceID);
                    if (!device) continue;
                    for (const type of type_list) {
                        if (!device[type]) continue;
                        for (const value of Object.keys(device[type])) {
                            count[type][value] = (count[type][value] || 0) + 1;
                            sample[type][value] = device[type][value];
                        }
                    }
                }

                res.json({count: count, sample: sample});
            } else {
                res.status(404).end();
            }
        });
    });

    RED.httpAdmin.get(NODE_PATH + 'getScenesByDevice', function (req, res) {
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
    });
    // RED.httpAdmin.get(NODE_PATH + 'gwscanner', function (req, res) {
    //     // let ip = require("ip");
    //     // console.log ( ip.address() );
    //
    //     let portscanner = require('portscanner');
    //
    //     // 127.0.0.1 is the default hostname; not required to provide
    //     portscanner.findAPortNotInUse([80], '127.0.0.1').then(port => {
    //         console.log(`Port ${port} is available!`);
    //
    //         // Now start your service on this port...
    //     });
    // });

    RED.httpAdmin.get(NODE_PATH + 'configurationMigration', function (req, res) {
        let data = req.query;
        let config = JSON.parse(data.config);
        let configMigration = new ConfigMigration(data.type, config);
        let controller = RED.nodes.getNode(config.server);
        let result = configMigration.migrate(controller);
        res.json(result);
    });

};
