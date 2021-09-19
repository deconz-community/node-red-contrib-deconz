function deconz_gatewayScanner(nodeItem, selectedItemElementName, options = {}) {
    $.getJSON('node-red-contrib-deconz/gwscanner', {})
        .done(function (data, textStatus, jqXHR) {
            console.log(data);
        }).fail(function (jqXHR, textStatus, errorThrown) {
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
    let result = name.replace(/ *\([^)]*\) */g, ""); //remove (lights: 1)
    result = result.replace(new RegExp('●', 'g'), '');
    result = result.trim();
    return result;

}