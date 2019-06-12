RED.nodes.registerType('deconz-get', {
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
        }
    },
    inputs: 1,
    outputs: 1,
    outputLabels: ["event"],
    paletteLabel: 'get',
    icon: "deconz.png",
    label: function () {
        var label = 'deconz-get';
        if (this.name) {
            label = this.name;
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

            this.device_name = selectedOptions.map(function () {
                return $(this).text();
            });
        } else {
            this.device_name = this.device = null;
        }
    }
});