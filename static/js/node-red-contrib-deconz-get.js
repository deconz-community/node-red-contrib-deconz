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
        },
        device_name: {
            value: null
        },
        state: {
            value: ""
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
            var $deviceInput = $('#node-input-device');

            deconz_getItemList(node.device, '#node-input-device', {allowEmpty:true});

            $deviceInput.on('change', function(){
                deconz_getItemStateList(0, '#node-input-state');
            });
            setTimeout(function () {
                deconz_getItemStateList(node.state, '#node-input-state');
            },100);
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