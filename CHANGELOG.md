# Changelog

All notable changes to this project will be documented in this file.

:memo: The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] :construction:

## [2.1.3] - 2021-12-06 ![Relative date](https://img.shields.io/date/1638803271?label=)

### Fixed

- Fix error msg for device with no color. Fix #182.
- Fix input node displaying incorrect status.

## [2.1.2] - 2021-11-26 ![Relative date](https://img.shields.io/date/1637939322?label=)

### Fixed

- Fix formatting value of ContactSensorState for HomeKit. (@WildPhilippAppeared - #180)

## [2.1.1] - 2021-11-25 ![Relative date](https://img.shields.io/date/1637877535?label=)

### Fixed

- Fix tests of configuration migration.

## [2.1.0] - 2021-11-25 ![Relative date](https://img.shields.io/date/1637870587?label=)

### Added

#### HomeKit format

- You can now select which characteristics you want in the payload.
- Initial support for ZHAThermostat. Can be used with Heater Cooler or Thermostat.

### Changed

#### HomeKit format

- Rework HomeKit attributes handling.
- The characteristics 'Hue', 'Saturation' and 'ColorTemperature' are now only added if the colormode of the light is '
  hs' or 'ct'.

### Fixed

- Fix add button now showing up in NR 1.2.9 on the Output rules and Commands.

## [2.0.8] - 2021-10-22 ![Relative date](https://img.shields.io/date/1634857494?label=)

### Added

- Backward compatibility for Node-Red 1.2.9.

### Fixed

- Migration of device when undefined.

## [2.0.7] - 2021-10-17 ![Relative date](https://img.shields.io/date/1634484549?label=)

### Fixed

- Ignore group 0 if he doesn’t exist instead of staying stuck.
- Fix toggle values for windows cover.
- Discard empty numeric values instead of convert them to 0.
- Fix device type detection for windows cover.

## [2.0.6] - 2021-10-13 ![Relative date](https://img.shields.io/date/1634158098?label=)

### Fixed

- Selecting an other server update the device list.
- Duplicate gateways in discovery are ignored.
- HomeKit format now send battery data only from the battery node.

## [2.0.5] - 2021-10-13 ![Relative date](https://img.shields.io/date/1634079545?label=)

### Fixed

- Fix HomeKit loop detection.
- Fix node error on partial deploy.

## [2.0.4] - 2021-10-11 ![Relative date](https://img.shields.io/date/1633986241?label=)

### Changed

- Cleanup old files.

## [2.0.3] - 2021-10-11 ![Relative date](https://img.shields.io/date/1633985783?label=)

### Added

- Magic 'All' group is not displayed in the groups list with the id 0.
- Display an error message if a device is not found on output nodes and continue processing.

### Fixed

- The msg that go through HomeKit and back to an output node are now discarded with a warning message.
- Attribute requests was not updating if there was no config.

## [2.0.2] - 2021-10-10 ![Relative date](https://img.shields.io/date/1633881662?label=)

### Fixed

- Update read me image url.

## [2.0.1] - 2021-10-10 ![Relative date](https://img.shields.io/date/1633879095?label=)

### Fixed

- Update npm deployment workflow.

## [2.0.0] - 2021-10-10 ![Relative date](https://img.shields.io/date/1633877978?label=)

### Migrate from 1.3.4

Make sure you backup your flow before updating, you will not be able to downgrade if the configuration is migrated.

Everything should be seamless, all your configurations will be migrated to the new save format. It will save the updated
configuration only when you open the node configuration and click Deploy. If you are not performing it, the node will
migrate the configuration on each start of Node-Red. Check the Node-Red log if you have any errors that shows up. If you
have any issues you may visit the [Deconz-Community Discord](https://discord.gg/3XGEYY9) server or open
an [issue on Github](https://github.com/deconz-community/node-red-contrib-deconz/issues).

### Added

- The nodes now allow multiple device selection.
- The nodes accept [queries](https://deconz-community.github.io/node-red-contrib-deconz/device_queries/) instead of a
  device list.
- Each outputs of the nodes are now customizable. If you don't need the HomeKit output, just remove it.
- Reworked the Auto configuration of server. It looks for Home-Assistant installations as well.

#### Input and Battey nodes

- New output types
    - Attribute - Contains all information about the device, include State and Config.
    - Config - Contains configuration data.
    - Scene Call - Called when a scene is called.
- New properties on messages
    - payload_format - The name of the value or __complete__ if the selected payload is "Complete payload".
    - payload_type - The option selected in the output type.
    - meta_changed - List of param path that changed since last message. Exemple : "state.lastupdated".
- Connection preview, you can press the top right button of each output rule to see what nodes are connected.
- Start output is now configurable for each type. To avoid fake button events you should disable it for switch devices.

#### Get node

- New output types
    - Attribute
    - Config
- New output formats
    - Single - The node will send a message per device that sends data.
    - Array - The node will send a message with all payload inside an array. The message will contain a payload that is
      an array of single message. E.g. msg.payload[0].payload is the payload of the first device. Each element will
      contain only the properties payload, meta, meta_changed. The properties topic, payload_format, payload_raw will be
      on the msg directly.
    - Sum - All properties of the devices will be added individually.
    - Average - All properties of the devices will be added recursively and then divided by the number of devices that
      have that property.
    - Min - The result will be a set with the minimal value of each property.
    - Max - The result will be a set with the maximal value of each property.

#### Output node

- New command types
    - Windows Cover - For easier comprehension of commands.
    - Custom command - For thoses tricky things that don't fit in a Deconz state command.
        - Target - Set where you wan't to send data. Can be 'attribute', 'state' or 'config'.
        - Command - Set the option name. Can be object if the payload contains an object with keys and values.
        - Payload - Set the value.
    - Pause - Add delay between 2 commands.
- Added output to see the result of the api request.
- All options can be set in one command. You can now set brightness and color in a single step.
- Multiple commands can be added and executed one by one.
- Command preview, you can press the top right button of each command to run it instantly.

#### Event node

- New message property meta is associated to the event with the device configuration.
- Now displays the event count since the last deploy.

## [1.3.4] - 2021-09-28 ![Relative date](https://img.shields.io/date/1632782604?label=)

### Changed

- Update readme for 2.0 version.

## [1.3.3] - 2021-06-20 ![Relative date](https://img.shields.io/date/1624190689?label=)

### Fixed

- Update multi-select to 1.15.2 for monaco-editor compatibility in node-red 2.0. #140

## [1.3.2] - 2021-03-06 ![Relative date](https://img.shields.io/date/1615059740?label=)

### Fixed

- Device list was empty. #89

## [1.3.1] - 2021-02-20 ![Relative date](https://img.shields.io/date/1613827429?label=)

### Fixed

- Removed unwanted transition time on out node when the transition time is not set. #118

## [1.3.0] - 2021-02-19 ![Relative date](https://img.shields.io/date/1613738128?label=)

### Added

- Adding the possibility to change progamatically the "Transition Time". #107

### Security

Please edit server configuration and click on update to save the API Key in node-red credentials.

- API Key is now stored in node-red credentials. #94

## [1.2.0] - 2020-07-12 ![Relative date](https://img.shields.io/date/1594559914?label=)

- Lastest version from [@andreypopov](https://github.com/andreypopov).
