# Changelog

All notable changes to this project will be documented in this file.

:memo: The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] :construction:
## [2.0.0-beta.9] - 2021-09-22 ![Relative date](https://img.shields.io/date/1632343413?label=)
### Added
- The nodes now allow multiple device selection.
- The nodes accept [queries](https://github.com/deconz-community/node-red-contrib-deconz/wiki/Device-queries) instead of a device list.
- Each outputs of nodes is now customizable. If you don't need the homekit output just remove it !
#### Input node
- New output types
  - Attribute
  - Config
- New properties on messages
  - payload_format - The name of the value or __complete__ if the selected payload is "Complete payload.
  - meta_changed - List of param path that changed since last message. Exemple : "state.lastupdated"
#### Get node
- New output types
  - Attribute
  - Config
- New output formats
  - Single - The node will send a message per device that send data.
  - Array - The node will send a message with all payload inside an array. The message will contain a payload that is an array of single message. Ex msg.payload[0].payload is the payload of the first device. Each element will contain only the properties payload, meta, meta_changed. The properties topic, payload_format, payload_raw will be on the msg directly.
  - Sum - All properties of the devices will be added individually.
  - Average - All properties of the devices will be added recursively and then divided by the amount of device that have that property.
  - Min - The result will be a set of minimal value of each property.
  - Max - The result will be a set of maximal value of each property.
#### Output node
- New output to see the result of the api request.
- All options can be set in one command.
- Multiple commands can be added and executed one by one.
#### Event node
- New message property meta with the device configuration.
#### Battery node
- Same rework as the input node.

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
