/**
 * @typedef {Object} Device
 * @property {String} device_name
 * @property {String} resource
 * @property {String} uniqueid
 * @property {Object} query
 * @property {String} path
 * @property {Boolean|undefined} query_match
 */

/**
 * @typedef {Object} DeviceMeta
 * @property {String} device_type - The domain of the device
 * @property {Number} device_id - The id of the device
 */


/**
 * @typedef {Object & Device} Light
 * @property {LightMeta} meta
 */

/**
 * @typedef {Object & DeviceMeta} LightMeta
 * @property {Number} colorcapabilities - The color capabilities as reported by the light.
 * @property {Number} ctmax - The maximum mired color temperature value a device supports.
 * @property {Number} ctmin - The minimum mired color temperature value a device supports.
 * @property {String} lastannounced - Last time the device announced itself to the network.
 * @property {String} lastseen - Last time the device has transmitted any data.
 * @property {String} etag - HTTP etag which changes on any action to the light.
 * @property {String} manufacturername - The manufacturer of the light device.
 * @property {String} modelid - An identifier unique to the product.
 * @property {String} name - Name of a light.
 * @property {Number} powerup - SETTABLE. Brightness to set after power on (limited to DE devices).
 * @property {String} swversion - Firmware version.
 * @property {String} type - Human readable type of the light.
 * @property {Object<string,String|Number|Boolean|Array>} state - The current state of the light.
 * @property {String} uniqueid - The unique id of the light. It consists of the MAC address of the light followed by a dash and an unique endpoint identifier in the range 01 to FF.
 */


/**
 * @typedef {Object & Device} Sensor
 * @property {SensorMeta} meta
 */

/**
 * @typedef {Object & DeviceMeta} SensorMeta
 * @property {Object<string,*>} config
 * @property {Number} ep
 * @property {String} etag
 * @property {String} lastseen
 * @property {String} manufacturername
 * @property {String} modelid
 * @property {String} name
 * @property {Object<string,*>} state
 * @property {String} swversion
 * @property {String} type
 * @property {String} uniqueid - The unique id of the light. It consists of the MAC address of the light followed by a dash and an unique endpoint identifier in the range 01 to FF.
 */


/**
 * @typedef {Object} Group
 * @property {String} device_name
 * @property {String} resource
 * @property {GroupMeta} meta
 * @property {Object} query
 * @property {Boolean|undefined} query_match
 * @property {String} path
 */


/**
 * @typedef {Object & DeviceMeta} GroupMeta
 * @property {Object<string,String|Number|Boolean|Array>} action
 * @property {Object<string,String|Number|Boolean|Array>} state
 * @property {Array} devicemembership
 * @property {String} etag
 * @property {String} id
 * @property {String} name
 * @property {String} type
 * @property {Array<String>} lights
 * @property {Array} scenes
 */


/**
 * @typedef {Object} Rule
 * @property {String} type - Can be 'attribute', 'state', 'config', 'homekit'
 * @property {String} format - Can be 'single', 'array', 'sum', 'average', 'min', 'max'
 * @property {String[]} [payload] - Can be '[__complete__'], ['__each__'] or any state/config value in an array.
 * @property {Boolean} onstart
 * @property {Boolean} [onerror]
 * @property {String} [output] - Can be 'always', 'onchange' or 'onupdate'
 */

/**
 *  @property {Object.<string, JQuery>} $elements
 */


class DeconzEditor {

    constructor(node, options = {}) {
        this.node = node;
        this.options = options;
    }

    get elements() {
        return {};
    }

    get NRCD() {
        return 'node-red-contrib-deconz';
    }

    findElements() {
        this.$elements = {};
        Object.keys(this.elements).forEach(k => {
            this.$elements[k] = this.findElement(this.elements[k]);
        });
    }

    findElement(identifier) {
        if (identifier.charAt(0) !== '#' && identifier.charAt(0) !== '.') {
            identifier = '#' + identifier;
        }
        return $(identifier);
    }

    async init() {
        this.findElements();
    }

    async connect() {
    }

    sendError(msg, timeout = 10000) {
        let myNotification = RED.notify(msg, {
            timeout: timeout,
            type: 'error',
            buttons: [{
                'text': 'okay',
                'class': 'primary',
                'click': () => myNotification.close()
            }]
        });
    }


