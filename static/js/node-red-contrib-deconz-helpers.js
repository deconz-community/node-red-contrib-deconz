function deconz_gatewayScanner(nodeItem, selectedItemElementName, options = {}) {
    $.getJSON('deconz/gwscanner', {})
        .done(function (data, textStatus, jqXHR) {
            console.log(data);
        }).fail(function (jqXHR, textStatus, errorThrown) {});
}

function deconz_getItemList(nodeItem, selectedItemElementName, options = {}) {

    options = $.extend({
        filterType:'',
        disableReadonly:false,
        refresh:false,
        allowEmpty:false,
        deviceType:false,
        batteryFilter:false,
        groups:false
    }, options);

    function deconz_updateItemList(controller, selectedItemElement, itemName, refresh = false) {
        // Remove all previous and/or static (if any) elements from 'select' input element
        selectedItemElement.children().remove();


        if (controller) {
            $.getJSON('deconz/itemlist', {
                controllerID: controller.id,
                forceRefresh: refresh
            })
                .done(function (data, textStatus, jqXHR) {
                    try {
                        // if (options.allowEmpty) {
                            // selectedItemElement.html('<option value="" disabled selected>Select device</option>');
                        // }

                        var optgroup = '';
                        var disabled = '';
                        var nameSuffix = '';
                        // var selected = false;
                        var groupHtml = '';
                        var prevName = '';

                        var itemList = [];
                        var groupList = [];
                        $.each(data.items, function(index, value) {
                            if (value.meta.device_type === "groups") {
                                groupList.push(value)
                            } else {
                                itemList.push(value)
                            }
                        });
                        var itemsByName = itemList.slice(0);
                        if ( groupList.length > 0 ) {
                            var groupsByName = groupList.slice(0);
                            groupsByName.sort(function(a,b) {
                                var x = a.device_name.toLowerCase();
                                var y = b.device_name.toLowerCase();
                                return x < y ? -1 : x > y ? 1 : 0;
                            });
                        }
                        itemsByName.sort(function(a,b) {
                            var x = a.device_name.toLowerCase();
                            var y = b.device_name.toLowerCase();
                            return x < y ? -1 : x > y ? 1 : 0;
                        });

                        if (options.groups && groupsByName) {
                            groupHtml = $('<optgroup/>', { label: RED._("node-red-contrib-deconz/in:multiselect.groups") });
                            groupHtml.appendTo(selectedItemElement);

                            $.each(groupsByName, function(index, value) {
                                if (value.meta.device_type == "groups") {
                                    $('<option  value="group_' + value.meta.id +'">&#9675;&nbsp;' +value.meta.name +' (lights: '+value.meta.lights.length+')</option>').appendTo(groupHtml);
                                }
                            });

                            groupHtml = $('<optgroup/>', { label: RED._("node-red-contrib-deconz/in:multiselect.devices") });
                            groupHtml.appendTo(selectedItemElement);
                        }

                        $.each(itemsByName, function(index, value) {
                            disabled = '';
                            nameSuffix = '';

                            if (options.deviceType && options.deviceType != value.meta.device_type) {
                                return true;
                            }

                            if (options.batteryFilter &&
                                (!("meta" in value)
                                || !("config" in value.meta)
                                || !("battery" in value.meta.config)
                                )
                            ) {

                                return true;
                            }
                            // selected = typeof(itemName) == 'string' && value.topic == itemName;


                            // //readonly
                            // if (typeof value.meta !== 'undefined'
                            //     && typeof value.meta.type !== 'undefined'
                            //     && options.disableReadonly
                            //     && parseInt(value.meta.readonly) == 1
                            // ) {
                            //     disabled = 'disabled="disabled"';
                            //     nameSuffix = 'readonly';
                            //     return true;
                            // }

                            // //filter by type
                            // if (typeof value.meta !== 'undefined'
                            //     && typeof value.meta.type !== 'undefined'
                            //     && options.filterType
                            //     && value.meta.type != options.filterType) {
                            //     disabled = 'disabled="disabled"';
                            //     nameSuffix = value.meta.type;
                            //     return true;
                            // }


                            // if (optgroup != value.device_type) {
                            //     groupHtml = $('<optgroup/>', { label: value.device_friendly_name});
                            //     groupHtml.appendTo(selectedItemElement);
                            //     optgroup = value.device_type;
                            // }

                            // $('<option value="' + value.topic + '"'+(selected ? 'selected' : '')+'>' + value.control_name + '</option>').appendTo(groupHtml);
                            //var name = (value.device_name).split(':',2);
                            var parentElement = (options.groups)?groupHtml:selectedItemElement;
                            $('<option'+ disabled+' value="' + value.uniqueid +'">&#9679;&nbsp;' + value.device_name + (nameSuffix?' ('+nameSuffix+')':'') +'</option>').appendTo(parentElement);
                        });

                        // Enable item selection
                        selectedItemElement.multiselect('enable');
                        // Finally, set the value of the input select to the selected value
                        selectedItemElement.val(itemName);
                        // // Rebuild bootstrap multiselect form
                        selectedItemElement.multiselect('rebuild');
                        // // Trim selected item string length with elipsis
                        var selectItemSpanElement = $(`span.multiselect-selected-text:contains("${itemName}")`);
                        var sHTML = selectItemSpanElement.html();
                        selectItemSpanElement.html(deconz_truncateWithEllipses(sHTML, 35));
                    } catch (error) {
                        console.error('Error #4534');
                        console.log(error);
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    // Disable item selection if no items were retrieved
                    selectedItemElement.multiselect('disable');
                    selectedItemElement.multiselect('refresh');
                    //console.error(`Error: ${errorThrown}`);
                });

        } else {
            // Disable item selection if no (valid) controller was selected
            selectedItemElement.multiselect('disable');
            selectedItemElement.multiselect('refresh');
        }
    }


    var deServerElement = $('#node-input-server');
    var refreshListElement = $('#force-refresh');
    var selectedItemElement = $(selectedItemElementName);


    // Initialize bootstrap multiselect form
    selectedItemElement.multiselect({
        enableFiltering: true,
        enableCaseInsensitiveFiltering: true,
        filterPlaceholder: RED._("node-red-contrib-deconz/in:multiselect.filter_devices"),
        includeResetOption: true,
        includeResetDivider: true,
        resetText: RED._("node-red-contrib-deconz/in:multiselect.refresh"),
        numberDisplayed: 1,
        maxHeight: 300,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: RED._("node-red-contrib-deconz/in:multiselect.none_selected"),
        buttonWidth: '70%',
    });

    // Initial call to populate item list
    deconz_updateItemList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, false);
    // onChange event handler in case a new controller gets selected
    deServerElement.change(function (event) {
        deconz_updateItemList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, true);
    });
    refreshListElement.click(function (event) {
        // Force a refresh of the item list
        deconz_updateItemList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, true);
    });
}


