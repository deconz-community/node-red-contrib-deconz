class DeconzCommandListEditor extends DeconzListItemListEditor {

    get elements() {
        return {
            list: 'node-input-output-container',
        };
    }

    get listType() {
        return 'rule';
    }

    get buttons() {
        let buttons = [];
        /*
        for (const [type, enabled] of Object.entries(this.options.type)) {
            if (enabled) {
                let type_name = RED._(`${this.NRCD}/server:editor.inputs.outputs.type.options.${type}`);
                buttons.push({
                    label: RED._(`${this.NRCD}/server:editor.inputs.outputs.type.add_button.label`, {type: type_name}),
                    icon: "fa fa-" + RED._(`${this.NRCD}/server:editor.inputs.outputs.type.add_button.icon`),
                    title: RED._(`${this.NRCD}/server:editor.inputs.outputs.type.add_button.title`, {type: type_name}),
                    click: () => this.$elements.list.editableList('addItem', {type})
                });
            }
        }

         */
        return buttons;
    }

    async init(mainEditor) {
        await super.init(mainEditor);
        await this.initList(DeconzCommandEditor, this.node.commands);
    }


}
