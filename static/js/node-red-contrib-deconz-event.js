RED.nodes.registerType('deconz-event', {
    category: 'deCONZ',
    color: '#f7aa3f',
    defaults: {
        name: {
            value: ""
        },
        server: {
            type: "deconz-server",
            required: true
        },
        device_name: {
            value: null
        }
    },
    inputs: 0,
    outputs: 1,
    outputLabels: ["event"],
    paletteLabel: 'event',
    icon: "deconz.png",
    label: function () {
        var label = 'deconz-event';
        if (this.name) {
            label = this.name;
        } else if (typeof(this.device_name) == 'string' && this.device_name.length) {
            label = this.device_name;
        } else if (typeof(this.device) == 'string' && this.device.length) {
            label = this.device;
        }

        return label;
    },
    oneditprepare: function () {
        var node = this;
        setTimeout(function(){
            deconz_getItemList(node.device, '#node-input-device', {allowEmpty:true});
        }, 100); //we need small timeout, too fire change event for server select
    },
    oneditsave: function () {
        var selectedOptions = $('#node-input-device option:selected');
        if (selectedOptions) {
            this.device = selectedOptions.map(function () {
                return $(this).val();
            });

            this.device_name = selectedOptions.text();
        } else {
            this.device_name = this.device = null;
        }
    }
});
