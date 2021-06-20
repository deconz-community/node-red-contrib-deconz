class DeconzDeviceListEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, options);
    }

    get xhrURL() {
        return `${this.NRCD}/itemlist`;
    }

    get xhrParams() {
        return {
            controllerID: this.mainEditor.serverNode.id,
            forceRefresh: this.options.refresh,
        };
    }

    async display(display = true) {
        if (this.$elements.showHide) {
            if (display) {
                this.$elements.showHide.show();
            } else {
                this.$elements.showHide.hide();
            }
            return this.$elements.showHide.promise();
        }
    }

    async getItems(options, xhrParams) {
        xhrParams.forceRefresh = options.refresh;

        let result = await $.getJSON(this.xhrURL, xhrParams).catch((t, u) => {
            this.sendError(t.status === 400 && t.responseText ? t.responseText : u.toString());
        });

        if (result && result.error_message) {
            console.warn(result.error_message);
            return;
        }

        return this.formatItemList(result.items, options.keepOnlyMatched);
    }

    /**
     *
     * @param options
     * @returns {Promise<{}>}
     */
    async updateList(options) {
        options = $.extend({
            refresh: true
        }, options);

        /** @type {JQuery} */
        let list = this.$elements.list;

        let devices = await this.getItems(options, this.xhrParams);

        // Remove all previous elements from 'select' input element
        list.children().remove();
        if (devices) this.generateHtmlItemList(devices, this.$elements.list);

        // Rebuild bootstrap multipleSelect form
        list.multipleSelect('refresh');
        // Enable item selection
        if (devices) {
            list.multipleSelect('enable');
        }

    }

    formatItemList(items, keepOnlyMatched = false) {
        let itemList = {};

        let injectItems = (part, matched) => {
            part.forEach((item) => {
                let device_type = item.type;
                if (itemList[device_type] === undefined) {
                    itemList[device_type] = [];
                }
                item.query_match = matched;
                itemList[device_type].push(item);
            });
        };

        injectItems(items.matched, true);
        if (keepOnlyMatched === false) injectItems(items.rejected, false);

        return itemList;
    }

    /**
     *
     * @param {Object.<String, Array<Light | Sensor | Group>>} items
     * @param {JQuery} htmlContainer
     */
    generateHtmlItemList(items, htmlContainer) {
        let queryMode = this.constructor === DeconzQueryEditor;
        for (const [group_key, item_list] of (Object.entries(items)
            .sort((a, b) => {
                // Sort by keys
                let x = a[0].toLowerCase();
                let y = b[0].toLowerCase();
                return x < y ? -1 : x > y ? 1 : 0;
            }))) {
            let groupHtml = $('<optgroup/>').attr('label', group_key);
            for (/** @type {Light | Sensor | Group} */ const item of item_list.sort((a, b) => {
                // Sort by keys
                let x = a.name.toLowerCase();
                let y = b.name.toLowerCase();
                return x < y ? -1 : x > y ? 1 : 0;
            })) {
                let label = item.name;
                if (item.device_type === "groups") {
                    label += ' (lights: ' + item.lights.length;
                    if (item.scenes.length) {
                        label += ", scenes: " + item.scenes.length;
                    }
                    label += ")";
                }
                let opt = $('<option>' + label + '</option>')
                    .attr("value", item.device_path);
                if (queryMode && item.query_match) {
                    opt.attr("selected", '');
                }
                opt.appendTo(groupHtml);
            }
            groupHtml.appendTo(htmlContainer);
        }
    }


}
