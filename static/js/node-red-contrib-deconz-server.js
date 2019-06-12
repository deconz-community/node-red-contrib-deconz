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
        }
    },
    label: function() {
        return this.name ||  this.ip+':'+this.port;
    }
});