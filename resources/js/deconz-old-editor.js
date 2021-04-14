function deconz_initNodeEditor(node, options = {}) {

    options = $.extend({
        ready: false, // TODO use that to drop events
        elements: {
            server: '#node-input-server',
            // Devices
            querySelect: '#node-input-query',
            queryResultSelect: '#node-input-query_result',
            deviceSelect: '#node-input-device_list',
            deviceShowHideSelector: '.deconz-device-selector',
            queryShowHideSelector: '.deconz-query-selector',
            refreshButton: '#force-refresh',
            refreshQueryResultButton: '#force-refresh-query-result',
            // State
            stateSelect: '#node-input-state',
            stateOutputSelect: '#node-input-output',
            // Homekit
            // Config
            configSelect: '#node-input-config',
            configOutputSelect: '#node-input-config_output',
        },
        queryAllowedTypes: ['deconz-device', 'json', 'jsonata'],
        itemList: {
            deviceType: false,
            batteryFilter: false,
        },
        stateList: {
            filterType: '',
            disableReadonly: false,
            refresh: false,
            defaultValue: "0",
            eachValue: "1",
            enableEachState: true
        },
        configList: {
            filterType: '',
            disableReadonly: false,
            refresh: false,
            defaultValue: "0",
            eachValue: "1"
        }
    }, options);

    let elements = {
        serverSelect: $(options.elements.server),
        // Devices
        querySelect: $(options.elements.querySelect),
        queryResultSelect: $(options.elements.queryResultSelect),
        deviceSelect: $(options.elements.deviceSelect),
        refreshButton: $(options.elements.refreshButton),
        refreshQueryResultButton: $(options.elements.refreshQueryResultButton),
        //State
        stateSelect: $(options.elements.stateSelect),
        stateOutputSelect: $(options.elements.stateOutputSelect),
        // Config
        configSelect: $(options.elements.configSelect),
        configOutputSelect: $(options.elements.configOutputSelect)
    };

    let serverNode = RED.nodes.node(elements.serverSelect.val());

    // Init Query field
    if (elements.querySelect.length) {

        // Replace deconz device type
        let index = options.queryAllowedTypes.indexOf('deconz-device');
        if (index !== -1) {
            options.queryAllowedTypes[index] = {
                value: "device",
                label: RED._("node-red-contrib-deconz/server:editor.inputs.device.query.options.device"),
                icon: "icons/node-red-contrib-deconz/deconz.png ",
                hasValue: false
            };
        }

        // Init typed input
        elements.querySelect.typedInput({
            type: "text",
            types: options.queryAllowedTypes,
            typeField: "#node-input-search_type"
        });

        let updateDeviceDisplay = function (type, value) {
            if (type === "device") {
                $(options.elements.deviceShowHideSelector).show();
                $(options.elements.queryShowHideSelector).hide();
            } else {
                $(options.elements.deviceShowHideSelector).hide();
                $(options.elements.queryShowHideSelector).show();
            }
        };

        updateDeviceDisplay(node.search_type, node.query);
        elements.querySelect.on('change', function (event, type, value) {
            // See https://github.com/node-red/node-red/issues/2883
            if (type === true) return;

            let t = elements.querySelect.typedInput('type');
            let v = elements.querySelect.typedInput('value');

            switch (t) {
                case 'device':
                    deconz_updateDeviceList(serverNode, node, elements, {}, options);
                    break;
                case 'json':
                case'jsonata':
                    deconz_updateDeviceList(serverNode, node, elements, {
                        queryMode: true
                    }, options);
                    break;
            }


            updateDeviceDisplay(t, v);
        });


    }

    // Init device selector
    deconz_initNodeEditorDeviceList(serverNode, node, elements, options, function (success) {
        if (success) {
            ['state', 'config'].forEach(function (type) {
                deconz_initNodeEditorStateConfigList(serverNode, node, elements, options, type, function (success) {
                    if (success) {
                        deconz_initNodeEditorStateConfigOutputList(serverNode, node, elements, options, type, function (success) {
                            if (success) {

                            } else {
                                //TODO handle error loading
                            }
                        });
                    } else {
                        //TODO handle error loading
                    }
                });
            });

            deconz_initNodeEditorQueryResultList(serverNode, node, elements, options, function (success) {
                if (success) {
                } else {
                    //TODO handle error loading
                }
            });

        } else {
            //TODO handle error loading
        }
    });
}


