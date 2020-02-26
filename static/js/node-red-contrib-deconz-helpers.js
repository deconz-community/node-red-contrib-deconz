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
                                    $('<option  value="group_' + value.meta.id +'">&#9675;&nbsp;' +value.meta.name +' (lights: '+value.meta.lights.length+(value.meta.scenes.length?", scenes: "+value.meta.scenes.length:"")+')</option>').appendTo(groupHtml);
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

                            var parentElement = (options.groups && groupHtml)?groupHtml:selectedItemElement;
                            $('<option'+ disabled+' value="' + value.uniqueid +'">&#9679;&nbsp;' + value.device_name + (nameSuffix?' ('+nameSuffix+')':'') +'</option>').appendTo(parentElement);
                        });

                        // Enable item selection
                        selectedItemElement.multipleSelect('enable');
                        // Finally, set the value of the input select to the selected value
                        selectedItemElement.val(itemName);
                        // // Rebuild bootstrap multiselect form
                        selectedItemElement.multipleSelect('refresh');
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
                    selectedItemElement.multipleSelect('disable');
                    selectedItemElement.multipleSelect('refresh');
                    //console.error(`Error: ${errorThrown}`);
                });

        } else {
            // Disable item selection if no (valid) controller was selected
            selectedItemElement.multipleSelect('disable');
            selectedItemElement.multipleSelect('refresh');
        }
    }


    var deServerElement = $('#node-input-server');
    var refreshListElement = $('#force-refresh');
    var selectedItemElement = $(selectedItemElementName);

    var attr = $(this).attr('multiple');


    // Initialize bootstrap multiselect form
    selectedItemElement.multipleSelect({
        maxHeight: 300,
        dropWidth: 320,
        width: 320,
        single: !(typeof $(this).attr('multiple') !== typeof undefined && $(this).attr('multiple') !== false),
        filter: true,
        filterPlaceholder: RED._("node-red-contrib-deconz/in:multiselect.filter_devices"),

        includeResetOption: true,
        includeResetDivider: true,
        resetText: RED._("node-red-contrib-deconz/in:multiselect.refresh"),
        numberDisplayed: 1,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: RED._("node-red-contrib-deconz/in:multiselect.none_selected")
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

        var uniqueId = $('#node-input-device').val();
        if (controller && uniqueId) {
            $.getJSON('deconz/statelist', {
                controllerID: controller.id,
                uniqueid:uniqueId
            })
                .done(function (data, textStatus, jqXHR) {
                    try {

                        selectedItemElement.html('<option value="0">'+ RED._("node-red-contrib-deconz/in:multiselect.complete_payload")+'</option>');


                        $.each(data, function(index, value) {
                            // $('<option  value="' + index +'">'+index+'</option>').appendTo(selectedItemElement);
                            $('<option  value="' + index +'">'+index+' ('+value+')</option>').appendTo(selectedItemElement);
                        });

                        // Enable item selection
                        selectedItemElement.multipleSelect('enable');


                        // Finally, set the value of the input select to the selected value
                        if (selectedItemElement.find('option[value='+itemName+']').length) {
                            selectedItemElement.val(itemName);
                        } else {
                            selectedItemElement.val(selectedItemElement.find('option').eq(0).attr('value'));
                        }
                        selectedItemElement.multipleSelect('destroy');

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
                    selectedItemElement.multipleSelect('disable');
                    selectedItemElement.multipleSelect('refresh');
                    //console.error(`Error: ${errorThrown}`);
                });

        } else {
            // Disable item selection if no (valid) controller was selected
            selectedItemElement.multipleSelect('disable');
            selectedItemElement.multipleSelect('refresh');
        }
    }


    var deServerElement = $('#node-input-server');
    var selectedItemElement = $(selectedItemElementName);




    // Initialize bootstrap multiselect form
    selectedItemElement.multipleSelect('destroy');
    selectedItemElement.multipleSelect({
        numberDisplayed: 1,
        dropWidth: 320,
        width: 320,
        single: !(typeof $(this).attr('multiple') !== typeof undefined && $(this).attr('multiple') !== false)
    });


    // Initial call to populate item list
    deconz_updateItemStateList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem);

    // onChange event handler in case a new controller gets selected
    deServerElement.change(function (event) {
        deconz_updateItemStateList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem);
    });
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

    $.get("https://phoscon.de/discover", function( data ) {}).done(function(data) {
        if (!data.length) {
            alert( "Can't discover your device, enter settings manually" );
            return false;
        }

        if ((settings.name).length <= 0) settings.name = data[0].name;
        if ((settings.ip).length <= 0) settings.ip = data[0].internalipaddress;
        if ((settings.port).length <= 0) settings.port = data[0].internalport;

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
                                var response  = (JSON.parse(jqXHR.responseText));
                                var resp = response[0];
                                if ('error' in resp) {
                                    msg = resp.error.description;
                                } else {
                                    msg = 'Uncaught Error.\n' + jqXHR.responseText;
                                }
                            }
                            alert(msg);
                        },
                        complete: function() {
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
                    var response  = (JSON.parse(jqXHR.responseText));
                    var resp = response[0];
                    if ('error' in resp) {
                        msg = resp.error.description;
                    } else {
                        msg = 'Uncaught Error.\n' + jqXHR.responseText;
                    }
                }
                alert(msg);
            },

            complete: function() {

            }
        });
    }).fail(function() {
        alert( "Remote server did not answer. Internet problems?" );
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
    var result =  name.replace(/ *\([^)]*\) */g, ""); //remove (lights: 1)
    result = result.replace(new RegExp('●', 'g'), '');
    result = result.trim();
    return result;

}