    //#region HTML Helpers

    getIcon(icon, includeClass = false) {
        if (icon === 'deconz') {
            return 'icons/node-red-contrib-deconz/icon-color.png';
        } else if (icon === 'homekit') {
            return 'icons/node-red-contrib-deconz/homekit-logo.png';
        } else if (RED.nodes.fontAwesome.getIconList().includes(`fa-${icon}`)) {
            return `${includeClass ? 'fa ' : ''}fa-${icon}`;
        } else {
            return icon;
        }
    }

    createIconElement(icon, container, isLarge = false) {
        // Based on RED.utils.createIconElement() from node-red core
        if (icon.substr(0, 3) === 'fa-') {
            let fontAwesomeUnicode = RED.nodes.fontAwesome.getIconUnicode(icon);
            if (fontAwesomeUnicode) {
                let faIconElement = $('<i/>').appendTo(container);
                faIconElement.addClass('fa ' + icon + (isLarge ? " fa-lg" : ""));
                return;
            }
            // If the specified name is not defined in font-awesome, show arrow-in icon.
            icon = RED.settings.apiRootUrl + "icons/node-red/arrow-in.svg";
        }
        let imageIconElement = $('<div/>').appendTo(container);
        imageIconElement.css("backgroundImage", "url(" + icon + ")");
    }

    getI18n(prefix, suffix, data = {}) {
        let _path = prefix;
        if (suffix) _path += `.${suffix}`;
        const value = RED._(_path, data);
        if (_path === value) return;
        return value;
    }

    async generateSimpleListField(container, options) {
        let input = $('<select/>', {id: options.id});

        if (options.choices) {
            for (const [key, value] of options.choices) {
                input.append($('<option/>')
                    .attr('value', key)
                    .html(RED._(value))
                );
            }
        }

        let row = await this.generateInputWithLabel(input, options);
        container.append(row);

        if (options.currentValue !== undefined) input.val(options.currentValue);

        return input;
    }

    async generateTypedInput(container, options) {
        let input = $('<input/>', {
            id: options.id,
            placeholder: RED._(options.placeholder)
            //class: 's-width',
        });

        let inputType = $('<input/>', {
            id: `${options.id}_type`,
            //class: 's-width',
            type: 'hidden',
        });

        input.append(inputType);

        return input;
    }


    async initTypedInput(input, options) {
        options = $.extend({
            addDefaultTypes: true,
            displayOnlyIcon: false,
            value: {},
            width: '200px'
        }, options);

        let typedInputOptions = $.extend({
            types: ["msg", "flow", "global"]
        }, options.typedInput);

        typedInputOptions.typeField = options.typeId;

        if (options.addDefaultTypes) {
            typedInputOptions.types.push('msg');
            typedInputOptions.types.push('flow');
            typedInputOptions.types.push('global');
            typedInputOptions.types.push('jsonata');
        }

        if (options.displayOnlyIcon) {
            // TODO Why this ? -> https://github.com/node-red/node-red/issues/2941
            let that = this;
            let valueLabel = function (a, b) {
                let typeDefinition;
                for (const type of this.typeList) {
                    if (typeof type !== 'object') continue;
                    if (type.value === this.propertyType) {
                        typeDefinition = type;
                    }
                }
                if (typeDefinition === undefined) return;
                if (typeDefinition.icon === undefined) return;

                this.oldValue = this.input.val();
                this.input.val("");
                this.valueLabelContainer.hide();
                // TODO update with createIconElement
                that.createIconElement(typeDefinition.icon, this.selectLabel);
                //this.selectLabel.html(`<i class="${typeDefinition.icon}" style="min-width: 13px;margin-right: 4px;"></i>`);
                this.selectTrigger.addClass('red-ui-typedInput-full-width');
                this.selectLabel.show();
            };
            for (let type of typedInputOptions.types) {
                if (typeof type === 'string') continue;
                type.hasValue = true;
                type.valueLabel = valueLabel;
            }
        }
        input.typedInput(typedInputOptions);

        if (options.width !== undefined) input.typedInput('width', options.width);
        if (options.value) {
            if (options.value.type !== undefined) input.typedInput('type', options.value.type);
            if (options.value.value !== undefined) input.typedInput('value', options.value.value);
        }
    }