function deconz_initNodeEditorQueryResultList(serverNode, node, elements, globalOptions, callback) {

    elements.queryResultSelect.multipleSelect({
        maxHeight: 300,
        dropWidth: 320,
        width: 320,
        single: false,
        filter: true,
        selectAll: false,
        filterPlaceholder: RED._("node-red-contrib-deconz/server:editor.inputs.device.device.filter_devices"),
        numberDisplayed: 1,
        disableIfEmpty: true,
        showClear: false,
        hideOptgroupCheckboxes: true,
        filterGroup: true,
        // Make the select read only, not pretty but multipleSelect don't allow readonly list, disable hide all options
        onClick: function (view) {
            elements.queryResultSelect.multipleSelect(view.selected ? 'uncheck' : 'check', view.value);
        }
    });

    // Initial call to populate item list
    deconz_updateDeviceList(serverNode, node, elements, {
        refresh: false,
        queryMode: true
    }, globalOptions);

    // onClick event handler for refresh button
    elements.refreshQueryResultButton.click(function (event) {
        // Force a refresh of the item list
        deconz_updateDeviceList(serverNode, node, elements, {
            refresh: true,
            queryMode: true
        }, globalOptions);
    });

    callback(true);

}

function deconz_initNodeEditorDeviceList(serverNode, node, elements, globalOptions, callback) {
    // Initialize bootstrap multiselect form
    elements.deviceSelect.multipleSelect({
        maxHeight: 300,
        dropWidth: 320,
        width: 320,
        single: (elements.deviceSelect.attr('multiple') !== "multiple"),
        filter: true,
        filterPlaceholder: RED._("node-red-contrib-deconz/server:editor.inputs.device.device.filter"),
        showClear: true
    });

    // Initial call to populate item list
    deconz_updateDeviceList(serverNode, node, elements, {
        refresh: false,
        useSavedData: true,
        callback: callback
    }, globalOptions);

    let refreshCallback = function (type) {
        deconz_updateItemConfigStateList(serverNode, node, elements, {
            useSelectedData: true,
            callback: function () {
                deconz_updateStateConfigOutputList(serverNode, node, elements, {}, globalOptions, type);
            }
        }, globalOptions, type);

    };
    // onChange event handler in case a new controller gets selected
    elements.serverSelect.change(function (event) {
        deconz_updateDeviceList(serverNode, node, elements, {
            useSavedData: true,
            callback: function () {
                refreshCallback('state');
                refreshCallback('config');
            }
        }, globalOptions);
    });

    // onClick event handler for refresh button
    elements.refreshButton.click(function (event) {
        // Force a refresh of the item list
        deconz_updateDeviceList(serverNode, node, elements, {
            useSelectedData: true,
            callback: function () {
                refreshCallback('state');
                refreshCallback('config');
            }
        }, globalOptions);
    });

}

