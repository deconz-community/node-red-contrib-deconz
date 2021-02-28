function deconz_gatewayScanner(nodeItem, selectedItemElementName, options = {}) {
    $.getJSON('deconz/gwscanner', {})
        .done(function (data, textStatus, jqXHR) {
            console.log(data);
        }).fail(function (jqXHR, textStatus, errorThrown) {
    });
}

function deconz_initNodeEditor(node, options = {}) {
    options = $.extend({
        ready: false, // TODO use that to drop events
        elements: {
            server: '#node-input-server',
            querySelect: '#node-input-query',
            queryResultSelect: '#node-input-query_result',
            deviceSelect: '#node-input-device_list',
            deviceShowHideSelector: '.deconz-device-selector',
            queryShowHideSelector: '.deconz-query-selector',
            refreshButton: '#force-refresh',
            refreshQueryResultButton: '#force-refresh-query-result',
            stateSelect: '#node-input-state',
            outputSelect: '#node-input-output',
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
            eachStateValue: "1",
        }
    }, options);

    let elements = {
        serverSelect: $(options.elements.server),
        querySelect: $(options.elements.querySelect),
        queryResultSelect: $(options.elements.queryResultSelect),
        deviceSelect: $(options.elements.deviceSelect),
        refreshButton: $(options.elements.refreshButton),
        refreshQueryResultButton: $(options.elements.refreshQueryResultButton),
        stateSelect: $(options.elements.stateSelect),
        outputSelect: $(options.elements.outputSelect)
    };

    let serverNode = RED.nodes.node(elements.serverSelect.val());

    // Init Query field
    if (elements.querySelect.length) {

        // Replace deconz device type
        let index = options.queryAllowedTypes.indexOf('deconz-device')
        if (index !== -1) {
            options.queryAllowedTypes[index] = {
                value: "device",
                label: RED._("node-red-contrib-deconz/in:label.device"),
                icon: "icons/node-red-contrib-deconz/deconz.png ",
                hasValue: false
            }
        }

        // Init typed input
        elements.querySelect.typedInput({
            type: "text",
            types: options.queryAllowedTypes,
            typeField: "#node-input-search_type"
        })

        let updateDeviceDisplay = function (type, value) {
            if (type === "device") {
                $(options.elements.deviceShowHideSelector).show();
                $(options.elements.queryShowHideSelector).hide();
            } else {
                $(options.elements.deviceShowHideSelector).hide()
                $(options.elements.queryShowHideSelector).show();
            }
        }

        updateDeviceDisplay(node.search_type, node.query)
        elements.querySelect.on('change', function (event, type, value) {
            // See https://github.com/node-red/node-red/issues/2883
            if (type === true) return

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


            updateDeviceDisplay(t, v)
        });


    }

    // Init device selector
    deconz_initNodeEditorDeviceList(serverNode, node, elements, options, function (success) {
        if (success) {
            deconz_initNodeEditorStateList(serverNode, node, elements, options, function (success) {
                if (success) {
                    deconz_initNodeEditorOutputList(serverNode, node, elements, options, function (success) {
                        if (success) {
                            deconz_initNodeEditorQueryResultList(serverNode, node, elements, options, function (success) {
                                if (success) {
                                } else {
                                    //TODO handle error loading
                                }
                            })
                        } else {
                            //TODO handle error loading
                        }
                    })
                } else {
                    //TODO handle error loading
                }
            });
        } else {
            //TODO handle error loading
        }
    })
}


