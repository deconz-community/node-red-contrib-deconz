class DeconzSpecificOutputEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, $.extend({}, options));
    }

    get elements() {
        return {
            container: 'specific-container',
            delay: 'node-input-delay',
            result: 'node-input-result'
        };
    }

    get default() {
        return {
            delay: {type: 'num', value: 50},
            result: {type: 'at_end'},
        };
    }

    async init() {
        this.node.specific = $.extend(true, this.default, this.node.specific);
        let container = this.findElement(this.elements.container);
        await this.generateSeparator(container, `${this.NRCD}/server:editor.inputs.separator.specific`);
        await this.generateDelayField(container, this.node.specific.delay);
        await this.generateResultField(container, this.node.specific.result);

        await super.init();

    }

    async generateDelayField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.specific.output.delay`;
        await this.generateTypedInputField(container, {
            id: this.elements.delay,
            i18n,
            value,
            width: '250px',
            typedInput: {types: ['num']}
        });
    }

    async generateResultField(container, value = {}) {
        let i18n = `${this.NRCD}/server:editor.inputs.specific.output.result`;
        await this.generateTypedInputField(container, {
            id: this.elements.result,
            i18n,
            value,
            width: '250px',
            typedInput: {
                types: [
                    this.generateTypedInputType(i18n, 'never', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'after_command', {hasValue: false}),
                    this.generateTypedInputType(i18n, 'at_end', {hasValue: false})
                ]
            }
        });
    }

    async connect() {
        await super.connect();

        /*
        this.$elements.container.closest('.red-ui-tray').on("drag", () => {
            this.$elements.delay.typedInput('width', '100%');
            this.$elements.result.typedInput('width', '100%');
        });

         */

    }

    get value() {
        return {
            delay: {
                type: this.$elements.delay.typedInput('type'),
                value: this.$elements.delay.typedInput('value')
            },
            result: {
                type: this.$elements.result.typedInput('type'),
                value: this.$elements.result.typedInput('value')
            }
        };
    }

}