function deconz_getItemStateList(nodeItem, selectedItemElementName, options = {}) {

    options = $.extend({
        filterType:'',
        disableReadonly:false,
        refresh:false
    }, options);

    function deconz_updateItemStateList(controller, selectedItemElement, itemName) {
        // Remove all previous and/or static (if any) elements from 'select' input element
        selectedItemElement.children().remove();

        if (controller) {
            $.getJSON('deconz/statelist', {
                controllerID: controller.id,
                uniqueid:$('#node-input-device').val()
            })
                .done(function (data, textStatus, jqXHR) {
                    try {

                        selectedItemElement.html('<option value="0">'+ RED._("node-red-contrib-deconz/in:multiselect.complete_payload")+'</option>');


                        $.each(data, function(index, value) {
                            // $('<option  value="' + index +'">'+index+'</option>').appendTo(selectedItemElement);
                            $('<option  value="' + index +'">'+index+' ('+value+')</option>').appendTo(selectedItemElement);
                        });

                        // Enable item selection
                        selectedItemElement.multiselect('enable');
                        // Finally, set the value of the input select to the selected value
                        selectedItemElement.val(itemName);
                        // Rebuild bootstrap multiselect form
                        selectedItemElement.multiselect('rebuild');
                        // Trim selected item string length with elipsis
                        var selectItemSpanElement = $(`span.multiselect-selected-text:contains("${itemName}")`);
                        var sHTML = selectItemSpanElement.html();
                        selectItemSpanElement.html(deconz_truncateWithEllipses(sHTML, 35));

                    } catch (error) {
                        console.error('Error #4534');
                        console.log(error);
                    }

                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    // Disable item selection if no items were retrieved
                    selectedItemElement.multiselect('disable');
                    selectedItemElement.multiselect('refresh');
                    //console.error(`Error: ${errorThrown}`);
                });

        } else {
            // Disable item selection if no (valid) controller was selected
            selectedItemElement.multiselect('disable');
            selectedItemElement.multiselect('refresh');
        }
    }


    var deServerElement = $('#node-input-server');
    var selectedItemElement = $(selectedItemElementName);




    // Initialize bootstrap multiselect form
    selectedItemElement.multiselect({
        numberDisplayed: 1,
        maxHeight: 300,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: RED._("node-red-contrib-deconz/in:multiselect.complete_payload"),
        buttonWidth: '70%',
    });


    // Initial call to populate item list
    deconz_updateItemStateList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem);

    // onChange event handler in case a new controller gets selected
    deServerElement.change(function (event) {
        deconz_updateItemStateList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem);
    });
}


