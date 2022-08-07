class DeconzSpecificApiEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, $.extend({}, options));
    }

    get elements() {
        return {
            container: 'deconz-api-form',
            name: 'node-config-input-name',
            method: 'node-config-input-method',
            endpoint: 'node-config-input-endpoint',
            payload: 'node-config-input-payload'
        };
    }

    get default() {
        return {
            name: '',
            method: { type: 'GET' },
            endpoint: { type: 'str', value: '/' },
            payload: { type: 'json', value: '{}' }
        };
    }

    async init() {
        this.node.specific = $.extend(true, this.default.specific, this.node.specific);
        let container = this.findElement(this.elements.container);
        await this.generateMethodField(container, this.node.specific.method);
        await this.generateEndpointField(container, this.node.specific.endpoint);
        await this.generatePayloadField(container, this.node.specific.payload);
        await super.init();
    }

    async connect() {
        await super.connect();
    }

    get value() {
        return {
            method: {
                type: this.$elements.method.typedInput('type'),
                value: this.$elements.method.typedInput('value'),
            },
            endpoint: {
                type: this.$elements.endpoint.typedInput('type'),
                value: this.$elements.endpoint.typedInput('value'),
            },
            payload: {
                type: this.$elements.payload.typedInput('type'),
                value: this.$elements.payload.typedInput('value'),
            }
        };
    }

    set value(newValues) {
        this.$elements.name.val(newValues.name);

        // Update type and value for method, endpoint and payload
        for (let field of ['method', 'endpoint', 'payload']) {
            this.$elements[field].typedInput('type', newValues[field].type);
            this.$elements[field].typedInput('value', newValues[field].value);
        }
        for (const element of Object.values(this.$elements)) {
            element.trigger('change');
        }
    }

    async generateMethodField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.specific.api.method`;
        await this.generateTypedInputField(container, {
            id: this.elements.method,
            i18n,
            value,
            width: '250px',
            typedInput: {
                types: [
                    this.generateTypedInputType(i18n, 'GET', { hasValue: false }),
                    this.generateTypedInputType(i18n, 'POST', { hasValue: false }),
                    this.generateTypedInputType(i18n, 'PUT', { hasValue: false }),
                    this.generateTypedInputType(i18n, 'DELETE', { hasValue: false }),
                ]
            }
        });
    }

    async generateEndpointField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.specific.api.endpoint`;
        await this.generateTypedInputField(container, {
            id: this.elements.endpoint,
            i18n,
            value,
            width: '250px',
            typedInput: {
                types: ['str']
            }
        });
    }

    async generatePayloadField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.specific.api.payload`;
        await this.generateTypedInputField(container, {
            id: this.elements.payload,
            i18n,
            value,
            width: '250px',
            typedInput: {
                types: ['json', 'jsonata']
            }
        });
    }

}
