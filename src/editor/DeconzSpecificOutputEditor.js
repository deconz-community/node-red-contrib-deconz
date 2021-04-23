class DeconzSpecificOutputEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, $.extend({}, options));
    }

    get elements() {
        return {
            container: 'specific-container',
            delay: 'delay',
            result: 'result'
        };
    }

    async init() {
        await super.init();

        await this.generateSeparator(this.$elements.container, `${this.NRCD}/server:editor.inputs.separator.specific`);
        await this.generateDelayField(this.$elements.container, {
            type: this.node.delay_type,
            value: this.node.delay
        });
        await this.generateResultField(this.$elements.container, {
            type: this.node.result_type,
            value: this.node.result
        });
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

}
