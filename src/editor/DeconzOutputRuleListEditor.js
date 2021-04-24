class DeconzOutputRuleListEditor extends DeconzListItemListEditor {

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
        let i18n = `${this.NRCD}/server:editor.inputs.outputs.type`;
        for (const [type, enabled] of Object.entries(this.options.type)) {
            if (enabled) {
                let type_name = this.getI18n(`${i18n}.options.${type}`);
                buttons.push({
                    label: this.getI18n(`${i18n}.add_button`, 'label', {type: type_name}),
                    icon: this.getIcon(this.getI18n(`${i18n}.add_button`, 'icon'), true),
                    title: this.getI18n(`${i18n}.add_button`, 'title', {type: type_name}),
                    click: () => this.$elements.list.editableList('addItem', {type})
                });
            }
        }
        return buttons;
    }

    async init(mainEditor) {
        await super.init(mainEditor);
        await this.initList(DeconzOutputRuleEditor, this.node.output_rules);
    }

    refresh() {
        for (const rule of Object.values(this.items)) {
            rule.updatePayloadList();
        }
    }

}
