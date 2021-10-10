# Node-Red deCONZ

[![GitHub](https://img.shields.io/github/license/deconz-community/node-red-contrib-deconz)](https://github.com/deconz-community/node-red-contrib-deconz/blob/main/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/deconz-community/node-red-contrib-deconz/NPM%20Publish)](https://github.com/deconz-community/node-red-contrib-deconz/actions)
[![GitHub release (latest by date including pre-releases)](https://img.shields.io/github/v/release/deconz-community/node-red-contrib-deconz?include_prereleases&label=github&sort=semver)](https://github.com/deconz-community/node-red-contrib-deconz/releases)
[![npm](https://img.shields.io/npm/v/node-red-contrib-deconz)](https://www.npmjs.com/package/node-red-contrib-deconz)
[![GitHub issues](https://img.shields.io/github/issues/deconz-community/node-red-contrib-deconz)](https://github.com/deconz-community/node-red-contrib-deconz/issues)
[![Discord](https://img.shields.io/badge/discord-online-success)](https://discord.gg/3XGEYY9)

Node-Red Nodes for deCONZ connectivity.

## The new 2.0 version is out

Hi it's [@Zehir](https://github.com/Zehir) here, I worked hard for months on a complete rework of this plugin. There is
a ton of new features, it's will be easier to do stuff on node-red. If you have any issue with this beta version, feel
free to open issues on [GitHub](https://github.com/deconz-community/node-red-contrib-deconz/issues).

This new version requires Node-Red version 2.0 or newer.

Some new features ([Changelog](https://github.com/deconz-community/node-red-contrib-deconz/blob/develop/CHANGELOG.md)):

* Multiple device selection.
* Select device using [queries](https://github.com/deconz-community/node-red-contrib-deconz/wiki/Device-queries).
* Multiple commands at once.
* Query multiple devices and merge the result.

### Migrate from 1.3.4

Make sure you backup your flow before updating, you will not be able to downgrade if the configuration is migrated.

Everything should be seamless, all your configuration will be migrated with the new save format. It's will save the
updated configuration only when you open the node configuration and click Deploy. If you don't do it the node will
migrate the configuration on each start of Node-Red. Check the Node-Red log if you have any errors that showes up. If
you have any issues you can come on the [Deconz-Community Discord](https://discord.gg/3XGEYY9) server or open
an [issue on Github](https://github.com/deconz-community/node-red-contrib-deconz/issues).

## Available nodes

* deconz-in: A node to subscribe to deCONZ events.
* deconz-get: get state of device or group.
* deconz-out: send actions or data to device or group.
* deconz-battery: get battery status of device
* deconz-event: get all deconz events

![Flow sample](https://github.com/deconz-community/node-red-contrib-deconz/blob/master/readme/flow_sample.png?raw=true)
![Server setup](https://github.com/deconz-community/node-red-contrib-deconz/blob/master/readme/server_setup.png?raw=true)
![Get node](https://github.com/deconz-community/node-red-contrib-deconz/blob/master/readme/get_node.png?raw=true)
![Out node](https://github.com/deconz-community/node-red-contrib-deconz/blob/master/readme/out_node.png?raw=true)

## Home Assistant

Do not forget to open ports if you are using Node-Red from outside Home Assistant containers :
![HA setup](https://github.com/deconz-community/node-red-contrib-deconz/blob/master/readme/ha_setup.png?raw=true)

## Legacy version

The last version of the "legacy" version will be 1.3.4. This version was originally created
by [@Andreypopov](https://github.com/andreypopov), he mentioned that he stopped development. Dennis the Community
Manager of deCONZ asked him to transfer the repository so we can advance on it later. Please bear with us.
