'use strict';
class DeconzHelper {
    static convertRange(value, r1, r2 ) {
        return Math.ceil((value - r1[0]) * (r2[1] - r2[0]) / ( r1[1] - r1[0] ) + r2[0]);
    }
}
module.exports = DeconzHelper;