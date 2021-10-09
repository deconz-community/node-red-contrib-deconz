class DeconzSpecificServerEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, $.extend({}, options));
    }

    get elements() {
        return {
            name: 'node-config-input-name',
            ip: 'node-config-input-ip',
            port: 'node-config-input-port',
            apikey: 'node-config-input-secured_apikey',
            ws_port: 'node-config-input-ws_port',
            secure: 'node-config-input-secure',
            polling: 'node-config-input-polling',
            getSettingsButton: 'node-contrib-deconz-get-settings'
        };
    }

    get default() {
        return {
            name: '',
            ip: '',
            port: '',
            apikey: '',
            ws_port: '',
            secure: false,
            polling: 15,
        };
    }

    get xhrURL() {
        return `${this.NRCD}/serverAutoconfig`;
    }

    async init() {
        this.node.specific = $.extend(true, this.default, this.node.specific);
        await super.init();
    }

    async connect() {
        await super.connect();
        this.$elements.getSettingsButton.on('click', () => this.discoverParams());
    }

    async discoverParams(overrideSettings) {
        if (overrideSettings === undefined) overrideSettings = {};

        let myNotification;
        let stop = false;
        let closeNotification = () => {
            if (myNotification && typeof myNotification.close === 'function')
                myNotification.close();
            stop = true;
        };
        myNotification = RED.notify("<p>Trying to find the server settings, please wait...<br>" +
            "This can take up to 15 seconds.</p>", {
            modal: true,
            fixed: true,
            type: 'info',
            buttons: [
                {
                    text: "Cancel",
                    class: "primary",
                    click: closeNotification
                }
            ]
        });

        try {
            let params = Object.assign({}, this.value, overrideSettings);
            if (params.discoverParam === undefined) params.discoverParam = {};
            params.discoverParam.devicetype = 'Node-Red Deconz Plugin' + (this.node ? ` id:${this.node.id}` : '');
            let request = await $.getJSON(this.xhrURL, {config: JSON.stringify(params)})
                .catch((t, u) => {
                    this.sendError(t.status === 400 && t.responseText ? t.responseText : u.toString());
                });

            if (stop) return;

            if (request.error) {
                let html = `<p>Error ${request.error.code}: ${request.error.description}</p>`;
                let buttons = [
                    {
                        text: "Cancel",
                        click: closeNotification
                    }
                ];

                switch (request.error.code) {
                    case 'GATEWAY_CHOICE':
                        html += "<p>There is multiple Deconz device in you network, " +
                            "please select the one you want to configure.</p>";
                        let idPrefix = 'node-red-contrib-deconz-gateway-id-';
                        let node = this;
                        let clickMethod = function (gateway_id) {
                            closeNotification();
                            if (gateway_id) {
                                request.currentSettings.discoverParam.targetGatewayID = gateway_id;
                            }
                            node.discoverParams(request.currentSettings);
                        };

                        for (const [index, gateway] of request.error.gateway_list.entries()) {
                            buttons.push({
                                text: `#${index + 1}: ${gateway.name}`,
                                id: idPrefix + index,
                                class: "primary",
                                /*jshint loopfunc: true */
                                click: () => clickMethod(gateway.bridge_id)
                            });
                        }

                        // Move the cancel button on right
                        buttons.push(buttons.shift());
                        break;
                    case 'DECONZ_ERROR':
                        if (request.error.type === 101) {
                            buttons.unshift({
                                text: "I pressed the link button",
                                class: "primary",
                                click: () => {
                                    closeNotification();
                                    this.discoverParams(request.currentSettings);
                                }
                            });
                            html += "<p>The reason why the request failed is that the gateway was not unlocked. " +
                                "This mechanism is needed to prevent anybody from access to the gateway without " +
                                "being permitted to do so.</p>";
                            html += "<ul>" +
                                "<li>In a new browser tab open the <a href='http://phoscon.de/pwa/' target='_blank'>Phoscon App</a></li>" +
                                "<li>Click on Menu -> Settings -> Gateway</li>" +
                                "<li>Click on \"Advanced\" button</li>" +
                                "<li>Click on the \"Authenticate app\" button</li>" +
                                "</ul>";
                            html += `<p>Within 60 seconds after unlocking the gateway, click on the button "${buttons[0].text}".</p>`;
                        }
                        break;
                    default:
                        buttons[buttons.length - 1].text = "Cancel";
                }

                html += `<p>Logs:</p><pre>${request.log.join('\n')}</pre>`;

                closeNotification();
                myNotification = RED.notify(html, {
                    modal: true,
                    fixed: true,
                    type: 'error',
                    buttons: buttons
                });
            } else if (request.success) {
                closeNotification();
                myNotification = RED.notify(`<p>Settings fetched successfully !</p>`, {
                    modal: false,
                    fixed: false,
                    type: 'success'
                });
                this.value = request.currentSettings;
            } else {
                closeNotification();
                myNotification = RED.notify(`<p>Unknown error : ${JSON.stringify(request)}</p>`, {
                    modal: true,
                    fixed: true,
                    type: 'error',
                    buttons: [
                        {
                            text: "Ok",
                            class: "primary",
                            click: closeNotification
                        }
                    ]
                });
            }
        } catch (error) {
            closeNotification();
            myNotification = RED.notify(`<p>Error while processing request: ${error.toString()}</p>`, {
                type: 'error',
            });
        }

    }

    get value() {
        return {
            name: this.$elements.name.val(),
            ip: this.$elements.ip.val(),
            port: this.$elements.port.val(),
            apikey: this.$elements.apikey.val(),
            ws_port: this.$elements.ws_port.val(),
            secure: this.$elements.secure.prop('checked'),
            polling: this.$elements.polling.val()
        };
    }

    set value(newValues) {
        this.$elements.name.val(newValues.name);
        this.$elements.ip.val(newValues.ip);
        this.$elements.port.val(newValues.port);
        this.$elements.apikey.val(newValues.apikey);
        this.$elements.ws_port.val(newValues.ws_port);
        this.$elements.secure.prop('checked', newValues.secure);
        this.$elements.polling.val(newValues.polling);
        for (const element of Object.values(this.$elements)) {
            element.change();
        }
    }

}
