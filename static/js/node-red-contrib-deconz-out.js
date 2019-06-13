RED.nodes.registerType('deconz-output', {
    category: 'deCONZ',
    color: '#f7aa3f',
    align: 'right',
    defaults: {
        name: {
            value: ""
        },
        server: {
            type: "deconz-server",
            required: true
        },
        device: {
            value: "",
            required: true
        },
        device_name: {
            value: null
        },
        command: {
            value: 'on',
        },
        commandType: {
            value: 'deconz_cmd',
        },
        payload: {
            value: 'payload',
        },
        payloadType: {
            value: 'msg',
        }
    },
    inputLabels: "event",
    paletteLabel: 'out',
    inputs: 1,
    outputs: 0,
    icon: "deconz.png",
    label: function() {
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
    oneditprepare: function() {
        var node = this;

        var deConzTypes = {
            value: 'deconz_cmd',
            label: 'deCONZ',
            icon: 'icons/node-red-contrib-deconz/icon-color.png',
            options: ['on', 'bri', 'hue', 'sat', 'ct', 'xy', 'alert', 'effect', 'colorloopspeed', 'transitiontime']
        };
        $('#node-input-command').typedInput({
            types: [deConzTypes, 'str', 'msg'],
            default: 'msg',
            value: 'topic',
            typeField: $('#node-input-commandType'),
        });
        $('#node-input-payload').typedInput({
            types: ['msg', 'flow', 'global', 'str', 'num', 'date'],
            default: 'msg',
            value: 'payload',
            typeField: $('#node-input-payloadType'),
        });
        $('#node-input-commandType').val(node.commandType);
        $('#node-input-payloadType').val(node.payloadType);



        setTimeout(function(){
            var $deviceInput = $('#node-input-device');

            deconz_getItemList(node.device, '#node-input-device', {allowEmpty:true, deviceType:'lights'});

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