function deconz_updateDeviceList(serverNode, node, elements, options, globalOptions) {

    let itemsSelected = [];

    options = $.extend({
        refresh: true,
        queryMode: false,
        useSavedData: false,
        useSelectedData: false,
        callback: $.noop
    }, options);

    let targetSelect = elements.deviceSelect;
    if (options.queryMode) {
        targetSelect = elements.queryResultSelect;
    }

    if (options.useSelectedData) {
        itemsSelected = targetSelect.multipleSelect('getSelects');
    }

    // Remove all previous and/or static (if any) elements from 'select' input element
    targetSelect.children().remove();

    if (serverNode) {

        let params = {
            controllerID: serverNode.id,
            forceRefresh: options.refresh,
        };

        if (options.queryMode) {
            params.query = elements.querySelect.typedInput('value');
            params.queryType = elements.querySelect.typedInput('type');
            params.nodeID = node.id;
        }

        $.getJSON('node-red-contrib-deconz/itemlist', params)
            .done(function (data, textStatus, jqXHR) {

                try {
                    let itemList = {};

                    Object.keys(data.items).forEach(function (key) {
                        let item = data.items[key];
                        let device_type = item.meta.type;

                        // Filter on device_type
                        // TODO probably removed when allow setting config of sensors
                        if (globalOptions.itemList.deviceType && globalOptions.itemList.deviceType !== device_type) {
                            return true;
                        }

                        // Keep only battery powered devices
                        if (globalOptions.itemList.batteryFilter &&
                            (!("meta" in item) || !("config" in item.meta) || !("battery" in item.meta.config))
                        ) {
                            return true;
                        }

                        if (itemList[device_type] === undefined) {
                            itemList[device_type] = [];
                        }

                        itemList[device_type].push(item);
                    });

                    Object.keys(itemList).sort().forEach(function (group_key) {

                        // Sort devices by name
                        itemList[group_key].sort(function (a, b) {
                            let x = a.device_name.toLowerCase();
                            let y = b.device_name.toLowerCase();
                            return x < y ? -1 : x > y ? 1 : 0;
                        });

                        let groupHtml = $('<optgroup/>', {label: group_key});


                        Object.keys(itemList[group_key]).forEach(function (device_key) {
                            let meta = itemList[group_key][device_key].meta;

                            let label = meta.name;
                            if (meta.device_type === "groups") {
                                label += ' (lights: ' + meta.lights.length;
                                if (meta.scenes.length) {
                                    label += ", scenes: " + meta.scenes.length;
                                }
                                label += ")";
                            }

                            let opt = $('<option>' + label + '</option>')
                                .attr("value", itemList[group_key][device_key].path);
                            if (options.queryMode && itemList[group_key][device_key].query_match) {
                                opt.attr("selected", true);
                            }
                            opt.appendTo(groupHtml);

                        });

                        groupHtml.appendTo(targetSelect);

                    });

                    // Enable item selection
                    targetSelect.multipleSelect('enable');
                    // Rebuild bootstrap multiselect form
                    targetSelect.multipleSelect('refresh');
                    // Finally, set the value of the input select to the selected value
                    if (!options.queryMode) {
                        if (options.useSavedData) {
                            let savedData = {
                                device: node.device,
                                device_list: node.device_list
                            };
                            // Load from old saved data
                            if (savedData.device !== null) {
                                let query = {};
                                if (savedData.device.substr(0, 5) === "group") {
                                    query.device_type = "groups";
                                    query.device_id = Number(savedData.device.substr(6));
                                } else {
                                    query.uniqueid = savedData.device;
                                }

                                $.getJSON('node-red-contrib-deconz/itemlist', {
                                    controllerID: serverNode.id,
                                    forceRefresh: options.refresh,
                                    query: JSON.stringify(query)
                                }).done(function (data, textStatus, jqXHR) {
                                    itemsSelected = [];
                                    Object.keys(data.items).forEach(function (key) {
                                        if (data.items[key].query_match) {
                                            itemsSelected.push(data.items[key].path);
                                        }
                                    });
                                    targetSelect.multipleSelect('setSelects', itemsSelected);
                                    $('#input_device_warning_message_update').show();

                                }).fail(function (jqXHR, textStatus, errorThrown) {
                                    // Disable item selection if no items were retrieved
                                    targetSelect.multipleSelect('disable');
                                    targetSelect.multipleSelect('refresh');
                                    //console.error(`Error: ${errorThrown}`);
                                });
                            } else if (savedData.device_list) {
                                targetSelect.multipleSelect('setSelects', savedData.device_list);
                            }

                        } else if (options.useSelectedData) {
                            if (itemsSelected !== undefined) {
                                targetSelect.multipleSelect('setSelects', itemsSelected);
                            }
                        }

                    }

                    options.callback(true);

                } catch (error) {
                    console.error('Error #4534');
                    console.log(error);
                    options.callback(false);
                }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                // Disable item selection if no items were retrieved
                targetSelect.multipleSelect('disable');
                targetSelect.multipleSelect('refresh');
                //console.error(`Error: ${errorThrown}`);
                options.callback(false);
            });

    } else {
        // Disable item selection if no (valid) controller was selected
        targetSelect.multipleSelect('disable');
        targetSelect.multipleSelect('refresh');
        options.callback(false);
    }
}

