class DeconzListItemEditor extends DeconzEditor {

    constructor(node, listEditor, container, options = {}) {
        super(node, options);
        this.listEditor = listEditor;
        container.uniqueId();
        this.uniqueId = container.attr('id');
        this.container = container;
    }

    //#region Index Setter/Getter
    set index(value) {
        if (value !== undefined && this.$elements && this.$elements.outputButton)
            this.$elements.outputButton.find(".node-input-rule-index").html(value + 1);
        this._index = value;
    }

    get index() {
        return this._index;
    }

    //#endregion

    async init() {
        await this.generateOutputButton(this.container.children().first());
        await super.init();
    }

    async generateOutputButton(container) {
        $('<a/>', {
            id: this.elements.outputButton,
            class: 'red-ui-button top-right-badge'
        }).append(
            `&nbsp;&#8594;&nbsp;<span class="node-input-rule-index">${this.index + 1}</span>&nbsp;`
        ).appendTo(container);

    }

}
