RED.nodes.registerType('deconz-battery', {
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
        device: {
            value: null,
            required: true
        },
        device_name: {
            value: null
        },
        outputAtStartup: {
            value: true,
            required: true,
        }
    },
    inputs: 0,
    outputs: 2,
    outputLabels: ["event"],
    paletteLabel: 'battery',
    icon: "deconz.png",
    label: function () {
        var label = 'deconz-battery';
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
            deconz_getItemList(node.device, '#node-input-device', {allowEmpty:true, batteryFilter:true});
        }, 100); //we need small timeout, too fire change event for server select
    },
    oneditsave: function () {
        var selectedOptions = $('#node-input-device option:selected');
        if (selectedOptions) {
            this.device = selectedOptions.map(function () {
                return $(this).val();
            });

            this.device_name = selectedOptions.text().replace(/ *\([^)]*\) */g, "");
        } else {
            this.device_name = this.device = null;
        }
    }
});
