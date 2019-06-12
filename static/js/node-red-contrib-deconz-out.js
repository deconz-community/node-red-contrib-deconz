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
        command: {
            value: '/on',
        },
        commandType: {
            value: 'wb_cmd',
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
        var label = 'deconz-output';
        if (this.name) {
            label = this.name;
        } else if (typeof(this.device) == 'string' && this.device.length) {
            label = this.device;
        }
        return label;
    },
    oneditprepare: function() {
        var node = this;

        var WbTypes = {
            value: 'wb_cmd',
            label: 'WB',
            icon: 'icons/node-red-contrib-deconz/deconz-color.png',
            options: ['/on']
        };
        $('#node-input-command').typedInput({
            types: [WbTypes, 'str', 'msg'],
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
            deconz_getItemList(node.device, '#node-input-device', {disableReadonly:true, allowEmpty:true});
        }, 100); //we need small timeout, too fire change event for server select

    }
});