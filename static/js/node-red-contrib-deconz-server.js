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
            //
            // deconz_gatewayScanner();
            // return false;
            var currentSettings = {
                name:$('#node-config-input-name').val(),
                ip:$('#node-config-input-ip').val(),
                port:$('#node-config-input-port').val(),
            };

            deconz_initSettings(function(settings){
                if (settings.name) $('#node-config-input-name').val(settings.name);
                if (settings.ip) $('#node-config-input-ip').val(settings.ip);
                if (settings.port) $('#node-config-input-port').val(settings.port);
                if (settings.apikey) $('#node-config-input-apikey').val(settings.apikey);
                if (settings.ws_port) $('#node-config-input-ws_port').val(settings.ws_port);
            }, currentSettings);

        });

    },
});