function deconz_initSettings(callback, inputSettings) {
    var settings = {
        name:false,
        ip:false,
        port:false,
        apikey:false,
        ws_port:false
    };

    $.get("https://dresden-light.appspot.com/discover", function( data ) {}).done(function(data) {
        if (!data.length) {
            alert( "Can't discover your device, enter settings manually" );
            return false;
        }

        settings.name = data[0].name;
        settings.ip = data[0].internalipaddress;
        settings.port = data[0].internalport;

        // deconz_getApiKey(callback, settings.ip, settings.port);

        $.ajax({
            type: "POST",
            dataType: 'json',
            url: 'http://'+settings.ip+':'+settings.port+'/api',
            data: JSON.stringify({"devicetype":"Node-red"}),
            success: function(response){
                var resp = response[0];
                if ('success' in resp) {
                    settings.apikey = resp.success.username;

                    $.ajax({
                        type: "GET",
                        dataType: 'json',
                        url: 'http://'+settings.ip+':'+settings.port+'/api/'+settings.apikey+'/config',
                        success: function(response){
                            if ('websocketport' in response) {
                                settings.ws_port = response.websocketport;
                            }
                        },
                        error: function (err) {
                            var response = (JSON.parse(err.responseText));
                            var resp = response[0];
                            if ('error' in resp) {
                                alert(resp.error.description);
                            }
                        },
                        complete: function() {
                            callback(settings);
                            return settings;
                        }
                    });
                }
            },
            error: function (err) {
                var response = (JSON.parse(err.responseText));
                var resp = response[0];
                if ('error' in resp) {
                    alert(resp.error.description);
                }

                callback(settings);
                return settings;
            },
            complete: function() {

            }
        });
    }).fail(function() {
        alert( "Remote server did not answer. Internet problems?" );
    });
}

function deconz_getApiKey(callback, ip, port) {
    $.ajax({
        type: "POST",
        dataType: 'json',
        url: 'http://'+settings.ip+':'+settings.port+'/api',
        data: JSON.stringify({"devicetype":"Node-red"}),
        success: function(response){
            var resp = response[0];
            if ('success' in resp) {
                settings.apikey = resp.success.username;

                $.ajax({
                    type: "GET",
                    dataType: 'json',
                    url: 'http://'+settings.ip+':'+settings.port+'/api/'+settings.apikey+'/config',
                    success: function(response){
                        if ('websocketport' in response) {
                            settings.ws_port = response.websocketport;
                        }
                    },
                    error: function (err) {
                        var response = (JSON.parse(err.responseText));
                        var resp = response[0];
                        if ('error' in resp) {
                            alert(resp.error.description);
                        }
                    },
                    complete: function() {
                        callback(settings);
                        return settings;
                    }
                });
            }
        },
        error: function (err) {
            var response = (JSON.parse(err.responseText));
            var resp = response[0];
            if ('error' in resp) {
                alert(resp.error.description);
            }

            callback(settings);
            return settings;
        },
        complete: function() {

        }
    });
}


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
    var result =  name.replace(/ *\([^)]*\) */g, ""); //remove (lights: 1)
    result = result.replace(new RegExp('●', 'g'), '');
    result = result.trim();
    return result;

}