    async generateTypedInputField(container, options) {
        let input = await this.generateTypedInput(container, {
            id: options.id,
            placeholder: this.getI18n(options.i18n, 'placeholder'),
        });

        let row = await this.generateInputWithLabel(input, options);
        container.append(row);
        await this.initTypedInput(input, options);
        return input;
    }

    async generateDoubleTypedInputField(container, optionsFirst, optionsSecond) {
        let inputFirst = await this.generateTypedInput(container, optionsFirst);
        let row = await this.generateInputWithLabel(inputFirst, optionsFirst);

        let inputSecond = await this.generateTypedInput(container, optionsSecond);
        row.append(inputSecond);

        container.append(row);
        optionsFirst.displayOnlyIcon = true;
        optionsFirst.width = '50px';
        optionsSecond.width = '150px';
        await this.initTypedInput(inputFirst, optionsFirst);
        await this.initTypedInput(inputSecond, optionsSecond);

    }


    generateTypedInputType(i18n, name, data = {}) {
        data.value = name;

        // Load label from i18n
        if (data.label === undefined) {
            data.label = this.getI18n(i18n, `options.${name}.label`, {}) || name;
        }

        // Load icon from i18n
        if (data.icon !== false && data.icon === undefined) {
            data.icon = this.getIcon(this.getI18n(i18n, `options.${name}.icon`));
        }

        if (data.icon && data.icon.substr(0, 3) === 'fa-') {
            data.icon = 'fa ' + data.icon;
        }

        if (Array.isArray(data.subOptions)) {
            if (!Array.isArray(data.options)) {
                data.options = [];
            }
            for (const opt of data.subOptions) {
                data.options.push(
                    this.generateTypedInputType(
                        `${i18n}.options.${name}`, (typeof opt === 'string' ? opt : opt.name),
                        {icon: false}
                    )
                );
            }
        }
        return data;
    }

    async generateCheckboxField(container, options) {

        let input = $('<input/>', {
            id: options.id,
            //class: 's-width',
            type: 'checkbox',
            style: 'display: table-cell; width: 14px;vertical-align: top;margin-right: 5px',
            checked: options.currentValue
        });

        let row = await this.generateInputWithLabel(input, options);
        row.append($('<span/>')
            .html(RED._(options.descText))
            .css('display', 'table-cell')
        );

        container.append(row);
    }

    async generateInputWithLabel(input, options = {}) {
        let row = $('<div/>', {
            class: 'form-row',
            style: 'padding:5px;margin:0;display:table;min-width:420px;'
        });
        let inputID = input.attr('id');
        if (inputID) {
            let labelElement = $('<label/>');
            labelElement.attr('for', inputID);
            labelElement.attr('class', 'l-width');
            labelElement.attr('style', 'display:table-cell;');

            // Try to load a title from i18n.
            if (options.title === undefined) {
                options.title = this.getI18n(options.i18n, 'title');
            }
            // Add Title
            if (options.title) {
                labelElement.attr('title', this.getI18n(options.i18n, 'title'));
            }

            // Try to load an icon from i18n.
            if (options.icon === undefined) {
                options.icon = this.getI18n(options.i18n, 'icon');
            }
            // Add icon if exist
            if (options.icon) {
                this.createIconElement(this.getIcon(options.icon), labelElement);
                labelElement.append('&nbsp;');
            }

            // Try to load a label from i18n.
            if (options.label === undefined) {
                options.label = this.getI18n(options.i18n, 'label');
            }
            // Add label
            if (options.label) {
                labelElement.append(`<span>${options.label}</span>`);
            }

            row.append(labelElement);
        }
        input.css('display', 'table-cell');
        row.append(input);

        return row;
    }

    async generateHR(container, topBottom = '5px', leftRight = '50px') {
        container.append(`<hr style="margin: ${topBottom} ${leftRight};">`);
    }

    async generateSeparator(container, label) {
        container.append(`<div class="separator">${RED._(label)}</div>`);
    }

    //#endregion


}

