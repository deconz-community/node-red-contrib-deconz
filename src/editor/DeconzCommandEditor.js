class DeconzCommandEditor extends DeconzListItemEditor {

    constructor(node, listEditor, container, options = {}) {
        options = $.extend({}, options);
        super(node, listEditor, container, options);
    }

    get elements() {
        let keys = [
            'typedomain',
            'on',
            'alert', 'effect', 'colorloopspeed',
            'transitiontime',
            // Windows Cover
            'open', 'stop', 'lift', 'tilt',
            // Scene
            'scenecallgroup', 'scenecallscene'
        ];

        for (const lightKey of ['bri', 'sat', 'hue', 'ct', 'xy']) {
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
        let value = {};


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
         * @property {TypedInput} on - Turn true = on or false = off, null = nothing, toogle = toogle
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
         * @typedef {Object} Command
         * @property {String} type - Can be 'deconz', 'custom', 'animation', 'pause', 'homekit'
         * @property {String} domain - Can be 'light', 'cover', 'sensor', 'group'
         * @property {String} target - Can be 'attribute', 'state', 'config'
         * @property {LightCommandArgs|CoverCommandArgs|Object} arg - An object of key value of settings
         */
        return {
            type: 'deconz',
            domain: 'light',
            target: 'state',
            arg: {
                on: {type: 'keep'},
                bri: {direction: 'set', type: 'keep'},
                sat: {direction: 'set', type: 'keep'},
                hue: {direction: 'set', type: 'keep'},
                ct: {direction: 'set', type: 'keep'},
                xy: {direction: 'set', type: 'keep'},
                alert: {type: 'keep'},
                effect: {type: 'keep'},
                colorloopspeed: {type: 'keep'},
                transitiontime: {type: 'keep'}
            }
        };
    }

    async init(command, index) {
        this._index = index;

        if (command === undefined || command.type === undefined) {
            command = this.defaultCommand;
        }

        //TODO For debug
        command = this.defaultCommand;
        command.domain = 'scene';

        await this.generateTypeDomainField(this.container, {type: command.type, value: command.domain});

        /*
        // Lights
        await this.generateLightOnField(this.container, command.arg.on);
        for (const lightType of ['bri', 'sat', 'hue', 'ct', 'xy']) {
            await this.generateLightColorField(this.container, lightType, command.arg[lightType]);
            if (lightType === 'bri') await this.generateHR(this.container);
        }
        await this.generateHR(this.container);
        await this.generateLightAlertField(this.container, command.arg.alert);
        await this.generateLightEffectField(this.container, command.arg.effect);
        await this.generateLightColorLoopSpeedField(this.container, command.arg.colorloopspeed);

        // Windows Cover
        await this.generateCoverOpenField(this.container, command.arg.open);
        await this.generateCoverStopField(this.container, command.arg.stop);
        await this.generateCoverLiftField(this.container, command.arg.lift);
        await this.generateCoverTiltField(this.container, command.arg.tilt);

        await this.generateHR(this.container);
        await this.generateCommonTransitionTimeField(this.container, command.arg.transitiontime);
        */

        // Groups
        //TODO call scene
        await this.generateSceneGroupField(this.container, command.arg.group);
        await this.generateSceneSceneField(this.container, command.arg.scene);


        await super.init();

        await this.listEditor.mainEditor.isInitialized();

        await this.connect();

    }

    async connect() {
        await super.connect();
    }

    async generateTypeDomainField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type`;
        let input = await this.generateTypedInputField(container, {
            id: this.elements.typedomain,
            i18n,
            value,
            addDefaultTypes: false,
            typedInput: {
                default: 'deconz',
                types: [
                    this.generateTypedInputType(i18n, 'deconz', {
                        subOptions: ['light', 'cover', 'group', 'scene']
                    }),
                    this.generateTypedInputType(i18n, 'homekit', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'custom', {hasValue: false}),
                    //this.generateTypedInputType(i18n, 'animation', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'pause', {hasValue: false}),
                ]
            }
        });
        //TODO this may broke later -> https://github.com/node-red/node-red/issues/2942
        //input.typedInput('disable', true);
    }

    //#region Light HTML Helpers
    async generateLightOnField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.light.fields.on`;
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
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.light.fields`;
        let fieldFormat = [fieldName !== 'xy' ? "num" : "json"];
        await this.generateDoubleTypedInputField(container,
            {
                id: this.elements[`${fieldName}_direction`],
                i18n: `${i18n}.${fieldName}`,
                addDefaultTypes: false,
                currentType: value.direction,
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
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.light.fields.alert`;
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
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.light.fields.effect`;
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
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.light.fields.colorloopspeed`;
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
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.cover.fields.open`;
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
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.cover.fields.stop`;
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
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.cover.fields.lift`;
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
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.cover.fields.tilt`;
        await this.generateTypedInputField(container, {
            id: this.elements.tilt,
            i18n,
            value,
            typedInput: {types: ['num']}
        });
    }

    //#endregion

    async generateCommonTransitionTimeField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.common.fields.transitiontime`;
        await this.generateTypedInputField(container, {
            id: this.elements.transitiontime,
            i18n,
            value,
            typedInput: {types: ["num"]}
        });
    }


    //#region Scene HTML Helpers
    async generateSceneGroupField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.scene.fields.group`;
        await this.generateTypedInputField(container, {
            id: this.elements.scenecallgroup,
            i18n,
            value,
            typedInput: {types: ['num']}
        });
    }

    async generateSceneSceneField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.commands.type.options.deconz.options.scene.fields.scene`;
        await this.generateTypedInputField(container, {
            id: this.elements.scenecallscene,
            i18n,
            value,
            typedInput: {types: ['num']}
        });
    }

    //#endregion
}