function deconz_initNodeEditorStateConfigList(serverNode, node, elements, globalOptions, type, callback) {
    let e = deconz_getElementsOfType(elements, globalOptions, type);
    if (!e) return false;
    if (e.itemSelect.length === 0) return false;

    // Initialize bootstrap multiselect form
    e.itemSelect.multipleSelect({
        numberDisplayed: 1,
        dropWidth: 320,
        width: 320,
        single: e.itemSelect.attr('multiple') !== "multiple",
        selectAll: false,
        filter: true,
        onClick: function (view) {
            if (!view.selected) return;
            switch (view.value) {
                case e.complete:
                case e.each_item:
                    e.itemSelect.multipleSelect('setSelects', [view.value]);
                    break;
                default:
                    e.itemSelect.multipleSelect('uncheck', e.complete);
                    e.itemSelect.multipleSelect('uncheck', e.each_item);
                    break;
            }
        },
        onUncheckAll: function () {
            e.itemSelect.multipleSelect('setSelects', e.complete);
        },
        onOptgroupClick: function (view) {
            if (!view.selected) return;
            e.itemSelect.multipleSelect('uncheck', e.complete);
            e.itemSelect.multipleSelect('uncheck', e.each_item);
        },
    });

    // Initial call to populate state list
    deconz_updateItemConfigStateList(serverNode, node, elements, {
        refresh: false,
        useSavedData: true,
        callback: callback
    }, globalOptions, type);

    let refreshCallback = function () {
        deconz_updateStateConfigOutputList(serverNode, node, elements, {}, globalOptions, type);
    };

    // onChange event handler in case a new controller gets selected
    elements.serverSelect.change(function (event) {
        deconz_updateItemConfigStateList(serverNode, node, elements, {
            useSavedData: true,
            callback: refreshCallback
        }, globalOptions, type);
    });

    // onClick event handler for refresh button
    elements.deviceSelect.change(function (event) {
        // Force a refresh of the item list
        deconz_updateItemConfigStateList(serverNode, node, elements, {
            useSelectedData: true,
            callback: refreshCallback
        }, globalOptions, type);
    });

}

function deconz_getElementsOfType(elements, globalOptions, type) {
    let e = {};
    switch (type) {
        case 'state':
            e.itemSelect = elements.stateSelect;
            e.outputSelect = elements.stateOutputSelect;
            e.complete = globalOptions.stateList.defaultValue;
            e.each_item = globalOptions.stateList.eachValue;
            break;
        case 'config':
            e.itemSelect = elements.configSelect;
            e.outputSelect = elements.configOutputSelect;
            e.complete = globalOptions.configList.defaultValue;
            e.each_item = globalOptions.configList.eachValue;
            break;
        default:
            return false;
    }
    return e;
}

