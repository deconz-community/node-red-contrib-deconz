RED.nodes.registerType('deconz-server', {
    category: 'config',
    defaults: {
        name: {
            value: null,
            required: false
        },
        ip: {
            value: '127.0.0.1',
            required: true
        },
        port: {
            value: '80',
            required: true
        },
        apikey: {
            value: null,
            required: true
        },
        ws_port: {
            value: '443',
            required: true
        }
    },
    label: function() {
        return this.name ||  this.ip+':'+this.port;
    },
    oneditprepare: function () {
        var node = this;
        var $refreshBtn = $('#force-refresh');

        $refreshBtn.on('click', function(){
            deconz_initSettings(function(settings){
                $('#node-config-input-name').val(settings.name);
                $('#node-config-input-ip').val(settings.ip);
                $('#node-config-input-port').val(settings.port);
                $('#node-config-input-apikey').val(settings.apikey);
                $('#node-config-input-ws_port').val(settings.ws_port);
            });

        });

    },
});