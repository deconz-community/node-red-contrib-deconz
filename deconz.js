var request = require('request');
var NODE_PATH = '/deconz/';

module.exports = function (RED) {
    /**
     * Enable http route to static files
     */
    RED.httpAdmin.get(NODE_PATH + 'static/*', function (req, res) {
        var options = {
            root: __dirname + '/static/',
            dotfiles: 'deny'
        };
        res.sendFile(req.params[0], options);
    });


    /**
     * Enable http route to JSON itemlist for each controller (controller id passed as GET query parameter)
     */
    RED.httpAdmin.get(NODE_PATH + 'itemlist', function (req, res) {
        var config = req.query;
        var controller = RED.nodes.getNode(config.controllerID);
        var forceRefresh = config.forceRefresh ? ['1', 'yes', 'true'].includes(config.forceRefresh.toLowerCase()) : false;

        if (controller && controller.constructor.name === "ServerNode") {
            controller.getItemsList(function (items, groups) {
                if (items) {
                    res.json({items:items, groups:groups});
                } else {
                    res.status(404).end();
                }
            }, forceRefresh);
        } else {
            res.status(404).end();
        }
    });

    RED.httpAdmin.get(NODE_PATH + 'statelist', function (req, res) {
        var config = req.query;
        var controller = RED.nodes.getNode(config.controllerID);
        if (controller && controller.constructor.name === "ServerNode") {
            var item = controller.getDevice(config.uniqueid);
            if (item) {
                res.json(item.state);
            } else {
                res.status(404).end();
            }
        } else {
            res.status(404).end();
        }
    });

    RED.httpAdmin.get(NODE_PATH + 'getScenesByDevice', function (req, res) {
        var config = req.query;
        var controller = RED.nodes.getNode(config.controllerID);
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
    //     // var ip = require("ip");
    //     // console.log ( ip.address() );
    //
    //     var portscanner = require('portscanner');
    //
    //     // 127.0.0.1 is the default hostname; not required to provide
    //     portscanner.findAPortNotInUse([80], '127.0.0.1').then(port => {
    //         console.log(`Port ${port} is available!`);
    //
    //         // Now start your service on this port...
    //     });
    // });
}