function deconz_initNodeEditorQueryResultList(serverNode, node, elements, globalOptions, callback) {

    elements.queryResultSelect.multipleSelect({
        maxHeight: 300,
        dropWidth: 320,
        width: 320,
        single: false,
        filter: true,
        selectAll: false,
        filterPlaceholder: RED._("node-red-contrib-deconz/in:multiselect.filter_devices"),
        numberDisplayed: 1,
        disableIfEmpty: true,
        showClear: false,
        hideOptgroupCheckboxes: true,
        filterGroup: true,
        // Make the select read only, not pretty but multipleSelect don't allow readonly list, disable hide all options
        onClick: function (view) {
            elements.queryResultSelect.multipleSelect(view.selected ? 'uncheck' : 'check', view.value)
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
        single: !(elements.deviceSelect.attr('multiple') === "multiple"),
        filter: true,
        filterPlaceholder: RED._("node-red-contrib-deconz/in:multiselect.filter_devices"),
        includeResetOption: true,
        includeResetDivider: true,
        resetText: RED._("node-red-contrib-deconz/in:multiselect.refresh"),
        numberDisplayed: 1,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: RED._("node-red-contrib-deconz/in:multiselect.none_selected"),
        showClear: true
    });

    // Initial call to populate item list
    deconz_updateDeviceList(serverNode, node, elements, {
        refresh: false,
        useSavedData: true,
        callback: callback
    }, globalOptions);

    let refreshCallback = function () {
        deconz_updateItemStateList(serverNode, node, elements, {
            useSelectedData: true,
            callback: function () {
                deconz_updateOutputList(serverNode, node, elements, {}, globalOptions)
            }
        }, globalOptions)

    };
    // onChange event handler in case a new controller gets selected
    elements.serverSelect.change(function (event) {
        deconz_updateDeviceList(serverNode, node, elements, {
            useSavedData: true,
            callback: refreshCallback
        }, globalOptions);
    });

    // onClick event handler for refresh button
    elements.refreshButton.click(function (event) {
        // Force a refresh of the item list
        deconz_updateDeviceList(serverNode, node, elements, {
            useSelectedData: true,
            callback: refreshCallback
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
        targetSelect = elements.queryResultSelect
    }

    if (options.useSelectedData) {
        itemsSelected = targetSelect.multipleSelect('getSelects')
    }

    // Remove all previous and/or static (if any) elements from 'select' input element
    targetSelect.children().remove();

    if (serverNode) {

        let params = {
            controllerID: serverNode.id,
            forceRefresh: options.refresh,
        }

        if (options.queryMode) {
            params.query = elements.querySelect.typedInput('value');
            params.queryType = elements.querySelect.typedInput('type');
            params.nodeID = node.id;
        }

        $.getJSON('deconz/itemlist', params)
            .done(function (data, textStatus, jqXHR) {

                try {
                    let itemList = {};

                    Object.keys(data.items).forEach(function (key) {
                        let item = data.items[key]
                        let device_type = item.meta.type;

                        // Filter on device_type
                        // TODO probably removed when allow setting config of sensors
                        if (globalOptions.itemList.deviceType && globalOptions.itemList.deviceType !== device_type) {
                            return true;
                        }

                        // Keep only battery powered devices
                        if (globalOptions.itemList.batteryFilter &&
                            (!("meta" in item)
                                || !("config" in item.meta)
                                || !("battery" in item.meta.config))
                        ) {
                            return true;
                        }

                        if (itemList[device_type] === undefined) {
                            itemList[device_type] = [];
                        }

                        itemList[device_type].push(item)
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
                            let meta = itemList[group_key][device_key].meta

                            let label = meta.name;
                            if (meta.device_type === "groups") {
                                label += ' (lights: ' + meta.lights.length;
                                if (meta.scenes.length) {
                                    label += ", scenes: " + meta.scenes.length
                                }
                                label += ")"
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
                                    query.device_type = "groups"
                                    query.device_id = Number(savedData.device.substr(6))
                                } else {
                                    query.uniqueid = savedData.device
                                }

                                $.getJSON('deconz/itemlist', {
                                    controllerID: serverNode.id,
                                    forceRefresh: options.refresh,
                                    query: JSON.stringify(query)
                                }).done(function (data, textStatus, jqXHR) {
                                    itemsSelected = []
                                    Object.keys(data.items).forEach(function (key) {
                                        if (data.items[key].query_match) {
                                            itemsSelected.push(data.items[key].path)
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

function deconz_initNodeEditorStateList(serverNode, node, elements, globalOptions, callback) {
    // Initialize bootstrap multiselect form

    let complete = globalOptions.stateList.defaultValue;
    let each_state = globalOptions.stateList.eachStateValue;

    elements.stateSelect.multipleSelect({
        numberDisplayed: 1,
        dropWidth: 320,
        width: 320,
        single: elements.stateSelect.attr('multiple') !== "multiple",
        selectAll: false,
        filter: true,
        onClick: function (view) {
            if (!view.selected) return;
            switch (view.value) {
                case complete:
                case each_state:
                    elements.stateSelect.multipleSelect('setSelects', [view.value]);
                    break;
                default:
                    elements.stateSelect.multipleSelect('uncheck', complete);
                    elements.stateSelect.multipleSelect('uncheck', each_state);
                    break;
            }
        },
        onUncheckAll: function () {
            elements.stateSelect.multipleSelect('setSelects', globalOptions.stateList.defaultValue)
        },
        onOptgroupClick: function (view) {
            if (!view.selected) return;
            elements.stateSelect.multipleSelect('uncheck', globalOptions.stateList.defaultValue);
            elements.stateSelect.multipleSelect('uncheck', globalOptions.stateList.eachStateValue);
        },
    });

    // Initial call to populate state list
    deconz_updateItemStateList(serverNode, node, elements, {
        refresh: false,
        useSavedData: true,
        callback: callback
    }, globalOptions);

    let refreshCallback = function () {
        deconz_updateOutputList(serverNode, node, elements, {}, globalOptions)
    };

    // onChange event handler in case a new controller gets selected
    elements.serverSelect.change(function (event) {
        deconz_updateItemStateList(serverNode, node, elements, {
            useSavedData: true,
            callback: refreshCallback
        }, globalOptions);
    });

    // onClick event handler for refresh button
    elements.deviceSelect.change(function (event) {
        // Force a refresh of the item list
        deconz_updateItemStateList(serverNode, node, elements, {
            useSelectedData: true,
            callback: refreshCallback
        }, globalOptions);
    });

}

function deconz_updateItemStateList(serverNode, node, elements, options, globalOptions) {
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
        savedData = node.state;
        if (!Array.isArray(savedData)) {
            savedData = [savedData];
        }
        if (savedData.length === 0) {
            savedData = [globalOptions.stateList.defaultValue];
        }
    }

    if (options.useSelectedData) {
        statesSelected = elements.stateSelect.multipleSelect('getSelects')
    }

    // Remove all previous and/or static (if any) elements from 'select' input element
    elements.stateSelect.children().remove();

    let devices = elements.deviceSelect.multipleSelect('getSelects');

    let finishUpdate = function () {

        elements.stateSelect.multipleSelect('enable');
        elements.stateSelect.multipleSelect('refresh');

        if (options.useSavedData) elements.stateSelect.multipleSelect('setSelects', savedData);
        if (options.useSelectedData) elements.stateSelect.multipleSelect('setSelects', statesSelected);

        if (elements.stateSelect.multipleSelect('getSelects').length === 0) {
            elements.stateSelect.multipleSelect('setSelects', globalOptions.stateList.defaultValue);
        }

        options.callback(true);
    }

    if (queryMode) {
        elements.stateSelect.html(
            '<option value="0">' + RED._("node-red-contrib-deconz/in:multiselect.complete_payload") + '</option>' +
            '<option value="1">' + RED._("node-red-contrib-deconz/in:multiselect.each_state") + '</option>'
        );
        finishUpdate();

    } else if (serverNode && devices) {
        $.getJSON('deconz/statelist', {
            controllerID: serverNode.id,
            devices: JSON.stringify(devices)
        })
            .done(function (data, textStatus, jqXHR) {

                try {
                    let html = '<option value="0">' + RED._("node-red-contrib-deconz/in:multiselect.complete_payload") + '</option>'

                    if (!$.isEmptyObject(data.count)) {
                        html += '<option value="1">' + RED._("node-red-contrib-deconz/in:multiselect.each_state") + '</option>'
                    }

                    elements.stateSelect.html(html);

                    let groupHtml = $('<optgroup/>', {label: "State"});

                    Object.keys(data.count).sort().forEach(function (state) {
                        let sample = data.sample[state];
                        let count = data.count[state];
                        let label = state;
                        if (count !== devices.length) {
                            label += " [" + count + "/" + devices.length + "]";
                        }
                        label += " (" + sample + ")";

                        $('<option>' + label + '</option>').attr('value', state).appendTo(groupHtml);
                    })

                    if (!$.isEmptyObject(data.count)) {
                        groupHtml.appendTo(elements.stateSelect);
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
                elements.stateSelect.multipleSelect('disable');
                elements.stateSelect.multipleSelect('refresh');
                //console.error(`Error: ${errorThrown}`);
                options.callback(false);
            });

    } else {
        // Disable item selection if no (valid) controller was selected
        elements.stateSelect.multipleSelect('disable');
        elements.stateSelect.multipleSelect('refresh');
        options.callback(false);
    }
}


function deconz_initNodeEditorOutputList(serverNode, node, elements, globalOptions, callback) {
    // Initialize bootstrap multiselect form
    elements.outputSelect.multipleSelect({
        maxHeight: 300,
        dropWidth: 320,
        single: true,
        placeholder: "Always"
    });


    // Initial call to populate output list
    deconz_updateOutputList(serverNode, node, elements, {
        useSavedData: true,
        callback: callback
    }, globalOptions);

    elements.stateSelect.on("change", function () {
        deconz_updateOutputList(serverNode, node, elements, {}, globalOptions);
    });

}

function deconz_updateOutputList(serverNode, node, elements, options, globalOptions) {

    options = $.extend({
        useSavedData: false,
        callback: $.noop
    }, options);

    // If Complete state payload selected
    if (elements.stateSelect.multipleSelect('getSelects').includes(globalOptions.stateList.defaultValue)) {
        elements.outputSelect.multipleSelect('disable');
        elements.outputSelect.multipleSelect('setSelects', 'always');
    } else {
        elements.outputSelect.multipleSelect('enable')
        if (options.useSavedData) elements.outputSelect.multipleSelect('setSelects', node.output)
    }

    options.callback(true);
}


function deconz_initSettings(callback, inputSettings) {
    settings = inputSettings;
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
        alert("Remote server did not answer. Internet problems?");
    });
}

//
// function deconz_getApiKey(callback, ip, port) {
//     $.ajax({
//         type: "POST",
//         dataType: 'json',
//         url: 'http://'+settings.ip+':'+settings.port+'/api',
//         data: JSON.stringify({"devicetype":"Node-red"}),
//         success: function(response){
//             var resp = response[0];
//             if ('success' in resp) {
//                 settings.apikey = resp.success.username;
//
//                 $.ajax({
//                     type: "GET",
//                     dataType: 'json',
//                     url: 'http://192.168.1.20:'+settings.port+'/api/'+settings.apikey+'/config',
//                     success: function(response){
//                         if ('websocketport' in response) {
//                             settings.ws_port = response.websocketport;
//                         }
//                     },
//                     error: function (err) {
//                         alert(err);
//                         alert('2');
//                         console.log(err);
//                         // var response = (JSON.parse(err.responseText));
//                         // var resp = response[0];
//                         // if ('error' in resp) {
//                         //     alert(resp.error.description);
//                         // }
//                     },
//                     complete: function() {
//                         callback(settings);
//                         return settings;
//                     }
//                 });
//             }
//         },
//         error: function (jqXHR, exception) {
//             var msg = '';
//             if (jqXHR.status === 0) {
//                 msg = 'Not connect.\n Verify Network.';
//             } else if (jqXHR.status == 404) {
//                 msg = 'Requested page not found. [404]';
//             } else if (jqXHR.status == 500) {
//                 msg = 'Internal Server Error [500].';
//             } else if (exception === 'parsererror') {
//                 msg = 'Requested JSON parse failed.';
//             } else if (exception === 'timeout') {
//                 msg = 'Time out error.';
//             } else if (exception === 'abort') {
//                 msg = 'Ajax request aborted.';
//             } else {
//                 msg = 'Uncaught Error.\n' + jqXHR.responseText;
//             }
//             alert(msg);
//         },
//         complete: function() {
//
//         }
//     });
// }


/**
 * truncateWithEllipses
 *
 * Utility function to truncate long strings with elipsis ('...')
 *
 */
function deconz_truncateWithEllipses(text, max = 30) {
    if (text) {
        return text.substr(0, max - 1) + (text.length > max ? '&hellip;' : '');
    } else {
        return text;
    }
}

function deconz_filterDeviceName(name) {
    var result = name.replace(/ *\([^)]*\) */g, ""); //remove (lights: 1)
    result = result.replace(new RegExp('●', 'g'), '');
    result = result.trim();
    return result;

}