function deconz_updateItemConfigStateList(serverNode, node, elements, options, globalOptions, type) {
    let e = deconz_getElementsOfType(elements, globalOptions, type);
    if (!e) return false;

    let statesSelected;
    let savedData;
    let queryMode = elements.querySelect.typedInput('type') !== 'device';

    options = $.extend({
        refresh: true,
        useSavedData: false,
        useSelectedData: false,
        callback: $.noop
    }, options);

    if (options.useSavedData) {
        savedData = node[type];
        if (!Array.isArray(savedData)) {
            savedData = [savedData];
        }
        if (savedData.length === 0) {
            savedData = [e.complete];
        }
    }

    if (options.useSelectedData) {
        statesSelected = e.itemSelect.multipleSelect('getSelects');
    }

    // Remove all previous and/or static (if any) elements from 'select' input element
    e.itemSelect.children().remove();

    let devices = elements.deviceSelect.multipleSelect('getSelects');

    let finishUpdate = function () {

        e.itemSelect.multipleSelect('enable');
        e.itemSelect.multipleSelect('refresh');

        if (options.useSavedData) e.itemSelect.multipleSelect('setSelects', savedData);
        if (options.useSelectedData) e.itemSelect.multipleSelect('setSelects', statesSelected);

        if (e.itemSelect.multipleSelect('getSelects').length === 0) {
            e.itemSelect.multipleSelect('setSelects', e.complete);
        }

        options.callback(true);
    };

    if (queryMode) {
        //TODO update that
        //TODO mettre a jour le state/config list quand on selectionne le mode query

        let html = '<option value="' + e.complete + '">' + RED._("node-red-contrib-deconz/server:editor.inputs." + type + ".payload.options.complete") + '</option>';
        if (globalOptions.stateList.enableEachState === true) {
            html += '<option value="' + e.each_item + '">' + RED._("node-red-contrib-deconz/server:editor.inputs." + type + ".payload.options.each") + '</option>';
        }
        e.itemSelect.html(html);
        finishUpdate();

    } else if (serverNode && devices) {
        $.getJSON('node-red-contrib-deconz/' + type + 'list', {
            controllerID: serverNode.id,
            devices: JSON.stringify(devices)
        })
            .done(function (data, textStatus, jqXHR) {

                try {
                    //TODO update that
                    let html = '<option value="' + e.complete + '">' + RED._("node-red-contrib-deconz/server:editor.inputs." + type + ".payload.options.complete") + '</option>';
                    if (globalOptions.stateList.enableEachState && !$.isEmptyObject(data.count)) {
                        html += '<option value="' + e.each_item + '">' + RED._("node-red-contrib-deconz/server:editor.inputs." + type + ".payload.options.each") + '</option>';
                    }

                    e.itemSelect.html(html);

                    let groupHtml = $('<optgroup/>', {label: RED._("node-red-contrib-deconz/server:editor.inputs." + type + ".payload.group_label")});

                    Object.keys(data.count).sort().forEach(function (item) {
                        let sample = data.sample[item];
                        let count = data.count[item];
                        let label = item;
                        if (count !== devices.length) {
                            label += " [" + count + "/" + devices.length + "]";
                        }
                        label += " (" + sample + ")";

                        $('<option>' + label + '</option>').attr('value', item).appendTo(groupHtml);
                    });

                    if (!$.isEmptyObject(data.count)) {
                        groupHtml.appendTo(e.itemSelect);
                    }
                    // Enable item selection

                    finishUpdate();

                } catch (error) {
                    console.error('Error #4534');
                    console.log(error);
                    options.callback(false);
                }


            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                // Disable item selection if no items were retrieved
                e.itemSelect.multipleSelect('disable');
                e.itemSelect.multipleSelect('refresh');
                //console.error(`Error: ${errorThrown}`);
                options.callback(false);
            });

    } else {
        // Disable item selection if no (valid) controller was selected
        e.itemSelect.multipleSelect('disable');
        e.itemSelect.multipleSelect('refresh');
        options.callback(false);
    }
}


function deconz_initNodeEditorStateConfigOutputList(serverNode, node, elements, globalOptions, type, callback) {
    let e = deconz_getElementsOfType(elements, globalOptions, type);
    if (!e) return false;


    // Initialize bootstrap multiselect form
    e.outputSelect.multipleSelect({
        maxHeight: 300,
        dropWidth: 320,
        single: true,
        placeholder: "Always"
    });


    // Initial call to populate output list
    deconz_updateStateConfigOutputList(serverNode, node, elements, {
        useSavedData: true,
        callback: callback
    }, globalOptions, type);

    e.itemSelect.on("change", function () {
        deconz_updateStateConfigOutputList(serverNode, node, elements, {}, globalOptions, type);
    });

}

function deconz_updateStateConfigOutputList(serverNode, node, elements, options, globalOptions, type) {
    let e = deconz_getElementsOfType(elements, globalOptions, type);
    if (!e) return false;

    options = $.extend({
        useSavedData: false,
        callback: $.noop
    }, options);

    // If Complete state payload selected
    if (e.itemSelect.multipleSelect('getSelects').includes(e.complete)) {
        e.outputSelect.multipleSelect('disable');
        e.outputSelect.multipleSelect('setSelects', 'always');
    } else {
        e.outputSelect.multipleSelect('enable');
        if (options.useSavedData) e.outputSelect.multipleSelect('setSelects', node.output);
    }

    options.callback(true);
}


