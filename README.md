# Node-Red deCONZ
[![GitHub](https://img.shields.io/github/license/deconz-community/node-red-contrib-deconz)](https://github.com/deconz-community/node-red-contrib-deconz/blob/main/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/deconz-community/node-red-contrib-deconz/NPM%20Publish)](https://github.com/deconz-community/node-red-contrib-deconz/actions)
[![GitHub release (latest by date including pre-releases)](https://img.shields.io/github/v/release/deconz-community/node-red-contrib-deconz?include_prereleases&label=github&sort=semver)](https://github.com/deconz-community/node-red-contrib-deconz/releases)
[![npm](https://img.shields.io/npm/v/node-red-contrib-deconz)](https://www.npmjs.com/package/node-red-contrib-deconz)
[![dependencies](https://status.david-dm.org/gh/deconz-community/node-red-contrib-deconz.svg)](https://david-dm.org/deconz-community/node-red-contrib-deconz)
[![GitHub issues](https://img.shields.io/github/issues/deconz-community/node-red-contrib-deconz)](https://github.com/deconz-community/node-red-contrib-deconz/issues)
[![Discord](https://img.shields.io/badge/discord-online-success)](https://discord.gg/3XGEYY9)

Node-Red Nodes for deCONZ connectivity.

## The new 2.0 beta version is out [![npm](https://img.shields.io/npm/v/node-red-contrib-deconz/dev)](https://www.npmjs.com/package/node-red-contrib-deconz/dev) ![GitHub commits since latest release (by date)](https://img.shields.io/github/commits-since/deconz-community/node-red-contrib-deconz/v1.3.3/develop)

Hi it's [@Zehir](https://github.com/Zehir) here, I worked hard for months on a complete rework of this plugin. There is a ton of new features, it's will be easier to do stuff on node-red. If you have any issue with this beta version, feel free to open issues on [GitHub](https://github.com/deconz-community/node-red-contrib-deconz/issues).

This new version requires Node-Red version 2.0 or newer. (It's could work with lasted 1.X version of Node-Red).

Some new features:
* Multiple device selection
* Select device using [queries](https://github.com/deconz-community/node-red-contrib-deconz/wiki/Device-queries)
* Multiple commands at once
* Query multiple devices and merge the result
* Many more to come

If you want to try the beta version you can install it from npm using the dev `tag` but you **should** backup your flow and be able to restore your flow if anything goes wrong.

As the current beta.8 everything should keep working after the update. The migration should be seamless, if it's not the case for you please open an [issue](https://github.com/deconz-community/node-red-contrib-deconz/issues).

## Legacy version

The last version of the "legacy" version will by 1.3.3. This version was originally created
by [@Andreypopov](https://github.com/andreypopov), he mentioned that he stopped development. Dennis the Community Manager of deCONZ asked him to transfer the repository so we can advance on it later. Please bear with us.

Available nodes are:

* deconz-in: A node to subscribe to deCONZ devices
* deconz-get: get state of device or group
* deconz-out: send data to device or group
* deconz-battery: get battery status of device
* deconz-event: get all deconz events

<img src="https://github.com/deconz-community/node-red-contrib-deconz/blob/master/readme/1.png?raw=true">
<img src="https://github.com/deconz-community/node-red-contrib-deconz/blob/master/readme/2.png?raw=true">
<img src="https://github.com/deconz-community/node-red-contrib-deconz/blob/master/readme/3.png?raw=true">

<h3>Home Assistant</h3>
Do not forget to open ports:
<img src="https://github.com/andreypopov/node-red-contrib-deconz/blob/master/readme/ha.png?raw=true">

[![Watch YouTube video](https://img.youtube.com/vi/i3TiZiuNofM/0.jpg)](https://www.youtube.com/watch?v=i3TiZiuNofM)
<br>Watch YouTube video


