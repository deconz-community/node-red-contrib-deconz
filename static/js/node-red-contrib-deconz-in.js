RED.nodes.registerType('deconz-input', {
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
        state_key: {
            value: null
        }
    },
    inputs: 0,
    outputs: 1,
    outputLabels: ["event"],
    paletteLabel: 'in',
    icon: "deconz.png",
    label: function () {
        var label = 'deconz-input';
        if (this.name) {
            label = this.name;
        } else if (typeof(this.device) == 'string' && this.device.length) {
            label = this.device;
        }
        console.log(this);
        return label;
    },
    oneditprepare: function () {
        var node = this;
        setTimeout(function(){
            deconz_getItemList(node.device, '#node-input-device', {allowEmpty:true});
            // console.log(deconz_getDeviceMeta(this.device));
        }, 100); //we need small timeout, too fire change event for server select

    },
    oneditsave: function () {
        var selectedOptions = $('#node-input-device option:selected');
        if (selectedOptions) {
            this.device = selectedOptions.map(function () {
                return $(this).val();
            });
        } else {
            this.device = null;
        }
    }
});