function deconz_initSettings(callback, inputSettings) {
    let settings = inputSettings;
    // var settings = {
    //     name:false,
    //     ip:false,
    //     port:false,
    //     apikey:false,
    //     ws_port:false
    // };

    $.get("https://phoscon.de/discover", function (data) {
    }).done(function (data) {
        if (!data.length) {
            alert("Can't discover your device, enter settings manually");
            return false;
        }

        if ((settings.name).length <= 0) settings.name = data[0].name;
        if ((settings.ip).length <= 0) settings.ip = data[0].internalipaddress;
        if ((settings.port).length <= 0) settings.port = data[0].internalport;

        // deconz_getApiKey(callback, settings.ip, settings.port);

        $.ajax({
            type: "POST",
            dataType: 'json',
            url: 'http://' + settings.ip + ':' + settings.port + '/api',
            data: JSON.stringify({"devicetype": "Node-red"}),
            success: function (response) {
                var resp = response[0];
                if ('success' in resp) {
                    settings.apikey = resp.success.username;

                    $.ajax({
                        type: "GET",
                        dataType: 'json',
                        url: 'http://' + settings.ip + ':' + settings.port + '/api/' + settings.apikey + '/config',
                        success: function (response) {
                            if ('websocketport' in response) {
                                settings.ws_port = response.websocketport;
                            }
                        },
                        error: function (jqXHR, exception) {
                            var msg = '';
                            if (jqXHR.status === 0) {
                                msg = 'Not connect. Try to enter deconz local IP address eg. 192.168.1.20';
                                if (settings.port == 40850) {
                                    msg = 'HomeAssistant? Fill only IP-address of your HA server.';
                                    alert(msg);
                                    return;
                                }
                            } else if (jqXHR.status == 404) {
                                msg = 'Requested page not found. [404]';
                            } else if (jqXHR.status == 500) {
                                msg = 'Internal Server Error [500].';
                            } else if (exception === 'parsererror') {
                                msg = 'Requested JSON parse failed.';
                            } else if (exception === 'timeout') {
                                msg = 'Time out error.';
                            } else if (exception === 'abort') {
                                msg = 'Ajax request aborted.';
                            } else {
                                var response = (JSON.parse(jqXHR.responseText));
                                var resp = response[0];
                                if ('error' in resp) {
                                    msg = resp.error.description;
                                } else {
                                    msg = 'Uncaught Error.\n' + jqXHR.responseText;
                                }
                            }
                            alert(msg);
                        },
                        complete: function () {
                            callback(settings);
                            return settings;
                        }
                    });
                }
            },
            error: function (jqXHR, exception) {
                var msg = '';
                if (jqXHR.status === 0) {
                    msg = 'Not connect. Try to enter deconz local IP address eg. 192.168.1.20';
                    if (settings.port === 40850) {
                        msg = 'HomeAssistant? Fill only IP-address of your HA server.';
                        alert(msg);
                        return;
                    }
                } else if (jqXHR.status === 404) {
                    msg = 'Requested page not found. [404]';
                } else if (jqXHR.status === 500) {
                    msg = 'Internal Server Error [500].';
                } else if (exception === 'parsererror') {
                    msg = 'Requested JSON parse failed.';
                } else if (exception === 'timeout') {
                    msg = 'Time out error.';
                } else if (exception === 'abort') {
                    msg = 'Ajax request aborted.';
                } else {
                    var response = (JSON.parse(jqXHR.responseText));
                    var resp = response[0];
                    if ('error' in resp) {
                        msg = resp.error.description;
                    } else {
                        msg = 'Uncaught Error.\n' + jqXHR.responseText;
                    }
                }
                alert(msg);
            },

            complete: function () {

            }
        });
    }).fail(function () {
        let myNotification = RED.notify('Remote server did not answer. Internet problems?', {
            modal: true,
            fixed: true,
            type: 'error',
            buttons: [
                {
                    'text': 'okay',
                    'class': 'primary',
                    'click': function (e) {
                        myNotification.close();
                    },
                },
            ],
        });
    });
}