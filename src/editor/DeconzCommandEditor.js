class DeconzCommandEditor extends DeconzListItemEditor {

    constructor(node, listEditor, container, options = {}) {
        options = $.extend({}, options);
        super(node, listEditor, container, options);
        this.containers = {};
    }

    get lightKeys() {
        return ['bri', 'sat', 'hue', 'ct', 'xy'];
    }

    get argKeys() {
        return [
            'on',
            'alert', 'effect', 'colorloopspeed',
            // Windows Cover
            'open', 'stop', 'lift', 'tilt',
            // Scene
            'scenecallgroup', 'scenecallscene',
            // Homekit, object
            'target',
            'command',
            'payload',
            // Pause
            'delay',
            // Common
            'transitiontime',
            'retryonerror',
            'aftererror',
        ];
    }

    get elements() {
        let keys = this.argKeys;
        keys.push('typedomain');
        keys.push('outputButton');
        for (const lightKey of this.lightKeys) {
            keys.push(lightKey);
            keys.push(lightKey + '_direction');
        }

        let elements = {};
        for (const key of keys) {
            elements[key] = `node-input-output-rule-${this.uniqueId}-${key}`;
        }
        return elements;
    }

    set value(command) {

    }

    get value() {
        let value = {
            arg: {}
        };

        value.type = this.$elements.typedomain.typedInput('type');
        value.domain = this.$elements.typedomain.typedInput('value');

        for (const key of this.argKeys) {
            value.arg[key] = {
                type: this.$elements[key].typedInput('type'),
                value: this.$elements[key].typedInput('value')
            };
        }

        for (const key of this.lightKeys) {
            value.arg[key] = {
                direction: this.$elements[key + '_direction'].typedInput('type'),
                type: this.$elements[key].typedInput('type'),
                value: this.$elements[key].typedInput('value')
            };
        }

        return value;
    }


    /**
     *
     * @returns {Command}
     */
    get defaultCommand() {
        /**
         * @typedef {Object} TypedInput
         * @property {String} type - Type
         * @property {*} value - Value
         */
        /**
         * @typedef {Object} LightArgs
         * @property {String} direction - Can be keep,set,inc,dec
         * @property {String} type - Can be keep,set,inc,dec
         * @property {Number|Array|null} value - Value numeric or [0.5,0.5]
         */
        /**
         * @typedef {Object} LightCommandArgs
         * @property {TypedInput} on - Turn true = on or false = off, "" = nothing, toogle = toogle
         * @property {LightArgs} bri - Brightness value
         * @property {LightArgs} sat - Color saturation
         * @property {LightArgs} hue - Color hue
         * @property {LightArgs} ct - Mired color temperature
         * @property {LightArgs} xy - CIE xy color space coordinates
         * @property {TypedInput} alert - Can be none/select/lselect
         * @property {TypedInput} effect - Can be none/colorloop
         * @property {TypedInput} colorloopspeed - (default: 15). 1 = very fast 255 = very slow
         * @property {TypedInput} transitiontime - Transition time in 1/10 seconds between two states.
         */
        /**
         * @typedef {Object} CoverCommandArgs
         * @property {Boolean|String} open - Turn true = open or false = closed, null = nothing, toogle = toogle
         * @property {Boolean} stop - Stop the current action
         * @property {Number|String|null} lift - 0 to 100 or stop or null
         * @property {Number|null} tilt - 0 to 100 or null
         */
        /**
         * @typedef {Object} CustomCommandArgs
         * @property {String} target - Can be 'attribute', 'state', 'config'
         * @property {TypedInput} command - Value name to set or object
         * @property {TypedInput} payload - Value to set or array of values if command is object
         */
        /**
         * @typedef {Object} Command
         * @property {String} type - Can be 'deconz_state', 'custom', 'pause', 'homekit'
         * @property {String} domain - Can be 'light', 'cover', 'group', 'scene'
         * @property {LightCommandArgs|CoverCommandArgs|CustomCommandArgs|Object} arg - An object of key value of settings
         */
        return {
            type: 'deconz_state',
            domain: 'light',
            target: 'state',
            arg: {
                on: {type: 'keep'},
                bri: {direction: 'set', type: 'num'},
                sat: {direction: 'set', type: 'num'},
                hue: {direction: 'set', type: 'num'},
                ct: {direction: 'set', type: 'num'},
                xy: {direction: 'set', type: 'num'},
                alert: {type: 'str'},
                effect: {type: 'str'},
                colorloopspeed: {type: 'num'},
                transitiontime: {type: 'num'},
                command: {type: 'str', value: 'on'},
                payload: {type: 'msg', value: 'payload'},
                delay: {type: 'num', value: 2000},
                target: {type: 'state'},
                group: {type: 'num'},
                scene: {type: 'num'},
                retryonerror: {type: 'num', value: 0},
                aftererror: {type: 'continue'}
            }
        };
    }

    async init(command, index) {
        this._index = index;
        command = $.extend(true, this.defaultCommand, command);

        await this.generateTypeDomainField(this.container, {type: command.type, value: command.domain});

        // Lights
        this.containers.light = $('<div>').appendTo(this.container);
        await this.generateLightOnField(this.containers.light, command.arg.on);
        for (const lightType of ['bri', 'sat', 'hue', 'ct', 'xy']) {
            await this.generateLightColorField(this.containers.light, lightType, command.arg[lightType]);
            if (lightType === 'bri') await this.generateHR(this.containers.light);
        }
        await this.generateHR(this.containers.light);
        await this.generateLightAlertField(this.containers.light, command.arg.alert);
        await this.generateLightEffectField(this.containers.light, command.arg.effect);
        await this.generateLightColorLoopSpeedField(this.containers.light, command.arg.colorloopspeed);

        // Windows Cover
        this.containers.windows_cover = $('<div>').appendTo(this.container);
        await this.generateCoverOpenField(this.containers.windows_cover, command.arg.open);
        await this.generateCoverStopField(this.containers.windows_cover, command.arg.stop);
        await this.generateCoverLiftField(this.containers.windows_cover, command.arg.lift);
        await this.generateCoverTiltField(this.containers.windows_cover, command.arg.tilt);

        // Scenes
        this.containers.scene = $('<div>').appendTo(this.container);
        await this.generateSceneGroupField(this.containers.scene, command.arg.group);
        await this.generateSceneSceneField(this.containers.scene, command.arg.scene);

        // Command
        this.containers.command = $('<div>').appendTo(this.container);
        await this.generateTargetField(this.containers.command, command.arg.target);
        await this.generateCommandField(this.containers.command, command.arg.command);

        // Payload
        this.containers.payload = $('<div>').appendTo(this.container);
        await this.generatePayloadField(this.containers.payload, command.arg.payload);

        // Pause
        this.containers.pause = $('<div>').appendTo(this.container);
        await this.generatePauseDelayField(this.containers.pause, command.arg.delay);

        // Common
        this.containers.transition = $('<div>').appendTo(this.container);
        await this.generateHR(this.containers.transition);
        await this.generateCommonTransitionTimeField(this.containers.transition, command.arg.transitiontime);


        this.containers.common = $('<div>').appendTo(this.container);
        await this.generateHR(this.containers.common);
        await this.generateCommonOnErrorRetryField(this.containers.common, command.arg.retryonerror);
        await this.generateCommonOnErrorAfterField(this.containers.common, command.arg.aftererror);

        await this.updateShowHide(command.type, command.domain);

        await super.init();

        await this.listEditor.mainEditor.isInitialized();

        await this.connect();

    }

    async connect() {
        await super.connect();

        this.$elements.typedomain.on('change', (event, type, value) => {
            this.updateShowHide(type, value);
        });
    }

    async updateShowHide(type, domain) {
        let containers = [];
        switch (type) {
            case 'deconz_state':
                switch (domain) {
                    case 'light':
                    case 'group':
                        containers.push('light');
                        containers.push('transition');
                        break;
                    case 'cover':
                        containers.push('windows_cover');
                        break;
                    case 'scene':
                        containers.push('scene');
                        break;
                }
                containers.push('common');
                break;
            case 'homekit':
                // TODO filter payload to have only msg, flow, global, json, jsonata
                containers.push('payload');
                containers.push('transition');
                containers.push('common');
                break;
            case 'custom':
                containers.push('command');
                containers.push('payload');
                containers.push('transition');
                containers.push('common');
                break;
            /* Planned for 2.1
        case 'animation':
            break;
             */
            case 'pause':
                containers.push('pause');
                break;
        }
        for (const [key, value] of Object.entries(this.containers)) {
            value.toggle(containers.includes(key));
        }
    }

    async generateTypeDomainField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type`;
        await this.generateTypedInputField(container, {
            id: this.elements.typedomain,
            i18n,
            value,
            addDefaultTypes: false,
            typedInput: {
                default: 'deconz_state',
                types: [
                    this.generateTypedInputType(i18n, 'deconz_state', {
                        subOptions: ['light', 'cover', 'group', 'scene']
                    }),
                    this.generateTypedInputType(i18n, 'homekit', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'custom', {hasValue: false}),
                    //this.generateTypedInputType(i18n, 'animation', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'pause', {hasValue: false}),
                ]
            }
        });
    }

    //#region Light HTML Helpers
    async generateLightOnField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.light.fields.on`;
        await this.generateTypedInputField(container, {
            id: this.elements.on,
            i18n,
            value,
            typedInput: {
                default: 'keep',
                types: [
                    this.generateTypedInputType(i18n, 'keep', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'set', {subOptions: ['true', 'false']}),
                    this.generateTypedInputType(i18n, 'toogle', {hasValue: false}),
                ]
            }
        });
    }

    async generateLightColorField(container, fieldName, value = {}) {
        //TODO revoir l'import de la valeur
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.light.fields`;
        let fieldFormat = [fieldName !== 'xy' ? "num" : "json"];
        if (fieldName === 'ct') {
            fieldFormat.push(this.generateTypedInputType(`${i18n}.ct`, 'deconz', {
                subOptions: ['cold', 'white', 'warm']
            }));
        }
        await this.generateDoubleTypedInputField(container,
            {
                id: this.elements[`${fieldName}_direction`],
                i18n: `${i18n}.${fieldName}`,
                addDefaultTypes: false,
                value: {type: value.direction},
                typedInput: {
                    types: [
                        this.generateTypedInputType(`${i18n}.lightFields`, 'set', {hasValue: false}),
                        this.generateTypedInputType(`${i18n}.lightFields`, 'inc', {hasValue: false}),
                        this.generateTypedInputType(`${i18n}.lightFields`, 'dec', {hasValue: false}),
                    ]
                }
            }, {
                id: this.elements[fieldName],
                value: {
                    type: value.type,
                    value: [fieldName !== 'xy' ? value.value : (value.value === undefined ? '[]' : value.value)]
                },
                typedInput: {
                    types: fieldFormat
                }
            }
        );
    }

    async generateLightAlertField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.light.fields.alert`;
        await this.generateTypedInputField(container, {
            id: this.elements.alert,
            i18n,
            value,
            typedInput: {
                types: [
                    "str",
                    this.generateTypedInputType(i18n, 'none', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'select', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'lselect', {hasValue: false}),
                ]
            }
        });
    }

    async generateLightEffectField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.light.fields.effect`;
        await this.generateTypedInputField(container, {
            id: this.elements.effect,
            i18n,
            value,
            typedInput: {
                types: [
                    "str",
                    this.generateTypedInputType(i18n, 'none', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'colorloop', {hasValue: false})
                ]
            }
        });
    }

    async generateLightColorLoopSpeedField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.light.fields.colorloopspeed`;
        await this.generateTypedInputField(container, {
            id: this.elements.colorloopspeed,
            i18n,
            value,
            typedInput: {types: ["num"]}
        });
    }

    //#endregion

    //#region Cover HTML Helpers
    async generateCoverOpenField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.cover.fields.open`;
        await this.generateTypedInputField(container, {
            id: this.elements.open,
            i18n,
            value,
            typedInput: {
                types: [
                    this.generateTypedInputType(i18n, 'keep', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'set', {subOptions: ['true', 'false']}),
                    this.generateTypedInputType(i18n, 'toogle', {hasValue: false}),
                ]
            }
        });
    }

    async generateCoverStopField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.cover.fields.stop`;
        await this.generateTypedInputField(container, {
            id: this.elements.stop,
            i18n,
            value,
            typedInput: {
                types: [
                    this.generateTypedInputType(i18n, 'keep', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'set', {subOptions: ['true', 'false']})
                ]
            }
        });
    }

    async generateCoverLiftField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.cover.fields.lift`;
        await this.generateTypedInputField(container, {
            id: this.elements.lift,
            i18n,
            value,
            typedInput: {
                types: [
                    'num',
                    'str',
                    this.generateTypedInputType(i18n, 'stop', {hasValue: false}),
                ]
            }
        });
    }

    async generateCoverTiltField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.cover.fields.tilt`;
        await this.generateTypedInputField(container, {
            id: this.elements.tilt,
            i18n,
            value,
            typedInput: {types: ['num']}
        });
    }

    //#endregion

    //#region Scene HTML Helpers
    async generateSceneGroupField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.scene.fields.group`;
        await this.generateTypedInputField(container, {
            id: this.elements.scenecallgroup,
            i18n,
            value,
            typedInput: {
                types: [
                    'num',
                    this.generateTypedInputType(i18n, 'from_device', {hasValue: false}),
                ]
            }
        });
    }

    async generateSceneSceneField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.scene.fields.scene`;
        await this.generateTypedInputField(container, {
            id: this.elements.scenecallscene,
            i18n,
            value,
            typedInput: {types: ['num', 'str']}
        });
    }

    //#endregion

    //#region Common HTML Helpers
    async generateTargetField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.common.fields.target`;
        await this.generateTypedInputField(container, {
            id: this.elements.target,
            i18n,
            value,
            typedInput: {
                types: [
                    this.generateTypedInputType(i18n, 'attribute', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'state', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'config', {hasValue: false})
                ]
            }
        });
    }

    async generateCommandField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.common.fields.command`;
        await this.generateTypedInputField(container, {
            id: this.elements.command,
            i18n,
            value,
            typedInput: {
                types: [
                    'str',
                    this.generateTypedInputType(i18n, 'object', {hasValue: false})
                ]
            }
        });
    }

    async generatePayloadField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.common.fields.payload`;
        await this.generateTypedInputField(container, {
            id: this.elements.payload,
            i18n,
            value,
            addDefaultTypes: false,
            typedInput: {
                types: [
                    'msg', 'flow', 'global',
                    'str', 'num', 'bool',
                    'json', 'jsonata',
                    'date'
                ]
            }
        });
    }

    //#endregion

    //#region Pause HTML Helpers
    async generatePauseDelayField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.pause.fields.delay`;
        await this.generateTypedInputField(container, {
            id: this.elements.delay,
            i18n,
            value,
            typedInput: {
                types: [
                    'num',
                ]
            }
        });
    }

    //#endregion

    //#region Transition HTML Helpers
    async generateCommonTransitionTimeField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.common.fields.transitiontime`;
        await this.generateTypedInputField(container, {
            id: this.elements.transitiontime,
            i18n,
            value,
            typedInput: {types: ["num"]}
        });
    }

    //#endregion

    //#region Option HTML Helpers
    async generateCommonOnErrorRetryField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.common.fields.retryonerror`;
        await this.generateTypedInputField(container, {
            id: this.elements.retryonerror,
            i18n,
            value,
            typedInput: {
                types: ['num']
            }
        });
    }

    async generateCommonOnErrorAfterField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz_state.options.common.fields.aftererror`;
        await this.generateTypedInputField(container, {
            id: this.elements.aftererror,
            i18n,
            value,
            typedInput: {
                types: [
                    this.generateTypedInputType(i18n, 'continue', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'stop', {hasValue: false})
                ]
            }
        });
    }

    //#endregion

}

