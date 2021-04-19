class DeconzListItemListEditor extends DeconzEditor {
    constructor(node, options = {}) {
        super(node, options);
        this.items = {};
    }

    get listType() {
        return 'item';
    }

    get buttons() {
        return [];
    }

    async init(mainEditor) {
        await super.init();
        this.mainEditor = mainEditor;
    }

    async initList(itemEditorClass, items = []) {
        let buttons = this.buttons;
        this.$elements.list.editableList({
            sortable: true,
            removable: true,
            height: 'auto',
            addButton: buttons.length === 0,
            buttons: buttons,
            addItem: (row, index, item) => {
                // Create item editor
                let itemEditor = new itemEditorClass(this.node, this, row);
                // Store item editor reference
                item.uniqueId = itemEditor.uniqueId;
                this.items[item.uniqueId] = itemEditor;
                // Init item editor
                itemEditor.init(item, index);
            },
            removeItem: (item) => {
                if (item.uniqueId && this.items[item.uniqueId]) {
                    let deletedIndex = this.items[item.uniqueId].index;
                    // Remove old editor
                    delete this.items[item.uniqueId];
                    // Shift index -1 of items after the deleted one
                    for (const item of Object.values(this.items)) {
                        if (item.index > deletedIndex) item.index--;
                    }
                } else {
                    throw new Error(`Error while removing the ${this.listType}, the ${this.listType} ${item.uniqueId} does not exist.`);
                }
            },
            sortItems: (items) => {
                // Update rule index
                items.each((index, item) => {
                    if (this.items[item.attr('id')]) {
                        this.items[item.attr('id')].index = index;
                    } else {
                        throw new Error(`Error while moving the ${this.listType}, the ${this.listType} ${index + 1} does not exist.`);
                    }
                });
            }
        });

        if (items.length > 0) this.$elements.list.editableList('addItems', items);

    }

    get value() {
        let result = [];
        for (const rule of Object.values(this.items).sort((a, b) => a.index - b.index)) {
            result.push(rule.value);
        }
        return result;
    }

    /**
     * @abstract refresh
     */
    refresh() {
    }

}
